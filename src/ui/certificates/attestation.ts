import type { ConsultantCheck } from "@/domain/certificates";

/** Texte d'attestation construit à partir des seuls contrôles réellement effectués. */
export function consultantAttestation(checks: ConsultantCheck[]): string {
  const parts: string[] = [];
  if (checks.includes("IDENTITY")) parts.push("son identité");
  if (checks.includes("DIPLOMAS")) parts.push("l'authenticité de ses diplômes");
  if (checks.includes("REFERENCES")) parts.push("ses références professionnelles");
  if (checks.includes("EXPERIENCE")) parts.push("la réalité de son expérience professionnelle");
  if (checks.includes("SKILLS")) parts.push("la pertinence de ses compétences dans ses domaines d'expertise");
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}` : parts[0] ?? "";
  return `a été vérifié(e) et reconnu(e) comme consultant(e) qualifié(e) sur la plateforme Talent Bridge. Nous certifions avoir contrôlé ${list}.`;
}
