/**
 * Schémas de validation partagés serveur/client (aucune dépendance serveur ici).
 * Le serveur revalide TOUJOURS : la validation client n'est qu'un confort.
 */
import { z } from "zod";

/** Messages de validation par défaut en français (les messages explicites restent prioritaires). */
const frenchErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") return { message: `${issue.minimum} caractère(s) minimum.` };
      if (issue.type === "number") return { message: `La valeur doit être supérieure ou égale à ${issue.minimum}.` };
      if (issue.type === "array") return { message: `Sélectionnez au moins ${issue.minimum} élément(s).` };
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `${issue.maximum} caractères maximum.` };
      if (issue.type === "number") return { message: `La valeur doit être inférieure ou égale à ${issue.maximum}.` };
      if (issue.type === "array") return { message: `${issue.maximum} élément(s) maximum.` };
      break;
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" || issue.received === "null" ? "Champ requis." : "Valeur invalide." };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Choix invalide." };
    case z.ZodIssueCode.invalid_date:
      return { message: "Date invalide." };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Adresse email invalide." };
      if (issue.validation === "url") return { message: "Adresse web invalide." };
      return { message: "Format invalide." };
  }
  return { message: ctx.defaultError };
};
z.setErrorMap(frenchErrorMap);

/** Nombre facultatif : un champ vide vaut null (et non 0). */
const optionalNumber = (schema: z.ZodNumber) => z.preprocess((v) => (v === "" || v === undefined ? null : v), z.union([z.null(), z.coerce.number().pipe(schema)]));

const trimmed = (min: number, max: number, msg?: string) => z.string().trim().min(min, msg ?? `${min} caractères minimum.`).max(max, `${max} caractères maximum.`);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const country = z.string().trim().length(2, "Pays invalide.").transform((v) => v.toUpperCase());
const currency = z.string().trim().length(3).transform((v) => v.toUpperCase());
const dateInput = z.coerce.date();
export const optionalDate = z.union([z.literal(""), z.null(), z.undefined(), z.coerce.date()]).transform((v) => (v instanceof Date && !isNaN(v.getTime()) ? v : null));

export const password = z
  .string()
  .min(10, "10 caractères minimum.")
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Le mot de passe doit contenir une minuscule, une majuscule et un chiffre.");

export const ORGANIZATION_TYPES = ["CONSULTING_FIRM", "COMPANY", "NGO", "INSTITUTION", "TRAINING_PROVIDER", "DONOR", "PROJECT_OWNER"] as const;
export const ORGANIZATION_TYPE_LABELS: Record<(typeof ORGANIZATION_TYPES)[number], string> = {
  CONSULTING_FIRM: "Cabinet de conseil",
  COMPANY: "Entreprise / PME",
  NGO: "ONG / organisation internationale",
  INSTITUTION: "Institution publique",
  TRAINING_PROVIDER: "Organisme de formation",
  DONOR: "Bailleur / partenaire technique",
  PROJECT_OWNER: "Porteur de projet",
};

export const signupSchema = z
  .object({
    accountType: z.enum(["EXPERT", ...ORGANIZATION_TYPES]),
    firstName: trimmed(1, 60, "Prénom requis."),
    lastName: trimmed(1, 60, "Nom requis."),
    email: z.string().trim().toLowerCase().email("Adresse email invalide."),
    phone: optionalText(30),
    password,
    countryCode: country,
    organizationName: optionalText(120),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }) }),
    acceptPrivacy: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter la politique de confidentialité." }) }),
    marketingEmail: z.boolean().default(false),
    invitationToken: optionalText(200),
  })
  .refine((v) => v.accountType === "EXPERT" || !!v.organizationName, { message: "Raison sociale requise.", path: ["organizationName"] });
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  password: z.string().min(1, "Mot de passe requis.").max(128),
});

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Adresse email invalide.") });
export const resetSchema = z.object({ token: z.string().min(10), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

// ── Organisation
export const organizationSchema = z.object({
  name: trimmed(2, 120),
  type: z.enum(ORGANIZATION_TYPES),
  countryCode: country,
  city: optionalText(80),
  registrationNumber: optionalText(60),
  taxId: optionalText(60),
  sector: optionalText(80),
  size: optionalText(20),
  website: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().url("URL invalide.")]).transform((v) => v || null),
  description: optionalText(2000),
  address: optionalText(300),
  contactName: optionalText(120),
  contactEmail: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().email()]).transform((v) => v || null),
  contactPhone: optionalText(30),
  expertiseNeeds: optionalText(2000),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

export const ORG_ROLES = ["OWNER", "ADMIN", "RECRUITER", "PROJECT_MANAGER", "MEMBER", "VIEWER"] as const;
export const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ORG_ROLES) });

// ── Profil expert
export const expertProfileSchema = z.object({
  headline: trimmed(3, 140),
  bio: optionalText(4000),
  countryCode: country,
  city: optionalText(80),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  languages: z.array(z.string().trim().min(2).max(5)).max(10),
  domainIds: z.array(z.string().min(1)).max(5),
  availability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]),
  availableFrom: optionalDate,
  mobility: z.enum(["LOCAL", "NATIONAL", "REGIONAL", "INTERNATIONAL"]),
  remoteOk: z.boolean(),
  mobilityCountries: z.array(z.string().length(2)).max(54).default([]),
  dailyRate: optionalNumber(z.number().min(0).max(100_000_000)),
  rateCurrency: currency.optional().nullable(),
  missionPreferences: optionalText(1000),
  visibility: z.enum(["PUBLIC", "MEMBERS", "PRIVATE"]),
});
export type ExpertProfileInput = z.infer<typeof expertProfileSchema>;

export const expertSkillsSchema = z.object({
  skills: z.array(z.object({ skillId: z.string().min(1), level: z.coerce.number().int().min(1).max(5), years: z.coerce.number().int().min(0).max(60) })).max(40),
});

export const experienceSchema = z.object({
  title: trimmed(2, 140),
  employer: trimmed(2, 140),
  countryCode: country.optional().nullable(),
  sector: optionalText(80),
  startDate: dateInput,
  endDate: optionalDate,
  description: optionalText(2000),
});

export const qualificationSchema = z.object({
  kind: z.enum(["DEGREE", "CERTIFICATION"]),
  title: trimmed(2, 160),
  institution: trimmed(2, 160),
  year: optionalNumber(z.number().int().min(1950).max(2100)),
  fileId: optionalText(40),
});

export const referenceSchema = z.object({
  contactName: trimmed(2, 120),
  contactOrg: trimmed(2, 160),
  contactEmail: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().email()]).transform((v) => v || null),
  contactPhone: optionalText(30),
  relation: optionalText(120),
  missionTitle: optionalText(200),
  year: optionalNumber(z.number().int().min(1950).max(2100)),
});

export const portfolioSchema = z.object({
  title: trimmed(2, 160),
  description: optionalText(1000),
  url: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().url()]).transform((v) => v || null),
  year: optionalNumber(z.number().int().min(1950).max(2100)),
});

export const slotSchema = z
  .object({ startDate: dateInput, endDate: dateInput, kind: z.enum(["AVAILABLE", "BOOKED", "UNAVAILABLE"]), note: optionalText(200) })
  .refine((v) => v.endDate >= v.startDate, { message: "La fin doit suivre le début.", path: ["endDate"] });

// ── Annuaire
export const expertSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  country: z.string().length(2).optional(),
  city: z.string().trim().max(80).optional(),
  domain: z.string().max(60).optional(),
  skill: z.string().max(60).optional(),
  language: z.string().max(5).optional(),
  minYears: z.coerce.number().int().min(0).max(60).optional(),
  certified: z.enum(["identity", "documents", "skills"]).optional(),
  availability: z.enum(["AVAILABLE", "PARTIAL"]).optional(),
  mobility: z.enum(["LOCAL", "NATIONAL", "REGIONAL", "INTERNATIONAL"]).optional(),
  maxRate: z.coerce.number().min(0).optional(),
  minRate: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  sort: z.enum(["relevance", "experience", "rating", "recent"]).default("relevance"),
});
export type ExpertSearch = z.infer<typeof expertSearchSchema>;

// ── Missions
export const missionSchema = z
  .object({
    title: trimmed(5, 160),
    description: trimmed(30, 10000, "Décrivez le besoin (30 caractères minimum)."),
    objectives: optionalText(4000),
    expectedResults: optionalText(4000),
    domainId: optionalText(40),
    experienceYearsMin: z.coerce.number().int().min(0).max(40),
    languages: z.array(z.string().min(2).max(5)).max(6).default(["fr"]),
    countryCode: country,
    city: optionalText(80),
    workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
    durationDays: optionalNumber(z.number().int().min(1).max(1500)),
    startDate: optionalDate,
    budgetMin: optionalNumber(z.number().min(0)),
    budgetMax: optionalNumber(z.number().min(0)),
    currency,
    applicationDeadline: optionalDate,
    visibility: z.enum(["PUBLIC", "MEMBERS", "INVITE_ONLY"]),
    requirements: z.array(z.object({ skillId: z.string().min(1), mandatory: z.boolean(), minLevel: z.coerce.number().int().min(1).max(5) })).max(20),
  })
  .refine((v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax, { message: "Le budget minimum dépasse le maximum.", path: ["budgetMax"] });
export type MissionInput = z.infer<typeof missionSchema>;

export const missionSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  country: z.string().length(2).optional(),
  domain: z.string().max(60).optional(),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const applicationSchema = z.object({
  coverLetter: trimmed(50, 6000, "Proposition technique : 50 caractères minimum."),
  proposedRate: optionalNumber(z.number().min(0)),
  currency: currency.optional().nullable(),
  availableFrom: optionalDate,
  technicalFileId: optionalText(40),
  financialFileId: optionalText(40),
});

export const applicationDecisionSchema = z.object({
  status: z.enum(["SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED"]),
  note: optionalText(1000),
});

export const interviewSchema = z.object({
  scheduledAt: dateInput,
  durationMin: z.coerce.number().int().min(10).max(480).default(45),
  mode: z.enum(["VISIO", "PHONE", "ONSITE"]),
  location: optionalText(300),
  notes: optionalText(2000),
});

// ── Vérification
export const verificationCheckSchema = z.object({
  step: z.enum(["COMPLETENESS", "ADMINISTRATIVE", "DIPLOMAS", "REFERENCES", "SKILLS_ASSESSMENT"]),
  result: z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]),
  note: optionalText(1000),
});
export const verificationDecisionSchema = z.object({
  decision: z.enum(["START_REVIEW", "REQUEST_INFO", "APPROVE", "REJECT"]),
  note: optionalText(2000),
});

// ── Matching
export const matchingWeightsSchema = z.object({
  skills: z.coerce.number().min(0).max(100),
  experience: z.coerce.number().min(0).max(100),
  references: z.coerce.number().min(0).max(100),
  availability: z.coerce.number().min(0).max(100),
  location: z.coerce.number().min(0).max(100),
  languages: z.coerce.number().min(0).max(100),
});

export const teamRequestSchema = z.object({
  missionId: z.string().min(1),
  budgetMax: optionalNumber(z.number().min(0)),
  roles: z
    .array(z.object({ key: z.string().min(1).max(40), label: trimmed(2, 80), skillIds: z.array(z.string()).min(1).max(10), days: z.coerce.number().int().min(1).max(1000) }))
    .min(1)
    .max(12),
});

export const needAnalysisSchema = z.object({ text: trimmed(10, 10000, "Décrivez le besoin (10 caractères minimum).") });

// ── Projets
export const projectSchema = z.object({
  name: trimmed(3, 160),
  description: optionalText(4000),
  missionId: optionalText(40),
  startDate: optionalDate,
  endDate: optionalDate,
});
export const taskSchema = z.object({
  title: trimmed(2, 200),
  description: optionalText(4000),
  assigneeId: optionalText(40),
  startDate: optionalDate,
  dueDate: optionalDate,
  isDeliverable: z.boolean().default(false),
});

// ── CRM
export const opportunitySchema = z.object({
  title: trimmed(2, 160),
  value: z.coerce.number().min(0),
  currency,
  stage: z.enum(["PROSPECT", "QUALIFIED", "NEED_IDENTIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]).default("PROSPECT"),
  expectedCloseDate: optionalDate,
  contactId: optionalText(40),
  leadId: optionalText(40),
  assigneeId: optionalText(40),
});
export const leadSchema = z.object({
  companyName: trimmed(2, 160),
  contactName: optionalText(120),
  email: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().email()]).transform((v) => v || null),
  phone: optionalText(30),
  countryCode: country.optional().nullable(),
  source: optionalText(80),
  notes: optionalText(2000),
});
export const crmContactSchema = z.object({
  firstName: trimmed(1, 80),
  lastName: trimmed(1, 80),
  email: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().email()]).transform((v) => v || null),
  phone: optionalText(30),
  companyName: optionalText(160),
  position: optionalText(120),
});
export const activitySchema = z.object({
  kind: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "TASK", "FOLLOW_UP"]),
  subject: trimmed(2, 200),
  body: optionalText(4000),
  dueAt: optionalDate,
  opportunityId: optionalText(40),
  contactId: optionalText(40),
});

// ── Facturation
export const subscribeSchema = z.object({
  priceId: z.string().min(1),
  couponCode: optionalText(40),
  method: z.enum(["MOBILE_MONEY", "CARD", "BANK_TRANSFER"]),
  payerPhone: optionalText(30),
  forOrganization: z.boolean().default(false),
});

export const planSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9_]{3,40}$/, "Code : majuscules, chiffres et _ (3-40)."),
  name: trimmed(2, 80),
  audience: z.enum(["EXPERT", "ORGANIZATION"]),
  description: trimmed(5, 1000),
  isRecurring: z.boolean(),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  highlight: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});
export const planPriceSchema = z.object({
  currency,
  interval: z.enum(["MONTH", "YEAR", "ONE_TIME"]),
  amount: z.coerce.number().min(0),
  countryCode: country.optional().nullable(),
});
export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/),
    percentOff: optionalNumber(z.number().min(0).max(100)),
    amountOff: optionalNumber(z.number().min(0)),
    currency: currency.optional().nullable(),
    maxRedemptions: optionalNumber(z.number().int().min(1)),
    validUntil: optionalDate,
  })
  .refine((v) => !!v.percentOff !== !!v.amountOff, { message: "Renseignez un pourcentage OU un montant.", path: ["percentOff"] });

export const refundRequestSchema = z.object({ amount: z.coerce.number().positive(), reason: trimmed(5, 500) });

// ── Communauté, mentorat, contact
export const postSchema = z.object({ body: trimmed(2, 4000), groupId: optionalText(40) });
export const commentSchema = z.object({ body: trimmed(1, 2000) });
export const reportSchema = z.object({ targetType: z.enum(["POST", "COMMENT", "EXPERT", "MISSION", "MESSAGE"]), targetId: z.string().min(1).max(40), reason: trimmed(5, 500) });
export const mentorshipSchema = z.object({ mentorId: z.string().min(1), topic: trimmed(3, 160), message: optionalText(2000) });
export const messageSchema = z.object({ body: trimmed(1, 5000) });
export const newConversationSchema = z.object({ recipientUserId: z.string().min(1).optional(), expertId: z.string().min(1).optional(), subject: trimmed(2, 160), body: trimmed(1, 5000) }).refine((v) => v.recipientUserId || v.expertId, { message: "Destinataire requis." });
export const contactSchema = z.object({
  name: trimmed(2, 120),
  email: z.string().trim().email("Adresse email invalide."),
  company: optionalText(160),
  subject: trimmed(2, 160),
  message: trimmed(10, 5000, "Votre message (10 caractères minimum)."),
});

// ── Appels d'offres
export const tenderSchema = z.object({
  type: z.enum(["TENDER", "EOI", "RFP"]),
  title: trimmed(5, 200),
  buyerName: trimmed(2, 160),
  countryCode: country,
  domainId: optionalText(40),
  description: trimmed(20, 10000),
  eligibility: optionalText(4000),
  budget: optionalNumber(z.number().min(0)),
  currency: currency.optional().nullable(),
  deadline: dateInput,
  sourceUrl: z.union([z.literal(""), z.null(), z.undefined(), z.string().trim().url()]).transform((v) => v || null),
});
export const tenderAlertSchema = z.object({ name: trimmed(2, 80), keywords: z.array(z.string().trim().min(2).max(40)).max(10), countryCodes: z.array(z.string().length(2)).max(20), domainIds: z.array(z.string()).max(10) });
export const bidRequirementSchema = z.object({ category: z.enum(["ADMINISTRATIVE", "TECHNICAL", "FINANCIAL", "EXPERTS"]), label: trimmed(2, 200) });

// ── Academy
export const courseSchema = z.object({
  title: trimmed(3, 160),
  summary: trimmed(10, 400),
  description: optionalText(6000),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  durationHours: z.coerce.number().int().min(1).max(500),
  price: z.coerce.number().min(0),
  currency,
  passingScore: z.coerce.number().int().min(0).max(100),
});
export const lessonSchema = z.object({ moduleTitle: trimmed(2, 160), title: trimmed(2, 160), kind: z.enum(["TEXT", "VIDEO", "DOCUMENT", "EXERCISE"]), content: optionalText(20000), videoUrl: z.union([z.literal(""), z.null(), z.undefined(), z.string().url()]).transform((v) => v || null) });

// ── CMS
export const contentBlockSchema = z.object({ title: optionalText(200), body: z.string().max(50000) });
export const faqSchema = z.object({ question: trimmed(5, 300), answer: trimmed(5, 4000), category: z.string().trim().max(40).default("GENERAL"), sortOrder: z.coerce.number().int().min(0).default(0) });
