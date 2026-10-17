"use client";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

/** Sélecteur de langue (cookie) : français par défaut, anglais préparé. */
export function LocaleSwitch({ locale, dark }: { locale: "fr" | "en"; dark?: boolean }) {
  const router = useRouter();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `tb_locale=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${dark ? "text-white/80 hover:text-white" : "text-slate hover:text-ink"}`}
      aria-label={next === "en" ? "Switch to English" : "Passer en français"}
    >
      <Globe className="h-3.5 w-3.5" /> {next.toUpperCase()}
    </button>
  );
}
