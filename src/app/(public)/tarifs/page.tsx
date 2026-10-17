import type { Metadata } from "next";
import { Check } from "lucide-react";
import { listPublicPlans } from "@/application/billing.service";
import { formatMoney } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Badge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";

export const metadata: Metadata = { title: "Tarifs" };
export const dynamic = "force-dynamic";
const INTERVAL = { MONTH: "/ mois", YEAR: "/ an", ONE_TIME: "" } as const;

/** Grille lue depuis la configuration (plans et prix administrables), jamais codée en dur. */
export default async function PricingPage() {
  const plans = await listPublicPlans();
  const groups = [
    { title: "Pour les experts", items: plans.filter((p) => p.audience === "EXPERT" && p.isRecurring) },
    { title: "Pour les organisations", items: plans.filter((p) => p.audience === "ORGANIZATION" && p.isRecurring) },
    { title: "Services à la carte", items: plans.filter((p) => !p.isRecurring) },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader title="Tarifs" description="Offres et prix configurés par Talent Bridge. Prix HT ; TVA appliquée selon le pays de facturation." />
      {groups.map((g) => g.items.length > 0 && (
        <section key={g.title} className="mb-12">
          <h2 className="mb-5 text-2xl font-extrabold">{g.title}</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {g.items.map((p) => (
              <div key={p.id} className={`flex flex-col rounded-2xl border bg-white p-6 shadow-card ${p.highlight ? "border-orange-500 ring-2 ring-orange-200" : "border-line"}`}>
                {p.highlight && <Badge tone="orange" className="mb-2 w-fit">Recommandé</Badge>}
                <h3 className="font-display text-xl font-extrabold">{p.name}</h3>
                <p className="mt-1 text-sm text-slate">{p.description}</p>
                <div className="mt-4 space-y-1">
                  {p.prices.map((pr) => <p key={pr.id}><span className="font-display text-2xl font-extrabold">{pr.amountMinor === 0 ? "Gratuit" : formatMoney(pr.amountMinor, pr.currency)}</span> <span className="text-sm text-slate">{pr.amountMinor ? INTERVAL[pr.interval] : ""}</span></p>)}
                </div>
                {p.features.length > 0 && <ul className="mt-4 space-y-1.5 text-sm">{p.features.map((f) => <li key={f.featureId} className="flex gap-2"><Check className="h-4 w-4 text-olive-600" />{f.feature.name}{f.limit !== null ? ` : ${f.limit}` : " : illimité"}</li>)}</ul>}
                <div className="mt-auto pt-6"><ButtonLink href={p.audience === "EXPERT" ? "/facturation?offre=" + p.code : "/facturation?offre=" + p.code} variant={p.highlight ? "primary" : "outline"} className="w-full">Choisir</ButtonLink></div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="text-sm text-slate">Paiement par Mobile Money, carte ou virement via des prestataires agréés. Les montants affichés sont ceux de la configuration en vigueur.</p>
    </div>
  );
}
