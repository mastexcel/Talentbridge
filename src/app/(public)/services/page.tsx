import type { Metadata } from "next";
import { publicFigures } from "@/application/figures.service";
import { Visual } from "@/ui/Visual";
import { visuals } from "@/ui/visuals";
import { PageHeader } from "@/ui/Page";
import { ButtonLink } from "@/ui/Button";
export const metadata: Metadata = { title: "Nos services" };
export const dynamic = "force-dynamic";
const SERVICES = [
  { id: "annuaire", title: "Annuaire et recherche d'experts", text: "Moteur de recherche multicritère (pays, domaine, compétences, langues, expérience, vérification, disponibilité, mobilité, tarif). Coordonnées protégées, contact via messagerie.", href: "/experts" },
  { id: "verification", title: "Vérification et certification", text: "Parcours en 9 étapes : dépôt, complétude, contrôle administratif, diplômes, références, évaluation des compétences, décision, badge, renouvellement. Aucun badge sans décision humaine.", href: "/inscription/consultant" },
  { id: "missions", title: "Marketplace des missions", text: "Publication, candidatures avec propositions technique et financière, présélection, entretiens, sélection, contractualisation et suivi jusqu'à la clôture.", href: "/missions" },
  { id: "matching", title: "Matching intelligent", text: "Recommandations déterministes et explicables (compétences 30 %, expérience 20 %, références vérifiées 15 %, disponibilité 15 %, localisation 10 %, langues 10 % — coefficients configurables), toujours soumises à validation humaine.", href: "/entreprises" },
  { id: "equipes", title: "Équipes projet", text: "Composition d'équipes pluridisciplinaires, chef de mission, tâches et livrables en Kanban et en chronologie, validation des travaux et évaluation finale.", href: "/ong-institutions" },
  { id: "appels-offres", title: "Appels d'offres et AMI", text: "Veille, alertes, dossiers de candidature, checklist et matrice de conformité (brouillons à vérifier), experts clés et consortiums.", href: "/appels-offres" },
  { id: "academy", title: "Talent Bridge Academy", text: "Parcours de formation, quiz, progression, certificats vérifiables par code unique et QR code, mentorat et sessions en direct.", href: "/academy" },
];
export default async function Page() {
  const v = visuals(await publicFigures());
  return (
    <>
    <Visual def={v.services} priority rounded={false} className="mx-auto max-w-[1774px] bg-white" />
    <div id="liste" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title="Nos services" description="Une infrastructure complète pour identifier, qualifier et mobiliser l'expertise." actions={<ButtonLink href="/tarifs">Voir les tarifs</ButtonLink>} />
      <div className="space-y-6">
        {SERVICES.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 overflow-hidden rounded-3xl border border-line bg-white shadow-card">
            <div className="p-6"><h2 className="text-2xl font-extrabold text-bordeaux-700">{s.title}</h2><p className="mt-2 text-slate">{s.text}</p><ButtonLink href={s.href} variant="outline" className="mt-4">En savoir plus</ButtonLink></div>
          </section>
        ))}
      </div>
      <Visual def={v.equipesProjet} className="mt-10" />
    </div>
    </>
  );
}
