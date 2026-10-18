# Design system

Tokens définis dans `src/app/globals.css` (Tailwind CSS 4, bloc `@theme`) ; composants dans `src/ui`.

## Identité

- **Logos officiels utilisés tels que fournis (fichiers non modifiés)** : `public/brand/logo-talent-bridge.png` (fond blanc) et `logo-talent-bridge-bordeaux.png` (cartouche bordeaux, fonds sombres). Composant : `<Logo variant="light|dark" />`. Le logo vertical fourni (`docs/brand-sources/logo-vertical-fourni.png`) contient un damier « transparent » incrusté dans l'image : il n'est pas affiché tant qu'une version PNG réellement transparente n'est pas fournie. Les favicons restent des recadrages du pictogramme (un favicon doit être carré).
- **Visuels officiels** : `public/visuels/*.png`, affichés sans modification par `<Visual>` (`src/ui/Visual.tsx`, catalogue `src/ui/visuals.ts`). Seules des zones sont recouvertes par du HTML positionné en coordonnées de l'image : boutons peints → vrais liens ; chiffres peints → chiffres réels (`publicFigures()`) ; barres de recherche → vrais formulaires ; pastilles et cartes → zones cliquables. Sous 768 px, chiffres et actions sont repris lisiblement sous le visuel. Pour ajouter un visuel : copier le fichier dans `public/visuels`, mesurer les zones (x, y, largeur, hauteur en pixels de l'image) et les déclarer dans `visuals.ts`.
- **Modèles de certificats** (`modele-*.png`) : affichés sur `/certificats` avec la mention « Exemple fictif » ; noms, numéros et QR codes peints ne sont pas vérifiables.
- Fonds `public/backgrounds/*.webp` (issus de la planche de fonds d'écran).
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

## Accessibilité et responsive

Contraste AA, focus visible (anneau orange), libellés explicites, navigation clavier des menus et dialogues, cibles tactiles ≥ 40 px, aucune information portée par la seule couleur. Mise en page mobile d'abord ; vérifiée sans débordement horizontal à 412 px (test Playwright `responsive.spec.ts`).
