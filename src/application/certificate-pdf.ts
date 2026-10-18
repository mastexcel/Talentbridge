/**
 * Certificats au format PDF (A4 paysage), même composition que l'affichage écran.
 * Coordonnées exprimées dans le gabarit 1536 × 1024 puis converties en points PDF.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { env } from "@/infrastructure/env";
import { CONSULTANT_CHECK_LABELS, type CertificateSnapshot } from "@/domain/certificates";
import { consultantAttestation } from "@/ui/certificates/attestation";
import { certificateImage, type PublicCertificate } from "./certificate.service";

const W = 842;
const H = 595;
const S = W / 1536;
const BORDEAUX = rgb(0x7b / 255, 0x1f / 255, 0x2b / 255);
const NAVY = rgb(0x1c / 255, 0x2a / 255, 0x3a / 255);
const GOLD = rgb(0xb8 / 255, 0x91 / 255, 0x3a / 255);
const WHITE = rgb(1, 1, 1);

/** Les polices standard PDF (WinAnsi) ne couvrent pas tous les caractères : substitutions sûres. */
const clean = (t: string) => t.replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, "-").replace(/ | /g, " ").replace(/[^\x20-\x7E -ÿ·€]/g, "");
const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

interface Ctx {
  page: PDFPage;
  fonts: { serif: PDFFont; serifBold: PDFFont; serifBoldItalic: PDFFont; sans: PDFFont; sansBold: PDFFont };
}

/** Texte centré sur cx (gabarit), ligne de base à `top` (gabarit), avec retour à la ligne si maxW. */
function centered(c: Ctx, text: string, cx: number, top: number, size: number, font: PDFFont, color = NAVY, opts: { maxW?: number; spacing?: number; lineH?: number } = {}) {
  const sz = size * S;
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (opts.maxW && font.widthOfTextAtSize(t, sz) + (opts.spacing ?? 0) * t.length * S > opts.maxW * S && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  lines.push(cur);
  lines.forEach((line, i) => {
    const spacing = (opts.spacing ?? 0) * S;
    const width = font.widthOfTextAtSize(line, sz) + spacing * Math.max(0, line.length - 1);
    let x = cx * S - width / 2;
    const y = H - (top + i * (opts.lineH ?? size * 1.25)) * S;
    if (!spacing) c.page.drawText(line, { x, y, size: sz, font, color });
    else for (const ch of line) {
      c.page.drawText(ch, { x, y, size: sz, font, color });
      x += font.widthOfTextAtSize(ch, sz) + spacing;
    }
  });
  return lines.length;
}

function left(c: Ctx, text: string, x: number, top: number, size: number, font: PDFFont, color = NAVY, maxW?: number, lineH?: number) {
  const sz = size * S;
  const words = clean(text).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (maxW && font.widthOfTextAtSize(t, sz) > maxW * S && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  lines.push(cur);
  lines.forEach((line, i) => c.page.drawText(line, { x: x * S, y: H - (top + i * (lineH ?? size * 1.3)) * S, size: sz, font, color }));
  return lines.length;
}

const hline = (c: Ctx, x1: number, x2: number, top: number, thick = 2, color = GOLD) => c.page.drawLine({ start: { x: x1 * S, y: H - top * S }, end: { x: x2 * S, y: H - top * S }, thickness: thick * S, color });
const vline = (c: Ctx, x: number, top: number, bottom: number) => c.page.drawLine({ start: { x: x * S, y: H - top * S }, end: { x: x * S, y: H - bottom * S }, thickness: 2 * S, color: GOLD });

/** Image contenue dans la boîte (gabarit), centrée, proportions conservées. */
function fit(c: Ctx, img: PDFImage | null, x: number, top: number, w: number, h: number) {
  if (!img) return;
  const r = Math.min((w * S) / img.width, (h * S) / img.height);
  const dw = img.width * r;
  const dh = img.height * r;
  c.page.drawImage(img, { x: x * S + (w * S - dw) / 2, y: H - top * S - h * S + (h * S - dh) / 2, width: dw, height: dh });
}

async function embed(doc: PDFDocument, file: { bytes: Uint8Array; mime: string } | null): Promise<PDFImage | null> {
  if (!file) return null;
  try {
    return file.mime === "image/png" ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
  } catch {
    return null;
  }
}

async function base(title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer("Talent Bridge");
  const page = doc.addPage([W, H]);
  const fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    serifBoldItalic: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public/brand/logo-talent-bridge.png")));
  return { doc, c: { page, fonts } as Ctx, logo };
}

async function qrImage(doc: PDFDocument, code: string) {
  return doc.embedPng(await QRCode.toBuffer(`${env().APP_URL}/certificats/${code}`, { margin: 1, width: 300 }));
}

function signature(c: Ctx, img: PDFImage | null, cx: number, top: number, name: string, title: string, org: string) {
  fit(c, img, cx - 150, top, 300, 80);
  hline(c, cx - 160, cx + 160, top + 88);
  centered(c, name, cx, top + 112, 19, c.fonts.serifBold);
  centered(c, title, cx, top + 132, 15, c.fonts.sans);
  centered(c, org, cx, top + 150, 15, c.fonts.sans);
}

function infoRow(c: Ctx, cx: number, top: number, items: [string, string][], colW: number) {
  const x0 = cx - (items.length * colW) / 2;
  items.forEach(([k, v], i) => {
    const mid = x0 + colW * i + colW / 2;
    if (i) vline(c, x0 + colW * i, top - 14, top + 30);
    centered(c, k.toUpperCase(), mid, top, 12, c.fonts.sans, NAVY, { spacing: 2 });
    centered(c, v, mid, top + 26, 19, c.fonts.serifBold);
  });
}

export async function academyCertificatePdf(cert: Extract<PublicCertificate, { type: "academy" }>, snap: CertificateSnapshot): Promise<Uint8Array> {
  const i = snap.issuer!;
  const { doc, c, logo } = await base(`Certificat ${cert.code}`);
  const [issuerLogo, seal, sigIssuer, sigTb, qr] = await Promise.all([
    embed(doc, await certificateImage(i.logoFileId)),
    embed(doc, await certificateImage(i.sealFileId)),
    embed(doc, await certificateImage(i.signatureFileId)),
    embed(doc, await certificateImage(snap.tb.signatureFileId)),
    qrImage(doc, cert.code),
  ]);
  const p = c.page;
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
  p.drawRectangle({ x: 27 * S, y: 27 * S, width: W - 54 * S, height: H - 54 * S, borderColor: BORDEAUX, borderWidth: 10 * S });
  p.drawRectangle({ x: 42 * S, y: 42 * S, width: W - 84 * S, height: H - 84 * S, borderColor: GOLD, borderWidth: 2 * S });
  // En-tête
  fit(c, logo, 250, 60, 480, 108);
  centered(c, "ACADEMY", 490, 192, 30, c.fonts.serifBold, BORDEAUX, { spacing: 10 });
  centered(c, "APPRENDRE · ÉVOLUER · INNOVER · IMPACTER", 490, 212, 12, c.fonts.sans, NAVY, { spacing: 2 });
  vline(c, 780, 70, 210);
  fit(c, issuerLogo, 810, 70, 140, 140);
  left(c, "EN PARTENARIAT AVEC", 965, 95, 13, c.fonts.sans);
  const n = left(c, i.name.toUpperCase(), 965, 125, 24, c.fonts.serif, NAVY, 460, 28);
  if (i.tagline) left(c, i.tagline.toUpperCase(), 965, 125 + n * 28 + 4, 12, c.fonts.sans);
  // Corps
  centered(c, "CERTIFICAT", 768, 330, 100, c.fonts.serifBold, BORDEAUX, { spacing: 10 });
  centered(c, "DE FORMATION EN LIGNE", 768, 378, 30, c.fonts.serif, NAVY, { spacing: 8 });
  hline(c, 468, 1068, 395);
  centered(c, "TALENT BRIDGE ACADEMY", 768, 420, 17, c.fonts.serif, NAVY, { spacing: 4 });
  centered(c, `EN PARTENARIAT AVEC ${i.name.toUpperCase()}`, 768, 440, 13, c.fonts.sans, NAVY, { spacing: 2, maxW: 1000 });
  centered(c, "ATTESTENT QUE", 768, 460, 13, c.fonts.sans, NAVY, { spacing: 2 });
  centered(c, cert.holderName, 768, 528, 64, c.fonts.serifBoldItalic, BORDEAUX);
  hline(c, 358, 1178, 545);
  centered(c, "a suivi avec succès la formation en ligne", 768, 575, 20, c.fonts.serif);
  const tl = centered(c, cert.courseTitle, 768, 610, 32, c.fonts.serifBold, NAVY, { maxW: 1200, lineH: 36 });
  centered(c, "et a satisfait à l'ensemble des exigences pédagogiques et des évaluations requises.", 768, 610 + tl * 36 + 4, 19, c.fonts.serif);
  infoRow(c, 768, 735, [["Durée de la formation", snap.durationHours ? `${snap.durationHours} heure${snap.durationHours > 1 ? "s" : ""}` : "-"], ["Date d'obtention", fmtDate(cert.issuedAt)], ["Numéro du certificat", cert.code]], 330);
  // Signatures et cachet
  signature(c, sigIssuer, 400, 800, i.signatoryName, i.signatoryTitle, i.name);
  fit(c, seal, 670, 790, 190, 190);
  signature(c, sigTb, 1010, 800, snap.tb.fullName, snap.tb.title, "Talent Bridge Academy");
  fit(c, qr, 1268, 790, 120, 120);
  centered(c, "VÉRIFIER L'AUTHENTICITÉ", 1328, 930, 11, c.fonts.sans);
  centered(c, "DU CERTIFICAT", 1328, 945, 11, c.fonts.sans);
  if (cert.revokedAt) centered(c, "CERTIFICAT RÉVOQUÉ", 768, 512, 90, c.fonts.sansBold, rgb(0.75, 0.1, 0.1));
  return doc.save();
}

export async function consultantCertificatePdf(cert: Extract<PublicCertificate, { type: "consultant" }>): Promise<Uint8Array> {
  const { doc, c, logo } = await base(`Certification ${cert.code}`);
  const [photo, sigTb, qr] = await Promise.all([embed(doc, await certificateImage(cert.photoFileId)), embed(doc, await certificateImage(cert.snapshot.tb.signatureFileId)), qrImage(doc, cert.code)]);
  const p = c.page;
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
  p.drawRectangle({ x: 22 * S, y: 22 * S, width: W - 44 * S, height: H - 44 * S, borderColor: GOLD, borderWidth: 3 * S });
  // Panneau bordeaux
  p.drawRectangle({ x: 34 * S, y: 36 * S, width: 412 * S, height: (1024 - 72 - 36) * S, color: rgb(0x6e / 255, 0x14 / 255, 0x22 / 255), borderColor: GOLD, borderWidth: 3 * S });
  if (photo) fit(c, photo, 57, 60, 366, 360);
  else centered(c, cert.holderName.split(" ").map((x) => x[0]).slice(0, 2).join(""), 240, 280, 110, c.fonts.serifBold, WHITE);
  const nl = centered(c, cert.holderName, 240, 470, 32, c.fonts.serifBold, WHITE, { maxW: 380, lineH: 36 });
  const hl = centered(c, cert.headline, 240, 470 + nl * 36 + 4, 18, c.fonts.sans, WHITE, { maxW: 370, lineH: 22 });
  let top = 470 + nl * 36 + hl * 22 + 24;
  hline(c, 60, 420, top);
  for (const k of cert.checks) {
    const l = CONSULTANT_CHECK_LABELS[k];
    top += 50;
    p.drawCircle({ x: 82 * S, y: H - (top - 6) * S, size: 14 * S, color: GOLD });
    left(c, k === "EXPERIENCE" && cert.yearsExperience ? `${cert.yearsExperience} ans d'expérience` : l.title, 110, top - 8, 18, c.fonts.sansBold, WHITE);
    left(c, l.text, 110, top + 12, 14, c.fonts.sans, WHITE);
  }
  hline(c, 60, 420, 905);
  centered(c, "ID TALENT BRIDGE", 240, 930, 14, c.fonts.sans, WHITE, { spacing: 3 });
  centered(c, cert.code, 240, 960, 22, c.fonts.sans, WHITE, { spacing: 2 });
  // Partie droite
  const cx = 1000;
  fit(c, logo, 760, 40, 480, 120);
  centered(c, "PLATEFORME PANAFRICAINE D'EXPERTS VÉRIFIÉS", cx, 180, 14, c.fonts.sans, NAVY, { spacing: 3 });
  centered(c, "EXPERTISE · OPPORTUNITÉS · IMPACT", cx, 198, 12, c.fonts.sans, NAVY, { spacing: 3 });
  centered(c, "CERTIFICATION", cx, 300, 96, c.fonts.serifBold, BORDEAUX);
  centered(c, "CONSULTANT VÉRIFIÉ", cx, 360, 44, c.fonts.serif, NAVY, { spacing: 10 });
  centered(c, "TALENT BRIDGE", cx, 405, 26, c.fonts.serif, NAVY, { spacing: 10 });
  left(c, "Talent Bridge atteste que", 500, 450, 20, c.fonts.serif);
  left(c, cert.holderName, 500, 505, 56, c.fonts.serifBold, BORDEAUX);
  hline(c, 500, 1120, 520);
  const al = left(c, consultantAttestation(cert.checks), 500, 550, 20, c.fonts.serif, NAVY, 960, 27);
  let y = 550 + al * 27 + 20;
  if (cert.domains.length) {
    const label = cert.checks.includes("SKILLS") ? "DOMAINES D'EXPERTISE VALIDÉS" : "DOMAINES D'EXPERTISE";
    centered(c, label, cx, y, 17, c.fonts.serif, NAVY, { spacing: 4 });
    y += 18;
    p.drawRectangle({ x: 500 * S, y: H - (y + 64) * S, width: 980 * S, height: 64 * S, color: rgb(0.965, 0.945, 0.902) });
    const colW = 980 / cert.domains.length;
    cert.domains.forEach((d, i) => centered(c, d, 500 + colW * i + colW / 2, y + 30, 15, c.fonts.sans, NAVY, { maxW: colW - 20, lineH: 18 }));
    y += 90;
  }
  infoRow(c, 900, Math.max(y + 10, 790), [["Date de certification", fmtDate(cert.issuedAt)], ["Valable jusqu'au", fmtDate(cert.validUntil)], ["Numéro de certificat", cert.code]], 260);
  signature(c, sigTb, 900, Math.max(y + 60, 830) > 830 ? 830 : Math.max(y + 60, 830), cert.snapshot.tb.fullName, cert.snapshot.tb.title, "Talent Bridge");
  fit(c, qr, 1340, 790, 130, 130);
  centered(c, "VÉRIFIER CE CERTIFICAT", 1405, 940, 11, c.fonts.sansBold);
  centered(c, "TALENT BRIDGE  |  CONNECTER LES EXPERTS  |  TRANSFORMER LES COMPÉTENCES EN RÉSULTATS", cx, 1000, 11, c.fonts.sans, NAVY, { spacing: 2 });
  if (cert.revokedAt) centered(c, "CERTIFICAT RÉVOQUÉ", 768, 512, 90, c.fonts.sansBold, rgb(0.75, 0.1, 0.1));
  return doc.save();
}
