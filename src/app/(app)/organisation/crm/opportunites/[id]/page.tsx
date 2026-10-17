import type { Metadata } from "next";
import { requireOrgUser } from "@/lib/session";
import { getOpportunity } from "@/application/crm.service";
import { formatMoney } from "@/domain/money";
import { OPPORTUNITY_STAGE_LABELS } from "@/domain/workflows";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { Badge } from "@/ui/Badge";
import { StageSelect } from "@/ui/StageSelect";

export const metadata: Metadata = { title: "Opportunité" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireOrgUser("crm.use");
  const o = await getOpportunity(user, id);
  return (
    <>
      <PageHeader back={{ href: "/organisation/crm", label: "CRM" }} title={o.title} description={<>{formatMoney(o.valueMinor, o.currency)} · probabilité {o.probabilityPct} % · <Badge tone="bordeaux">{OPPORTUNITY_STAGE_LABELS[o.stage]}</Badge>{o.lostReason ? ` · perdue : ${o.lostReason}` : ""}</>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card><CardHeader title="Historique des interactions" /><CardBody className="space-y-4">
          <ApiForm action="/api/v1/crm/activity" submitLabel="Ajouter" successMessage="Interaction enregistrée." className="grid gap-2 sm:grid-cols-3" transform={(d) => ({ ...d, opportunityId: o.id, contactId: o.contactId })}>
            <Select name="kind" aria-label="Type"><option value="CALL">Appel</option><option value="EMAIL">Email</option><option value="MEETING">Rendez-vous</option><option value="NOTE">Note</option><option value="FOLLOW_UP">Relance</option><option value="TASK">Tâche</option></Select>
            <Input name="subject" placeholder="Objet" aria-label="Objet" />
            <Input name="dueAt" type="date" aria-label="Échéance (relance)" />
            <Textarea name="body" placeholder="Compte rendu" aria-label="Compte rendu" className="sm:col-span-3" />
          </ApiForm>
          <ol className="space-y-2 border-l-2 border-orange-200 pl-4 text-sm">{o.activities.map((a) => <li key={a.id}><span className="text-xs text-slate">{a.createdAt.toLocaleDateString("fr-FR")}</span> — <strong>{a.kind}</strong> {a.subject}{a.dueAt && !a.doneAt ? <span className="ml-1 text-xs text-orange-800">(échéance {a.dueAt.toLocaleDateString("fr-FR")})</span> : null}{a.body && <p className="text-slate">{a.body}</p>}{!a.doneAt && a.dueAt && <ActionButton action="/api/v1/crm/activity-done" body={{ id: a.id }} variant="ghost" successMessage="Fait.">Marquer fait</ActionButton>}</li>)}</ol>
        </CardBody></Card>
        <aside className="space-y-6">
          <Card><CardHeader title="Étape" /><CardBody><StageSelect id={o.id} stage={o.stage} />{o.contact && <p className="mt-3 text-sm">Contact : {o.contact.firstName} {o.contact.lastName} — {o.contact.email}</p>}</CardBody></Card>
          <Card><CardHeader title="Devis" /><CardBody className="space-y-2 text-sm">
            {o.quotes.map((q) => <p key={q.id}><span className="font-mono">{q.number}</span> — {q.title} — {formatMoney(q.amountMinor, q.currency)}</p>)}
            <ApiForm action="/api/v1/crm/quote" submitLabel="Créer le devis" successMessage="Devis créé." className="space-y-2" transform={(d) => ({ ...d, opportunityId: o.id, currency: o.currency })}>
              <Field label="Intitulé" htmlFor="q-t"><Input id="q-t" name="title" /></Field>
              <Field label={`Montant (${o.currency})`} htmlFor="q-a"><Input id="q-a" name="amount" type="number" data-type="number" /></Field>
              <Field label="Valable jusqu'au" htmlFor="q-v"><Input id="q-v" name="validUntil" type="date" /></Field>
            </ApiForm>
          </CardBody></Card>
        </aside>
      </div>
    </>
  );
}
