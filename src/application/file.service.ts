/**
 * Dépôt et lecture des fichiers. Lecture toujours autorisée côté serveur selon la relation
 * de l'utilisateur au fichier ; liens de partage temporaires signés (HMAC, 10 minutes).
 */
import { prisma, type Db } from "@/infrastructure/db";
import { storage } from "@/infrastructure/storage/storage";
import { hmacSha256, randomToken, safeEqual, sha256 } from "@/infrastructure/crypto";
import { env } from "@/infrastructure/env";
import { DomainError } from "@/domain/errors";
import { checkFile, sanitizeFilename } from "@/domain/files";
import { hasAdminPermission, orgRoleCan, type OrgRole } from "@/domain/permissions";
import type { SessionUser } from "./auth.service";
import { audit } from "./audit.service";

export const FILE_PURPOSES = ["CV", "PHOTO", "VERIFICATION", "QUALIFICATION", "MISSION", "TENDER", "PROPOSAL", "DELIVERABLE", "COURSE", "ORG_DOCUMENT", "PORTFOLIO"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

const ALLOWED_BY_PURPOSE: Record<FilePurpose, string[]> = {
  CV: ["pdf", "docx"],
  PHOTO: ["png", "jpg", "jpeg", "webp"],
  VERIFICATION: ["pdf", "png", "jpg", "jpeg"],
  QUALIFICATION: ["pdf", "png", "jpg", "jpeg"],
  MISSION: ["pdf", "docx", "xlsx"],
  TENDER: ["pdf", "docx", "xlsx"],
  PROPOSAL: ["pdf", "docx", "xlsx"],
  DELIVERABLE: ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"],
  COURSE: ["pdf", "docx", "png", "jpg", "jpeg"],
  ORG_DOCUMENT: ["pdf", "png", "jpg", "jpeg"],
  PORTFOLIO: ["pdf", "png", "jpg", "jpeg", "webp"],
};

export async function uploadFile(
  user: SessionUser,
  input: { filename: string; bytes: Uint8Array; purpose: FilePurpose; organizationId?: string | null },
  db: Db = prisma,
) {
  if (input.organizationId && !user.memberships.some((m) => m.organizationId === input.organizationId)) {
    throw new DomainError("FORBIDDEN", "Vous n'êtes pas membre de cette organisation.");
  }
  const check = checkFile(input.filename, input.bytes, ALLOWED_BY_PURPOSE[input.purpose]);
  if (!check.ok) throw new DomainError("VALIDATION", check.reason);
  const filename = sanitizeFilename(input.filename);
  const key = `${input.purpose.toLowerCase()}/${new Date().getUTCFullYear()}/${randomToken(16)}.${check.ext}`;
  await storage().put(key, input.bytes, check.mime);
  const file = await db.storedFile.create({
    data: {
      ownerUserId: user.id,
      organizationId: input.organizationId ?? null,
      storageKey: key,
      filename,
      mimeType: check.mime,
      sizeBytes: input.bytes.length,
      sha256: sha256(Buffer.from(input.bytes).toString("base64")),
      visibility: input.purpose === "PHOTO" ? "PUBLIC" : "PRIVATE",
      purpose: input.purpose,
    },
    select: { id: true, filename: true, mimeType: true, sizeBytes: true, purpose: true, createdAt: true },
  });
  return file;
}

/**
 * Droit de lecture d'un fichier :
 *  - propriétaire, ou membre de l'organisation rattachée ;
 *  - fichier public (photo de profil) ;
 *  - organisation recevant une candidature qui le référence (CV, propositions) ;
 *  - membres d'un projet pour les livrables du projet ;
 *  - administrateurs selon leur périmètre (vérification, validation, finance).
 */
export async function canReadFile(user: SessionUser | null, fileId: string, db: Db = prisma): Promise<boolean> {
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return false;
  if (file.visibility === "PUBLIC") return true;
  if (!user) return false;
  if (file.ownerUserId === user.id) return true;
  if (file.organizationId && user.memberships.some((m) => m.organizationId === file.organizationId)) return true;
  if (hasAdminPermission(user, "EXPERTS_VERIFY") && ["VERIFICATION", "QUALIFICATION", "CV"].includes(file.purpose)) return true;
  if (hasAdminPermission(user, "ORGS_VALIDATE") && file.purpose === "ORG_DOCUMENT") return true;
  if (hasAdminPermission(user, "MARKETPLACE_MODERATE") && ["MISSION", "PROPOSAL", "TENDER"].includes(file.purpose)) return true;

  const reviewerOrgs = user.memberships.filter((m) => orgRoleCan(m.role as OrgRole, "applications.review")).map((m) => m.organizationId);
  if (reviewerOrgs.length) {
    const viaApplication = await db.application.findFirst({
      where: {
        mission: { organizationId: { in: reviewerOrgs } },
        OR: [{ technicalFileId: fileId }, { financialFileId: fileId }, { expert: { cvFileId: fileId } }],
      },
      select: { id: true },
    });
    if (viaApplication) return true;
  }
  // Pièces jointes des missions publiques : lisibles par tout utilisateur connecté.
  const missionAttachment = await db.missionAttachment.findFirst({ where: { fileId, mission: { status: { in: ["PUBLISHED", "SHORTLISTING"] }, visibility: { not: "INVITE_ONLY" } } }, select: { id: true } });
  if (missionAttachment) return true;
  const deliverable = await db.projectTask.findFirst({ where: { fileId, project: { members: { some: { userId: user.id } } } }, select: { id: true } });
  return !!deliverable;
}

export async function readFileForUser(user: SessionUser | null, fileId: string, db: Db = prisma) {
  if (!(await canReadFile(user, fileId, db))) throw new DomainError("FORBIDDEN", "Accès au document refusé.");
  const file = await db.storedFile.findUniqueOrThrow({ where: { id: fileId } });
  if (user && file.ownerUserId !== user.id && file.visibility === "PRIVATE") {
    await audit({ actorId: user.id, action: "file.read", entityType: "StoredFile", entityId: fileId, metadata: { purpose: file.purpose } }, db);
  }
  return file;
}

/** Lien temporaire signé (partage ponctuel sans session) : /api/v1/files/[id]?e=…&s=… */
export function signFileLink(fileId: string, ttlSec = 600, now = Date.now()): string {
  const e = Math.floor(now / 1000) + ttlSec;
  const s = hmacSha256(env().FILE_SIGNING_SECRET, `${fileId}.${e}`);
  return `/api/v1/files/${fileId}?e=${e}&s=${s}`;
}

export function verifyFileLink(fileId: string, e: string | null, s: string | null, now = Date.now()): boolean {
  if (!e || !s) return false;
  const exp = Number(e);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  return safeEqual(hmacSha256(env().FILE_SIGNING_SECRET, `${fileId}.${exp}`), s);
}
