import type { Metadata } from "next";
import { AudiencePage } from "@/ui/AudiencePage";
export const metadata: Metadata = { title: "Pour les ONG et institutions" };
export default function Page() {
  return <AudiencePage eyebrow="Pour les ONG, institutions et bailleurs" title="Mobilisez des experts spécialisés pour vos programmes" intro="Accédez à un réseau qualifié, renforcez l'impact de vos projets et garantissez la traçabilité de vos sélections." image="/images/ong.webp"
    benefits={[{ title: "Réseau panafricain", text: "Experts de nombreux pays, langues et domaines du développement." }, { title: "Conformité et transparence", text: "Historique des décisions, journal d'audit et critères de sélection documentés." }, { title: "Équipes pluridisciplinaires", text: "Composition d'équipes selon les rôles, le budget et les calendriers." }, { title: "Renforcement des capacités", text: "Formations certifiantes via Talent Bridge Academy." }]}
    steps={["Ouvrez l'espace de votre organisation (validation administrative).", "Publiez vos termes de référence.", "Sélectionnez et contractualisez en toute traçabilité.", "Suivez les livrables et évaluez les prestations."]}
    cta={[{ label: "Découvrir nos solutions", href: "/inscription/organisation?type=NGO" }, { label: "Nous contacter", href: "/contact" }]} />;
}
