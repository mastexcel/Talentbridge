import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/ui/Toast";
import { InstallAppBanner, PwaRegister } from "@/ui/InstallApp";
import { getLocale } from "@/i18n/server";

/** Typographies auto-hébergées par Next (aucun appel externe côté client). */
const display = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-jakarta", display: "swap" });
const text = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

/** Instance de démonstration hébergée (image Dockerfile.demo) : jamais de données réelles. */
const hostedDemo = process.env.NODE_ENV === "production" && process.env.DEMO_SEED === "true";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000"),
  title: { default: "Talent Bridge — Connecter les experts, transformer les compétences en résultats", template: "%s · Talent Bridge" },
  description: "Plateforme panafricaine de mobilisation, de vérification et de mise en relation d'experts avec les cabinets, entreprises, ONG et institutions.",
  applicationName: "Talent Bridge",
  ...(hostedDemo ? { robots: { index: false, follow: false } } : {}),
  icons: { apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Talent Bridge", statusBarStyle: "default" },
  openGraph: { title: "Talent Bridge", description: "Des experts d'aujourd'hui pour les défis de demain.", locale: "fr_FR", siteName: "Talent Bridge", type: "website", images: [{ url: "/brand/tb-logo.png", width: 1600, height: 406 }] },
};

export const viewport: Viewport = { themeColor: "#7B1F2B", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${text.variable}`}>
      <body className="min-h-screen font-sans">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-lift">
          Aller au contenu
        </a>
        {hostedDemo && (
          <p role="note" className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
            Site de démonstration : données fictives, paiements simulés, aucun email envoyé. Ne saisissez aucune donnée réelle.
          </p>
        )}
        <ToastProvider>{children}</ToastProvider>
        <PwaRegister />
        <InstallAppBanner />
      </body>
    </html>
  );
}
