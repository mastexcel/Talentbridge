import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db";
import { storage } from "@/infrastructure/storage/storage";
import { route } from "@/infrastructure/http/handler";
import { DomainError } from "@/domain/errors";
import { readFileForUser, verifyFileLink } from "@/application/file.service";

/**
 * Lecture d'un document : autorisation serveur (session) OU lien signé temporaire (?e=&s=).
 * Stockage S3 : redirection vers une URL pré-signée de 5 minutes ; local : contenu servi en pièce jointe.
 */
export const GET = route<{ id: string }>({}, async ({ req, user, params }) => {
  const signed = verifyFileLink(params.id, req.nextUrl.searchParams.get("e"), req.nextUrl.searchParams.get("s"));
  const file = signed ? await prisma.storedFile.findUnique({ where: { id: params.id } }) : await readFileForUser(user, params.id);
  if (!file) throw new DomainError("NOT_FOUND", "Document introuvable.");
  const url = storage().temporaryUrl(file.storageKey, 300);
  if (url) return NextResponse.redirect(url);
  let bytes: Uint8Array;
  try {
    bytes = await storage().get(file.storageKey);
  } catch {
    throw new DomainError("NOT_FOUND", "Contenu du document indisponible (document de démonstration sans fichier réel).");
  }
  const inline = file.mimeType.startsWith("image/") || file.mimeType === "application/pdf";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": file.mimeType,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.filename)}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
