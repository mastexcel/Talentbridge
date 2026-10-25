import type { MetadataRoute } from "next";

/** Manifeste de l'application installable (PWA) : écran d'accueil, plein écran, raccourcis. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Talent Bridge",
    short_name: "Talent Bridge",
    description: "Plateforme panafricaine d'experts vérifiés : missions, appels d'offres, équipes projet et Academy.",
    lang: "fr",
    dir: "ltr",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#7B1F2B",
    categories: ["business", "education", "productivity"],
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Trouver un expert", url: "/experts?source=app", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Missions", url: "/missions?source=app", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Academy", url: "/academy?source=app", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
      { name: "Mon espace", url: "/connexion?source=app", icons: [{ src: "/app/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
