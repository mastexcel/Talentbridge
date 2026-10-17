import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireExpertUser } from "@/lib/session";
import { myVerifications } from "@/application/verification.service";
import { recomputeCompleteness } from "@/application/expert.service";
import { MIN_COMPLETENESS_FOR_VERIFICATION } from "@/domain/profile";
import { VERIFICATION_STATUS_LABELS, VERIFICATION_TYPE_LABELS, type VerificationType } from "@/domain/workflows";
import { PageHeader } from "@/ui/Page";
import { Card, CardBody, CardHeader } from "@/ui/Card";
import { StatusBadge } from "@/ui/Badge";
import { ActionButton } from "@/ui/ActionButton";
import { FileUpload } from "@/ui/FileUpload";
import { Alert } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Vérification et certification" };

const DOCS: Record<VerificationType, { kind: string; label: string }[]> = {
  IDENTITY: [{ kind: "ID_CARD", label: "Pièce d'identité (CNI ou passeport)" }],
  DOCUMENTS: [{ kind: "DIPLOMA", label: "Copie de diplôme" }, { kind: "CERTIFICATE", label: "Certificat professionnel" }, { kind: "REFERENCE_LETTER", label: "Attestation / lettre de référence" }],
  SKILLS: [{ kind: "OTHER", label: "Pièce complémentaire (facultatif)" }],
};
const STEPS = ["Dépôt des justificatifs", "Contrôle de complétude", "Vérification administrative", "Contrôle des diplômes", "Vérification des références", "Évaluation des compétences", "Décision", "Attribution du badge", "Renouvellement"];

export default async function VerificationPage() {
  const user = await requireExpertUser("/espace/verification");
  const [requests, { score }] = await Promise.all([myVerifications(user.expertProfile.id), recomputeCompleteness(user.expertProfile.id)]);
  return (
    <>
      <PageHeader title="Centre de vérification" description="Chaque badge est attribué par un vérificateur après contrôle humain : jamais sur simple dépôt de document." />
      {score < MIN_COMPLETENESS_FOR_VERIFICATION && <Alert tone="warning" className="mb-6">Votre profil est complété à {score} % : {MIN_COMPLETENESS_FOR_VERIFICATION} % sont nécessaires pour soumettre une demande. <a href="/espace/profil" className="underline">Compléter mon profil</a></Alert>}
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">{STEPS.map((s, i) => <li key={s} className="rounded-full border border-line bg-white px-3 py-1"><strong className="text-orange-700">{i + 1}.</strong> {s}</li>)}</ol>
      <div className="grid gap-6 lg:grid-cols-3">
        {(["IDENTITY", "DOCUMENTS", "SKILLS"] as VerificationType[]).map((type) => {
          const req = requests.find((r) => r.type === type);
          const editable = req && ["NOT_SUBMITTED", "INFO_REQUESTED"].includes(req.status);
          return (
            <Card key={type}>
              <CardHeader title={VERIFICATION_TYPE_LABELS[type]} action={<StatusBadge status={req?.status ?? "NOT_SUBMITTED"} label={VERIFICATION_STATUS_LABELS[req?.status ?? "NOT_SUBMITTED"]} />} />
              <CardBody className="space-y-4 text-sm">
                {type === "SKILLS" && <p className="text-slate">Évaluation par entretien technique ou test, menée par un évaluateur Talent Bridge (service <a href="/tarifs" className="underline">Certification expert</a>).</p>}
                {!req || ["REJECTED", "EXPIRED", "VERIFIED"].includes(req.status) ? (
                  <>
                    {req?.status === "REJECTED" && <Alert tone="error" title="Demande refusée">{req.decisionNote}</Alert>}
                    {req?.status === "VERIFIED" && <p className="text-olive-800">Vérifié le {req.decidedAt?.toLocaleDateString("fr-FR")}{req.expiresAt ? `, valable jusqu'au ${req.expiresAt.toLocaleDateString("fr-FR")}` : ""}.</p>}
                    {req?.status !== "VERIFIED" && <ActionButton action="/api/v1/verification/request" body={{ type }} variant="primary" successMessage="Demande ouverte : déposez vos justificatifs.">{req ? "Nouvelle demande" : "Démarrer"}</ActionButton>}
                  </>
                ) : (
                  <>
                    {req.status === "INFO_REQUESTED" && <Alert tone="warning" title="Complément demandé">{req.events.filter((e) => e.toStatus === "INFO_REQUESTED").at(-1)?.note}</Alert>}
                    <div>
                      <p className="font-semibold">Justificatifs déposés</p>
                      {req.documents.length === 0 ? <p className="text-slate">Aucun.</p> : <ul className="mt-1 space-y-1">{req.documents.map((d) => <li key={d.id} className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate" /><a href={`/api/v1/files/${d.file.id}`} className="underline">{d.file.filename}</a></li>)}</ul>}
                    </div>
                    {editable && (
                      <>
                        {DOCS[type].map((d) => <div key={d.kind}><p className="mb-1 text-xs font-semibold">{d.label}</p><FileUpload purpose="VERIFICATION" accept=".pdf,.png,.jpg,.jpeg" label="Déposer" attach={{ action: "/api/v1/verification/document", body: { requestId: req.id, kind: d.kind, label: d.label } }} /></div>)}
                        <ActionButton action="/api/v1/verification/submit" body={{ requestId: req.id }} variant="success" size="md" confirm="Soumettre cette demande à l'équipe de vérification ? Les pièces ne pourront plus être modifiées sauf demande de complément." successMessage="Demande soumise.">Soumettre à vérification</ActionButton>
                      </>
                    )}
                    {!editable && <p className="text-slate">Demande en cours de traitement par l'équipe Talent Bridge.</p>}
                  </>
                )}
                {req && req.events.length > 0 && (
                  <details><summary className="cursor-pointer text-xs font-semibold text-slate">Historique</summary><ul className="mt-2 space-y-1 text-xs">{req.events.map((e) => <li key={e.id}>{e.createdAt.toLocaleDateString("fr-FR")} — {VERIFICATION_STATUS_LABELS[e.toStatus]}{e.note ? ` : ${e.note}` : ""}</li>)}</ul></details>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
