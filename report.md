# G3 toolchain report
Run date: 2026-11-06 23:05:57 UTC
Runner: Linux 7.0.0-1017-azure, openjdk version "17.0.21" 2026-10-20

## A. Flutter releases (official feed)

- Current stable: **3.47.9** (Dart 3.13.7), released 2026-10-29
- Latest 8 stable releases:
  - 3.47.9  Dart 3.13.7  2026-10-29
  - 3.47.8  Dart 3.13.7  2026-10-23
  - 3.47.7  Dart 3.13.5  2026-10-08
  - 3.47.6  Dart 3.13.5  2026-10-01
  - 3.47.5  Dart 3.13.4  2026-09-18
  - 3.47.4  Dart 3.13.3  2026-09-11
  - 3.47.3  Dart 3.13.3  2026-09-09
  - 3.47.2  Dart 3.13.2  2026-08-27
- Blueprint version 3.47.9 exists on the stable channel: **True**
- Using Flutter: **3.47.9**

## B. Install and doctor

- `flutter_clone`: exit **0** (2s)
- `flutter_version`: exit **0** (20s)
```
Flutter 3.47.9 • channel [user-branch] • https://github.com/flutter/flutter.git
Framework • revision c197ca5199 (8 days ago) • 2026-10-29 10:10:20 -0400
Engine • hash 9e025265bef30b838c0c1b68cad19decf97048f2 (revision 89c39edfdf) (10 days ago) • 2026-10-27 19:51:20.000Z
Tools • Dart 3.13.7 • DevTools 2.60.0
```
- `flutter_precache`: exit **0** (21s)
- `flutter_doctor`: exit **0** (4s)

## C. Scratch project and every blueprint dependency (F009 + google_sign_in)

- `flutter_create`: exit **0** (1s)
- flutter_localizations: ok
- intl: ok
- http: ok
- crypto: ok
- uuid: ok
- path: ok
- path_provider: ok
- sqflite: ok
- flutter_secure_storage: ok
- image_picker: ok
- image: ok
- file_picker: ok
- share_plus: ok
- url_launcher: ok
- video_player: ok
- wakelock_plus: ok
- package_info_plus: ok
- archive: ok
- flutter_tts: ok
- in_app_purchase: ok
- web: ok
- phosphor_flutter: ok
- google_sign_in: ok
- dev flutter_lints: ok
- dev flutter_launcher_icons: ok
- dev flutter_native_splash: ok
- `pub_get`: exit **0** (0s)

| Package | Kind | Resolved version |
| --- | --- | --- |
| archive | direct main | 4.6.0 |
| crypto | direct main | 3.0.8 |
| cupertino_icons | direct main | 1.0.9 |
| file_picker | direct main | 13.3.2 |
| flutter | direct main | 0.0.0 |
| flutter_launcher_icons | direct dev | 0.14.4 |
| flutter_lints | direct dev | 6.0.0 |
| flutter_localizations | direct main | 0.0.0 |
| flutter_native_splash | direct dev | 2.4.8 |
| flutter_secure_storage | direct main | 11.2.0 |
| flutter_test | direct dev | 0.0.0 |
| flutter_tts | direct main | 4.2.5 |
| google_sign_in | direct main | 7.2.0 |
| http | direct main | 1.6.0 |
| image | direct main | 4.12.0 |
| image_picker | direct main | 1.2.4 |
| in_app_purchase | direct main | 3.3.1 |
| intl | direct main | 0.20.3 |
| package_info_plus | direct main | 10.2.2 |
| path | direct main | 1.9.1 |
| path_provider | direct main | 2.1.6 |
| phosphor_flutter | direct main | 2.1.0 |
| share_plus | direct main | 13.3.1 |
| sqflite | direct main | 2.4.5 |
| url_launcher | direct main | 6.3.3 |
| uuid | direct main | 4.6.0 |
| video_player | direct main | 2.14.1 |
| wakelock_plus | direct main | 1.8.2 |
| web | direct main | 1.1.2 |

### pub outdated (shows whether resolved = latest)
```
Showing outdated packages.
[*] indicates versions that are not the latest available.

Package Name              Current   Upgradable  Resolvable  Latest  

direct dependencies:     
cupertino_icons           *1.0.9    *1.0.9      2.0.0       2.0.0   

dev_dependencies: all up-to-date.

transitive dependencies: 
code_assets               *1.2.1    2.2.0       2.2.0       2.2.0   
cross_file                *0.3.5+5  *0.3.5+5    *0.3.5+5    0.4.0   
hooks                     *2.0.2    2.2.0       2.2.0       2.2.0   
material_color_utilities  *0.13.0   *0.13.0     *0.13.0     0.13.1  
meta                      *1.18.3   1.19.0      1.19.0      1.19.0  
objective_c               *9.5.0    9.6.3       9.6.3       9.6.3   
petitparser               *7.0.2    7.1.0       7.1.0       7.1.0   
record_use                *0.6.0    1.1.1       1.1.1       1.1.1   
vector_math               *2.4.0    2.4.4       2.4.4       2.4.4   
xml                       *7.0.1    7.1.0       7.1.0       7.1.0   

transitive dev_dependencies:
cli_util                  *0.4.2    *0.4.2      *0.4.2      0.6.0   
test_api                  *0.7.12   *0.7.12     *0.7.12     0.7.15  

8 upgradable dependencies are locked (in pubspec.lock) to older versions.
To update these dependencies, use `flutter pub upgrade`.

1 dependency is constrained to a version that is older than a resolvable version.
To update it, edit pubspec.yaml, or run `flutter pub upgrade --major-versions`.
```

## D. Analyze the scratch project

- `flutter_analyze`: exit **0** (6s)
```
Analyzing probe...                                              
No issues found! (ran in 5.4s)
```

## E. Android template facts

```
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:22:    /** Sets the compileSdkVersion used by default in Flutter app projects. */
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:23:    val compileSdkVersion: Int = 36
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:25:    /** Sets the minSdkVersion used by default in Flutter app projects. */
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:26:    val minSdkVersion: Int = 24
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:29:     * Sets the targetSdkVersion used by default in Flutter app projects.
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:30:     * targetSdkVersion should always be the latest available stable version.
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:34:    val targetSdkVersion: Int = 36
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:37:     * Sets the ndkVersion used by default in Flutter app projects.
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt:42:    val ndkVersion: String = "28.2.13676358"
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/tasks/BaseFlutterTaskHelper.kt:151:            args("-dMinSdkVersion=${baseFlutterTask.minSdkVersion}")
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/tasks/ValidateCompileSdkVersionTask.kt:20: * Task to validate that the project's compileSdkVersion and ndkVersion are not lower than
/home/runner/flutter/packages/flutter_tools/gradle/src/main/kotlin/tasks/ValidateCompileSdkVersionTask.kt:158:                        ndkVersion = "$maxPluginNdkVersion"
--- app build file ---
build.gradle.kts
src
plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.zdmgold.videomilla"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.zdmgold.videomilla"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
--- wrapper ---
distributionUrl=https\://services.gradle.org/distributions/gradle-9.3.1-all.zip
--- settings (plugin versions) ---
21:    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
22:    id("com.android.application") version "9.1.0" apply false
23:    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
```

## F. Media3 versions (Google Maven)

- Latest stable media3-transformer: **1.11.1**
- Last 8 stable: 1.9.1, 1.9.2, 1.9.3, 1.9.4, 1.10.0, 1.10.1, 1.11.0, 1.11.1
- Blueprint doc claim: 1.11.1 present: **True**
- Probing with Media3 1.11.1

## G. Media3 API compile probe (image item, MatrixTransformation, OverlayEffect) + all plugins in a debug APK

- `android_debug_apk`: exit **0** (287s)
```
```
total 164776
drwxr-xr-x 2 runner runner      4096 Nov  6 23:12 .
drwxr-xr-x 5 runner runner      4096 Nov  6 23:11 ..
-rw-r--r-- 1 runner runner 168714873 Nov  6 23:11 app-debug.apk
-rw-r--r-- 1 runner runner        40 Nov  6 23:12 app-debug.apk.sha1

## H. Web builds of the same scratch app

- `web_release`: exit **0** (28s)
- `web_wasm`: exit **0** (29s)
```
│   See https://flutter.dev/to/wasm for more information.                                  │
```

## I. Mediabunny

    version = '1.65.2'
    license = 'MPL-2.0'
    dist.tarball = 'https://registry.npmjs.org/mediabunny/-/mediabunny-1.65.2.tgz'
- npm install mediabunny: ok
```
346f3a2af124234aeb257c2eeb41cb572cfb6fbd254d153bb9f436abab4b17ff  node_modules/mediabunny/dist/bundles/mediabunny.cjs
ca4807a0d057bbf5755982be1f23e11b659251fdb5c1cba586b9b501b9f5fe9f  node_modules/mediabunny/dist/bundles/mediabunny.mjs
3ea06a5fadd928ef80bbc5ec41c5bb583934e59993437c0d7ff02a67d203acf7  node_modules/mediabunny/dist/bundles/mediabunny.node.cjs
08149edcc8cf980da65d94a0a54a8fc0fa85a65f89b66f55c906f33618363919  node_modules/mediabunny/dist/bundles/mediabunny.min.mjs
e71c7e1047806e3d8280019d915ed068704f25a379ffc2afaafc60343dcd3584  node_modules/mediabunny/dist/bundles/mediabunny.min.cjs
```

## J. Worker toolchain (npm)

- typescript: 7.0.2
- wrangler: 4.158.0
- vitest: 5.1.0
- @cloudflare/vitest-pool-workers: 0.23.0
- @cloudflare/workers-types: 5.20261106.1

`@cloudflare/vitest-pool-workers` peer dependencies:
```
{
  "vitest": "^4.1.0",
  "@vitest/runner": "^4.1.0",
  "@vitest/snapshot": "^4.1.0"
}
```

## Done

Finished 23:13:01 UTC
