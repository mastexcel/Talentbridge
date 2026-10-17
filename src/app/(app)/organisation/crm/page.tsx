import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgUser } from "@/lib/session";
import { listContacts, listLeads, pipeline, upcomingActivities } from "@/application/crm.service";
import { formatMoney } from "@/domain/money";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES } from "@/domain/workflows";
import { DomainError } from "@/domain/errors";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatCard } from "@/ui/Stat";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";
import { ButtonLink } from "@/ui/Button";
import { StageSelect } from "@/ui/StageSelect";

export const metadata: Metadata = { title: "CRM commercial" };

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue = "pipeline" } = await searchParams;
  const { user } = await requireOrgUser("crm.use");
  let data;
  try {
    data = await pipeline(user);
  } catch (e) {
    if (e instanceof DomainError && e.code === "PLAN_LIMIT") return <><PageHeader title="CRM commercial" /><Alert tone="info" title="Fonctionnalité incluse dans les offres Business et Enterprise">{e.message} <ButtonLink href="/tarifs" size="sm" className="ml-2">Voir les offres</ButtonLink></Alert></>;
    throw e;
  }
  const [leads, contacts, reminders] = await Promise.all([listLeads(user), listContacts(user, undefined), upcomingActivities(user)]);
  const money = (rows: { currency: string; amountMinor: number }[]) => rows.map((r) => formatMoney(r.amountMinor, r.currency)).join(" · ") || "—";
  return (
    <>
      <PageHeader title="CRM commercial" description="Données strictement réservées à votre organisation." actions={<><ButtonLink href="/api/v1/exports/crm?format=xlsx" variant="outline" size="sm">Export Excel</ButtonLink><ButtonLink href="/api/v1/exports/crm?format=csv" variant="outline" size="sm">Export CSV</ButtonLink></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Valeur du pipeline" value={money(data.pipelineValue)} />
        <StatCard label="Prévision pondérée" value={money(data.weightedForecast)} tone="orange" hint="Valeur × probabilité de l'étape" />
        <StatCard label="Taux de conversion" value={data.conversionPct != null ? `${data.conversionPct} %` : "—"} tone="olive" hint="Gagnées / (gagnées + perdues)" />
        <StatCard label="Relances à faire" value={reminders.filter((r) => r.dueAt && r.dueAt <= new Date(Date.now() + 86_400_000)).length} tone="ink" />
      </div>
      <nav className="mb-4 flex gap-2 text-sm">{[["pipeline", "Pipeline"], ["prospects", "Prospects"], ["contacts", "Contacts"], ["activites", "Activités & relances"]].map(([k, l]) => <Link key={k} href={`?vue=${k}`} className={`rounded-full px-3 py-1 ${vue === k ? "bg-bordeaux-700 text-white" : "border border-line bg-white"}`}>{l}</Link>)}</nav>

      {vue === "pipeline" && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {data.stages.map((col) => (
              <section key={col.stage} className="w-64 shrink-0 rounded-2xl bg-white/70 p-3 ring-1 ring-line" aria-label={OPPORTUNITY_STAGE_LABELS[col.stage]}>
                <p className="mb-2 flex justify-between text-sm font-bold"><span>{OPPORTUNITY_STAGE_LABELS[col.stage]}</span><span className="text-slate">{col.items.length}</span></p>
                <div className="space-y-2">
                  {col.items.map((o) => (
                    <article key={o.id} className="rounded-xl border border-line bg-white p-3 text-sm shadow-sm">
                      <Link href={`/organisation/crm/opportunites/${o.id}`} className="font-semibold hover:text-bordeaux-700">{o.title}</Link>
                      <p className="text-xs text-slate">{o.contact ? `${o.contact.firstName} ${o.contact.lastName} · ${o.contact.companyName ?? ""}` : "Sans contact"}</p>
                      <p className="mt-1 text-xs"><strong>{formatMoney(o.valueMinor, o.currency)}</strong> · {o.probabilityPct} %</p>
                      <StageSelect id={o.id} stage={o.stage} />
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <Card><CardHeader title="Nouvelle opportunité" /><CardBody>
            <ApiForm action="/api/v1/crm/opportunity" submitLabel="Créer" successMessage="Opportunité créée." className="grid gap-3 sm:grid-cols-5">
              <Field label="Titre" htmlFor="o-title" required className="sm:col-span-2"><Input id="o-title" name="title" /></Field>
              <Field label="Valeur" htmlFor="o-val" required><Input id="o-val" name="value" type="number" min={0} data-type="number" /></Field>
              <Field label="Devise" htmlFor="o-cur"><Select id="o-cur" name="currency"><option>XOF</option><option>XAF</option><option>EUR</option><option>USD</option></Select></Field>
              <Field label="Étape" htmlFor="o-stage"><Select id="o-stage" name="stage">{OPPORTUNITY_STAGES.filter((s) => s !== "WON" && s !== "LOST").map((s) => <option key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</option>)}</Select></Field>
              <Field label="Contact" htmlFor="o-contact" className="sm:col-span-2"><Select id="o-contact" name="contactId"><option value="">—</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.companyName})</option>)}</Select></Field>
              <Field label="Clôture prévue" htmlFor="o-close"><Input id="o-close" name="expectedCloseDate" type="date" /></Field>
            </ApiForm>
          </CardBody></Card>
        </>
      )}

      {vue === "prospects" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card><CardHeader title={`Prospects (${leads.length})`} /><CardBody className="divide-y divide-line">
            {leads.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{l.companyName}</strong> {l.contactName && `— ${l.contactName}`} <span className="text-xs text-slate">{l.source} · {l.status}</span></span>
                {l.status !== "CONVERTED" && <ActionButton action="/api/v1/crm/convert" body={{ leadId: l.id, title: `Opportunité — ${l.companyName}`, value: 0, currency: "XOF" }} successMessage="Prospect converti en contact + opportunité.">Convertir</ActionButton>}
              </div>
            ))}
          </CardBody></Card>
          <Card><CardHeader title="Nouveau prospect" /><CardBody>
            <ApiForm action="/api/v1/crm/lead" submitLabel="Ajouter" successMessage="Prospect ajouté." className="space-y-3">
              <Field label="Société" htmlFor="l-c" required><Input id="l-c" name="companyName" /></Field>
              <Field label="Contact" htmlFor="l-n"><Input id="l-n" name="contactName" /></Field>
              <Field label="Email" htmlFor="l-e"><Input id="l-e" name="email" type="email" /></Field>
              <Field label="Téléphone" htmlFor="l-p"><Input id="l-p" name="phone" /></Field>
              <Field label="Source" htmlFor="l-s"><Input id="l-s" name="source" placeholder="Salon, site, recommandation…" /></Field>
              <Field label="Notes" htmlFor="l-no"><Textarea id="l-no" name="notes" /></Field>
            </ApiForm>
          </CardBody></Card>
        </div>
      )}

      {vue === "contacts" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card><CardHeader title={`Contacts (${contacts.length})`} /><CardBody className="divide-y divide-line text-sm">{contacts.map((c) => <p key={c.id} className="py-2"><strong>{c.firstName} {c.lastName}</strong> — {c.position ?? ""} {c.companyName ? `· ${c.companyName}` : ""} <span className="text-xs text-slate">{c.email}</span></p>)}</CardBody></Card>
          <Card><CardHeader title="Nouveau contact" /><CardBody>
            <ApiForm action="/api/v1/crm/contact" submitLabel="Ajouter" successMessage="Contact ajouté." className="space-y-3">
              <Field label="Prénom" htmlFor="c-f" required><Input id="c-f" name="firstName" /></Field>
              <Field label="Nom" htmlFor="c-l" required><Input id="c-l" name="lastName" /></Field>
              <Field label="Société" htmlFor="c-co"><Input id="c-co" name="companyName" /></Field>
              <Field label="Fonction" htmlFor="c-po"><Input id="c-po" name="position" /></Field>
              <Field label="Email" htmlFor="c-e"><Input id="c-e" name="email" type="email" /></Field>
              <Field label="Téléphone" htmlFor="c-p"><Input id="c-p" name="phone" /></Field>
            </ApiForm>
          </CardBody></Card>
        </div>
      )}

      {vue === "activites" && (
        <Card><CardHeader title="Activités et relances à venir" /><CardBody className="divide-y divide-line text-sm">
          {reminders.length === 0 && <p className="text-slate">Aucune relance planifiée.</p>}
          {reminders.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><strong className={a.dueAt && a.dueAt < new Date() ? "text-red-700" : ""}>{a.dueAt?.toLocaleDateString("fr-FR")}</strong> — {a.kind} : {a.subject} {a.opportunity && <span className="text-xs text-slate">({a.opportunity.title})</span>}</span>
              <ActionButton action="/api/v1/crm/activity-done" body={{ id: a.id }} successMessage="Activité réalisée.">Fait</ActionButton>
            </div>
          ))}
        </CardBody></Card>
      )}
    </>
  );
}
