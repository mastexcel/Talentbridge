import { notFound } from "next/navigation";
import { getTender } from "@/application/tender.service";
import { currentUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { daysUntil } from "@/domain/tenders";
import { orgRoleCan, type OrgRole } from "@/domain/permissions";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, DemoBadge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { ActionButton } from "@/ui/ActionButton";
import { RichText } from "@/ui/Page";
import { Alert } from "@/ui/Feedback";
import { TENDER_TYPE_LABELS } from "@/ui/labels";

export const dynamic = "force-dynamic";

export default async function TenderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, user] = await Promise.all([getTender(id), currentUser()]);
  if (!t) notFound();
  const m = user?.memberships.find((x) => x.organizationId === user.activeOrgId);
  const canBid = !!m && orgRoleCan(m.role as OrgRole, "tenders.manage");
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap gap-2"><Badge tone="bordeaux">{TENDER_TYPE_LABELS[t.type]}</Badge><DemoBadge show={t.isDemo} /><Badge tone="olive">Clôture dans {daysUntil(t.deadline)} jour(s)</Badge></div>
      <h1 className="mt-3 text-3xl font-extrabold">{t.title}</h1>
      <p className="mt-1 text-slate">{t.buyerName} · {t.countryCode} · Réf. {t.reference}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card><CardHeader title="Objet" /><CardBody><RichText text={t.description} /></CardBody></Card>
          {t.eligibility && <Card><CardHeader title="Critères d'éligibilité" /><CardBody><RichText text={t.eligibility} /></CardBody></Card>}
        </div>
        <aside className="space-y-4">
          <Card><CardBody className="space-y-2 text-sm"><p>Date limite : <strong>{t.deadline.toLocaleString("fr-FR")}</strong></p><p>Budget : <strong>{t.budgetMinor && t.currency ? formatMoney(t.budgetMinor, t.currency) : "Non communiqué"}</strong></p>{t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-orange-700 underline">Avis officiel</a>}</CardBody></Card>
          {canBid ? (
            <ActionButton action="/api/v1/tenders/bid-start" body={{ tenderId: t.id }} variant="primary" size="md" className="w-full" successMessage="Dossier de candidature ouvert.">Préparer une candidature</ActionButton>
          ) : user ? (
            <Alert tone="info">La préparation de dossier est réservée aux organisations (rôles administrateur, recruteur ou chef de projet).</Alert>
          ) : (
            <ButtonLink href={`/connexion?suite=/appels-offres/${t.id}`} className="w-full">Se connecter</ButtonLink>
          )}
          <p className="text-xs text-slate">Vérifiez toujours les conditions dans l'avis officiel de l'acheteur.</p>
        </aside>
      </div>
    </div>
  );
}
