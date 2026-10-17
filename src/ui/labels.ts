/** Libellés d'affichage partagés. */
export const TENDER_TYPE_LABELS = { TENDER: "Appel d'offres", EOI: "AMI", RFP: "Demande de propositions" } as const;
export const LEVEL_LABELS: Record<string, string> = { BEGINNER: "Débutant", INTERMEDIATE: "Intermédiaire", ADVANCED: "Avancé" };
export const BID_STATUS_LABELS: Record<string, string> = { WATCHING: "En veille", PREPARING: "En préparation", SUBMITTED: "Soumis", WON: "Gagné", LOST: "Perdu", WITHDRAWN: "Retiré" };
export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = { PENDING_PAYMENT: "En attente de paiement", ACTIVE: "Actif", PAST_DUE: "Impayé", CANCELLED: "Résilié", EXPIRED: "Expiré" };
export const INVOICE_STATUS_LABELS: Record<string, string> = { DRAFT: "Brouillon", ISSUED: "À payer", PARTIALLY_PAID: "Partiellement payée", PAID: "Payée", VOID: "Annulée" };
export const PAYMENT_STATUS_LABELS: Record<string, string> = { PENDING: "En attente", SUCCEEDED: "Réussi", FAILED: "Échoué", CANCELLED: "Annulé", REFUNDED: "Remboursé", PARTIALLY_REFUNDED: "Partiellement remboursé" };
export const METHOD_LABELS: Record<string, string> = { MOBILE_MONEY: "Mobile Money", CARD: "Carte bancaire", BANK_TRANSFER: "Virement" };
export const ORG_STATUS_LABELS: Record<string, string> = { PENDING: "En attente de validation", VERIFIED: "Validée", REJECTED: "Refusée", SUSPENDED: "Suspendue" };
export const PROJECT_STATUS_LABELS: Record<string, string> = { PLANNING: "Planification", ACTIVE: "En cours", ON_HOLD: "En pause", COMPLETED: "Terminé", CANCELLED: "Annulé" };
export const TASK_STATUS_LABELS: Record<string, string> = { TODO: "À faire", IN_PROGRESS: "En cours", REVIEW: "En revue", DONE: "Terminé" };
export const DELIVERABLE_LABELS: Record<string, string> = { NOT_DELIVERABLE: "", PENDING: "Livrable attendu", SUBMITTED: "Livrable soumis", APPROVED: "Livrable validé", CHANGES_REQUESTED: "Modifications demandées" };
export const PROJECT_ROLE_LABELS: Record<string, string> = { LEAD: "Chef de mission", CONSULTANT: "Consultant", CLIENT_REVIEWER: "Validateur client", OBSERVER: "Observateur" };
