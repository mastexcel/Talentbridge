import type { Metadata } from "next";
import { AudiencePage } from "@/ui/AudiencePage";
export const metadata: Metadata = { title: "Pour les entreprises" };
export default function Page() {
  return <AudiencePage eyebrow="Pour les entreprises et PME" title="Trouvez l'expertise qu'il vous faut, quand il vous la faut" intro="Publiez votre besoin, recevez des profils qualifiés et sécurisez vos projets avec des experts vérifiés." image="/images/entreprises.webp"
    benefits={[{ title: "Délais réduits", text: "Objectif de 72 h pour identifier des profils, selon la disponibilité des experts." }, { title: "Matching expliqué", text: "Chaque recommandation détaille son score critère par critère." }, { title: "Contrats et livrables", text: "Contractualisation, suivi des livrables et évaluation dans un seul outil." }, { title: "Facturation claire", text: "Abonnement ou service ponctuel, factures conformes et téléchargeables." }]}
    steps={["Décrivez votre besoin en quelques minutes.", "Recevez candidatures et recommandations.", "Comparez, organisez les entretiens, sélectionnez.", "Pilotez la mission jusqu'à sa clôture."]}
    cta={[{ label: "Publier une mission", href: "/inscription/organisation?type=COMPANY" }, { label: "Parcourir les experts", href: "/experts" }]} />;
}
