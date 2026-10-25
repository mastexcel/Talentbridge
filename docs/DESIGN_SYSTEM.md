# Design system

Tokens définis dans `src/app/globals.css` (Tailwind CSS 4, bloc `@theme`) ; composants dans `src/ui`.

## Identité

- **Logo** : fichiers officiels conservés intacts dans `docs/brand-sources/` (`logo-officiel-fond-blanc.png`, `logo-officiel-cartouche-bordeaux.png`). Les déclinaisons web sont générées par `python3 scripts/brand/generate_brand_assets.py` sans toucher au dessin : fond rendu transparent (le cartouche bordeaux perd ses coins noirs), marges retirées, rééchantillonnage Lanczos, PNG sans perte servis sans recompression (`unoptimized`) :
  - `tb-wordmark.png` / `tb-wordmark-inverse.png` : « Talent Bridge » + pont, fonds clairs / sombres — en-têtes, barres latérales, certificats ;
  - `tb-logo.png` / `tb-logo-inverse.png` : logo complet avec slogan (partage social, supports imprimés) ;
  - `tb-pictogramme.png` : pont seul (barre latérale repliée, icônes) ; `src/app/icon.png` et `apple-touch-icon.png` en dérivent.
  - Composant `<Logo variant="light|dark" tagline />` : le slogan, illisible une fois réduit dans une image, est composé en texte net (`<Tagline>`) et n'est affiché que là où la place le permet (pied de page, page de connexion).
  - Le logo vertical fourni (`logo-vertical-fourni.png`) contient un damier « transparent » incrusté : non utilisé.
- **Visuels officiels** : `public/visuels/*.png`, affichés sans modification par `<Visual>` (`src/ui/Visual.tsx`, catalogue `src/ui/visuals.ts`). Seules des zones sont recouvertes par du HTML positionné en coordonnées de l'image : boutons peints → vrais liens ; chiffres peints → chiffres réels (`publicFigures()`) ; barres de recherche → vrais formulaires ; pastilles et cartes → zones cliquables. Sous 768 px, chiffres et actions sont repris lisiblement sous le visuel. Pour ajouter un visuel : copier le fichier dans `public/visuels`, mesurer les zones (x, y, largeur, hauteur en pixels de l'image), les déclarer dans `visuals.ts`, puis lancer `npx tsx scripts/brand/optimize-visuals.mts`. Ce script produit, sans toucher aux originaux, des déclinaisons WebP (640, 1080 et 1920 px, qualité 90) dans `public/optimized/visuels`, servies directement par le loader `src/lib/image-loader.ts` : aucun calcul d'image à chaque visite (environ 300 Ko au lieu de 2 Mo par visuel), ce qui garde le site rapide sur mobile et sur un hébergement modeste.
- **Certificats** : en fond, le pont du logo (7 % d'opacité) et la carte d'Afrique en pointillés avec ses connexions africaines et internationales (`afrique-connexions.svg/.png`, générée par `npx tsx scripts/brand/generate-africa-map.mts`), à l'écran et dans le PDF ; composants `AcademyCertificate` et `ConsultantCertificate` (`src/ui/certificates`) reproduisant les modèles fournis (gabarit 1536 × 1024 mis à l'échelle, polices Cinzel et Playfair Display), version PDF équivalente (`certificate-pdf.ts`). Les modèles d'origine (`modele-*.png`) restent affichés sur `/certificats` comme « Exemple fictif ».
- Fond de la page de connexion `public/backgrounds/connexion.webp` : zone d'image du fond d'écran n° 1 de la planche (sans logo, textes peints ni légende de la planche), généré par le même script.
- **Typographies** : Plus Jakarta Sans (titres, `font-display`), Inter (texte, `font-sans`), auto-hébergées via `next/font`.

## Couleurs

| Rôle | Token | Valeur |
|---|---|---|
| Bordeaux (primaire) | `bordeaux-700` | #7B1F2B |
| Orange (action, accent) | `orange-500` | #E8731A — texte orange : `orange-700` #B4520C (contraste AA) |
| Olive (succès, impact) | `olive-500` | #8DB92E — texte : `olive-700` #557318 |
| Texte | `ink` | #17212B |
| Texte secondaire | `slate` | #64748B |
| Fond de page | `mist` | #F7F8FA |
| Bordures | `line` | #E5E8EE |
| Surfaces | blanc | #FFFFFF |

Échelles complètes 50 → 950 pour bordeaux, orange, olive. Les couleurs vives (orange-500, olive-500) ne portent jamais de texte fin sur fond blanc.

**Graphiques** (`src/ui/charts.tsx`) : palette catégorielle validée par script (luminosité, chroma, daltonisme, contraste) dans un ordre fixe : #A13A4A, #5E8A1E, #2F6FB5, #D4640F, #7C5CB8. Un seul axe Y, info-bulle au survol, légende dès 2 séries, tableau de données accessible sous chaque graphique.

## Formes et élévation

Rayons `rounded-xl` (14 px, champs, boutons) et `rounded-2xl` (20 px, cartes) ; ombres `shadow-card` (repos) et `shadow-lift` (survol, menus). Animation d'entrée `animate-fade-in`, désactivée si `prefers-reduced-motion`.

## Composants (`src/ui`)

| Composant | Usage |
|---|---|
| `Button`, `ButtonLink` | Variantes `primary` (orange-600, action principale), `secondary` (bordeaux), `outline`, `ghost`, `success` (olive), `danger`, `light` (sur fond sombre) ; tailles `sm/md/lg` (cva) |
| `Card`, `CardHeader`, `CardBody` | Conteneurs |
| `Badge`, `StatusBadge`, `DemoBadge` | Statuts (toujours libellé texte + couleur), marquage « Démo » |
| `Field`, `Input`, `Textarea`, `Select`, `Checkbox` | Champs avec libellé, aide, erreur, `aria-invalid` |
| `ApiForm` | Formulaire relié à l'API : sérialisation typée, erreurs par champ, clé d'idempotence, redirection |
| `SignupForm`, `MissionForm` | Formulaires React Hook Form + Zod (schémas partagés avec le serveur) |
| `ActionButton` | Action avec confirmation / saisie (dialogue accessible) |
| `Alert`, `EmptyState`, `Skeleton`, `NotAvailable` | Retours, états vides, chargement, fonctionnalité non activée (jamais de faux succès) |
| `Table`, `Pagination`, `PageHeader`, `RichText` | Mise en page |
| `Stat` | Tuiles KPI (valeur, variation, source) |
| `BarChartCard`, `LineChartCard`, `DonutCard`, `FunnelCard` | Graphiques |
| `MatchBreakdown`, `ScorePill` | Score de matching détaillé par critère |
| `Shell` | Mise en page connectée : barre latérale repliable, tiroir mobile (`role="dialog"`), sélecteur d'organisation |
| `FileUpload`, `SkillsEditor`, `TeamBuilder`, `TaskMove`, `StageSelect`, `QuizForm`… | Composants métier |
| `Toast`, `MobileMenu`, `LocaleSwitch` | Divers |

## Affichage multi-écrans

Quatre formats sont couverts et testés : téléphone (390 × 844), tablette portrait (768 × 1024), tablette paysage (1024 × 768) et ordinateur (1440 × 900). Règles : navigation publique complète à partir de 1280 px (menu compact en dessous), barre latérale des espaces connectés à partir de 1024 px (tiroir en dessous), éléments de grille autorisés à rétrécir (`:where(.grid) > * { min-width: 0 }`), tableaux et onglets à défilement horizontal interne, étiquettes autorisées à passer à la ligne. Le test `tests/e2e/multi-ecrans.spec.ts` ouvre chaque page de chaque rôle aux quatre formats et échoue en cas de débordement horizontal ou d'erreur.

## Accessibilité et responsive

Contraste AA, focus visible (anneau orange), libellés explicites, navigation clavier des menus et dialogues, cibles tactiles ≥ 40 px, aucune information portée par la seule couleur. Mise en page mobile d'abord ; vérifiée sans débordement horizontal à 412 px (test Playwright `responsive.spec.ts`).
