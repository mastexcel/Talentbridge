/**
 * Lecture assistée d'un CV (texte extrait du PDF ou du DOCX) : propose des informations pour le
 * profil. Rien n'est enregistré ici ; l'expert relit, corrige et choisit ce qu'il garde. Les éléments
 * importés restent « déclarés » (non vérifiés) tant que Talent Bridge ne les a pas contrôlés.
 * Méthode déterministe (sections, dates, référentiel de compétences et synonymes), sans service externe.
 */

export interface CvReferenceData {
  skills: { id: string; nameFr: string; nameEn: string; synonyms: string[]; domainId: string | null }[];
  domains: { id: string; nameFr: string; nameEn: string }[];
  countries: { code: string; nameFr: string; nameEn: string }[];
}

export interface CvDraft {
  contact: { email: string | null; phone: string | null; linkedin: string | null };
  headline: string | null;
  bio: string | null;
  yearsExperience: number | null;
  languages: string[];
  countryCode: string | null;
  skills: { skillId: string; name: string; evidence: string }[];
  domainIds: string[];
  experiences: { title: string; employer: string; startDate: string; endDate: string | null; description: string | null }[];
  qualifications: { kind: "DEGREE" | "CERTIFICATION"; title: string; institution: string; year: number | null }[];
}

/** Minuscules sans accents, pour comparer. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Section = "profile" | "experience" | "education" | "certifications" | "skills" | "languages" | "other";

const HEADINGS: [Section, RegExp][] = [
  ["experience", /^(experiences?( professionnelles?)?|parcours professionnel|experience professionnelle|professional experience|work experience|employment( history)?|missions? (realisees|effectuees)|references professionnelles)$/],
  ["education", /^(formations?( academiques?)?|education|etudes|diplomes?( et formations?)?|formation et diplomes|cursus|academic background|qualifications?)$/],
  ["certifications", /^(certifications?|certificats?|formations? complementaires?|trainings?|formations? continues?)$/],
  ["skills", /^(competences?( cles| techniques| professionnelles)?|domaines? de competences?|skills|key skills|expertise|domaines? d'expertise)$/],
  ["languages", /^(langues?( parlees)?|languages?|connaissances linguistiques)$/],
  ["profile", /^(profil( professionnel)?|resume|summary|a propos( de moi)?|about( me)?|presentation|objectif|profile)$/],
  ["other", /^(centres? d'interets?|loisirs|interests|hobbies|publications?|informations? complementaires?|references?|personal details|etat civil)$/],
];

function headingOf(line: string): Section | null {
  const t = fold(line).replace(/[:•\-–—_*#|]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 50) return null;
  for (const [s, re] of HEADINGS) if (re.test(t)) return s;
  return null;
}

const MONTHS: Record<string, number> = {
  janv: 1, janvier: 1, jan: 1, january: 1, fevr: 2, fevrier: 2, feb: 2, february: 2, fev: 2, mars: 3, mar: 3, march: 3, avr: 4, avril: 4, apr: 4, april: 4,
  mai: 5, may: 5, juin: 6, june: 6, jun: 6, juil: 7, juillet: 7, jul: 7, july: 7, aout: 8, aug: 8, august: 8, sept: 9, septembre: 9, sep: 9, september: 9,
  oct: 10, octobre: 10, october: 10, nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const NOW_RE = "(?:a ce jour|ce jour|aujourd'hui|aujourd hui|present|actuel(?:lement)?|en cours|now|current|date|today)";
const POINT = `(?:(?:${MONTH_RE})\\.?\\s+\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4})`;
const RANGE = new RegExp(`(?:de\\s+|du\\s+|depuis\\s+|from\\s+|since\\s+)?(${POINT})\\s*(?:[-–—~]+|a|au|to|until|jusqu'a|jusqu'en|>)?\\s*(${POINT}|${NOW_RE})?`, "i");

/** Date « AAAA-MM-01 » à partir de « mars 2019 », « 03/2019 » ou « 2019 ». */
function toIsoMonth(p: string): string | null {
  const t = fold(p).replace(/\./g, "").trim();
  let m = /^(\d{1,2})[/-](\d{4})$/.exec(t);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = new RegExp(`^(${MONTH_RE})\\s+(\\d{4})$`).exec(t);
  if (m) return `${m[2]}-${String(MONTHS[m[1]]).padStart(2, "0")}-01`;
  m = /^(\d{4})$/.exec(t);
  if (m) return `${m[1]}-01-01`;
  return null;
}
const plausibleYear = (iso: string) => {
  const y = +iso.slice(0, 4);
  return y >= 1960 && y <= new Date().getFullYear() + 1;
};

/** Plage de dates en tête ou en fin de ligne (expérience). */
function parseRange(line: string): { start: string; end: string | null; rest: string } | null {
  const f = fold(line);
  const m = RANGE.exec(f);
  if (!m || !m[1]) return null;
  const start = toIsoMonth(m[1]);
  if (!start || !plausibleYear(start)) return null;
  // Une date isolée ne suffit pas : il faut une plage (fin ou « à ce jour »), pour ne pas confondre avec un diplôme.
  if (!m[2]) return null;
  const isNow = new RegExp(`^${NOW_RE}$`).test(m[2]);
  const end = isNow ? null : toIsoMonth(m[2]);
  if (!isNow && (!end || !plausibleYear(end) || end < start)) return null;
  const rest = (line.slice(0, m.index) + " " + line.slice(m.index + m[0].length)).replace(/^[\s:–—\-|,()]+|[\s:–—\-|,()]+$/g, "").replace(/\(\s*\)/g, "").trim();
  return { start, end, rest };
}

/** « Titre — Employeur », « Titre chez Employeur », « Employeur : Titre »… */
function splitTitleEmployer(s: string): { title: string; employer: string } {
  const parts = s.split(/\s+(?:chez|at|@|pour le compte de|pour)\s+|\s*[|–—]\s*|\s+-\s+|\s*,\s*|\s*:\s*/i).map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) return { title: parts[0], employer: parts.slice(1).join(", ") };
  return { title: parts[0] ?? "", employer: "" };
}

const DEGREE_RE = /\b(doctorat|phd|ph\.d|these|master|mastere|msc|m\.sc|mba|dess|dea|maitrise|licence|bachelor|bsc|b\.sc|ingenieur|diplome|dut|bts|deug|brevet de technicien|baccalaureat|bac\s*\+\s*\d|certificat d'aptitude|capes|agregation)\b/;
const CERT_RE = /\b(certifi|certificat|pmp|prince\s*2|itil|cisco|ccna|scrum|psm|pmi|six sigma|toefl|toeic|ielts|delf|dalf|iso\s*\d{4,5}|cfa|acca|cia|cisa|cissp|aws|azure|google cloud)\b/;
const INSTITUTION_RE = /\b(universite|university|institut|institute|ecole|school|college|faculte|faculty|academie|academy|polytechnique|centre|center|cnam|iae|esc|insead|hec)\b/;

const LANGS: [string, RegExp][] = [
  ["fr", /\b(francais|french)\b/],
  ["en", /\b(anglais|english)\b/],
  ["pt", /\b(portugais|portuguese)\b/],
  ["ar", /\b(arabe|arabic)\b/],
  ["es", /\b(espagnol|spanish)\b/],
  ["sw", /\b(swahili|kiswahili)\b/],
];

const TITLE_HINT = /\b(expert|experte|consultant|consultante|ingenieur|specialiste|chef|charge|chargee|responsable|directeur|directrice|manager|coordonnateur|coordonnatrice|coordinateur|economiste|analyste|conseiller|conseillere|architecte|auditeur|auditrice|juriste|statisticien|statisticienne|gestionnaire|developpeur|developpeuse|formateur|formatrice|medecin|enseignant|chercheur|chercheuse|officer|engineer|specialist|advisor|adviser|analyst|director|lead|head)\b/;

/** Texte réduit à des mots séparés par une espace (ponctuation ignorée : « S&E » → « s e »). */
const words = (s: string) => ` ${fold(s).replace(/[^a-z0-9]+/g, " ").trim()} `;
/** Terme présent comme suite de mots entiers (au moins 3 caractères utiles). */
const containsTerm = (haystackWords: string, term: string) => {
  const t = words(term);
  return t.replace(/ /g, "").length >= 2 && t.trim().length >= 3 && haystackWords.includes(t);
};

export function parseCvText(raw: string, ref: CvReferenceData): CvDraft {
  const text = raw.replace(/\r/g, "").replace(/[   ]/g, " ");
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").replace(/^[•▪●◦■\-–*·]\s*/, "").trim()).filter(Boolean);
  const all = fold(lines.join("\n"));

  // Découpage en sections
  const sections: Record<Section | "head", string[]> = { head: [], profile: [], experience: [], education: [], certifications: [], skills: [], languages: [], other: [] };
  let current: Section | "head" = "head";
  for (const l of lines) {
    const h = headingOf(l);
    if (h) {
      current = h;
      continue;
    }
    sections[current].push(l);
  }

  // Coordonnées (affichées pour contrôle, jamais publiées)
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0] ?? null;
  const phone = /(?:\+|00)\d[\d\s.-]{7,16}\d/.exec(text)?.[0].replace(/\s+/g, " ") ?? null;
  const linkedin = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\w-]+\/?/i.exec(text)?.[0] ?? null;

  // Accroche : première ligne d'en-tête qui ressemble à un intitulé de poste
  const headLines = sections.head.slice(0, 12).filter((l) => !/@|\d{6,}|linkedin|^(tel|tél|phone|email|adresse|address)\b/i.test(l));
  const headline = headLines.find((l) => l.length >= 8 && l.length <= 120 && TITLE_HINT.test(fold(l))) ?? null;

  // Présentation
  const bioText = sections.profile.join(" ").replace(/\s+/g, " ").trim();
  const bio = bioText.length >= 40 ? bioText.slice(0, 2000) : null;

  // Expériences : une plage de dates ouvre un bloc
  const experiences: CvDraft["experiences"] = [];
  const expLines = sections.experience.length ? sections.experience : [];
  let block: { start: string; end: string | null; head: string; body: string[] } | null = null;
  const flush = () => {
    if (!block) return;
    let { title, employer } = splitTitleEmployer(block.head);
    const body = [...block.body];
    if (!title && body.length) title = body.shift()!;
    if (!employer && body.length && body[0].length <= 90) employer = body.shift()!;
    if (title) experiences.push({ title: title.slice(0, 160), employer: (employer || "Non précisé").slice(0, 160), startDate: block.start, endDate: block.end, description: body.join("\n").slice(0, 1500) || null });
    block = null;
  };
  for (const l of expLines) {
    const r = parseRange(l);
    if (r) {
      flush();
      block = { start: r.start, end: r.end, head: r.rest, body: [] };
    } else if (block) block.body.push(l);
  }
  flush();

  // Diplômes et certifications
  const qualifications: CvDraft["qualifications"] = [];
  const pushQual = (kind: "DEGREE" | "CERTIFICATION", line: string, next: string | undefined) => {
    const year = /\b(19[6-9]\d|20\d{2})\b/.exec(line)?.[1] ?? (next && /^\D{0,10}\b(19[6-9]\d|20\d{2})\b\D{0,10}$/.exec(next)?.[1]);
    const cleaned = line.replace(/\b(19[6-9]\d|20\d{2})\b/g, "").replace(/[()]/g, "").replace(/\s*[-–—|,:]\s*$/, "").replace(/^\s*[-–—|,:]\s*/, "").trim();
    const parts = cleaned.split(/\s*[|–—]\s*|\s+-\s+|\s*,\s*|\s+[àa]\s+(?=l'|la |le |l’)|\s*:\s*/).map((x) => x.trim()).filter(Boolean);
    let title = parts[0] ?? cleaned;
    let institution = parts.slice(1).find((p) => INSTITUTION_RE.test(fold(p))) ?? parts[1] ?? "";
    if (!institution && next && INSTITUTION_RE.test(fold(next))) institution = next;
    if (INSTITUTION_RE.test(fold(title)) && parts[1] && !INSTITUTION_RE.test(fold(parts[1]))) [title, institution] = [parts[1], title];
    if (title.length < 3) return;
    const y = year ? +year : null;
    if (!qualifications.some((q) => fold(q.title) === fold(title) && q.year === y)) qualifications.push({ kind, title: title.slice(0, 160), institution: (institution || "Non précisé").slice(0, 160), year: y });
  };
  sections.education.forEach((l, i) => {
    const f = fold(l);
    if (DEGREE_RE.test(f)) pushQual("DEGREE", l, sections.education[i + 1]);
    else if (CERT_RE.test(f)) pushQual("CERTIFICATION", l, sections.education[i + 1]);
  });
  sections.certifications.forEach((l, i) => {
    if (l.length <= 160 && (CERT_RE.test(fold(l)) || /\b(19[6-9]\d|20\d{2})\b/.test(l))) pushQual("CERTIFICATION", l, sections.certifications[i + 1]);
  });

  // Années d'expérience : mention explicite, sinon déduite des expériences
  const explicit = /(\d{1,2})\s*\+?\s*(?:ans|annees|years?)\s+(?:d'|d’|de\s+)?(?:experience|experiences|of experience)/.exec(all);
  let yearsExperience: number | null = explicit ? Math.min(60, +explicit[1]) : null;
  if (yearsExperience == null && experiences.length) {
    const first = experiences.map((e) => e.startDate).sort()[0];
    yearsExperience = Math.max(0, Math.min(60, new Date().getFullYear() - +first.slice(0, 4)));
  }

  // Langues
  const langSource = sections.languages.length ? fold(sections.languages.join(" ")) : all;
  const languages = LANGS.filter(([, re]) => re.test(langSource)).map(([c]) => c);

  // Pays : en-tête d'abord (adresse), sinon nationalité mentionnée
  const head = words(sections.head.slice(0, 15).join(" "));
  const country = ref.countries.find((c) => containsTerm(head, c.nameFr) || containsTerm(head, c.nameEn));

  // Compétences du référentiel (noms et synonymes)
  const allWords = words(lines.join("\n"));
  const skills: CvDraft["skills"] = [];
  for (const s of ref.skills) {
    const term = [s.nameFr, s.nameEn, ...s.synonyms].find((t) => containsTerm(allWords, t));
    if (term) skills.push({ skillId: s.id, name: s.nameFr, evidence: term });
  }
  const domainIds = new Set(skills.map((s) => ref.skills.find((k) => k.id === s.skillId)?.domainId).filter((x): x is string => !!x));
  for (const d of ref.domains) if (containsTerm(allWords, d.nameFr) || containsTerm(allWords, d.nameEn)) domainIds.add(d.id);

  return {
    contact: { email, phone, linkedin },
    headline: headline?.slice(0, 160) ?? null,
    bio,
    yearsExperience,
    languages,
    countryCode: country?.code ?? null,
    skills,
    domainIds: [...domainIds],
    experiences: experiences.slice(0, 30),
    qualifications: qualifications.slice(0, 30),
  };
}
