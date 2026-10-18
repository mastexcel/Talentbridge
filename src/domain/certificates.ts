/**
 * Protocole de certification (règles pures).
 *
 * Formation (Academy) — avant la mise en ligne, il faut :
 *  1. une institution délivrante complète : nom, logo, cachet, nom et fonction du signataire,
 *     signature, et l'attestation que le déclarant est autorisé à utiliser ces éléments ;
 *  2. cette institution validée par Talent Bridge (personne différente du déclarant) ;
 *  3. un cosignataire Talent Bridge actif (nom, fonction, signature).
 * Certificat « Consultant vérifié » : identité ET diplômes/références vérifiés (badges actifs),
 * signé par le signataire Talent Bridge désigné pour les vérifications.
 */

export type IssuerStatus = "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED";

export interface IssuerFields {
  name: string | null;
  logoFileId: string | null;
  sealFileId: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signatureFileId: string | null;
  authorizationAttested: boolean;
}

export interface SignatoryFields {
  fullName: string;
  title: string;
  signatureFileId: string | null;
  isActive: boolean;
}

/** Éléments manquants pour qu'une institution puisse être soumise à validation. */
export function issuerMissing(i: IssuerFields): string[] {
  const missing: string[] = [];
  if (!i.name?.trim()) missing.push("nom de l'institution");
  if (!i.logoFileId) missing.push("logo de l'institution");
  if (!i.sealFileId) missing.push("cachet de l'institution");
  if (!i.signatoryName?.trim()) missing.push("nom du signataire de l'institution");
  if (!i.signatoryTitle?.trim()) missing.push("fonction du signataire de l'institution");
  if (!i.signatureFileId) missing.push("signature du signataire de l'institution");
  if (!i.authorizationAttested) missing.push("attestation d'autorisation d'usage du logo, du cachet et de la signature");
  return missing;
}

/** Ce qui empêche encore la mise en ligne d'une formation (liste vide = publiable). */
export function coursePublishBlockers(c: { lessons: number; issuer: (IssuerFields & { status: IssuerStatus }) | null; tbSignatory: SignatoryFields | null }): string[] {
  const blockers: string[] = [];
  if (c.lessons === 0) blockers.push("Ajoutez au moins une leçon.");
  if (!c.issuer) blockers.push("Renseignez l'institution qui délivre la formation (logo, cachet, signataire et signature).");
  else {
    const missing = issuerMissing(c.issuer);
    if (missing.length) blockers.push(`Institution incomplète : ${missing.join(", ")}.`);
    else if (c.issuer.status === "DRAFT") blockers.push("Soumettez l'institution à la validation de Talent Bridge.");
    else if (c.issuer.status === "SUBMITTED") blockers.push("Institution en attente de validation par Talent Bridge.");
    else if (c.issuer.status === "REJECTED") blockers.push("Institution refusée par Talent Bridge : corrigez-la puis soumettez-la à nouveau.");
  }
  if (!c.tbSignatory) blockers.push("Talent Bridge doit désigner le cosignataire du certificat.");
  else if (!c.tbSignatory.isActive || !c.tbSignatory.signatureFileId) blockers.push("Le cosignataire Talent Bridge désigné n'est plus actif : un nouveau cosignataire doit être désigné.");
  return blockers;
}

export type BadgeKind = "IDENTITY_VERIFIED" | "DOCUMENTS_VERIFIED" | "SKILLS_ASSESSED";
export type ConsultantCheck = "EXPERIENCE" | "DIPLOMAS" | "REFERENCES" | "SKILLS" | "IDENTITY";

export const CONSULTANT_CHECK_LABELS: Record<ConsultantCheck, { title: string; text: string }> = {
  EXPERIENCE: { title: "Expérience vérifiée", text: "Expérience professionnelle contrôlée" },
  DIPLOMAS: { title: "Diplômes vérifiés", text: "Authenticité des diplômes confirmée" },
  REFERENCES: { title: "Références professionnelles", text: "Employeurs et missions validés" },
  SKILLS: { title: "Compétences validées", text: "Domaines d'expertise contrôlés" },
  IDENTITY: { title: "Identité vérifiée", text: "Documents officiels validés" },
};

/**
 * Contrôles attestés par le certificat, déduits des badges actifs.
 * « Diplômes et références vérifiés » couvre diplômes, références et expérience déclarée.
 */
export function consultantChecks(activeBadges: BadgeKind[]): { eligible: boolean; checks: ConsultantCheck[]; reason: string | null } {
  const has = (k: BadgeKind) => activeBadges.includes(k);
  const checks: ConsultantCheck[] = [];
  if (has("DOCUMENTS_VERIFIED")) checks.push("EXPERIENCE", "DIPLOMAS", "REFERENCES");
  if (has("SKILLS_ASSESSED")) checks.push("SKILLS");
  if (has("IDENTITY_VERIFIED")) checks.push("IDENTITY");
  const eligible = has("IDENTITY_VERIFIED") && has("DOCUMENTS_VERIFIED");
  return { eligible, checks, reason: eligible ? null : "Le certificat exige une identité vérifiée ET des diplômes et références vérifiés par Talent Bridge." };
}

/** Fin de validité : la plus proche des échéances des badges utilisés (3 ans par défaut sinon). */
export function consultantValidUntil(issuedAt: Date, badgeExpiries: (Date | null)[]): Date {
  const dated = badgeExpiries.filter((d): d is Date => d instanceof Date);
  if (dated.length) return new Date(Math.min(...dated.map((d) => d.getTime())));
  const d = new Date(issuedAt);
  d.setFullYear(d.getFullYear() + 3);
  return d;
}

export function consultantCertificateCode(year: number, seq: number): string {
  return `TB-CV-${year}-${String(seq).padStart(6, "0")}`;
}

/** Copie figée des éléments graphiques et des signataires au moment de la délivrance. */
export interface CertificateSnapshot {
  issuer?: { name: string; tagline: string | null; logoFileId: string; sealFileId: string; signatoryName: string; signatoryTitle: string; signatureFileId: string };
  tb: { fullName: string; title: string; signatureFileId: string; sealFileId: string | null };
  durationHours?: number;
}
