import { NextResponse } from "next/server";
import { route } from "@/infrastructure/http/handler";
import { getInvoice } from "@/application/billing.service";
import { invoicePdf } from "@/application/finance.service";

export const GET = route<{ id: string }>({ auth: true }, async ({ user, params }) => {
  const inv = await getInvoice(user!, params.id); // contrôle d'accès
  const pdf = await invoicePdf(inv.id);
  return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="facture-${inv.number}.pdf"` } });
});
