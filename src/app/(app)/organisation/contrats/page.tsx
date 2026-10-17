import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgUser } from "@/lib/session";
import { listOrgContracts } from "@/application/project.service";
import { formatMoney } from "@/domain/money";
import { CONTRACT_STATUS_LABELS, contractFlow } from "@/domain/workflows";
import { orgRoleCan } from "@/domain/permissions";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody } from "@/ui/Card";
import { StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Select, Textarea } from "@/ui/Field";
import { EmptyState } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Contrats" };
const NEXT_LABEL: Record<string, string> = { SENT: "Envoyer à l'expert", ACTIVE: "Démarrer", COMPLETED: "Marquer terminé", TERMINATED: "Résilier", DRAFT: "Repasser en brouillon" };

export default async function OrgContracts() {
  const { user, role, org } = await requireOrgUser("org.view");
  const contracts = await listOrgContracts(user, org.id);
  const can = orgRoleCan(role, "contracts.manage");
  return (
    <>
      <PageHeader title="Contrats" description="Contrats issus des candidatures retenues. La signature de l'expert est horodatée et journalisée." />
      {contracts.length === 0 ? <EmptyState title="Aucun contrat" description="Retenez un candidat pour établir un contrat." /> : (
        <div className="space-y-4">
          {contracts.map((c) => (
            <Card key={c.id}><CardBody className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="text-sm">
                <p className="font-mono text-xs text-slate">{c.reference}</p>
                <p className="font-display text-lg font-bold">{c.mission.title}</p>
                <p>Expert : <Link href={`/experts/${c.expert.slug}`} className="underline">{c.expert.user.firstName} {c.expert.user.lastName}</Link> · {formatMoney(c.amountMinor, c.currency)} · commission plateforme {(c.commissionBps / 100).toFixed(1)} %</p>
                <p className="text-xs text-slate">{c.startDate ? `Du ${c.startDate.toLocaleDateString("fr-FR")}` : ""}{c.endDate ? ` au ${c.endDate.toLocaleDateString("fr-FR")}` : ""}{c.signedAt ? ` · signé le ${c.signedAt.toLocaleDateString("fr-FR")}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={c.status} label={CONTRACT_STATUS_LABELS[c.status]} />
                {can && <div className="flex flex-wrap justify-end gap-2">{contractFlow.next(c.status).filter((s) => s !== "SIGNED").map((s) => <ActionButton key={s} action={`/api/v1/contracts/${c.id}/status`} body={{ status: s }} variant={s === "TERMINATED" ? "danger" : "outline"} confirm={s === "TERMINATED" ? "Résilier ce contrat ?" : s === "COMPLETED" ? "Confirmer la fin de mission ? La commission plateforme sera calculée." : undefined} successMessage="Contrat mis à jour.">{NEXT_LABEL[s] ?? s}</ActionButton>)}</div>}
                {c.status === "SENT" && <p className="text-xs text-slate">En attente de signature de l'expert.</p>}
                {can && c.status === "COMPLETED" && c.reviews.length === 0 && (
                  <details className="w-72 rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Évaluer l'expert</summary>
                    <ApiForm action={`/api/v1/contracts/${c.id}/review`} submitLabel="Publier l'évaluation" successMessage="Évaluation publiée." className="mt-2 space-y-2">
                      <Field label="Note" htmlFor={`rt-${c.id}`}><Select id={`rt-${c.id}`} name="rating" data-type="number" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n}/5)</option>)}</Select></Field>
                      <Field label="Commentaire" htmlFor={`rc-${c.id}`}><Textarea id={`rc-${c.id}`} name="comment" /></Field>
                    </ApiForm>
                  </details>
                )}
              </div>
            </CardBody></Card>
          ))}
        </div>
      )}
    </>
  );
}
