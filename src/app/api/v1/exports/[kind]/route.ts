import { NextResponse } from "next/server";
import { DomainError } from "@/domain/errors";
import { route } from "@/infrastructure/http/handler";
import { requireAdmin } from "@/application/access";
import { invoiceExportRows, toCsv, toXlsx } from "@/application/finance.service";
import { crmExportRows } from "@/application/crm.service";
import { ceoKpis } from "@/application/analytics.service";
import { ceoPdf } from "@/application/reporting.service";
import { listAudit } from "@/application/audit.service";
import { audit } from "@/application/audit.service";
import { kpiFilterFrom } from "@/lib/kpi-filter";

/** Exports : ?format=csv|xlsx (et pdf pour le rapport de direction). Chaque export est journalisé. */
export const GET = route<{ kind: string }>({ auth: true, rateLimit: { limit: 30, windowMs: 3600_000, key: "user" } }, async ({ req, user, params }) => {
  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  let data: { headers: string[]; rows: unknown[][] };
  let name: string;
  switch (params.kind) {
    case "factures":
      requireAdmin(user, "FINANCE_MANAGE");
      data = await invoiceExportRows();
      name = "factures";
      break;
    case "crm":
      data = await crmExportRows(user!);
      name = "crm-opportunites";
      break;
    case "audit": {
      requireAdmin(user, "AUDIT_VIEW");
      const { items } = await listAudit({ page: 1 });
      data = { headers: ["Date", "Action", "Entité", "Identifiant", "Acteur", "IP"], rows: items.map((a) => [a.createdAt, a.action, a.entityType, a.entityId, a.actor?.email ?? "", a.ip]) };
      name = "journal-audit";
      break;
    }
    case "direction": {
      requireAdmin(user, "ANALYTICS_VIEW");
      const f = kpiFilterFrom(Object.fromEntries(req.nextUrl.searchParams));
      const k = await ceoKpis(f);
      if (format === "pdf") {
        await audit({ actorId: user!.id, action: "export.direction", entityType: "Report", metadata: { format } });
        const pdf = await ceoPdf(k, { from: f.from, to: f.to, filters: `${f.country ?? "tous pays"}, ${f.orgType ?? "tous types"}, ${f.currency}` });
        return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="rapport-direction.pdf"' } });
      }
      data = {
        headers: ["Indicateur", "Valeur"],
        rows: [
          ...Object.entries(k.totals),
          ...Object.entries(k.rates),
          ["revenue_minor", k.finance.revenue], ["mrr_minor", k.finance.mrr], ["arr_minor", k.finance.arr], ["outstanding_minor", k.finance.outstanding], ["currency", k.finance.currency], ["demo_included", k.includeDemo],
          ...k.finance.byService.map((s) => [`revenue_service_${s.code}`, s.amount]),
          ...k.finance.byCountry.map((s) => [`revenue_country_${s.code}`, s.amount]),
        ],
      };
      name = "indicateurs-direction";
      break;
    }
    default:
      throw new DomainError("NOT_FOUND", "Export inconnu.");
  }
  await audit({ actorId: user!.id, organizationId: user!.activeOrgId, action: `export.${params.kind}`, entityType: "Export", metadata: { format } });
  if (format === "xlsx") {
    return new NextResponse(new Uint8Array(await toXlsx(name, data.headers, data.rows)), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"` } });
  }
  return new NextResponse(toCsv(data.headers, data.rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
});
