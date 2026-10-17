import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireExpertUser } from "@/lib/session";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Field, Input, Select } from "@/ui/Field";

export const metadata: Metadata = { title: "Disponibilités" };
const KIND = { AVAILABLE: ["Disponible", "bg-olive-500"], BOOKED: ["Engagé", "bg-orange-500"], UNAVAILABLE: ["Indisponible", "bg-bordeaux-600"] } as const;

/** Calendrier de disponibilité sur 6 mois : les périodes engagées sont exclues par le matching. */
export default async function AvailabilityPage() {
  const user = await requireExpertUser("/espace/disponibilites");
  const slots = await prisma.availabilitySlot.findMany({ where: { expertId: user.expertProfile.id, endDate: { gte: new Date(Date.now() - 31 * 86_400_000) } }, orderBy: { startDate: "asc" } });
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1)));
  const status = (d: Date) => slots.find((s) => s.startDate <= d && s.endDate >= d)?.kind;
  return (
    <>
      <PageHeader title="Calendrier de disponibilité" description="Indiquez vos périodes engagées ou indisponibles : elles sont prises en compte dans le calcul des recommandations." />
      <div className="mb-6 flex flex-wrap gap-4 text-xs">{Object.values(KIND).map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className={`h-3 w-3 rounded ${c}`} />{l}</span>)}<span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-line bg-white" />Non renseigné</span></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {months.map((m) => {
          const days = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
          const offset = (m.getUTCDay() + 6) % 7;
          return (
            <Card key={m.toISOString()}>
              <CardHeader title={m.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })} />
              <CardBody>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="font-semibold text-slate">{d}</span>)}
                  {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const d = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), i + 1, 12));
                    const k = status(d);
                    return <span key={i} title={k ? KIND[k][0] : undefined} className={`rounded py-1 ${k ? `${KIND[k][1]} text-white` : "border border-line"}`}>{i + 1}</span>;
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ajouter une période" />
          <CardBody>
            <ApiForm action="/api/v1/me/item-add" submitLabel="Ajouter" successMessage="Période ajoutée." className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="itemKind" value="slot" />
              <Field label="Du" htmlFor="s-start" required><Input id="s-start" name="startDate" type="date" /></Field>
              <Field label="Au" htmlFor="s-end" required><Input id="s-end" name="endDate" type="date" /></Field>
              <Field label="Type" htmlFor="s-kind"><Select id="s-kind" name="kind" defaultValue="BOOKED"><option value="BOOKED">Engagé (autre mission)</option><option value="UNAVAILABLE">Indisponible</option><option value="AVAILABLE">Disponible</option></Select></Field>
              <Field label="Note (privée)" htmlFor="s-note"><Input id="s-note" name="note" /></Field>
            </ApiForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Périodes renseignées" />
          <CardBody className="space-y-2 text-sm">
            {slots.length === 0 && <p className="text-slate">Aucune période.</p>}
            {slots.map((s) => <div key={s.id} className="flex items-center justify-between rounded-xl border border-line p-2"><span><span className={`mr-2 inline-block h-2.5 w-2.5 rounded ${KIND[s.kind][1]}`} />{s.startDate.toLocaleDateString("fr-FR")} → {s.endDate.toLocaleDateString("fr-FR")} · {KIND[s.kind][0]}{s.note ? ` — ${s.note}` : ""}</span><ActionButton action="/api/v1/me/item-remove" body={{ kind: "slot", id: s.id }} variant="ghost" successMessage="Période supprimée."><Trash2 className="h-4 w-4" /><span className="sr-only">Supprimer</span></ActionButton></div>)}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
