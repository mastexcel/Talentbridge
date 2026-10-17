# Design system

Tokens définis dans `src/app/globals.css` (Tailwind CSS 4, bloc `@theme`) ; composants dans `src/ui`.

## Identité

- **Logo officiel** (fourni, non redessiné) : `public/brand/logo-main.png` (horizontal), `logo-vertical.png`, `logo-compact.png`, `logo-icon.png` (pictogramme, favicon), `logo-mono.png`, `logo-wordmark.png`, `logo-dark.png` (fond sombre). Planches sources : `docs/brand-sources/`. Composant : `<Logo variant="main|compact|icon|dark" />`.
- **Visuels** : `public/images/*.webp` (issus des flyers fournis), fonds `public/backgrounds/*.webp`.
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
