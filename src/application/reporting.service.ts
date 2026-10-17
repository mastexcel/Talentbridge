/** Rapport PDF de synthèse du CEO Dashboard (chiffres issus de ceoKpis, période et filtres indiqués). */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMoney } from "@/domain/money";
import type { ceoKpis } from "./analytics.service";

type Kpis = Awaited<ReturnType<typeof ceoKpis>>;

export async function ceoPdf(k: Kpis, meta: { from: Date; to: Date; filters: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const clean = (s: string) => s.replace(/[  ]/g, " ").replace(/[—–]/g, "-").replace(/[≥]/g, ">=").replace(/[^\x20-\x7E -ÿ€]/g, "");
  let y = 790;
  const line = (t: string, o: { b?: boolean; size?: number; color?: [number, number, number] } = {}) => {
    page.drawText(clean(t), { x: 48, y, size: o.size ?? 11, font: o.b ? bold : font, color: o.color ? rgb(...o.color) : rgb(0.09, 0.13, 0.17) });
    y -= (o.size ?? 11) + 8;
  };
  line("Talent Bridge - Tableau de bord de direction", { b: true, size: 18, color: [0.48, 0.12, 0.17] });
  line(`Période : ${meta.from.toLocaleDateString("fr-FR")} au ${meta.to.toLocaleDateString("fr-FR")} - ${meta.filters}`, { size: 10 });
  if (k.includeDemo) line("ATTENTION : données de démonstration incluses (non représentatives).", { b: true, size: 10, color: [0.7, 0.32, 0.05] });
  y -= 6;
  const c = k.finance.currency;
  const rows: [string, string][] = [
    ["Utilisateurs", String(k.totals.totalUsers)], ["Experts inscrits", String(k.totals.experts)], ["Experts vérifiés", String(k.totals.verifiedExperts)],
    ["Organisations", String(k.totals.organizations)], ["Clients payants", String(k.totals.payingClients)], ["Abonnements actifs", String(k.totals.activeSubs)],
    ["Missions publiées (période)", String(k.totals.missionsPublished)], ["Missions attribuées (période)", String(k.totals.missionsAwarded)],
    ["Chiffre d'affaires encaissé", formatMoney(k.finance.revenue, c)], ["MRR", formatMoney(k.finance.mrr, c)], ["ARR", formatMoney(k.finance.arr, c)],
    ["Créances", formatMoney(k.finance.outstanding, c)], ["Taux de conversion", k.rates.conversionPct != null ? `${k.rates.conversionPct} %` : "n.d."],
    ["Délai moyen de matching", k.rates.avgMatchingHours != null ? `${k.rates.avgMatchingHours} h (${k.rates.matchingSample} missions)` : "n.d."],
    ["Satisfaction", k.rates.satisfaction != null ? `${k.rates.satisfaction}/5 (${k.rates.satisfactionCount} avis)` : "n.d."],
    ["Taux de renouvellement", k.rates.renewalPct != null ? `${k.rates.renewalPct} %` : "n.d."],
  ];
  for (const [l, v] of rows) {
    page.drawText(clean(l), { x: 48, y, size: 11, font });
    page.drawText(clean(v), { x: 330, y, size: 11, font: bold });
    y -= 19;
  }
  y -= 10;
  line("Revenus par service", { b: true });
  for (const s of k.finance.byService) line(`${s.label} : ${formatMoney(s.amount, c)}`, { size: 10 });
  line("Experts par pays", { b: true });
  line(k.expertsByCountry.map((x) => `${x.code} ${x.count}`).join("  |  ") || "-", { size: 10 });
  line("Définitions des indicateurs : docs/KPI.md", { size: 8, color: [0.4, 0.45, 0.55] });
  return doc.save();
}
