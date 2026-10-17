/**
 * Machines à états des processus métier. Toute transition passe par `assertTransition`
 * (refus explicite sinon) et est historisée par le service appelant.
 */
import { DomainError } from "./errors";

function machine<S extends string>(name: string, transitions: Record<S, readonly S[]>) {
  return {
    transitions,
    can(from: S, to: S): boolean {
      return transitions[from]?.includes(to) ?? false;
    },
    assert(from: S, to: S): void {
      if (!transitions[from]?.includes(to)) {
        throw new DomainError("INVALID_STATE", `Transition ${name} non autorisée : ${from} → ${to}.`, { from, to });
      }
    },
    next(from: S): readonly S[] {
      return transitions[from] ?? [];
    },
  };
}

// ── Missions : Brouillon → Publication → Candidatures → Présélection → Entretiens → Sélection
//    → Contractualisation → Exécution → Clôture
export type MissionStatus =
  | "DRAFT" | "PUBLISHED" | "SHORTLISTING" | "INTERVIEWS" | "SELECTION" | "CONTRACTING" | "IN_PROGRESS" | "CLOSED" | "CANCELLED";

export const missionFlow = machine<MissionStatus>("mission", {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["SHORTLISTING", "CANCELLED", "DRAFT"],
  SHORTLISTING: ["INTERVIEWS", "SELECTION", "PUBLISHED", "CANCELLED"],
  INTERVIEWS: ["SELECTION", "SHORTLISTING", "CANCELLED"],
  SELECTION: ["CONTRACTING", "INTERVIEWS", "CANCELLED"],
  CONTRACTING: ["IN_PROGRESS", "SELECTION", "CANCELLED"],
  IN_PROGRESS: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
});

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publiée — candidatures ouvertes",
  SHORTLISTING: "Présélection",
  INTERVIEWS: "Entretiens",
  SELECTION: "Sélection",
  CONTRACTING: "Contractualisation",
  IN_PROGRESS: "En exécution",
  CLOSED: "Clôturée",
  CANCELLED: "Annulée",
};

/** Statuts dans lesquels une mission accepte de nouvelles candidatures. */
export const MISSION_OPEN_STATUSES: readonly MissionStatus[] = ["PUBLISHED", "SHORTLISTING"];

// ── Candidatures
export type ApplicationStatus = "SUBMITTED" | "SHORTLISTED" | "INTERVIEW" | "SELECTED" | "REJECTED" | "WITHDRAWN" | "CONTRACTED";

export const applicationFlow = machine<ApplicationStatus>("candidature", {
  SUBMITTED: ["SHORTLISTED", "REJECTED", "WITHDRAWN", "SELECTED"],
  SHORTLISTED: ["INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["SELECTED", "REJECTED", "WITHDRAWN", "SHORTLISTED"],
  SELECTED: ["CONTRACTED", "REJECTED", "WITHDRAWN"],
  REJECTED: [],
  WITHDRAWN: [],
  CONTRACTED: [],
});

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Reçue",
  SHORTLISTED: "Présélectionnée",
  INTERVIEW: "Entretien",
  SELECTED: "Retenue",
  REJECTED: "Non retenue",
  WITHDRAWN: "Retirée",
  CONTRACTED: "Contractualisée",
};

// ── Vérification des experts
export type VerificationStatus = "NOT_SUBMITTED" | "PENDING" | "IN_REVIEW" | "INFO_REQUESTED" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type VerificationType = "IDENTITY" | "DOCUMENTS" | "SKILLS";
export type VerificationStep =
  | "SUBMISSION" | "COMPLETENESS" | "ADMINISTRATIVE" | "DIPLOMAS" | "REFERENCES" | "SKILLS_ASSESSMENT" | "DECISION" | "BADGE" | "RENEWAL";

export const verificationFlow = machine<VerificationStatus>("vérification", {
  NOT_SUBMITTED: ["PENDING"],
  PENDING: ["IN_REVIEW", "INFO_REQUESTED", "REJECTED"],
  IN_REVIEW: ["INFO_REQUESTED", "VERIFIED", "REJECTED"],
  INFO_REQUESTED: ["PENDING"],
  VERIFIED: ["EXPIRED"],
  REJECTED: ["PENDING"], // nouvelle soumission après refus
  EXPIRED: ["PENDING"], // renouvellement
});

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  NOT_SUBMITTED: "Non soumis",
  PENDING: "En attente",
  IN_REVIEW: "En vérification",
  INFO_REQUESTED: "Complément demandé",
  VERIFIED: "Vérifié",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
};

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  IDENTITY: "Vérification d'identité",
  DOCUMENTS: "Vérification documentaire (diplômes, références)",
  SKILLS: "Évaluation des compétences",
};

/** Contrôles humains obligatoires avant de pouvoir décider « Vérifié », par type. */
export const REQUIRED_CHECKS: Record<VerificationType, readonly VerificationStep[]> = {
  IDENTITY: ["COMPLETENESS", "ADMINISTRATIVE"],
  DOCUMENTS: ["COMPLETENESS", "DIPLOMAS", "REFERENCES"],
  SKILLS: ["COMPLETENESS", "SKILLS_ASSESSMENT"],
};

/** Badge attribué à l'issue d'une vérification réussie (jamais sur simple dépôt de document). */
export const BADGE_FOR_TYPE: Record<VerificationType, string> = {
  IDENTITY: "IDENTITY_VERIFIED",
  DOCUMENTS: "DOCUMENTS_VERIFIED",
  SKILLS: "SKILLS_ASSESSED",
};

export interface CheckLike {
  step: VerificationStep;
  result: "PASS" | "FAIL" | "NOT_APPLICABLE";
}

/**
 * Décision « Vérifié » possible seulement si tous les contrôles requis ont été réalisés
 * par un humain et qu'aucun n'est en échec.
 */
export function canApproveVerification(type: VerificationType, checks: readonly CheckLike[]): { ok: boolean; missing: VerificationStep[]; failed: VerificationStep[] } {
  const required = REQUIRED_CHECKS[type];
  const byStep = new Map(checks.map((c) => [c.step, c.result]));
  const missing = required.filter((s) => !byStep.has(s));
  const failed = required.filter((s) => byStep.get(s) === "FAIL");
  // Un contrôle « non applicable » ne peut pas remplacer le contrôle de complétude.
  if (byStep.get("COMPLETENESS") === "NOT_APPLICABLE") failed.push("COMPLETENESS");
  return { ok: missing.length === 0 && failed.length === 0, missing, failed };
}

// ── Contrats
export type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "ACTIVE" | "COMPLETED" | "TERMINATED";
export const contractFlow = machine<ContractStatus>("contrat", {
  DRAFT: ["SENT", "TERMINATED"],
  SENT: ["SIGNED", "DRAFT", "TERMINATED"],
  SIGNED: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["COMPLETED", "TERMINATED"],
  COMPLETED: [],
  TERMINATED: [],
});

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé à l'expert",
  SIGNED: "Signé",
  ACTIVE: "En cours",
  COMPLETED: "Terminé",
  TERMINATED: "Résilié",
};

// ── Organisations
export type OrganizationStatus = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
export const organizationFlow = machine<OrganizationStatus>("organisation", {
  PENDING: ["VERIFIED", "REJECTED"],
  VERIFIED: ["SUSPENDED"],
  REJECTED: ["PENDING", "VERIFIED"],
  SUSPENDED: ["VERIFIED"],
});

// ── CRM
export type OpportunityStage = "PROSPECT" | "QUALIFIED" | "NEED_IDENTIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export const OPPORTUNITY_STAGES: readonly OpportunityStage[] = ["PROSPECT", "QUALIFIED", "NEED_IDENTIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  PROSPECT: "Prospect",
  QUALIFIED: "Qualifié",
  NEED_IDENTIFIED: "Besoin identifié",
  PROPOSAL: "Proposition",
  NEGOTIATION: "Négociation",
  WON: "Gagné",
  LOST: "Perdu",
};
/** Probabilité par défaut associée à chaque étape (prévision pondérée). */
export const STAGE_DEFAULT_PROBABILITY: Record<OpportunityStage, number> = {
  PROSPECT: 10, QUALIFIED: 20, NEED_IDENTIFIED: 35, PROPOSAL: 50, NEGOTIATION: 75, WON: 100, LOST: 0,
};
