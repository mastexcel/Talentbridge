import type { Metadata } from "next";
import { AudiencePage } from "@/ui/AudiencePage";
export const metadata: Metadata = { title: "Pour les cabinets de conseil" };
export default function Page() {
  return <AudiencePage eyebrow="Pour les cabinets de conseil" title="Gagnez plus d'appels d'offres avec les bons experts" intro="Mobilisez rapidement des experts clés vérifiés, préparez vos dossiers avec une matrice de conformité et constituez des consortiums." image="/images/cabinets.webp"
    benefits={[{ title: "Experts clés vérifiés", text: "Identité, diplômes et références contrôlés : des CV qui tiennent à l'analyse." }, { title: "Veille et alertes", text: "Appels d'offres et AMI filtrés par pays, domaine et mots-clés." }, { title: "Matrice de conformité", text: "Checklist des pièces repérées dans les TDR, à valider par votre équipe." }, { title: "Consortiums", text: "Associez vos partenaires et vos experts dans un même dossier." }]}
    steps={["Créez l'espace de votre cabinet et invitez vos collaborateurs.", "Suivez les appels d'offres et ouvrez un dossier de candidature.", "Associez les experts pertinents grâce au matching.", "Soumettez un dossier complet et suivez vos résultats."]}
    cta={[{ label: "Rejoindre la plateforme", href: "/inscription/organisation?type=CONSULTING_FIRM" }, { label: "Voir les appels d'offres", href: "/appels-offres" }]} />;
}
