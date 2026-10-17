import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { prisma } from "@/infrastructure/db";
import { requireUser } from "@/lib/session";
import { getInvoice } from "@/application/billing.service";
import { mockAllowed } from "@/infrastructure/payments/registry";
import { formatMoney } from "@/domain/money";
import { METHOD_LABELS } from "@/ui/labels";
import { Card, CardBody } from "@/ui/Card";
import { ActionButton } from "@/ui/ActionButton";
import { Alert } from "@/ui/Feedback";

export const metadata: Metadata = { title: "Paiement de test" };

/**
 * Simulateur du prestataire « mock » : remplace la page hébergée d'un vrai prestataire.
 * Le résultat est transmis par un webhook SIGNÉ traité par le même code qu'en production.
 * Indisponible en production (sauf démo hébergée explicitement autorisée).
 */
export default async function MockPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/paiement/test/${id}`);
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p || p.provider !== "mock" || !mockAllowed()) notFound();
  const inv = await getInvoice(user, p.invoiceId);
  return (
    <div className="mx-auto max-w-lg">
      <Alert tone="warning" title="Environnement de test" className="mb-4">Aucun argent réel n'est débité. Ce simulateur remplace la page de paiement du prestataire pendant le développement et la démonstration.</Alert>
      <Card><CardBody className="space-y-4 text-center">
        <FlaskConical className="mx-auto h-10 w-10 text-orange-600" />
        <p className="text-sm text-slate">Facture {inv.number} · {METHOD_LABELS[p.method]}</p>
        <p className="font-display text-3xl font-extrabold">{formatMoney(p.amountMinor, p.currency)}</p>
        {p.status === "PENDING" ? (
          <div className="flex justify-center gap-3">
            <ActionButton action="/api/v1/billing/simulate" body={{ paymentId: p.id, outcome: "SUCCEEDED" }} variant="success" size="lg" successMessage="Paiement de test accepté.">Simuler un paiement accepté</ActionButton>
            <ActionButton action="/api/v1/billing/simulate" body={{ paymentId: p.id, outcome: "FAILED" }} variant="danger" size="lg" successMessage="Paiement de test refusé.">Simuler un refus</ActionButton>
          </div>
        ) : <p>Ce paiement est déjà traité ({p.status}).</p>}
      </CardBody></Card>
    </div>
  );
}
