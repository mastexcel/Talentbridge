"use client";
import { useState } from "react";
import { ApiForm } from "./ApiForm";
import { Field, Input, Textarea } from "./Field";
import { FileUpload } from "./FileUpload";

export function ApplyForm({ missionId, currency }: { missionId: string; currency: string }) {
  const [tech, setTech] = useState<string | null>(null);
  const [fin, setFin] = useState<string | null>(null);
  return (
    <ApiForm action={`/api/v1/missions/${missionId}/apply`} submitLabel="Déposer ma candidature" successMessage="Candidature déposée." className="space-y-4" transform={(d) => ({ ...d, technicalFileId: tech, financialFileId: fin, currency })}>
      <Field label="Proposition technique (résumé)" htmlFor="coverLetter" required hint="Approche, méthodologie, références pertinentes. 50 caractères minimum.">
        <Textarea id="coverLetter" name="coverLetter" rows={6} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Tarif journalier proposé (${currency})`} htmlFor="proposedRate"><Input id="proposedRate" name="proposedRate" type="number" min={0} data-type="number" /></Field>
        <Field label="Disponible à partir du" htmlFor="availableFrom"><Input id="availableFrom" name="availableFrom" type="date" /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="mb-1 text-sm font-semibold">Proposition technique (PDF, DOCX)</p><FileUpload purpose="PROPOSAL" accept=".pdf,.docx" label="Joindre" onUploaded={(f) => setTech(f.id)} /></div>
        <div><p className="mb-1 text-sm font-semibold">Proposition financière (PDF, XLSX)</p><FileUpload purpose="PROPOSAL" accept=".pdf,.docx,.xlsx" label="Joindre" onUploaded={(f) => setFin(f.id)} /></div>
      </div>
    </ApiForm>
  );
}
