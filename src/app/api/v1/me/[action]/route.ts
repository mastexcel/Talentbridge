import { z } from "zod";
import { DomainError } from "@/domain/errors";
import { actions, defineAction } from "@/infrastructure/http/actions";
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/infrastructure/http/cookies";
import { requireExpert } from "@/application/access";
import { addItem, removeItem, setProfileFile, setSkills, toggleFavorite, updateProfile } from "@/application/expert.service";
import { toggleSaveMission } from "@/application/mission.service";
import { markRead, setPreference, NOTIFICATION_TYPES, type NotificationType } from "@/application/notification.service";
import { deleteAccount, setConsent } from "@/application/privacy.service";
import { createOrganization } from "@/application/organization.service";
import { experienceSchema, expertProfileSchema, expertSkillsSchema, organizationSchema, portfolioSchema, qualificationSchema, referenceSchema, slotSchema } from "@/application/schemas";

const ITEM_SCHEMAS = { experience: experienceSchema, qualification: qualificationSchema, reference: referenceSchema, portfolio: portfolioSchema, slot: slotSchema };
type Kind = keyof typeof ITEM_SCHEMAS;
type P = { action: string };

export const POST = actions<P>({
  profile: defineAction({ schema: expertProfileSchema, run: async ({ user }, body) => updateProfile(user, requireExpert(user).expertId, body) }),
  skills: defineAction({ schema: expertSkillsSchema, run: async ({ user }, body) => setSkills(requireExpert(user).expertId, body.skills) }),
  "item-add": defineAction({
    schema: z.object({ kind: z.enum(["experience", "qualification", "reference", "portfolio", "slot"]) }).passthrough(),
    run: async ({ user }, body) => {
      const { kind, ...rest } = body as { kind: Kind } & Record<string, unknown>;
      return addItem(requireExpert(user).expertId, kind, ITEM_SCHEMAS[kind].parse(rest) as Record<string, unknown>);
    },
  }),
  "item-remove": defineAction({ schema: z.object({ kind: z.enum(["experience", "qualification", "reference", "portfolio", "slot"]), id: z.string().min(1) }), run: async ({ user }, b) => removeItem(requireExpert(user).expertId, b.kind, b.id) }),
  "profile-file": defineAction({ schema: z.object({ field: z.enum(["photoFileId", "cvFileId"]), fileId: z.string().min(1) }), run: async ({ user }, b) => setProfileFile(user, requireExpert(user).expertId, b.field, b.fileId) }),
  favorite: defineAction({ schema: z.object({ expertId: z.string().min(1) }), run: async ({ user }, b) => toggleFavorite(user.id, b.expertId) }),
  "save-mission": defineAction({ schema: z.object({ missionId: z.string().min(1) }), run: async ({ user }, b) => toggleSaveMission(user.id, b.missionId) }),
  "notifications-read": defineAction({ schema: z.object({ ids: z.union([z.literal("all"), z.array(z.string())]) }), run: async ({ user }, b) => markRead(user.id, b.ids) }),
  "notification-pref": defineAction({
    schema: z.object({ type: z.string(), channel: z.enum(["IN_APP", "EMAIL", "SMS"]), enabled: z.boolean() }),
    run: async ({ user }, b) => {
      if (!(b.type in NOTIFICATION_TYPES)) throw new DomainError("VALIDATION", "Type inconnu.");
      await setPreference(user.id, b.type as NotificationType, b.channel, b.enabled);
    },
  }),
  consent: defineAction({ schema: z.object({ type: z.enum(["MARKETING_EMAIL", "MARKETING_SMS", "PROFILE_PUBLIC"]), granted: z.boolean() }), run: async ({ user }, b) => setConsent(user, b.type, b.granted) }),
  "organization-create": defineAction({ schema: organizationSchema, run: async ({ user }, b) => ({ organization: await createOrganization(user, b), redirectUrl: "/organisation" }) }),
  "delete-account": defineAction({
    schema: z.object({ confirmation: z.literal("SUPPRIMER", { errorMap: () => ({ message: "Saisissez SUPPRIMER pour confirmer." }) }) }),
    run: async ({ user }) => {
      await deleteAccount(user);
      const res = NextResponse.json({ ok: true, redirectUrl: "/?compte-supprime=1" });
      clearSessionCookie(res);
      return res;
    },
  }),
});
