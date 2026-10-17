import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { NOTIFICATION_TYPES } from "@/application/notification.service";
import { currentConsents } from "@/application/privacy.service";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { ResendVerification } from "@/ui/ResendVerification";
import { PreferenceToggle } from "@/ui/PreferenceToggle";

export const metadata: Metadata = { title: "Paramètres du compte" };

export default async function SettingsPage() {
  const user = await requireUser("/parametres");
  const [prefs, consents] = await Promise.all([prisma.notificationPreference.findMany({ where: { userId: user.id } }), currentConsents(user.id)]);
  const pref = (type: string, channel: string) => prefs.find((p) => p.type === type && p.channel === channel)?.enabled ?? channel !== "SMS";
  return (
    <>
      <PageHeader title="Paramètres du compte" description={`${user.firstName} ${user.lastName} · ${user.email}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader title="Sécurité" /><CardBody className="space-y-4">
          {user.emailVerifiedAt ? <Alert tone="success">Adresse email vérifiée le {user.emailVerifiedAt.toLocaleDateString("fr-FR")}.</Alert> : <Alert tone="warning">Adresse email non vérifiée. <ResendVerification /></Alert>}
          <ApiForm action="/api/v1/auth/change-password" submitLabel="Changer le mot de passe" successMessage="Mot de passe modifié. Vos autres sessions ont été déconnectées." className="space-y-3">
            <Field label="Mot de passe actuel" htmlFor="cur" required><Input id="cur" name="currentPassword" type="password" autoComplete="current-password" /></Field>
            <Field label="Nouveau mot de passe" htmlFor="new" required hint="10 caractères minimum, majuscule, minuscule et chiffre."><Input id="new" name="newPassword" type="password" autoComplete="new-password" /></Field>
          </ApiForm>
        </CardBody></Card>
        <Card><CardHeader title="Préférences de notification" description="Les emails de sécurité, de paiement et de facturation sont toujours envoyés." /><CardBody>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate"><th className="pb-2">Événement</th><th>Interne</th><th>Email</th><th>SMS</th></tr></thead>
            <tbody>{Object.entries(NOTIFICATION_TYPES).map(([type, label]) => (
              <tr key={type} className="border-t border-line"><td className="py-2">{label}</td>{(["IN_APP", "EMAIL", "SMS"] as const).map((ch) => <td key={ch}><PreferenceToggle type={type} channel={ch} enabled={pref(type, ch)} /></td>)}</tr>
            ))}</tbody></table>
        </CardBody></Card>
        <Card><CardHeader title="Consentements" description="Historisés : chaque changement est conservé avec sa date." /><CardBody className="space-y-2">
          <PreferenceToggle consent="MARKETING_EMAIL" enabled={!!consents.MARKETING_EMAIL} label="Recevoir des informations et opportunités par email" />
          <PreferenceToggle consent="MARKETING_SMS" enabled={!!consents.MARKETING_SMS} label="Recevoir des informations par SMS" />
          {user.expertProfile && <PreferenceToggle consent="PROFILE_PUBLIC" enabled={!!consents.PROFILE_PUBLIC} label="Profil visible dans l'annuaire public (sans coordonnées)" />}
        </CardBody></Card>
        <Card><CardHeader title="Mes données personnelles" /><CardBody className="space-y-4 text-sm">
          <p>Téléchargez une copie de vos données (profil, candidatures, consentements, factures) au format JSON.</p>
          <ButtonLink href="/api/v1/me/export" variant="outline">Exporter mes données</ButtonLink>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Supprimer mon compte</p>
            <p className="mt-1 text-red-900">Vos données personnelles seront anonymisées. Les factures sont conservées (obligation comptable). Impossible si vous êtes seul propriétaire d'une organisation ou sous contrat en cours.</p>
            <ApiForm action="/api/v1/me/delete-account" submitLabel="Supprimer définitivement" submitVariant="danger" successMessage="Compte supprimé." className="mt-3">
              <Field label="Saisissez SUPPRIMER pour confirmer" htmlFor="confirmation"><Input id="confirmation" name="confirmation" autoComplete="off" /></Field>
            </ApiForm>
          </div>
        </CardBody></Card>
      </div>
    </>
  );
}
