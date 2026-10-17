import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { PageHeader } from "@/ui/Page";
import { ApiForm } from "@/ui/ApiForm";
import { Field, Input, Select, Textarea } from "@/ui/Field";
import { Card, CardBody } from "@/ui/Card";
export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader title="Contactez-nous" description="Un besoin d'experts, une question sur la plateforme ou un partenariat ? Notre équipe vous répond." />
      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <Card><CardBody>
          <ApiForm action="/api/v1/contact" submitLabel="Envoyer" successMessage="Message envoyé. Nous revenons vers vous rapidement." className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" htmlFor="name" required><Input id="name" name="name" autoComplete="name" /></Field>
            <Field label="Email" htmlFor="email" required><Input id="email" name="email" type="email" autoComplete="email" /></Field>
            <Field label="Organisation" htmlFor="company"><Input id="company" name="company" autoComplete="organization" /></Field>
            <Field label="Objet" htmlFor="subject" required><Select id="subject" name="subject"><option>Besoin d'experts</option><option>Partenariat</option><option>Question sur mon compte</option><option>Presse</option><option>Autre</option></Select></Field>
            <Field label="Message" htmlFor="message" required className="sm:col-span-2"><Textarea id="message" name="message" rows={6} /></Field>
          </ApiForm>
        </CardBody></Card>
        <Card><CardBody className="space-y-4 text-sm">
          <p className="flex gap-2"><MapPin className="h-5 w-5 text-orange-600" />Abidjan, Côte d'Ivoire<br />(adresse à compléter)</p>
          <p className="flex gap-2"><Mail className="h-5 w-5 text-orange-600" />contact@talentbridge.africa<br />(à confirmer)</p>
          <p className="text-xs text-slate">Vos données servent uniquement à traiter votre demande (voir la politique de confidentialité).</p>
        </CardBody></Card>
      </div>
    </div>
  );
}
