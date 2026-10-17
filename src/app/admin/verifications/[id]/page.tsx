import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminUser } from "@/lib/session";
import { adminGetRequest } from "@/application/verification.service";
import { REQUIRED_CHECKS, VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS, canApproveVerification } from "@/domain/workflows";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { Badge, StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { ApiForm } from "@/ui/ApiForm";
import { Select, Input } from "@/ui/Field";
import { Alert } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Instruction de la demande" };
const STEP_LABELS: Record<string, string> = { COMPLETENESS: "Contrôle de complétude", ADMINISTRATIVE: "Vérification administrative (identité)", DIPLOMAS: "Contrôle des diplômes", REFERENCES: "Vérification des références", SKILLS_ASSESSMENT: "Évaluation des compétences" };

export default async function VerificationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminUser("EXPERTS_VERIFY");
  const r = await adminGetRequest(admin, id);
  const gate = canApproveVerification(r.type, r.checks);
  const e = r.expert;
  return (
    <>
      <PageHeader back={{ href: "/admin/verifications", label: "File d'attente" }} title={`${e.user.firstName} ${e.user.lastName}`} description={<>{VERIFICATION_TYPE_LABELS[r.type]} · <StatusBadge status={r.status} label={VERIFICATION_STATUS_LABELS[r.status]} /> · <Link href={`/experts/${e.slug}`} className="underline">profil</Link></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card><CardHeader title="Justificatifs déposés" description="Ouverture journalisée ; liens à durée limitée." /><CardBody className="space-y-2 text-sm">
            {r.documents.length === 0 && <p className="text-slate">Aucun document.</p>}
            {r.documents.map((d) => <p key={d.id}><a href={`/api/v1/files/${d.file.id}`} target="_blank" className="font-semibold text-orange-700 underline">{d.file.filename}</a> <Badge>{d.kind}</Badge> <span className="text-xs text-slate">{d.label} · {Math.round(d.file.sizeBytes / 1024)} Ko</span></p>)}
            <p className="pt-2 text-xs text-slate">Identité déclarée : {e.user.firstName} {e.user.lastName} · {e.user.email} · {e.user.phone ?? "—"}</p>
          </CardBody></Card>
          <Card><CardHeader title="Diplômes et références (vérification unitaire)" /><CardBody className="space-y-3 text-sm">
            {e.qualifications.map((q) => <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2"><span>{q.title} — {q.institution} {q.year} <Badge tone={q.status === "VERIFIED" ? "olive" : q.status === "REJECTED" ? "red" : "neutral"}>{q.status}</Badge></span><span className="flex gap-1"><ActionButton action="/api/v1/admin/verify-item" body={{ kind: "qualification", id: q.id, verified: true }} variant="success" successMessage="Diplôme vérifié.">Vérifié</ActionButton><ActionButton action="/api/v1/admin/verify-item" body={{ kind: "qualification", id: q.id, verified: false }} successMessage="Marqué non vérifiable.">Non vérifiable</ActionButton></span></div>)}
            {e.references.map((x) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2"><span>{x.missionTitle} — {x.contactOrg}<br /><span className="text-xs text-slate">Référent : {x.contactName} · {x.contactEmail ?? "—"} · {x.contactPhone ?? "—"}</span> <Badge tone={x.status === "VERIFIED" ? "olive" : "neutral"}>{x.status}</Badge></span><span className="flex gap-1"><ActionButton action="/api/v1/admin/verify-item" body={{ kind: "reference", id: x.id, verified: true }} variant="success" confirm="Confirmez-vous avoir contacté le référent et obtenu confirmation ?" successMessage="Référence vérifiée.">Vérifiée</ActionButton><ActionButton action="/api/v1/admin/verify-item" body={{ kind: "reference", id: x.id, verified: false }} successMessage="Référence rejetée.">Rejeter</ActionButton></span></div>)}
          </CardBody></Card>
          <Card><CardHeader title="Historique des décisions" /><CardBody><ol className="space-y-1 border-l-2 border-orange-200 pl-4 text-xs">{r.events.map((ev) => <li key={ev.id}>{ev.createdAt.toLocaleString("fr-FR")} — {VERIFICATION_STATUS_LABELS[ev.fromStatus]} → <strong>{VERIFICATION_STATUS_LABELS[ev.toStatus]}</strong>{ev.note ? ` : ${ev.note}` : ""}</li>)}</ol></CardBody></Card>
        </div>
        <aside className="space-y-6">
          <Card><CardHeader title="Contrôles requis" description="Saisie obligatoire avant toute décision « Vérifié »." /><CardBody className="space-y-3 text-sm">
            {r.status === "PENDING" && <ActionButton action="/api/v1/admin/verification-decide" body={{ requestId: r.id, decision: "START_REVIEW" }} variant="primary" successMessage="Instruction démarrée." className="w-full">Démarrer l'instruction</ActionButton>}
            {REQUIRED_CHECKS[r.type].map((step) => {
              const c = r.checks.find((x) => x.step === step);
              return (
                <div key={step} className="rounded-xl border border-line p-3">
                  <p className="font-semibold">{STEP_LABELS[step]} {c && <Badge tone={c.result === "PASS" ? "olive" : c.result === "FAIL" ? "red" : "neutral"}>{c.result}</Badge>}</p>
                  {c?.note && <p className="text-xs text-slate">{c.note}</p>}
                  {r.status === "IN_REVIEW" && (
                    <ApiForm action="/api/v1/admin/verification-check" submitLabel="Enregistrer" successMessage="Contrôle enregistré." className="mt-2 grid grid-cols-[110px_1fr] gap-2" transform={(d) => ({ ...d, requestId: r.id, step })}>
                      <Select name="result" defaultValue={c?.result ?? "PASS"} aria-label="Résultat"><option value="PASS">Conforme</option><option value="FAIL">Non conforme</option><option value="NOT_APPLICABLE">N/A</option></Select>
                      <Input name="note" placeholder="Observation" defaultValue={c?.note ?? ""} aria-label="Observation" />
                    </ApiForm>
                  )}
                </div>
              );
            })}
          </CardBody></Card>
          {r.status === "IN_REVIEW" && (
            <Card><CardHeader title="Décision" /><CardBody className="space-y-2">
              {!gate.ok && <Alert tone="warning">Décision « Vérifié » impossible : {gate.missing.length ? `contrôles manquants (${gate.missing.map((s) => STEP_LABELS[s]).join(", ")})` : ""}{gate.failed.length ? ` contrôles non conformes (${gate.failed.map((s) => STEP_LABELS[s]).join(", ")})` : ""}.</Alert>}
              <ActionButton action="/api/v1/admin/verification-decide" body={{ requestId: r.id, decision: "APPROVE" }} variant="success" size="md" className="w-full" prompt={{ key: "note", label: "Note de décision (facultative)" }} successMessage="Vérification validée, badge attribué.">Valider et attribuer le badge</ActionButton>
              <ActionButton action="/api/v1/admin/verification-decide" body={{ requestId: r.id, decision: "REQUEST_INFO" }} className="w-full" prompt={{ key: "note", label: "Complément demandé à l'expert", required: true }} successMessage="Complément demandé.">Demander un complément</ActionButton>
              <ActionButton action="/api/v1/admin/verification-decide" body={{ requestId: r.id, decision: "REJECT" }} variant="danger" className="w-full" prompt={{ key: "note", label: "Motif du refus (communiqué à l'expert)", required: true }} successMessage="Demande refusée.">Refuser</ActionButton>
            </CardBody></Card>
          )}
          {r.badges.length > 0 && <Card><CardHeader title="Badge attribué" /><CardBody className="space-y-2 text-sm">{r.badges.map((b) => <div key={b.id}><p>{b.badge.nameFr} — {b.revokedAt ? `révoqué le ${b.revokedAt.toLocaleDateString("fr-FR")}` : `valable jusqu'au ${b.expiresAt?.toLocaleDateString("fr-FR") ?? "—"}`}</p>{!b.revokedAt && <ActionButton action="/api/v1/admin/badge-revoke" body={{ expertBadgeId: b.id }} variant="danger" prompt={{ key: "reason", label: "Motif de la révocation", required: true }} successMessage="Badge révoqué.">Révoquer</ActionButton>}</div>)}</CardBody></Card>}
        </aside>
      </div>
    </>
  );
}
