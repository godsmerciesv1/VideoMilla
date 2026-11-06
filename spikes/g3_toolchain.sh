#!/usr/bin/env bash
# G3 toolchain spike. THROWAWAY: lives on the 'spikes' branch only, never on main.
# Finds which real versions resolve and compile. Writes spikes/out/report.md.
set -u
WANTED="3.47.1"
OUT="$(pwd)/spikes/out"; mkdir -p "$OUT"; R="$OUT/report.md"
WORK="${RUNNER_TEMP:-/tmp}/g3"; mkdir -p "$WORK"
say(){ printf '%s\n' "$*" | tee -a "$R"; }
sec(){ printf '\n## %s\n\n' "$*" | tee -a "$R"; }
run(){ local label="$1"; shift; local t0; t0=$(date +%s); "$@" >"$OUT/$label.log" 2>&1; local rc=$?; say "- \`$label\`: exit **$rc** ($(( $(date +%s)-t0 ))s)"; return $rc; }
echo "# G3 toolchain report" > "$R"; say "Run date: $(date -u +%F' '%T) UTC"; say "Runner: $(uname -sr), $(java -version 2>&1 | head -1)"

sec "A. Flutter releases (official feed)"
curl -fsSL https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json -o "$OUT/releases.json" || say "- could not fetch the release feed"
FV=$(python3 - "$WANTED" "$R" <<'PY'
import json,sys
wanted,rep=sys.argv[1],sys.argv[2]
d=json.load(open('spikes/out/releases.json'))
rel=[r for r in d['releases'] if r['channel']=='stable']
by={r['hash']:r for r in d['releases']}
cur=by[d['current_release']['stable']]
has=any(r['version']==wanted for r in rel)
with open(rep,'a') as f:
    f.write(f"- Current stable: **{cur['version']}** (Dart {cur.get('dart_sdk_version')}), released {cur['release_date'][:10]}\n")
    f.write("- Latest 8 stable releases:\n")
    for r in rel[:8]: f.write(f"  - {r['version']}  Dart {r.get('dart_sdk_version')}  {r['release_date'][:10]}\n")
    f.write(f"- Blueprint version {wanted} exists on the stable channel: **{has}**\n")
print(wanted if has else cur['version'])
PY
)
say "- Using Flutter: **$FV**"

sec "B. Install and doctor"
run flutter_clone git clone --depth 1 -b "$FV" https://github.com/flutter/flutter.git "$HOME/flutter" || { say "FATAL: cannot clone Flutter $FV"; exit 1; }
export PATH="$HOME/flutter/bin:$PATH"
run flutter_version flutter --version
{ echo '```'; flutter --version 2>&1 | head -8; echo '```'; } >> "$R"
flutter config --no-analytics >/dev/null 2>&1
run flutter_precache flutter precache --web --android
run flutter_doctor flutter doctor -v

sec "C. Scratch project and every blueprint dependency (F009 + google_sign_in)"
cd "$WORK"
run flutter_create flutter create --org com.zdmgold --project-name videomilla --platforms android,web probe || { say "FATAL: flutter create failed"; exit 1; }
cd probe
flutter pub add flutter_localizations --sdk=flutter >"$OUT/add_flutter_localizations.log" 2>&1 && say "- flutter_localizations: ok" || say "- flutter_localizations: **FAILED**"
for p in intl http crypto uuid path path_provider sqflite flutter_secure_storage image_picker image file_picker share_plus url_launcher video_player wakelock_plus package_info_plus archive flutter_tts in_app_purchase web phosphor_flutter google_sign_in; do
  if flutter pub add "$p" >"$OUT/add_$p.log" 2>&1; then say "- $p: ok"; else say "- $p: **FAILED** (see add_$p.log)"; fi
done
for p in flutter_lints flutter_launcher_icons flutter_native_splash; do
  if flutter pub add "dev:$p" >"$OUT/add_$p.log" 2>&1; then say "- dev $p: ok"; else say "- dev $p: **FAILED** (see add_$p.log)"; fi
done
run pub_get flutter pub get
python3 - "$R" "$OUT/pinned_dependencies.yaml" <<'PY'
import re,sys
rep,pin=sys.argv[1],sys.argv[2]
rows=[];cur=None;dep=None
for line in open('pubspec.lock'):
    m=re.match(r'^  ([a-z0-9_]+):\s*$',line)
    if m: cur=m.group(1);dep=None;continue
    m=re.match(r'^    dependency: "([^"]+)"',line)
    if m: dep=m.group(1);continue
    m=re.match(r'^    version: "([^"]+)"',line)
    if m and cur and dep in('direct main','direct dev'): rows.append((cur,dep,m.group(1)))
with open(rep,'a') as f:
    f.write("\n| Package | Kind | Resolved version |\n| --- | --- | --- |\n")
    for n,k,v in rows: f.write(f"| {n} | {k} | {v} |\n")
with open(pin,'w') as f:
    f.write("# exact pins, generated from pubspec.lock\ndependencies:\n")
    for n,k,v in rows:
        if k=='direct main': f.write(f"  {n}: {v}\n")
    f.write("dev_dependencies:\n")
    for n,k,v in rows:
        if k=='direct dev': f.write(f"  {n}: {v}\n")
PY
{ echo; echo "### pub outdated (shows whether resolved = latest)"; echo '```'; flutter pub outdated 2>&1 | head -60; echo '```'; } >> "$R"

sec "D. Analyze the scratch project"
run flutter_analyze flutter analyze
{ echo '```'; tail -15 "$OUT/flutter_analyze.log"; echo '```'; } >> "$R"

sec "E. Android template facts"
{ echo '```'; grep -rnE "(minSdkVersion|targetSdkVersion|compileSdkVersion|ndkVersion)" "$HOME/flutter/packages/flutter_tools/gradle/src/main" --include=*.kt 2>/dev/null | head -12;
  echo "--- app build file ---"; ls android/app; sed -n 1,60p android/app/build.gradle.kts 2>/dev/null || sed -n 1,60p android/app/build.gradle;
  echo "--- wrapper ---"; cat android/gradle/wrapper/gradle-wrapper.properties | grep distributionUrl;
  echo "--- settings (plugin versions) ---"; grep -nE "version" android/settings.gradle* | head; echo '```'; } >> "$R"

sec "F. Media3 versions (Google Maven)"
for a in media3-transformer media3-effect media3-common; do curl -fsSL "https://dl.google.com/dl/android/maven2/androidx/media3/$a/maven-metadata.xml" -o "$WORK/$a.xml" || say "- $a: metadata fetch failed"; done
M3=$(python3 - "$WORK/media3-transformer.xml" "$R" <<'PY'
import re,sys
x=open(sys.argv[1]).read()
vs=re.findall(r'<version>([^<]+)</version>',x)
stable=[v for v in vs if re.fullmatch(r'\d+\.\d+\.\d+',v)]
def key(v): return tuple(int(p) for p in v.split('.'))
stable.sort(key=key)
with open(sys.argv[2],'a') as f:
    f.write(f"- Latest stable media3-transformer: **{stable[-1]}**\n- Last 8 stable: {', '.join(stable[-8:])}\n- Blueprint doc claim: 1.11.1 present: **{'1.11.1' in stable}**\n")
print(stable[-1])
PY
)
say "- Probing with Media3 $M3"

sec "G. Media3 API compile probe (image item, MatrixTransformation, OverlayEffect) + all plugins in a debug APK"
mkdir -p android/app/src/main/kotlin/com/zdmgold/videomilla
cat > android/app/src/main/kotlin/com/zdmgold/videomilla/Probe.kt <<'KT'
package com.zdmgold.videomilla

import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.MatrixTransformation
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.Transformer
import com.google.common.collect.ImmutableList

object Probe {
    fun still(path: String, durationMs: Long, w: Int, h: Int): EditedMediaItem {
        val zoom = MatrixTransformation { presentationTimeUs ->
            val t = (presentationTimeUs / 1000f / durationMs).coerceIn(0f, 1f)
            Matrix().apply { postScale(1f + 0.12f * t, 1f + 0.12f * t) }
        }
        val overlay = object : BitmapOverlay() {
            private val bmp = Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888)
            override fun getBitmap(presentationTimeUs: Long): Bitmap = bmp
        }
        val videoEffects = listOf<Effect>(
            Presentation.createForWidthAndHeight(w, h, Presentation.LAYOUT_SCALE_TO_FIT_WITH_CROP),
            zoom,
            OverlayEffect(ImmutableList.of(overlay)),
        )
        val item = MediaItem.Builder().setUri(path).setImageDurationMs(durationMs).build()
        return EditedMediaItem.Builder(item).setFrameRate(25).setEffects(Effects(listOf(), videoEffects)).build()
    }

    fun composition(items: List<EditedMediaItem>): Composition =
        Composition.Builder(EditedMediaItemSequence.Builder(items).build()).build()

    val transformerClass = Transformer::class.java
}
KT
BF=android/app/build.gradle.kts
if [ -f "$BF" ]; then
cat >> "$BF" <<GR

dependencies {
    implementation("androidx.media3:media3-transformer:$M3")
    implementation("androidx.media3:media3-effect:$M3")
    implementation("androidx.media3:media3-common:$M3")
}
GR
else
BF=android/app/build.gradle
cat >> "$BF" <<GR

dependencies {
    implementation "androidx.media3:media3-transformer:$M3"
    implementation "androidx.media3:media3-effect:$M3"
    implementation "androidx.media3:media3-common:$M3"
}
GR
fi
run android_debug_apk flutter build apk --debug
{ echo '```'; grep -E "^e: |error:|FAILURE|What went wrong|Could not|Unresolved|BUILD " "$OUT/android_debug_apk.log" | head -40; echo '```'; } >> "$R"
ls -la build/app/outputs/flutter-apk/ 2>/dev/null | tee -a "$R" >/dev/null

sec "H. Web builds of the same scratch app"
run web_release flutter build web --release
run web_wasm flutter build web --release --wasm
{ echo '```'; grep -iE "error|wasm|unsupported|incompatible" "$OUT/web_wasm.log" | head -15; echo '```'; } >> "$R"

sec "I. Mediabunny"
mkdir -p "$WORK/mb" && cd "$WORK/mb" && npm init -y >/dev/null 2>&1
{ npm view mediabunny version license dist.tarball 2>&1 | head -6; } | sed 's/^/    /' >> "$R"
npm install mediabunny >"$OUT/npm_mediabunny.log" 2>&1 && say "- npm install mediabunny: ok" || say "- npm install mediabunny: **FAILED**"
{ echo '```'; ls -la node_modules/mediabunny/dist 2>/dev/null | head -30; echo; (cd node_modules/mediabunny/dist 2>/dev/null && sha256sum *.js *.mjs 2>/dev/null | head -10); echo '```'; } >> "$R"

sec "J. Worker toolchain (npm)"
for p in typescript wrangler vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types; do echo "- $p: $(npm view "$p" version 2>&1 | tail -1)" | tee -a "$R"; done
{ echo; echo '`@cloudflare/vitest-pool-workers` peer dependencies:'; echo '```'; npm view @cloudflare/vitest-pool-workers peerDependencies --json 2>&1 | head -12; echo '```'; } >> "$R"

sec "Done"; say "Finished $(date -u +%T) UTC"
exit 0
