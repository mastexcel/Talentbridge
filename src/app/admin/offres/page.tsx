import type { Metadata } from "next";
import { prisma } from "@/infrastructure/db";
import { requireAdminUser } from "@/lib/session";
import { formatMoney } from "@/domain/money";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { ApiForm } from "@/ui/ApiForm";
import { ActionButton } from "@/ui/ActionButton";
import { Checkbox, Field, Input, Select, Textarea } from "@/ui/Field";
import { Badge } from "@/ui/Badge";

export const metadata: Metadata = { title: "Offres et tarifs" };
const INTERVAL = { MONTH: "/ mois", YEAR: "/ an", ONE_TIME: "unique" } as const;

/** Configuration commerciale : plans, prix par devise/pays, fonctionnalités et limites, coupons. Rien n'est codé en dur. */
export default async function OffersAdmin() {
  await requireAdminUser("FINANCE_MANAGE");
  const [plans, features, coupons] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: [{ audience: "asc" }, { sortOrder: "asc" }], include: { prices: true, features: { include: { feature: true } }, _count: { select: { subscriptions: true } } } }),
    prisma.feature.findMany({ orderBy: { code: "asc" } }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Offres et tarifs" description="Les modifications s'appliquent aux nouvelles souscriptions ; les souscriptions existantes conservent leur prix." />
      <div className="space-y-6">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader title={<span className="flex flex-wrap items-center gap-2">{p.name} <Badge>{p.code}</Badge><Badge tone={p.audience === "EXPERT" ? "orange" : "bordeaux"}>{p.audience === "EXPERT" ? "Experts" : "Organisations"}</Badge>{!p.isActive && <Badge tone="red">Inactive</Badge>}</span>} description={`${p._count.subscriptions} souscription(s)`} />
            <CardBody className="grid gap-6 lg:grid-cols-3">
              <ApiForm action="/api/v1/admin/plan-save" successMessage="Offre enregistrée." className="space-y-2" extra={{ id: p.id }}>
                <Field label="Code" htmlFor={`c-${p.id}`}><Input id={`c-${p.id}`} name="code" defaultValue={p.code} /></Field>
                <Field label="Nom" htmlFor={`n-${p.id}`}><Input id={`n-${p.id}`} name="name" defaultValue={p.name} /></Field>
                <Field label="Audience" htmlFor={`a-${p.id}`}><Select id={`a-${p.id}`} name="audience" defaultValue={p.audience}><option value="EXPERT">Experts</option><option value="ORGANIZATION">Organisations</option></Select></Field>
                <Field label="Description" htmlFor={`d-${p.id}`}><Textarea id={`d-${p.id}`} name="description" defaultValue={p.description} /></Field>
                <Field label="Ordre" htmlFor={`o-${p.id}`}><Input id={`o-${p.id}`} name="sortOrder" type="number" data-type="number" defaultValue={p.sortOrder} /></Field>
                <div className="flex flex-wrap gap-3"><Checkbox name="isRecurring" defaultChecked={p.isRecurring} label="Récurrente" /><Checkbox name="isActive" defaultChecked={p.isActive} label="Active" /><Checkbox name="isPublic" defaultChecked={p.isPublic} label="Publique" /><Checkbox name="highlight" defaultChecked={p.highlight} label="Mise en avant" /></div>
              </ApiForm>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Prix</p>
                {p.prices.map((pr) => <div key={pr.id} className="flex items-center justify-between"><span className={pr.isActive ? "" : "text-slate line-through"}>{formatMoney(pr.amountMinor, pr.currency)} {INTERVAL[pr.interval]}{pr.countryCode ? ` (${pr.countryCode})` : ""}</span><ActionButton action="/api/v1/admin/price-toggle" body={{ id: pr.id, isActive: !pr.isActive }} variant="ghost" successMessage="Prix mis à jour.">{pr.isActive ? "Désactiver" : "Réactiver"}</ActionButton></div>)}
                <ApiForm action="/api/v1/admin/price-add" submitLabel="Ajouter un prix" successMessage="Prix ajouté." className="grid grid-cols-2 gap-2 border-t border-line pt-2" extra={{ planId: p.id }}>
                  <Input name="amount" type="number" data-type="number" placeholder="Montant" aria-label="Montant" />
                  <Select name="currency" aria-label="Devise"><option>XOF</option><option>XAF</option><option>EUR</option><option>USD</option><option>GHS</option><option>NGN</option><option>KES</option><option>MAD</option></Select>
                  <Select name="interval" aria-label="Périodicité"><option value="MONTH">Mensuel</option><option value="YEAR">Annuel</option><option value="ONE_TIME">Unique</option></Select>
                  <Input name="countryCode" placeholder="Pays (facultatif)" maxLength={2} aria-label="Pays" />
                </ApiForm>
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Fonctionnalités et limites</p>
                {features.map((f) => {
                  const pf = p.features.find((x) => x.featureId === f.id);
                  return (
                    <ApiForm key={f.id} action="/api/v1/admin/plan-feature" submitLabel="OK" successMessage="Fonctionnalité mise à jour." className="flex items-center gap-2" extra={{ planId: p.id, featureCode: f.code }}>
                      <Checkbox name="included" defaultChecked={!!pf} label={f.name} className="flex-1" />
                      <Input name="limit" type="number" data-type="number" defaultValue={pf?.limit ?? ""} placeholder="∞" className="h-8 w-16" aria-label={`Limite ${f.name}`} />
                    </ApiForm>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        ))}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader title="Nouvelle offre" /><CardBody>
            <ApiForm action="/api/v1/admin/plan-save" submitLabel="Créer" successMessage="Offre créée." className="space-y-2">
              <Input name="code" placeholder="CODE_OFFRE" aria-label="Code" /><Input name="name" placeholder="Nom" aria-label="Nom" />
              <Select name="audience" aria-label="Audience"><option value="ORGANIZATION">Organisations</option><option value="EXPERT">Experts</option></Select>
              <Textarea name="description" placeholder="Description" aria-label="Description" />
              <input type="hidden" name="sortOrder" value="50" data-type="number" />
              <div className="flex gap-3"><Checkbox name="isRecurring" defaultChecked label="Récurrente" /><Checkbox name="isActive" defaultChecked label="Active" /><Checkbox name="isPublic" defaultChecked label="Publique" /></div>
            </ApiForm>
          </CardBody></Card>
          <Card><CardHeader title="Coupons promotionnels" /><CardBody className="space-y-3 text-sm">
            {coupons.map((c) => <div key={c.id} className="flex items-center justify-between"><span><strong>{c.code}</strong> — {c.percentOffBps ? `${c.percentOffBps / 100} %` : formatMoney(c.amountOffMinor ?? 0, c.currency ?? "XOF")} · {c.redemptions}/{c.maxRedemptions ?? "∞"}{c.validUntil ? ` · jusqu'au ${c.validUntil.toLocaleDateString("fr-FR")}` : ""}</span><ActionButton action="/api/v1/admin/coupon-toggle" body={{ id: c.id, isActive: !c.isActive }} variant="ghost" successMessage="Coupon mis à jour.">{c.isActive ? "Désactiver" : "Activer"}</ActionButton></div>)}
            <ApiForm action="/api/v1/admin/coupon-create" submitLabel="Créer le coupon" successMessage="Coupon créé." className="grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Input name="code" placeholder="CODE" aria-label="Code" /><Input name="percentOff" type="number" data-type="number" placeholder="% de remise" aria-label="Pourcentage" />
              <Input name="amountOff" type="number" data-type="number" placeholder="ou montant fixe" aria-label="Montant" /><Select name="currency" aria-label="Devise"><option value="">Devise (montant fixe)</option><option>XOF</option><option>EUR</option></Select>
              <Input name="maxRedemptions" type="number" data-type="number" placeholder="Utilisations max" aria-label="Utilisations max" /><Input name="validUntil" type="date" aria-label="Validité" />
            </ApiForm>
          </CardBody></Card>
        </div>
      </div>
    </>
  );
}
