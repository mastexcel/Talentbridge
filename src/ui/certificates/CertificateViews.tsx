/* eslint-disable @next/next/no-img-element -- images servies par liens signés temporaires */
/**
 * Certificats, d'après les modèles graphiques fournis :
 *  - AcademyCertificate : certificat de formation (institution délivrante + Talent Bridge Academy) ;
 *  - ConsultantCertificate : certification « Consultant vérifié ».
 * Gabarit fixe 1536 × 1024 mis à l'échelle de la largeur disponible (unités de conteneur) :
 * rendu identique sur ordinateur, tablette (portrait / paysage) et téléphone.
 */
import { Briefcase, Cpu, GraduationCap, HeartPulse, Landmark, Leaf, LineChart, ShieldCheck, Sprout, Wallet, Zap, FileText, Award } from "lucide-react";
import { cn } from "../cn";
import { CONSULTANT_CHECK_LABELS, type ConsultantCheck } from "@/domain/certificates";
import { cinzel, playfair } from "./fonts";
import { consultantAttestation } from "./attestation";

const u = (n: number) => `calc(var(--u) * ${n})`;
const GOLD = "#B8913A";
const NAVY = "#1C2A3A";

const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export interface SignatoryView {
  name: string;
  title: string;
  organization: string;
  signatureUrl: string | null;
}

function Frame({ children, className, specimen, revoked, label }: { children: React.ReactNode; className?: string; specimen?: boolean; revoked?: boolean; label: string }) {
  return (
    <div className={cn("w-full [container-type:inline-size]", cinzel.variable, playfair.variable)}>
      <div role="img" aria-label={label} className={cn("relative w-full overflow-hidden bg-white text-left shadow-lift", className)} style={{ aspectRatio: "1536 / 1024", ["--u" as string]: "calc(100cqw / 1536)" }}>
        {children}
        {(specimen || revoked) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className={cn("-rotate-[18deg] rounded-xl border-4 font-[family-name:var(--font-cinzel)] font-bold uppercase opacity-80", revoked ? "border-red-700 text-red-700" : "border-orange-600 text-orange-600")} style={{ fontSize: u(110), padding: `${u(10)} ${u(40)}`, letterSpacing: u(10) }}>
              {revoked ? "Révoqué" : "Spécimen"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Signature({ s, compact }: { s: SignatoryView; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ lineHeight: 1.25 }}>
      <div className="flex items-end justify-center" style={{ height: u(compact ? 62 : 80), width: u(300) }}>
        {s.signatureUrl ? <img src={s.signatureUrl} alt={`Signature de ${s.name}`} className="max-h-full max-w-full object-contain" /> : <span className="italic text-slate" style={{ fontSize: u(16) }}>Signature à fournir</span>}
      </div>
      <div style={{ width: u(320), height: u(2), background: GOLD, margin: `${u(6)} 0` }} />
      <p className="font-[family-name:var(--font-playfair)] font-bold" style={{ fontSize: u(19), color: NAVY }}>{s.name}</p>
      <p style={{ fontSize: u(15), color: NAVY }}>{s.title}</p>
      <p style={{ fontSize: u(15), color: NAVY }}>{s.organization}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="uppercase" style={{ fontSize: u(13), letterSpacing: u(3), color: NAVY }}>{children}</p>;
}

function InfoRow({ items }: { items: [string, string][] }) {
  return (
    <div className="flex items-stretch justify-center">
      {items.map(([k, v], i) => (
        <div key={k} className="flex flex-col items-center justify-center text-center" style={{ padding: `0 ${u(42)}`, borderLeft: i ? `${u(2)} solid ${GOLD}` : undefined }}>
          <Label>{k}</Label>
          <p className="font-[family-name:var(--font-playfair)] font-bold" style={{ fontSize: u(19), color: NAVY, marginTop: u(6) }}>{v}</p>
        </div>
      ))}
    </div>
  );
}

function Qr({ dataUrl, caption }: { dataUrl: string; caption: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="bg-white" style={{ padding: u(6), border: `${u(2)} solid ${GOLD}` }}>
        <img src={dataUrl} alt="QR code de vérification" style={{ width: u(118), height: u(118) }} />
      </div>
      <p className="uppercase" style={{ fontSize: u(11), letterSpacing: u(1.5), color: NAVY, marginTop: u(8), maxWidth: u(170) }}>{caption}</p>
    </div>
  );
}

export interface AcademyCertificateProps {
  code: string;
  holderName: string;
  courseTitle: string;
  durationHours: number | null;
  issuedAt: Date;
  issuer: { name: string; tagline: string | null; logoUrl: string | null; sealUrl: string | null; signatory: SignatoryView };
  tb: SignatoryView;
  qrDataUrl: string;
  specimen?: boolean;
  revoked?: boolean;
}

export function AcademyCertificate(p: AcademyCertificateProps) {
  return (
    <Frame specimen={p.specimen} revoked={p.revoked} label={`Certificat de formation en ligne délivré à ${p.holderName} pour « ${p.courseTitle} », numéro ${p.code}`}>
      {/* Cadre bordeaux + filet doré */}
      <div className="absolute" style={{ inset: u(22), border: `${u(10)} solid #7B1F2B` }} />
      <div className="absolute" style={{ inset: u(42), border: `${u(2)} solid ${GOLD}` }} />
      <div className="absolute flex flex-col items-center" style={{ inset: u(48), paddingTop: u(10) }}>
        {/* En-tête : Talent Bridge Academy | institution partenaire */}
        <div className="flex w-full items-center justify-center" style={{ gap: u(40), height: u(170) }}>
          <div className="flex flex-col items-center">
            <img src="/brand/logo-talent-bridge.png" alt="Talent Bridge" style={{ height: u(108) }} />
            <p className="font-[family-name:var(--font-cinzel)] font-bold uppercase text-bordeaux-700" style={{ fontSize: u(30), letterSpacing: u(10), marginTop: u(-6) }}>Academy</p>
            <p className="uppercase" style={{ fontSize: u(12), letterSpacing: u(3), color: NAVY }}>Apprendre · Évoluer · Innover · Impacter</p>
          </div>
          <div style={{ width: u(2), height: u(130), background: GOLD }} />
          <div className="flex items-center" style={{ gap: u(20), maxWidth: u(600) }}>
            <div className="flex shrink-0 items-center justify-center" style={{ width: u(140), height: u(140) }}>
              {p.issuer.logoUrl ? <img src={p.issuer.logoUrl} alt={`Logo ${p.issuer.name}`} className="max-h-full max-w-full object-contain" /> : null}
            </div>
            <div className="min-w-0">
              <p className="uppercase" style={{ fontSize: u(13), letterSpacing: u(2), color: NAVY }}>En partenariat avec</p>
              <p className="font-[family-name:var(--font-cinzel)] uppercase" style={{ fontSize: u(25), lineHeight: 1.15, color: NAVY }}>{p.issuer.name}</p>
              {p.issuer.tagline && <p className="uppercase" style={{ fontSize: u(12), letterSpacing: u(2.5), color: NAVY, marginTop: u(4) }}>{p.issuer.tagline}</p>}
            </div>
          </div>
        </div>

        <p className="font-[family-name:var(--font-cinzel)] font-bold uppercase text-bordeaux-700" style={{ fontSize: u(108), letterSpacing: u(10), lineHeight: 1, marginTop: u(14) }}>Certificat</p>
        <p className="font-[family-name:var(--font-cinzel)] uppercase" style={{ fontSize: u(32), letterSpacing: u(9), color: NAVY, marginTop: u(8) }}>De formation en ligne</p>
        <div style={{ width: u(600), height: u(2), background: GOLD, margin: `${u(10)} 0` }} />
        <p className="font-[family-name:var(--font-cinzel)] uppercase" style={{ fontSize: u(17), letterSpacing: u(5), color: NAVY }}>Talent Bridge Academy</p>
        <p className="text-center uppercase" style={{ fontSize: u(13), letterSpacing: u(3), color: NAVY, maxWidth: u(900) }}>En partenariat avec {p.issuer.name}</p>
        <p className="uppercase" style={{ fontSize: u(13), letterSpacing: u(3), color: NAVY, marginTop: u(4) }}>attestent que</p>

        <p className="font-[family-name:var(--font-playfair)] font-bold italic text-bordeaux-700" style={{ fontSize: u(68), lineHeight: 1.1, marginTop: u(6) }}>{p.holderName}</p>
        <div style={{ width: u(820), height: u(2), background: GOLD }} />
        <p style={{ fontSize: u(20), color: NAVY, marginTop: u(10) }}>a suivi avec succès la formation en ligne</p>
        <p className="text-center font-[family-name:var(--font-playfair)] font-bold" style={{ fontSize: u(32), color: NAVY, maxWidth: u(1200), lineHeight: 1.2 }}>{p.courseTitle}</p>
        <p style={{ fontSize: u(19), color: NAVY }}>et a satisfait à l&apos;ensemble des exigences pédagogiques et des évaluations requises.</p>

        <div style={{ marginTop: u(22) }}>
          <InfoRow items={[["Durée de la formation", p.durationHours ? `${p.durationHours} heure${p.durationHours > 1 ? "s" : ""}` : "—"], ["Date d'obtention", fmtDate(p.issuedAt)], ["Numéro du certificat", p.code]]} />
        </div>

        {/* Signatures, cachet de l'institution, QR code */}
        <div className="absolute flex items-end justify-between" style={{ left: u(150), right: u(40), bottom: u(18) }}>
          <Signature s={p.issuer.signatory} />
          <div className="flex items-center justify-center" style={{ width: u(190), height: u(190) }}>
            {p.issuer.sealUrl ? <img src={p.issuer.sealUrl} alt={`Cachet de ${p.issuer.name}`} className="max-h-full max-w-full object-contain" /> : null}
          </div>
          <Signature s={p.tb} />
          <Qr dataUrl={p.qrDataUrl} caption="Vérifier l'authenticité du certificat" />
        </div>
      </div>
    </Frame>
  );
}

const DOMAIN_ICONS: [RegExp, typeof Briefcase][] = [
  [/agri|aliment/i, Sprout],
  [/financ|pme|banque/i, Wallet],
  [/sant/i, HeartPulse],
  [/éduc|format/i, GraduationCap],
  [/environ|climat/i, Leaf],
  [/énergie|energie/i, Zap],
  [/digital|numér|data/i, Cpu],
  [/gouvern|institution/i, Landmark],
  [/suivi|évaluation|projet/i, LineChart],
];
const domainIcon = (name: string) => DOMAIN_ICONS.find(([re]) => re.test(name))?.[1] ?? Briefcase;
const CHECK_ICONS: Record<ConsultantCheck, typeof Briefcase> = { EXPERIENCE: Briefcase, DIPLOMAS: GraduationCap, REFERENCES: FileText, SKILLS: Award, IDENTITY: ShieldCheck };

export interface ConsultantCertificateProps {
  code: string;
  holderName: string;
  headline: string;
  photoUrl: string | null;
  domains: string[];
  checks: ConsultantCheck[];
  yearsExperience: number | null;
  issuedAt: Date;
  validUntil: Date;
  tb: SignatoryView;
  qrDataUrl: string;
  revoked?: boolean;
  specimen?: boolean;
}

export function ConsultantCertificate(p: ConsultantCertificateProps) {
  const skillsValidated = p.checks.includes("SKILLS");
  return (
    <Frame revoked={p.revoked} specimen={p.specimen} label={`Certification « Consultant vérifié » de ${p.holderName}, numéro ${p.code}`}>
      <div className="absolute" style={{ inset: u(22), border: `${u(3)} solid ${GOLD}` }} />
      {/* Panneau bordeaux */}
      <div className="absolute flex flex-col items-center text-white" style={{ left: u(34), top: u(72), width: u(412), bottom: u(36), borderRadius: u(28), background: "linear-gradient(180deg,#8E1B2C 0%,#5A0E1A 100%)", border: `${u(3)} solid ${GOLD}`, padding: `0 ${u(26)} ${u(24)}` }}>
        <div className="overflow-hidden bg-white/10" style={{ width: u(366), height: u(380), marginTop: u(-40), borderRadius: u(26), border: `${u(4)} solid ${GOLD}` }}>
          {p.photoUrl ? <img src={p.photoUrl} alt={`Photo de ${p.holderName}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-[family-name:var(--font-cinzel)]" style={{ fontSize: u(110) }}>{p.holderName.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>}
        </div>
        <p className="text-center font-[family-name:var(--font-playfair)] font-bold" style={{ fontSize: u(33), marginTop: u(18), lineHeight: 1.15 }}>{p.holderName}</p>
        <p className="text-center text-white/90" style={{ fontSize: u(19), lineHeight: 1.3 }}>{p.headline}</p>
        <div style={{ width: "100%", height: u(2), background: GOLD, margin: `${u(14)} 0` }} />
        <ul className="w-full" style={{ display: "grid", gap: u(14) }}>
          {p.checks.map((c) => {
            const Icon = CHECK_ICONS[c];
            const label = CONSULTANT_CHECK_LABELS[c];
            return (
              <li key={c} className="flex items-center" style={{ gap: u(16) }}>
                <Icon style={{ width: u(36), height: u(36), color: "#E2B55B" }} strokeWidth={2} aria-hidden />
                <span>
                  <span className="block font-semibold" style={{ fontSize: u(18) }}>{c === "EXPERIENCE" && p.yearsExperience ? `${p.yearsExperience} ans d'expérience` : label.title}</span>
                  <span className="block text-white/80" style={{ fontSize: u(14) }}>{label.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto w-full text-center">
          <div style={{ width: "100%", height: u(2), background: GOLD, margin: `0 0 ${u(12)}` }} />
          <p className="uppercase text-white/85" style={{ fontSize: u(14), letterSpacing: u(3) }}>ID Talent Bridge</p>
          <p style={{ fontSize: u(23), letterSpacing: u(2) }}>{p.code}</p>
        </div>
      </div>

      {/* Partie droite */}
      <div className="absolute flex flex-col items-center" style={{ left: u(470), right: u(40), top: u(36), bottom: u(40) }}>
        <p className="absolute right-0 text-right uppercase" style={{ top: u(30), fontSize: u(13), letterSpacing: u(3), color: NAVY, lineHeight: 1.7 }}>Des talents<br />pour une Afrique<br />plus forte</p>
        <img src="/brand/logo-talent-bridge.png" alt="Talent Bridge" style={{ height: u(96) }} />
        <p className="uppercase" style={{ fontSize: u(14), letterSpacing: u(4), color: NAVY }}>Plateforme panafricaine d&apos;experts vérifiés</p>
        <p className="uppercase" style={{ fontSize: u(12), letterSpacing: u(4), color: NAVY }}>Expertise · Opportunités · Impact</p>
        <p className="font-[family-name:var(--font-cinzel)] font-bold uppercase text-bordeaux-700" style={{ fontSize: u(100), lineHeight: 1, marginTop: u(8) }}>Certification</p>
        <p className="font-[family-name:var(--font-cinzel)] uppercase" style={{ fontSize: u(42), letterSpacing: u(12), color: NAVY, marginTop: u(4) }}>Consultant vérifié</p>
        <div className="flex items-center" style={{ gap: u(20) }}>
          <span style={{ width: u(120), height: u(2), background: GOLD }} />
          <p className="font-[family-name:var(--font-cinzel)] uppercase" style={{ fontSize: u(28), letterSpacing: u(12), color: NAVY }}>Talent Bridge</p>
          <span style={{ width: u(120), height: u(2), background: GOLD }} />
        </div>
        <div className="w-full" style={{ padding: `0 ${u(20)}`, marginTop: u(10) }}>
          <p style={{ fontSize: u(20), color: NAVY }}>Talent Bridge atteste que</p>
          <p className="font-[family-name:var(--font-playfair)] font-bold text-bordeaux-700" style={{ fontSize: u(56), lineHeight: 1.1 }}>{p.holderName}</p>
          <div style={{ width: u(620), height: u(2), background: GOLD, margin: `${u(4)} 0 ${u(8)}` }} />
          <p style={{ fontSize: u(19), color: NAVY, lineHeight: 1.35 }}>{consultantAttestation(p.checks)}</p>
        </div>
        {p.domains.length > 0 && (
          <div className="w-full" style={{ marginTop: u(10) }}>
            <div className="flex items-center justify-center" style={{ gap: u(16) }}>
              <span style={{ flex: 1, height: u(2), background: GOLD }} />
              <p className="font-[family-name:var(--font-cinzel)] uppercase" style={{ fontSize: u(17), letterSpacing: u(5), color: NAVY }}>{skillsValidated ? "Domaines d'expertise validés" : "Domaines d'expertise"}</p>
              <span style={{ flex: 1, height: u(2), background: GOLD }} />
            </div>
            <div className="flex items-center justify-around bg-[#F6F1E6]" style={{ marginTop: u(8), borderRadius: u(18), padding: `${u(10)} ${u(12)}` }}>
              {p.domains.map((d, i) => {
                const Icon = domainIcon(d);
                return (
                  <div key={d} className="flex items-center" style={{ gap: u(12), paddingLeft: i ? u(16) : 0, borderLeft: i ? `${u(2)} solid ${GOLD}` : undefined, maxWidth: u(220) }}>
                    <Icon style={{ width: u(32), height: u(32), color: NAVY }} aria-hidden />
                    <span style={{ fontSize: u(15), color: NAVY, lineHeight: 1.2 }}>{d}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex w-full items-start justify-between" style={{ marginTop: u(12) }}>
          <div className="flex flex-col items-center" style={{ flex: 1 }}>
            <InfoRow items={[["Date de certification", fmtDate(p.issuedAt)], ["Valable jusqu'au", fmtDate(p.validUntil)], ["Numéro de certificat", p.code]]} />
            <div style={{ marginTop: u(4) }}>
              <Signature s={p.tb} compact />
            </div>
          </div>
          <Qr dataUrl={p.qrDataUrl} caption="Vérifier ce certificat" />
        </div>
        <p className="absolute uppercase" style={{ bottom: u(-26), fontSize: u(11), letterSpacing: u(4), color: NAVY }}>Talent Bridge &nbsp;|&nbsp; Connecter les experts &nbsp;|&nbsp; Transformer les compétences en résultats</p>
      </div>
    </Frame>
  );
}

