import { expect, test } from "@playwright/test";

test.describe("Affichage mobile", () => {
  test("accueil et menu mobile sans débordement horizontal", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await page.getByRole("navigation", { name: "Navigation mobile" }).getByRole("link", { name: "Experts" }).click();
    await expect(page).toHaveURL(/\/experts/, { timeout: 20_000 });
  });

  test("espace connecté : tiroir de navigation", async ({ page }) => {
    await page.request.post("/api/v1/auth/login", { data: { email: "consultant@demo.talentbridge.africa", password: process.env.DEMO_PASSWORD ?? "Demo2026!TB" }, headers: { origin: new URL(page.url() === "about:blank" ? "http://localhost:3100" : page.url()).origin } });
    await page.goto("/espace", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const link = page.getByRole("dialog", { name: "Menu de navigation" }).getByRole("link", { name: "Mon profil" });
    await expect(link).toBeVisible();
    // Navigation attendue explicitement : sous forte charge (suite complète en parallèle), le rendu serveur peut prendre plusieurs secondes.
    await Promise.all([page.waitForURL(/\/espace\/profil/, { timeout: 60_000 }), link.click()]);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
