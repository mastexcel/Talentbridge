/**
 * Finance : tableau de bord, factures PDF, exports CSV / Excel.
 * Les montants affichés proviennent exclusivement des factures et paiements enregistrés.
 * Les paiements de TEST (prestataire simulé) et les données de démonstration sont exclus des
 * recettes réelles et comptés à part.
 */
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { env } from "@/infrastructure/env";
import { formatMoney } from "@/domain/money";
import { SERVICE_LABELS } from "@/domain/billing";

export interface FinanceFilter {
  from?: Date;
  to?: Date;
  currency?: string;
  includeTest?: boolean;
}

export async function financeDashboard(f: FinanceFilter, db: Db = prisma) {
  const currency = f.currency ?? "XOF";
  const from = f.from ?? new Date(Date.now() - 365 * 86_400_000);
  const to = f.to ?? new Date();
  const payWhere: Prisma.PaymentWhereInput = { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] }, currency, confirmedAt: { gte: from, lte: to }, ...(f.includeTest ? {} : { isTest: false, invoice: { isDemo: false } }) };
  const [payments, refunds, receivables, activeSubs, commissions, testCount] = await Promise.all([
    db.payment.findMany({ where: payWhere, select: { amountMinor: true, confirmedAt: true, invoice: { select: { serviceCode: true, countryCode: true } } } }),
    db.refund.aggregate({ where: { status: "SUCCEEDED", payment: payWhere }, _sum: { amountMinor: true } }),
    db.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, currency, ...(f.includeTest ? {} : { isDemo: false }) }, select: { totalMinor: true, paidMinor: true, dueAt: true } }),
    db.subscription.findMany({ where: { status: "ACTIVE", price: { currency }, ...(f.includeTest ? {} : { isDemo: false }) }, select: { price: { select: { amountMinor: true, interval: true } } } }),
    db.commission.groupBy({ by: ["status"], where: { currency }, _sum: { amountMinor: true } }),
    db.payment.count({ where: { isTest: true, status: "SUCCEEDED" } }),
  ]);
  const revenue = payments.reduce((s, p) => s + p.amountMinor, 0) - (refunds._sum.amountMinor ?? 0);
  const byService = new Map<string, number>();
  const byCountry = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    const svc = p.invoice.serviceCode ?? "AUTRE";
    byService.set(svc, (byService.get(svc) ?? 0) + p.amountMinor);
    const c = p.invoice.countryCode ?? "—";
    byCountry.set(c, (byCountry.get(c) ?? 0) + p.amountMinor);
    const m = p.confirmedAt!.toISOString().slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + p.amountMinor);
  }
  const now = Date.now();
  const outstanding = receivables.reduce((s, i) => s + (i.totalMinor - i.paidMinor), 0);
  const overdue = receivables.filter((i) => i.dueAt && i.dueAt.getTime() < now).reduce((s, i) => s + (i.totalMinor - i.paidMinor), 0);
  // MRR = abonnements mensuels + annuels / 12 (devise du filtre).
  const mrr = Math.round(activeSubs.reduce((s, x) => s + (x.price.interval === "MONTH" ? x.price.amountMinor : x.price.interval === "YEAR" ? x.price.amountMinor / 12 : 0), 0));
  return {
    currency,
    revenue,
    refunds: refunds._sum.amountMinor ?? 0,
    outstanding,
    overdue,
    activeSubscriptions: activeSubs.length,
    mrr,
    arr: mrr * 12,
    byService: [...byService].map(([code, amount]) => ({ code, label: SERVICE_LABELS[code] ?? code, amount })).sort((a, b) => b.amount - a.amount),
    byCountry: [...byCountry].map(([code, amount]) => ({ code, amount })).sort((a, b) => b.amount - a.amount),
    byMonth: [...byMonth].sort().map(([month, amount]) => ({ month, amount })),
    commissions: commissions.map((c) => ({ status: c.status, amount: c._sum.amountMinor ?? 0 })),
    testPaymentsExcluded: f.includeTest ? 0 : testCount,
  };
}

export async function listAllInvoices(filter: { status?: string; q?: string; page?: number }, db: Db = prisma) {
  const take = 30;
  const where: Prisma.InvoiceWhereInput = {
    ...(filter.status ? { status: filter.status as "ISSUED" } : {}),
    ...(filter.q ? { OR: [{ number: { contains: filter.q, mode: "insensitive" } }, { organization: { name: { contains: filter.q, mode: "insensitive" } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((filter.page ?? 1) - 1) * take, include: { organization: { select: { name: true } }, user: { select: { firstName: true, lastName: true } }, payments: { select: { id: true, status: true, method: true, provider: true, isTest: true, amountMinor: true } } } }),
    db.invoice.count({ where }),
  ]);
  return { items, total, pageSize: take };
}

// ── Exports ──────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Neutralise les formules (injection CSV dans les tableurs).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}

export async function toXlsx(sheetName: string, headers: string[], rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Talent Bridge";
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.addRow(headers).font = { bold: true };
  for (const r of rows) ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v)));
  ws.columns.forEach((c) => (c.width = 20));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function invoiceExportRows(db: Db = prisma) {
  const invoices = await db.invoice.findMany({ where: { number: { not: null } }, orderBy: { issuedAt: "asc" }, include: { organization: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } } });
  const headers = ["Numéro", "Émise le", "Client", "Service", "Devise", "HT", "TVA", "TTC", "Payé", "Statut", "Démo"];
  const rows = invoices.map((i) => [i.number, i.issuedAt, i.organization?.name ?? `${i.user?.firstName ?? ""} ${i.user?.lastName ?? ""}`.trim(), SERVICE_LABELS[i.serviceCode ?? ""] ?? i.serviceCode, i.currency, i.subtotalMinor, i.taxMinor, i.totalMinor, i.paidMinor, i.status, i.isDemo ? "oui" : "non"]);
  return { headers, rows };
}

// ── PDF ──────────────────────────────────────────────────────

/** Remplace les caractères hors WinAnsi (police standard du PDF). */
function pdfText(s: string): string {
  return s.replace(/[  ]/g, " ").replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[—–]/g, "-").replace(/[^\x20-\x7E -ÿ€]/g, "");
}

export async function invoicePdf(invoiceId: string, db: Db = prisma): Promise<Uint8Array> {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { lines: true, payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } } } } });
  const seller = inv.sellerSnapshot as Record<string, string>;
  const buyer = inv.buyerSnapshot as Record<string, string | null>;
  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${inv.number}`);
  doc.setProducer("Talent Bridge");
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const bordeaux = rgb(0x7b / 255, 0x1f / 255, 0x2b / 255);
  const orange = rgb(0xe8 / 255, 0x73 / 255, 0x1a / 255);
  const grey = rgb(0.39, 0.45, 0.55);
  const text = (t: string, x: number, y: number, o: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {}) => page.drawText(pdfText(t), { x, y, size: o.size ?? 10, font: o.f ?? font, color: o.color ?? rgb(0.09, 0.13, 0.17) });

  text("Talent", 40, 790, { size: 22, f: bold, color: bordeaux });
  text("Bridge", 110, 790, { size: 22, f: bold, color: rgb(0x8d / 255, 0xb9 / 255, 0x2e / 255) });
  page.drawRectangle({ x: 40, y: 780, width: 140, height: 2, color: orange });
  text(inv.status === "DRAFT" ? "FACTURE (BROUILLON)" : "FACTURE", 380, 795, { size: 16, f: bold, color: bordeaux });
  text(`N° ${inv.number ?? "-"}`, 380, 776, { f: bold });
  text(`Émise le ${inv.issuedAt?.toLocaleDateString("fr-FR") ?? "-"}`, 380, 762);
  text(`Échéance ${inv.dueAt?.toLocaleDateString("fr-FR") ?? "-"}`, 380, 748);
  if (inv.isDemo) text("DOCUMENT DE DÉMONSTRATION - SANS VALEUR", 40, 815, { size: 9, f: bold, color: orange });

  let y = 730;
  text("Émetteur", 40, y, { f: bold, color: grey });
  text("Client", 320, y, { f: bold, color: grey });
  const sellerLines = [seller.name, seller.address, `RCCM : ${seller.registrationNumber ?? "-"}`, `Compte contribuable : ${seller.taxId ?? "-"}`, seller.taxRegime ?? ""];
  const buyerLines = [buyer.name ?? "", buyer.address ?? "", buyer.countryCode ?? "", buyer.registrationNumber ? `RCCM : ${buyer.registrationNumber}` : "", buyer.taxId ? `Compte contribuable : ${buyer.taxId}` : "", buyer.email ?? ""].filter(Boolean);
  sellerLines.forEach((l, i) => text(l ?? "", 40, y - 15 - i * 13, { size: 9 }));
  buyerLines.forEach((l, i) => text(l, 320, y - 15 - i * 13, { size: 9 }));

  y = 620;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 18, color: rgb(0.97, 0.97, 0.98) });
  text("Désignation", 46, y, { f: bold, size: 9 });
  text("Qté", 330, y, { f: bold, size: 9 });
  text("PU HT", 370, y, { f: bold, size: 9 });
  text("TVA", 440, y, { f: bold, size: 9 });
  text("Total HT", 490, y, { f: bold, size: 9 });
  y -= 20;
  for (const l of inv.lines) {
    text(l.description.slice(0, 60), 46, y, { size: 9 });
    text(String(l.quantity), 330, y, { size: 9 });
    text(formatMoney(l.unitPriceMinor, inv.currency), 370, y, { size: 9 });
    text(`${(l.taxRateBps / 100).toFixed(l.taxRateBps % 100 ? 2 : 0)} %`, 440, y, { size: 9 });
    text(formatMoney(l.totalMinor, inv.currency), 490, y, { size: 9 });
    y -= 16;
  }
  y -= 10;
  const totals: [string, number][] = [["Total HT", inv.subtotalMinor], ["TVA", inv.taxMinor], ["Total TTC", inv.totalMinor], ["Déjà réglé", inv.paidMinor], ["Reste à payer", inv.totalMinor - inv.paidMinor]];
  for (const [label, amount] of totals) {
    text(label, 380, y, { f: label === "Total TTC" ? bold : font });
    text(formatMoney(amount, inv.currency), 480, y, { f: label === "Total TTC" ? bold : font });
    y -= 15;
  }
  if (inv.payments.some((p) => p.isTest)) text("Paiement(s) effectué(s) en MODE TEST : aucun encaissement réel.", 40, y - 10, { size: 9, f: bold, color: orange });

  const qr = await QRCode.toDataURL(`${env().APP_URL}/facturation/factures/${inv.id}`, { margin: 0, width: 160 });
  const png = await doc.embedPng(qr);
  page.drawImage(png, { x: 40, y: 70, width: 70, height: 70 });
  text("Mentions légales et fiscales à valider par l'expert-comptable de Talent Bridge", 120, 120, { size: 8, color: grey });
  text("conformément à la réglementation applicable (notamment Code général des impôts de Côte d'Ivoire).", 120, 108, { size: 8, color: grey });
  text(`Paiement : Mobile Money, carte ou virement - référence ${inv.number}`, 120, 90, { size: 8, color: grey });
  return doc.save();
}
