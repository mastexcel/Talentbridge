/**
 * Les 14 parcours critiques du cahier des charges, enchaînés dans un vrai navigateur
 * sur l'application construite (base de démonstration seedée).
 */
import { expect, test, type Page } from "@playwright/test";

const PW = process.env.DEMO_PASSWORD ?? "Demo2026!TB";
const stamp = Date.now();
const consultantEmail = `e2e.consultant.${stamp}@test.local`;
const orgEmail = `e2e.ong.${stamp}@test.local`;
const password = "E2eMotdepasse1";
const lastName = `Testeur${String(stamp).slice(-6)}`;
const fullName = `Ines ${lastName}`;
const missionTitle = `Évaluation E2E du programme de suivi-évaluation ${stamp}`;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

async function login(page: Page, email: string, pw = PW) {
  await page.context().clearCookies();
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill(pw);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"));
  await page.waitForLoadState("networkidle");
}

/** Suit un lien par son href (évite les clics perdus pendant les préchargements du routeur). */
async function follow(page: Page, name: string | RegExp) {
  const href = await page.getByRole("link", { name }).first().getAttribute("href");
  await page.goto(href!, { waitUntil: "networkidle" });
}

/** Bouton d'action avec boîte de confirmation / saisie. */
async function confirmAction(page: Page, button: string | RegExp, text?: string) {
  await page.getByRole("button", { name: button }).first().click();
  const dialog = page.locator("dialog[open]");
  if (text !== undefined) await dialog.locator("textarea").fill(text);
  await dialog.getByRole("button", { name: "Confirmer" }).click();
}

test.describe.serial("Parcours critiques Talent Bridge", () => {
  test("1. Inscription d'un consultant", async ({ page }) => {
    await page.goto("/inscription", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /Consultant indépendant/ }).click();
    await page.getByLabel("Prénom").fill("Ines");
    await page.getByLabel(/^Nom/).fill(lastName);
    await page.getByLabel("Email").fill(consultantEmail);
    await page.getByLabel("Mot de passe").fill(password);
    // Validation côté client (React Hook Form + Zod) : CGU obligatoires
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page.getByText("Vous devez accepter les conditions d'utilisation.")).toBeVisible();
    await page.getByLabel(/conditions générales/).check();
    await page.getByLabel(/politique de confidentialité/).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL(/\/espace\/profil/);
    await expect(page.getByText("Bienvenue sur Talent Bridge !")).toBeVisible();
  });

  test("2. Création du profil expert", async ({ page }) => {
    await login(page, consultantEmail, password);
    await page.goto("/espace/profil", { waitUntil: "networkidle" });
    await page.getByLabel("Titre professionnel").fill("Experte en suivi-évaluation de programmes");
    await page.getByLabel("Présentation").fill("Douze ans d'expérience en suivi-évaluation de programmes de développement en Afrique de l'Ouest, pour des ONG et des bailleurs.");
    await page.getByLabel("Ville").fill("Abidjan");
    await page.getByLabel("Années d'expérience").fill("12");
    await page.getByLabel("Suivi-évaluation", { exact: true }).check();
    await page.getByLabel("Tarif journalier indicatif").fill("150000");
    // Profil privé par défaut : l'expert choisit explicitement d'apparaître dans l'annuaire.
    await page.getByLabel("Visibilité du profil").selectOption("PUBLIC");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).first().click();
    await expect(page.getByText("Profil enregistré.")).toBeVisible();
    for (const s of ["Suivi-évaluation", "Enquêtes et collecte de données", "Cadre logique / théorie du changement"]) {
      await page.getByLabel("Compétence à ajouter").selectOption({ label: s + " — Suivi-évaluation" });
      await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    }
    await page.getByRole("button", { name: "Enregistrer les compétences" }).click();
    await expect(page.getByText("Compétences enregistrées.")).toBeVisible();
    // Éléments complémentaires (expérience, diplôme, références, CV) via l'API de l'application
    const api = page.request;
    const headers = { origin: new URL(page.url()).origin };
    await api.post("/api/v1/me/item-add", { headers, data: { itemKind: "experience", title: "Chargée de S&E", employer: "ONG partenaire", startDate: "2014-01-01" } });
    await api.post("/api/v1/me/item-add", { headers, data: { itemKind: "qualification", kind: "DEGREE", title: "Master en évaluation", institution: "Université" } });
    for (const n of [1, 2]) await api.post("/api/v1/me/item-add", { headers, data: { itemKind: "reference", contactName: `Référent ${n}`, contactOrg: `Organisation ${n}` } });
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('input[type=file][aria-label="Déposer mon CV"]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("Fichier déposé.")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(/Complétude du profil/)).toBeVisible();
    const pct = Number((await page.locator("text=/^\\d+ %$/").first().innerText()).replace(" %", ""));
    expect(pct).toBeGreaterThanOrEqual(60);
  });

  test("3. Soumission à vérification", async ({ page }) => {
    await login(page, consultantEmail, password);
    await page.goto("/espace/verification", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Démarrer", exact: true }).first().click();
    await expect(page.getByText("Demande ouverte")).toBeVisible();
    await page.locator('input[type=file][aria-label="Déposer"]').first().setInputFiles({ name: "cni.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("Fichier déposé.")).toBeVisible();
    await confirmAction(page, "Soumettre à vérification");
    await expect(page.getByText("Demande soumise.")).toBeVisible();
    await expect(page.getByText("En attente").first()).toBeVisible();
  });

  test("4. Validation administrative (vérificateur)", async ({ page }) => {
    await login(page, "verificateur@demo.talentbridge.africa");
    await page.goto("/admin/verifications", { waitUntil: "networkidle" });
    await follow(page, fullName);
    await page.getByRole("button", { name: "Démarrer l'instruction" }).click();
    await expect(page.getByText("Instruction démarrée.")).toBeVisible();
    // Le badge ne peut pas être attribué sans contrôles
    await confirmAction(page, "Valider et attribuer le badge", "");
    await expect(page.getByText(/contrôles requis/)).toBeVisible();
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Enregistrer" }).nth(i).click();
      await expect(page.getByText("Contrôle enregistré.").first()).toBeVisible();
    }
    await confirmAction(page, "Valider et attribuer le badge", "Pièce d'identité conforme");
    await expect(page.getByText("Vérification validée, badge attribué.")).toBeVisible();
    await expect(page.getByText(/Identité vérifiée — valable jusqu'au/)).toBeVisible();
  });

  test("5. Création d'une organisation", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/inscription/organisation?type=NGO", { waitUntil: "networkidle" });
    await page.getByLabel("Raison sociale").fill(`ONG E2E ${stamp}`);
    await page.getByLabel("Prénom").fill("Omar");
    await page.getByLabel(/^Nom/).fill("Recruteur");
    await page.getByLabel("Email professionnel").fill(orgEmail);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByLabel(/conditions générales/).check();
    await page.getByLabel(/politique de confidentialité/).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL(/\/organisation\/parametres/);
    await expect(page.getByText("Votre espace est créé")).toBeVisible();
    await page.getByLabel("N° d'immatriculation (RCCM…)").fill("CI-ABJ-2026-B-12345");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Fiche enregistrée.")).toBeVisible();
  });

  test("6. Publication d'une mission", async ({ page }) => {
    await login(page, orgEmail, password);
    await page.goto("/organisation/missions/nouvelle", { waitUntil: "networkidle" });
    await page.getByLabel("Intitulé de la mission").fill(missionTitle);
    await page.getByLabel("Description").fill("Nous recherchons un expert en suivi-évaluation pour concevoir le cadre logique et piloter les enquêtes de référence du programme.");
    await page.getByRole("button", { name: "Analyser le besoin" }).click();
    await expect(page.getByText(/compétence\(s\) repérée\(s\)/)).toBeVisible();
    await expect(page.getByText("Suivi-évaluation").first()).toBeVisible();
    await page.getByLabel("Pays").selectOption("CI");
    await page.getByRole("button", { name: "Créer la mission (brouillon)" }).click();
    await page.waitForURL(/\/organisation\/missions\/c/);
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByText(/Publiée — candidatures ouvertes/).first()).toBeVisible();
  });

  test("7. Recherche et matching", async ({ page }) => {
    await page.goto(`/missions?q=${encodeURIComponent("E2E")}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: missionTitle })).toBeVisible();
    await page.goto(`/experts?q=${lastName}`, { waitUntil: "networkidle" });
    await expect(page.getByText(fullName)).toBeVisible();
    await login(page, orgEmail, password);
    await page.goto("/organisation/missions", { waitUntil: "networkidle" });
    await follow(page, missionTitle);
    await page.goto(page.url().split("?")[0] + "?onglet=matching", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Lancer le matching" }).click();
    await expect(page.getByText("Recommandations calculées.")).toBeVisible();
    const card = page.locator("div", { has: page.getByRole("link", { name: fullName }) }).last();
    await expect(page.getByRole("link", { name: fullName })).toBeVisible();
    await expect(page.getByText(/\/100$/).first()).toBeVisible();
    await expect(page.getByText("Compétences").first()).toBeVisible();
    void card;
  });

  test("8. Dépôt d'une candidature", async ({ page }) => {
    await login(page, consultantEmail, password);
    await page.goto(`/missions?q=${encodeURIComponent("E2E")}`, { waitUntil: "networkidle" });
    await follow(page, missionTitle);
    await page.getByLabel(/Proposition technique \(résumé\)/).fill("Approche mixte : revue documentaire, cadre logique participatif, enquête de référence sur échantillon représentatif et restitution.");
    await page.getByLabel(/Tarif journalier proposé/).fill("150000");
    await page.locator('input[type=file][aria-label="Joindre"]').first().setInputFiles({ name: "proposition.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("Fichier déposé.")).toBeVisible();
    await page.getByRole("button", { name: "Déposer ma candidature" }).click();
    await page.waitForURL(/\/espace\/candidatures/);
    await expect(page.getByRole("link", { name: missionTitle })).toBeVisible();
    await expect(page.getByText("Reçue").first()).toBeVisible();
  });

  test("9. Sélection d'un expert et contractualisation", async ({ page }) => {
    await login(page, orgEmail, password);
    await page.goto("/organisation/missions", { waitUntil: "networkidle" });
    await follow(page, missionTitle);
    await page.getByRole("button", { name: "Présélectionner", exact: true }).click();
    await expect(page.getByText("Candidature : Présélectionnée.")).toBeVisible();
    await confirmAction(page, "Retenir", "Profil le plus pertinent");
    await expect(page.getByText("Candidature : Retenue.")).toBeVisible();
    await page.getByLabel(/Montant total/).fill("3000000");
    await page.getByRole("button", { name: "Créer le contrat" }).click();
    await page.waitForURL(/\/organisation\/contrats/);
    await page.getByRole("button", { name: "Envoyer à l'expert" }).first().click();
    await expect(page.getByText("Contrat mis à jour.")).toBeVisible();
    // Signature par l'expert
    await login(page, consultantEmail, password);
    await page.goto("/espace/contrats", { waitUntil: "networkidle" });
    await confirmAction(page, "Signer");
    await expect(page.getByText("Contrat signé.")).toBeVisible();
  });

  test("10. Création d'une équipe projet", async ({ page }) => {
    await login(page, orgEmail, password);
    await page.goto("/organisation/contrats", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Démarrer", exact: true }).first().click();
    await expect(page.getByText("Contrat mis à jour.")).toBeVisible();
    await page.goto("/projets", { waitUntil: "networkidle" });
    await page.getByLabel(/^Nom/).fill(`Équipe E2E ${stamp}`);
    await page.getByLabel("Mission liée").selectOption({ label: missionTitle });
    await page.getByRole("button", { name: "Créer le projet" }).click();
    await page.waitForURL(/\/projets\/c/);
    await page.goto(page.url().split("?")[0] + "?vue=equipe", { waitUntil: "networkidle" });
    await page.getByLabel("Consultant").selectOption({ label: fullName });
    await page.getByLabel("Rôle").selectOption("LEAD");
    await page.getByRole("button", { name: "Ajouter" }).first().click();
    await expect(page.getByText("Membre ajouté.")).toBeVisible();
    await expect(page.getByText("Chef de mission")).toBeVisible();
  });

  test("11. Suivi d'une mission (tâches, livrable, validation)", async ({ page }) => {
    await login(page, orgEmail, password);
    await page.goto("/projets", { waitUntil: "networkidle" });
    await follow(page, new RegExp(`Équipe E2E ${stamp}`));
    const projectUrl = page.url().split("?")[0];
    await page.goto(page.url().split("?")[0] + "?vue=equipe", { waitUntil: "networkidle" });
    await page.getByLabel(/^Titre/).fill("Rapport de démarrage");
    await page.getByLabel("Assignée à").selectOption({ label: fullName });
    await page.getByLabel("C'est un livrable (validation requise)").check();
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByText("Tâche créée.")).toBeVisible();
    // Le consultant dépose le livrable
    await login(page, consultantEmail, password);
    await page.goto(projectUrl, { waitUntil: "networkidle" });
    await page.locator('input[type=file][aria-label="Déposer"]').first().setInputFiles({ name: "rapport.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText("Fichier déposé.")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Livrable soumis")).toBeVisible();
    // Le client valide
    await login(page, orgEmail, password);
    await page.goto(projectUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(page.getByText("Livrable validé.").first()).toBeVisible();
    await page.goto(projectUrl + "?vue=chronologie", { waitUntil: "networkidle" });
    await expect(page.getByText("Vue chronologique")).toBeVisible();
  });

  test("12. Souscription en mode test", async ({ page }) => {
    await login(page, orgEmail, password);
    await page.goto("/facturation", { waitUntil: "networkidle" });
    await page.getByLabel("Offre").selectOption({ index: 0 });
    await page.getByRole("button", { name: "Continuer vers le paiement" }).click();
    await page.waitForURL(/\/paiement\/test\//);
    await expect(page.getByText("Environnement de test")).toBeVisible();
    await page.getByRole("button", { name: "Simuler un paiement accepté" }).click();
    await page.waitForURL(/\/facturation\/factures\//);
    await expect(page.getByText("Payée").first()).toBeVisible();
    await expect(page.getByText("Test", { exact: true }).first()).toBeVisible();
  });

  test("13. Génération d'une facture (PDF)", async ({ page }) => {
    await login(page, orgEmail, password);
    await page.goto("/facturation", { waitUntil: "networkidle" });
    const href = await page.getByRole("link", { name: "PDF" }).first().getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
    // Une autre organisation ne peut pas télécharger cette facture
    await login(page, "cabinet@demo.talentbridge.africa");
    expect((await page.request.get(href!)).status()).toBe(403);
  });

  test("14. Consultation du CEO Dashboard", async ({ page }) => {
    await login(page, "consultant@demo.talentbridge.africa");
    await page.goto("/admin/direction", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/^(?!.*\/admin\/direction)/); // pas d'accès sans droits
    await login(page, "ceo@demo.talentbridge.africa");
    await page.goto("/admin/direction?demo=1", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "CEO Dashboard" })).toBeVisible();
    await expect(page.getByText("Données de démonstration incluses")).toBeVisible();
    for (const k of ["Utilisateurs", "Chiffre d'affaires encaissé", "Délai moyen de matching", "Taux de conversion", "Satisfaction"]) await expect(page.getByText(k).first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Carte de l'Afrique/ })).toBeVisible();
    const csv = await page.request.get("/api/v1/exports/direction?format=csv&demo=1");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("missionsPublished");
    const pdf = await page.request.get("/api/v1/exports/direction?format=pdf");
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("15. Academy : un apprenant s'inscrit à un séminaire", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/academy", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Catalogue des formations et séminaires" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prochains séminaires et sessions" })).toBeVisible();
    await page.goto((await page.getByRole("link", { name: "Séminaires", exact: true }).getAttribute("href"))!, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "Séminaires", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /genre et inclusion/ }).first()).toBeVisible();
    await follow(page, "Créer un compte apprenant");
    await page.getByLabel("Prénom").fill("Awa");
    await page.getByLabel(/^Nom/).fill(lastName);
    await page.getByLabel("Email").fill(`e2e.apprenant.${stamp}@test.local`);
    await page.getByLabel("Mot de passe").fill(password);
    await page.getByLabel(/conditions générales/).check();
    await page.getByLabel(/politique de confidentialité/).check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL(/\/academy\?bienvenue=1/);
    await page.goto("/academy/seminaire-genre-inclusion-demo", { waitUntil: "networkidle" });
    await expect(page.getByText("Choisissez votre session")).toBeVisible();
    await page.getByRole("button", { name: "S'inscrire gratuitement" }).click();
    await expect(page.getByText("Inscription confirmée.").first()).toBeVisible();
    await page.goto("/espace/formations", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /genre et inclusion/ })).toBeVisible();
    await expect(page.getByText("Séminaire").first()).toBeVisible();
  });
});
