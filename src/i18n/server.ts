import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALES, translator, type Locale } from "./messages";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : "fr";
}

export async function getT() {
  const locale = await getLocale();
  return { t: translator(locale), locale };
}
