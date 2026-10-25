# Application Android Talent Bridge

Application Android légère (≈ 40 Ko) qui ouvre le site Talent Bridge en plein écran dans une WebView :
pages du site gardées dans l'application, liens externes, `tel:` et `mailto:` ouverts dans l'application
adaptée, envoi de fichiers (CV, justificatifs), téléchargement des PDF avec la session de l'utilisateur,
page hors connexion locale, bouton retour, liens `https://<site>` ouverts dans l'application.

- Android 5.0 (API 21) minimum, cible API 34.
- Identifiant : `africa.talentbridge.app`.
- Adresse du site : `res/values/strings.xml` (`site_url`, `site_host`) et l'hôte du filtre d'intention de
  `AndroidManifest.xml`. Actuellement l'instance de démonstration ; à remplacer par l'adresse de
  production avant toute diffusion publique.

## Construire

Outils (Ubuntu) : `apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23` et un JDK.

```sh
KEYSTORE=/chemin/talentbridge.jks KS_PASS=… sh android/build-apk.sh <versionCode> <versionName>
# → android/build/talentbridge-<versionName>.apk
```

La clé de signature (`.jks`) et son mot de passe ne sont **jamais** stockés dans le dépôt : conservez-les
en lieu sûr. Une mise à jour de l'application doit être signée avec la même clé (sinon Android refuse
de l'installer par-dessus l'ancienne) ; incrémenter `versionCode` à chaque version.

## Google Play

Le Play Store exige un Android App Bundle (`.aab`) et une cible API récente : la publication passe par un
projet Gradle (Android Studio) ou par un paquet « Trusted Web Activity » généré à partir de l'application
web installable (manifeste `src/app/manifest.ts`), avec le compte développeur Google Play de Talent Bridge.
