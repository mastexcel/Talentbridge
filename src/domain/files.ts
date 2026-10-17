/**
 * Validation des fichiers déposés : liste blanche de types, taille maximale,
 * contrôle de la signature binaire (« magic bytes ») — l'extension et le type MIME
 * déclarés par le navigateur ne suffisent pas.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string[]; test: (b: Uint8Array) => boolean }[] = [
  { mime: "application/pdf", ext: ["pdf"], test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { mime: "image/png", ext: ["png"], test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", ext: ["jpg", "jpeg"], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", ext: ["webp"], test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 },
  // DOCX / XLSX : conteneurs ZIP
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ["docx"], test: (b) => b[0] === 0x50 && b[1] === 0x4b },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ["xlsx"], test: (b) => b[0] === 0x50 && b[1] === 0x4b },
];

export type FileCheck = { ok: true; mime: string; ext: string } | { ok: false; reason: string };

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "fichier";
  return base.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(0, 120) || "fichier";
}

export function checkFile(filename: string, bytes: Uint8Array, allowed: readonly string[] = ["pdf", "png", "jpg", "jpeg", "webp", "docx", "xlsx"]): FileCheck {
  if (bytes.length === 0) return { ok: false, reason: "Fichier vide." };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, reason: "Fichier trop volumineux (10 Mo maximum)." };
  const ext = sanitizeFilename(filename).split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(ext)) return { ok: false, reason: `Type de fichier non autorisé (.${ext}).` };
  const sig = SIGNATURES.find((s) => s.ext.includes(ext));
  if (!sig || !sig.test(bytes)) return { ok: false, reason: "Le contenu du fichier ne correspond pas à son extension." };
  return { ok: true, mime: sig.mime, ext };
}

export const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"] as const;
export const DOC_EXT = ["pdf", "docx", "png", "jpg", "jpeg"] as const;
