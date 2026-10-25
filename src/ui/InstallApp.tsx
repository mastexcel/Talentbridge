"use client";
/**
 * Application installable (PWA) : enregistrement du service worker, proposition d'installation
 * (Android, ordinateur : invite native du navigateur ; iPhone/iPad : marche à suivre Safari).
 */
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { cn } from "./cn";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Platform = "prompt" | "ios" | "installed" | "unsupported";

const DISMISS_KEY = "tb_install_dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** État d'installation partagé par la bannière et le bouton de la page /application. */
function useInstall() {
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if (isStandalone()) return setPlatform("installed");
    if (isIos()) setPlatform("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPrompt);
      setPlatform("prompt");
    };
    const onInstalled = () => setPlatform("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setPlatform("installed");
  }, [deferred]);

  return { platform, install };
}

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

function IosSteps({ className }: { className?: string }) {
  return (
    <ol className={cn("space-y-1 text-sm", className)}>
      <li>1. Touchez <Share className="inline h-4 w-4 align-[-3px]" aria-label="Partager" /> dans Safari</li>
      <li>2. Choisissez <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden /> « Sur l&apos;écran d&apos;accueil »</li>
    </ol>
  );
}

/** Bannière discrète en bas d'écran, une seule fois par appareil (fermeture mémorisée). */
export function InstallAppBanner() {
  const { platform, install } = useInstall();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  // La page /application présente déjà l'installation.
  if (dismissed || pathname === "/application" || (platform !== "prompt" && platform !== "ios")) return null;
  return (
    <div role="dialog" aria-label="Installer l'application Talent Bridge" className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-md animate-fade-in rounded-2xl border border-line bg-white p-4 shadow-lift sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <Image src="/app/icon-192.png" alt="" width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-xl border border-line" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-ink">Installer l&apos;application</p>
          {platform === "prompt" ? (
            <p className="text-sm text-slate">Talent Bridge sur votre écran d&apos;accueil, en plein écran.</p>
          ) : (
            <IosSteps className="mt-1 text-slate" />
          )}
        </div>
        <button type="button" onClick={close} aria-label="Fermer" className="rounded-lg p-1 text-slate hover:bg-mist"><X className="h-5 w-5" /></button>
      </div>
      {platform === "prompt" && (
        <button type="button" onClick={() => install().finally(close)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 font-semibold text-white hover:bg-orange-700">
          <Download className="h-4 w-4" aria-hidden /> Installer
        </button>
      )}
    </div>
  );
}

/** Bouton et explications de la page /application. */
export function InstallAppPanel() {
  const { platform, install } = useInstall();
  if (platform === "installed") return <p className="rounded-xl bg-olive-50 px-4 py-3 text-olive-900">L&apos;application Talent Bridge est installée sur cet appareil.</p>;
  if (platform === "prompt")
    return (
      <button type="button" onClick={install} className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700">
        <Download className="h-5 w-5" aria-hidden /> Installer l&apos;application
      </button>
    );
  if (platform === "ios") return <div className="rounded-xl border border-line bg-white p-4"><p className="mb-2 font-semibold">Sur iPhone et iPad (Safari)</p><IosSteps /></div>;
  return <p className="text-slate">Ouvrez cette page dans Chrome (Android, ordinateur) ou Safari (iPhone, iPad) pour installer l&apos;application.</p>;
}
