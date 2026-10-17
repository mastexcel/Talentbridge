import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/infrastructure/db";
import { requireOrgUser } from "@/lib/session";
import { getBid } from "@/application/tender.service";
import { complianceRate, daysUntil } from "@/domain/tenders";
import { BID_STATUS_LABELS } from "@/ui/labels";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, StatusBadge } from "@/ui/Badge";
import { Progress } from "@/ui/Stat";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";
import { Table, TBody, Td, Th, THead } from "@/ui/Table";
import { FileUpload } from "@/ui/FileUpload";

export const metadata: Metadata = { title: "Dossier de candidature" };
const CAT: Record<string, string> = { ADMINISTRATIVE: "Administratif", TECHNICAL: "Technique", FINANCIAL: "Financier", EXPERTS: "Experts" };
const REQ: Record<string, string> = { MISSING: "Manquant", IN_PROGRESS: "En cours", READY: "Prêt" };

export default async function BidPage({ params }: { params: Promise<{ bidId: string }> }) {
  const { bidId } = await params;
  const { user, org } = await requireOrgUser("tenders.manage");
  const bid = await getBid(user, bidId);
  const [experts, partnerOrgs] = await Promise.all([
    prisma.expertProfile.findMany({ where: { visibility: { in: ["PUBLIC", "MEMBERS"] }, completeness: { gte: 50 } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, headline: true }, orderBy: { completeness: "desc" }, take: 200 }),
    prisma.organization.findMany({ where: { id: { not: org.id }, status: "VERIFIED" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const rate = complianceRate(bid.requirements);
  const drafts = bid.requirements.filter((r) => r.isDraft).length;
  return (
    <>
      <PageHeader back={{ href: "/organisation/appels-offres", label: "Dossiers" }} title={bid.tender.title} description={<>{bid.tender.buyerName} · clôture le {bid.tender.deadline.toLocaleDateString("fr-FR")} (J-{daysUntil(bid.tender.deadline)}) · <StatusBadge status={bid.status} label={BID_STATUS_LABELS[bid.status]} /></>} actions={<Link href={`/appels-offres/${bid.tenderId}`} className="text-sm underline">Avis complet</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Matrice de conformité / checklist" description={`${rate} % des pièces prêtes`} action={<ActionButton action={`/api/v1/bids/${bid.id}/extract`} prompt={{ key: "tdrText", label: "Collez le texte des TDR (facultatif : l'avis est déjà analysé)" }} successMessage="Exigences repérées ajoutées en brouillon.">Analyser les TDR</ActionButton>} />
            <CardBody>
              <Progress value={rate} />
              {drafts > 0 && <Alert tone="warning" className="mt-3">{drafts} exigence(s) proposée(s) automatiquement : brouillons à vérifier dans les TDR puis à confirmer. Rien n'est inventé : seules des pièces usuelles repérées dans le texte sont proposées.</Alert>}
            </CardBody>
            <Table><THead><tr><Th>Catégorie</Th><Th>Exigence</Th><Th>Statut</Th><Th>Pièce</Th><Th /></tr></THead>
              <TBody>{bid.requirements.map((r) => (
                <tr key={r.id}>
                  <Td>{CAT[r.category] ?? r.category}</Td>
                  <Td>{r.label}{r.isDraft && <Badge tone="demo" className="ml-2">Brouillon à vérifier</Badge>}{r.note && <p className="text-xs text-slate">{r.note}</p>}</Td>
                  <Td><StatusBadge status={r.status} label={REQ[r.status]} /></Td>
                  <Td>{r.fileId ? <a className="text-orange-700 underline" href={`/api/v1/files/${r.fileId}`}>Document</a> : <FileUpload purpose="TENDER" organizationId={org.id} accept=".pdf,.docx,.xlsx" label="Joindre" attach={{ action: `/api/v1/bids/${bid.id}/requirement-update`, body: { requirementId: r.id, status: "READY" } }} />}</Td>
                  <Td className="space-y-1">
                    {r.isDraft && <ActionButton action={`/api/v1/bids/${bid.id}/requirement-update`} body={{ requirementId: r.id, confirm: true }} successMessage="Exigence confirmée.">Confirmer</ActionButton>}
                    {r.status !== "READY" && <ActionButton action={`/api/v1/bids/${bid.id}/requirement-update`} body={{ requirementId: r.id, status: "READY" }} variant="success" successMessage="Pièce prête.">Prêt</ActionButton>}
                    <ActionButton action={`/api/v1/bids/${bid.id}/requirement-delete`} body={{ requirementId: r.id }} variant="ghost" confirm="Supprimer cette ligne ?" successMessage="Supprimée.">Suppr.</ActionButton>
                  </Td>
                </tr>
              ))}</TBody></Table>
            <CardBody className="border-t border-line">
              <ApiForm action={`/api/v1/bids/${bid.id}/requirement-add`} submitLabel="Ajouter" successMessage="Exigence ajoutée." className="grid gap-2 sm:grid-cols-[180px_1fr]">
                <Select name="category" aria-label="Catégorie"><option value="ADMINISTRATIVE">Administratif</option><option value="TECHNICAL">Technique</option><option value="FINANCIAL">Financier</option><option value="EXPERTS">Experts</option></Select>
                <Input name="label" placeholder="Pièce ou exigence à préparer" aria-label="Exigence" />
              </ApiForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Experts clés associés" description="Uniquement des experts réels de l'annuaire, avec leur CV déposé." />
            <CardBody className="space-y-2 text-sm">
              {bid.experts.map((e) => <p key={e.expertId}><Link href={`/experts/${e.expert.slug}`} className="font-semibold underline">{e.expert.user.firstName} {e.expert.user.lastName}</Link> — {e.role} {e.expert.cvFileId ? <a href={`/api/v1/files/${e.expert.cvFileId}`} className="ml-2 text-orange-700 underline">CV</a> : <Badge tone="orange">CV non déposé</Badge>}</p>)}
              <ApiForm action={`/api/v1/bids/${bid.id}/expert`} submitLabel="Associer" successMessage="Expert associé." className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]">
                <Select name="expertId" aria-label="Expert">{experts.map((e) => <option key={e.id} value={e.id}>{e.user.firstName} {e.user.lastName} — {e.headline?.slice(0, 50)}</option>)}</Select>
                <Input name="role" placeholder="Rôle (ex. chef d'équipe)" aria-label="Rôle" />
              </ApiForm>
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card><CardHeader title="Statut du dossier" /><CardBody className="flex flex-wrap gap-2">
            {(["PREPARING", "SUBMITTED", "WON", "LOST", "WITHDRAWN"] as const).filter((s) => s !== bid.status).map((s) => <ActionButton key={s} action={`/api/v1/bids/${bid.id}/status`} body={{ status: s }} variant={s === "SUBMITTED" ? "primary" : "outline"} confirm={s === "SUBMITTED" ? "Marquer le dossier comme soumis ? Toutes les pièces doivent être prêtes et confirmées." : undefined} successMessage="Statut mis à jour.">{BID_STATUS_LABELS[s]}</ActionButton>)}
          </CardBody></Card>
          <Card><CardHeader title="Consortium" description="Associez vos partenaires (organisations validées)." /><CardBody className="space-y-3 text-sm">
            {bid.consortium && <div><p className="font-semibold">{bid.consortium.name}</p><ul className="text-slate">{bid.consortium.members.map((m) => <li key={m.organizationId}>{m.organization.name} ({m.role === "LEAD" ? "chef de file" : "membre"})</li>)}</ul></div>}
            <ApiForm action={`/api/v1/bids/${bid.id}/consortium`} submitLabel="Enregistrer" successMessage="Consortium enregistré." className="space-y-2">
              <Field label="Nom du groupement" htmlFor="c-name"><Input id="c-name" name="name" defaultValue={bid.consortium?.name ?? `Groupement ${org.name}`} /></Field>
              <Field label="Partenaires" htmlFor="c-p"><select id="c-p" name="partnerOrgIds" multiple className="h-28 w-full rounded-xl border border-line p-2 text-sm" defaultValue={bid.consortium?.members.map((m) => m.organizationId) ?? []}>{partnerOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            </ApiForm>
          </CardBody></Card>
          <Card><CardBody className="text-sm">Échéance interne conseillée : <strong>{bid.internalDeadline?.toLocaleDateString("fr-FR") ?? "—"}</strong> (3 jours avant la clôture).</CardBody></Card>
        </aside>
      </div>
    </>
  );
}
