/**
 * Affichage multi-écrans : chaque interface (public, consultant, organisation, formateur,
 * administration) est ouverte sur ordinateur, tablette portrait, tablette paysage et téléphone.
 * Échec si la page ne répond pas, déborde horizontalement ou produit une erreur dans la console.
 */
import { expect, test } from "@playwright/test";
import { ROLE_ROUTES, VIEWPORTS } from "./routes";

const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo2026!TB";

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  for (const r of ROLE_ROUTES) {
    test(`${name} — ${r.role}`, async ({ browser, baseURL }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ viewport });
      if (r.email) {
        const res = await context.request.post(`${baseURL}/api/v1/auth/login`, { headers: { origin: baseURL! }, data: { email: r.email, password: PASSWORD } });
        expect(res.ok(), `connexion ${r.email}`).toBeTruthy();
      }
      const problems: string[] = [];
      for (const path of r.paths) {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        const response = await page.goto(path, { waitUntil: "networkidle" });
        if (!response?.ok()) problems.push(`${path} : statut ${response?.status()}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) problems.push(`${path} : débordement horizontal de ${overflow} px`);
        if (errors.length) problems.push(`${path} : ${errors[0]}`);
        await page.close();
      }
      await context.close();
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}
