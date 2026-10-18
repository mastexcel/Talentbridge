/** Typographies des certificats (capitales classiques et italique de titre, comme sur les modèles fournis). */
import { Cinzel, Playfair_Display } from "next/font/google";

export const cinzel = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-cinzel", display: "swap" });
export const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
