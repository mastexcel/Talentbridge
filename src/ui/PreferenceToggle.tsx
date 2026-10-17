"use client";
import { useState } from "react";
import { api, ApiError } from "./api";
import { useToast } from "./Toast";

/** Interrupteur relié à l'API (préférence de notification ou consentement). */
export function PreferenceToggle({ type, channel, consent, enabled, label }: { type?: string; channel?: "IN_APP" | "EMAIL" | "SMS"; consent?: "MARKETING_EMAIL" | "MARKETING_SMS" | "PROFILE_PUBLIC"; enabled: boolean; label?: string }) {
  const [on, setOn] = useState(enabled);
  const toast = useToast();
  async function change(v: boolean) {
    setOn(v);
    try {
      if (consent) await api("/api/v1/me/consent", { body: { type: consent, granted: v } });
      else await api("/api/v1/me/notification-pref", { body: { type, channel, enabled: v } });
      toast("success", "Préférence enregistrée.");
    } catch (e) {
      setOn(!v);
      toast("error", e instanceof ApiError ? e.message : "Erreur.");
    }
  }
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => change(e.target.checked)} className="h-4 w-4 accent-orange-600" aria-label={label ?? `${type} ${channel}`} />
      {label}
    </label>
  );
}
