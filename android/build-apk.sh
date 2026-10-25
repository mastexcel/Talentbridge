#!/bin/sh
# Construit l'APK Android de Talent Bridge sans Gradle ni SDK complet (outils des paquets Ubuntu :
# aapt apksigner zipalign dalvik-exchange android-sdk-platform-23, plus un JDK).
# Usage : KEYSTORE=chemin.jks KS_PASS=… sh android/build-apk.sh [versionCode] [versionName]
# La clé de signature n'est JAMAIS stockée dans le dépôt.
set -e
cd "$(dirname "$0")"
VC=${1:-1}
VN=${2:-1.0.0}
SDK=${ANDROID_PLATFORM_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
: "${KEYSTORE:?KEYSTORE (fichier .jks) requis}"
: "${KS_PASS:?KS_PASS (mot de passe du keystore) requis}"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes"

aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -A assets -I "$SDK" \
  --min-sdk-version 21 --target-sdk-version 34 --version-code "$VC" --version-name "$VN" \
  -F "$OUT/app.unaligned.apk"
javac -nowarn --release 8 -classpath "$SDK" -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && aapt add app.unaligned.apk classes.dex >/dev/null)
zipalign -f -p 4 "$OUT/app.unaligned.apk" "$OUT/app.aligned.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass env:KS_PASS --out "$OUT/talentbridge-$VN.apk" "$OUT/app.aligned.apk"
apksigner verify --print-certs "$OUT/talentbridge-$VN.apk" | head -3
echo "APK : android/$OUT/talentbridge-$VN.apk"
