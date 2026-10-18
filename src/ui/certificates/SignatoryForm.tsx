"use client";
/** Création / modification d'un cosignataire Talent Bridge : signature (et cachet facultatif) déposés puis rattachés. */
import { useState } from "react";
import { ApiForm } from "../ApiForm";
import { FileUpload } from "../FileUpload";
import { Field, Input } from "../Field";

export function SignatoryForm({ signatory }: { signatory?: { id: string; fullName: string; title: string; forVerification: boolean; isActive: boolean } }) {
  const [signatureFileId, setSignature] = useState<string | null>(null);
  const [sealFileId, setSeal] = useState<string | null>(null);
  const key = signatory?.id ?? "new";
  return (
    <ApiForm action="/api/v1/certificates/tb-signatory-save" submitLabel={signatory ? "Enregistrer" : "Ajouter le cosignataire"} successMessage="Cosignataire enregistré." className="grid gap-3 sm:grid-cols-2" extra={{ id: signatory?.id ?? null, signatureFileId, sealFileId }}>
      <Field label="Nom complet" htmlFor={`sg-n-${key}`} required><Input id={`sg-n-${key}`} name="fullName" defaultValue={signatory?.fullName} /></Field>
      <Field label="Fonction" htmlFor={`sg-t-${key}`} required><Input id={`sg-t-${key}`} name="title" defaultValue={signatory?.title} placeholder="Ex. : Directeur général" /></Field>
      <div className="space-y-1">
        <p className="text-sm font-medium">Signature {signatory ? "(remplacer)" : "(obligatoire)"}</p>
        <FileUpload purpose="CERT_SIGNATURE" accept="image/png,image/jpeg" label="Déposer la signature" onUploaded={(f) => setSignature(f.id)} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Cachet Talent Bridge (facultatif)</p>
        <FileUpload purpose="CERT_SEAL" accept="image/png,image/jpeg" label="Déposer le cachet" onUploaded={(f) => setSeal(f.id)} />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="forVerification" defaultChecked={signatory?.forVerification} className="accent-orange-600" /> Signe les certificats « Consultant vérifié »</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={signatory?.isActive ?? true} className="accent-orange-600" /> Actif</label>
    </ApiForm>
  );
}
