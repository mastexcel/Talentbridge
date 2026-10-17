import { DomainError } from "@/domain/errors";
import { route } from "@/infrastructure/http/handler";
import { FILE_PURPOSES, uploadFile, type FilePurpose } from "@/application/file.service";

/** Dépôt multipart (champ `file`, `purpose`, `organizationId` facultatif). Validation du contenu côté serveur. */
export const POST = route({ auth: true, rateLimit: { limit: 30, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = String(form?.get("purpose") ?? "");
  if (!(file instanceof File)) throw new DomainError("VALIDATION", "Aucun fichier reçu.");
  if (!FILE_PURPOSES.includes(purpose as FilePurpose)) throw new DomainError("VALIDATION", "Type de document invalide.");
  const organizationId = (form?.get("organizationId") as string | null) || null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { file: await uploadFile(user!, { filename: file.name, bytes, purpose: purpose as FilePurpose, organizationId }) };
});
