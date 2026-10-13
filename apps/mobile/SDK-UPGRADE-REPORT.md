# Expo 57 / Android API 36 — báo cáo triển khai

Ngày kiểm tra: **13/10/2026**. Nhánh: `danh/expo57-android36`, từ commit `0a67e9218498063f74e92ffe6e4be875e76d0114`. Nâng cấp được thực hiện trong worktree riêng; không submit hoặc deploy production:

`C:\Users\ADMIN\.codex\worktrees\expo57-android36\CareOnRoad-mobile-break`

**Đã nâng cấp source/dependencies lên Expo 57.0.28 + RN 0.86.3 + React 19.2.3; cấu hình Android target API 36. Chưa kiểm chứng native build hoặc sẵn sàng phát hành.** EAS trả `Not logged in`; local không có Java/JDK hoặc Android SDK được phát hiện.

## A. Current Environment — trước nâng cấp

| Thành phần | Baseline được audit |
|---|---|
| Workflow | Expo Prebuild, Android native đã commit và được duy trì thủ công |
| Expo | Manifest `~52.0.42`, lockfile `52.0.49` |
| React Native / React / React DOM | `0.76.9 / 18.3.1 / 18.3.1` |
| Node local / EAS | `24.19.0 / 20.18.0` |
| Package manager | pnpm `11.22.0`, mobile workspace và lockfile riêng |
| Android min / compile / target | `24 / 35 / 34` |
| Build Tools / NDK | `35.0.0 / 26.1.10909125` |
| AGP / Kotlin / Gradle | `8.6.0 / 1.9.25 / 8.10.2` |
| Hermes / New Architecture | Bật |
| Java / local SDK | Java không có trong PATH/JAVA_HOME; SDK không tìm thấy ở đường dẫn mặc định |
| Native release signing | Trỏ vào debug key; chưa có chứng cứ EAS upload certificate |
| Native app label | CareOnRoad (Preview) |

Checkout gốc vẫn giữ nguyên thay đổi API/Compose và hai file untracked của người dùng. Cache dependency gốc đã được khôi phục từ frozen lockfile; tiến trình này kết thúc với lỗi build-policy optional `dtrace-provider`, nên không coi môi trường baseline đã được kiểm chứng đầy đủ. Không sửa root lockfile, API/web source, environment values, icons, ProGuard hoặc debug keystore.

## B. Recommended Versions — bộ đã triển khai

| Thành phần | Đích | Căn cứ |
|---|---|---|
| Expo / RN / React + React DOM | `57.0.28 / 0.86.3 / 19.2.3` | Expo bundled dependency matrix |
| Android min / compile / target | `24 / 36 / 36` | RN/Expo catalog và override rõ ràng |
| Build Tools / NDK | `36.0.0 / 27.1.12297006` | Native catalog RN 0.86.3 |
| AGP / Kotlin / Gradle | `8.12.0 / 2.1.20 / 9.3.1` | Package catalog và bare template chính thức |
| Hermes / Architecture | Hermes V1, New Architecture | Bộ SDK 57 |
| EAS Node / pnpm / Java image | `22.23.1 / 11.22.0 / JDK 17` | EAS image SDK 57 |
| EAS Android image | `ubuntu-26.04-jdk-17-ndk-r27b-sdk-57` | Official EAS infrastructure |
| EAS CLI dùng kiểm tra | `24.12.0`, chạy bằng `pnpm dlx` | Không đưa CLI vào dependency runtime của app |

Các số native tooling trên được đọc từ package/template; **chưa chạy Gradle để xác nhận toolchain thực thi**. [Expo compatibility](https://docs.expo.dev/versions/latest/), [SDK 57](https://expo.dev/changelog/sdk-57), [bundled packages](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json), [EAS image](https://docs.expo.dev/build-reference/infrastructure/).

| Phương án | Compatibility / thay đổi | Risk / maintenance / build |
|---|---|---|
| A — minimal, SDK 54.0.37 / RN 0.81.5 / React 19.1.0 | Bộ chính thức đầu tiên target 36; ít migration hơn | Rủi ro thấp hơn, gần cuối vòng hỗ trợ; native vẫn cần build |
| B — đã chọn, SDK 57 | Bộ stable chính thức, Router fork và RN host mới; Reanimated 4/Worklets | Rủi ro migration cao hơn, thời gian bảo trì tốt hơn; JS checks pass, native chưa kiểm chứng |

Lộ trình thực hiện: `52 → 53.0.27 → 54.0.37 → 55.0.31 → 56.0.23 → 57.0.28`, dùng matrix từng SDK và `expo install --fix`. SDK 56 Doctor cảnh báo lỗi Hermes V1 đã được xác định trong release notes; tiếp tục đến SDK 57 có bản sửa, Doctor cuối không còn cảnh báo này. Không dùng force, legacy peers hoặc xóa lockfile. [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

SDK 52 không được chọn để ép target 36 bằng một property. SDK 57 tương thích RN 0.86, không ghép RN 0.78. Expo khuyến nghị nâng từng SDK; đã kiểm tra JS ở từng chặng. Native APK checkpoint 54 bị chặn vì EAS chưa đăng nhập.

## C. Dependency Conflicts — toàn bộ direct packages

Phiên bản trước lấy từ lockfile audit; đích bên dưới là **bản thực tế đã cài**, có thể khác patch trong range đề xuất. Các mục “đã xử lý” có chứng cứ install/Doctor/JS; native acceptance vẫn pending.

| Package | Trước → đã cài | Phân loại / mức độ | Nguyên nhân, cách xử lý và source ảnh hưởng |
|---|---|---|---|
| expo | 52.0.49 → 57.0.28 | Breaking / cao | Nâng từng SDK bằng matrix, cập nhật native template |
| react, react-dom | 18.3.1 → 19.2.3 | Breaking / cao | Đồng bộ RN/Expo; providers, refs, JSX đã typecheck |
| react-native | 0.76.9 → 0.86.3 | Breaking / cao | ExpoReactHostFactory, loadReactNative, Gradle/Hermes tooling; native compile pending |
| expo-router | 4.0.22 → 57.0.26 | Breaking / cao | Router mới tách React Navigation; source dùng expo-router; tái tạo typed routes, giữ routes/auth redirect/focus hooks |
| reanimated | 3.16.7 → 4.5.1 | Breaking / cao | Thêm worklets 0.10.1, giữ New Architecture; NativeWind animation cần device test |
| worklets | Chưa có → 0.10.1 | Requires Update / cao | Peer bắt buộc của Reanimated 4; Metro peer từ RN 0.86.3 |
| gesture-handler | 2.20.2 → 2.32.0 | Requires Update / vừa | Theo Expo; gestures/navigation cần smoke |
| screens | 4.5.0 (cache ban đầu 4.4.0) → 4.26.2 | Potential Conflict / cao | Bỏ override cũ bị pnpm 11 bỏ qua; dùng Expo range |
| safe-area-context | 4.12.0 → 5.7.0 | Requires Update / vừa | Insets, headers/tabs/modal; edge-to-edge cần Android 15/16 |
| svg | 15.8.0 → 15.15.4 | Requires Update / vừa | Đồng bộ native icons/SVG |
| react-native-web | 0.19.13 → 0.21.4 | Requires Update / vừa | Đồng bộ React 19 |
| AsyncStorage | 1.23.1 → 2.2.0 | Breaking / cao | Giữ storage keys, token/session API; dữ liệu nâng đè cần device test |
| datetimepicker | 8.2.0 → 9.1.0 | Requires Update / vừa | Theo Expo; booking/Schedule cần regression |
| lucide-react-native | 0.469.0 → 0.511.0 | Potential Conflict / vừa | Peer React 19 hợp lệ, xác minh 86 icon imports vẫn tồn tại |
| @expo/vector-icons | 14.0.4 → 15.1.1 | Requires Update / vừa | Theo Expo range ^15.0.2; icons/fonts |
| expo-asset | 11.0.5 → 57.0.19 | Requires Update / vừa | Theo matrix; asset loading |
| expo-constants | 17.0.8 → 57.0.21 | Requires Update / vừa | Theo matrix; runtime config |
| expo-font | 13.0.4 → 57.0.4 | Requires Update / vừa | Theo matrix; font loading |
| expo-image-picker | 16.0.6 → 57.0.20 | Breaking / cao | MediaTypeOptions → ['images']; Android system picker không yêu cầu broad library access; avatar/field upload |
| expo-linking | 7.0.5 → 57.0.12 | Requires Update / vừa | Theo matrix; OAuth/deep links giữ scheme |
| expo-location | 18.0.10 → 57.0.21 | Requires Update / cao | Theo matrix; foreground/live-location lifecycle giữ nguyên, cần device smoke |
| expo-status-bar | 2.0.1 → 57.0.1 | Requires Update / vừa | Theo matrix; API 36 layout/status bars |
| expo-system-ui | 4.0.9 → 57.0.4 | Requires Update / vừa | Theo matrix; system colors |
| expo-splash-screen | Chưa khai báo → 57.0.10 | Breaking / vừa | SDK 56 bỏ splash trong ExpoConfig; dùng plugin + native manager/style, giữ logo/màu |
| expo-dev-client | 5.2.4 → 57.0.20 | Requires Update / cao | Bản cũ lệch SDK 52; cần build client mới, không tái dùng APK cũ |
| @types/react | 18.3.31 → 19.2.18 | Breaking / vừa | Expo range ~19.2.0; ColorValue callback cho tab icons |
| babel-preset-expo | 12.0.12 → 57.0.15 | Requires Update / cao | Transform React/Worklets/NativeWind theo Expo |
| eslint, eslint-config-expo | 8.57.1 / 8.0.1 → 9.39.1 / 57.0.2 | Requires Update / vừa | Flat config và resolver; compiler diagnostics vẫn hiển thị ở mức warning |
| typescript | 5.9.3 → 6.0.3 | Requires Update / vừa | Bỏ baseUrl, giữ @/*; CSS module declaration riêng |
| @react-native/metro-config | Chưa khai báo → 0.86.3 | Potential Conflict / cao | Peer của Worklets, đồng bộ RN; không pin Metro 0.81 |
| metro-cache, metro-config | 0.81.5 → bỏ direct deps | Unsupported cho đích / cao | Source không dùng trực tiếp; Expo quản lý Metro |
| eas-cli | 16.0.0 → bỏ local dep; dlx 24.12.0 | Potential Conflict / cao | Local CLI kéo config-plugins sai SDK và Doctor cảnh báo; chạy bên ngoài project |
| nativewind, tailwindcss | 4.2.7 / 3.4.19 → giữ | Compatible | NativeWind 4 hỗ trợ SDK 57; không migration UI sang v5 |
| @supabase/supabase-js | 2.116.0 → giữ | Compatible, runtime pending | Node EAS nâng 22 đáp ứng engines; auth/OAuth/storage cần smoke |
| query-string | 7.1.3 → giữ | Compatible | Không đổi auth/deep-link parsing |
| sharp, @babel/core | 0.35.5 / 7.29.7 → giữ | Compatible | Tooling/assets, strict install đã pass |

Tên ngắn RN trong bảng tương ứng package `react-native-*`; datetimepicker và AsyncStorage là package scoped khai báo trong package.json. Không có expo-notifications, expo-camera, expo-secure-store, Firebase hoặc Maps trong mobile; không bổ sung chúng. NativeWind hỗ trợ đích theo [official installation](https://www.nativewind.dev/docs/getting-started/installation).

Conflicts ngoài package đã xử lý:

- **Cao:** Node EAS 20 không đáp ứng pnpm 11/Supabase; đổi Node 22.23.1. Local Node 24 giữ nguyên.
- **Cao:** strict peers/pnpm build policy placeholder; đặt boolean rõ ràng, strictPeerDependencies=true. `enableGlobalVirtualStore=false` cố định cùng chế độ giữa local/CI; `verifyDepsBeforeRun=error` ngăn lệnh kiểm tra tự thay cache.
- **Cao:** Metro lookup root có nguy cơ lấy RN/React của web/API; dùng Expo default + NativeWind, bundle cuối pass với dependencies mobile.
- **Cao:** Expo 57 prebuild mặc định clean; mọi script prebuild thêm --no-clean, gate native được đổi thành chỉ đọc. Không chạy clean hoặc regenerate native trong checkout chính. [SDK 57 behavior](https://expo.dev/changelog/sdk-57).
- **Cao:** release debug signing fallback; gỡ khỏi release, giữ debug config. EAS phải inject upload signing, certificate thực tế chưa biết. [EAS Android build](https://docs.expo.dev/build-reference/android-builds/).
- **Vừa:** package trong bộ Expo đích phát hành <24h bị pnpm minimum-release-age chặn. pnpm ghi 17 ngoại lệ **đúng package@version** vào workspace YAML; không tắt policy toàn cục. EAS CLI dùng 24.12 thay 24.13 mới phát hành để tránh ngoại lệ CLI không cần thiết.
- **Vừa, còn lại:** ESLint 9.39.1 bị registry đánh dấu deprecated, nhưng vẫn là bộ tooling đã chọn/tương thích và chạy pass. Nâng major ESLint cần kiểm tra config Expo riêng.
- **Vừa, còn lại:** 43 lint warnings (18 compiler diagnostics, 6 duplicate imports, 19 unused directives). Compiler đã tắt rõ ràng; nâng severity các diagnostics thành warning để không sửa business effects/UI ngoài phạm vi. Rules hooks cơ bản vẫn giữ. Không tự động --fix hoặc tuyên bố sạch cảnh báo.

## D. Changes Made

Mọi thay đổi source nằm trong `apps/mobile`:

| Files | Nội dung |
|---|---|
| package.json, pnpm-lock.yaml | Bộ Expo/RN/React và native peers; scripts an toàn; CLI tách khỏi dependencies |
| pnpm-workspace.yaml, .npmrc | pnpm 11 policies, strict peers, build approval booleans, store ổn định, age exclusions cụ thể |
| metro.config.js, tsconfig.json, css.d.ts | Expo/NativeWind default, alias không baseUrl, CSS typing |
| .eslintrc.js → eslint.config.js | ESLint flat config, resolver, compiler warnings |
| app.config.ts | Splash plugin, photo/microphone blocks, obsolete fields removed, compiler opt-out |
| rider/(tabs)/_layout.tsx, mechanic/(tabs)/_layout.tsx | Chỉ đổi typing ColorValue; routes/UI giữ nguyên |
| src/lib/avatar-upload.ts, field-photo-uploader.tsx | Android system picker permission flow, enum mới; camera/iOS guards giữ nguyên |
| android/build.gradle, settings.gradle, gradle.properties | Expo catalogs/autolinking, API 36, native tooling, edge-to-edge |
| android/app/build.gradle | Hermes compiler mới, stable release level, app label theo variant, release signing fallback bỏ |
| MainApplication.kt, MainActivity.kt | Native host API mới, splash registration; lifecycle/back behavior giữ |
| AndroidManifest.xml, values/styles.xml, values/strings.xml | Permissions removal markers, activity config, native splash, label dynamic |
| gradle/wrapper/{jar,properties}, gradlew, gradlew.bat | Official Gradle 9.3.1 wrapper |
| eas.json | Node/pnpm/image SDK 57, production app-bundle |
| scripts/check-android-prebuild.cjs, scripts/__tests__/*.test.cjs | Read-only source gate và 10 regression tests |
| README.md, AGENTS.md, SDK-UPGRADE-REPORT.md | Stack/lệnh/checklist và chứng cứ thực tế |

Giữ package ID `com.careonroad.app`, versionName 1.0.0 và source versionCode 1; EAS remote autoIncrement giữ nguyên, versionCode artifact chỉ biết sau build. Không đổi endpoints/env/signing secrets, API contracts, storage keys, assets, ProGuard hoặc business state machines. Có thay đổi tên production từ label native Preview sang CareOnRoad đúng config; không phải redesign UI.

## E. Validation Results

| Kiểm tra cuối SDK 57 | Trạng thái | Bằng chứng |
|---|---|---|
| Frozen lockfile / strict peer resolution | **PASS** | pnpm 11.22.0 install --frozen-lockfile; không force/legacy peers |
| Expo Doctor | **PASS** | 20/20; appConfigFieldsNotSyncedCheck vốn đã disabled do native thủ công, không bật thêm kiểm tra bị bỏ qua |
| expo install --check | **PASS** | Dependencies are up to date |
| TypeScript | **PASS** | pnpm run typecheck, exit 0 |
| ESLint | **PASS, có warnings** | Exit 0; 0 errors, 43 warnings |
| Regression tests upgrade | **PASS** | 10/10, Android/iOS picker guards + negative native configuration tests |
| Read-only native source gate | **PASS** | ID, API 24/36/36, Hermes, catalog, splash, perms/deep links, release guard |
| Metro Android export | **PASS** | 3.552 modules; entry-a2fc0730100a3e725d88cde3d5ca7d77.hbc ~7,2 MB |
| Root build API + web | **PASS** | pnpm run build; Next API 15.5.25 và web 16.3.4 build hoàn tất |
| EAS authentication | **FAIL** | eas-cli 24.12.0 whoami exit 1, Not logged in; quyền project/signing chưa kiểm tra |
| Java/Gradle local environment | **FAIL** | Không tìm thấy Java/JDK/SDK; không chạy native compile |
| EAS development APK (SDK 54 và 57) / production AAB | **NOT TESTED** | Thiếu EAS login; chưa tạo build job hoặc artifact |
| Startup, gestures, native modules, device smoke | **NOT TESTED** | Chưa có device/emulator/native client đích |
| Artifact API, certificate, versionCode, merged permissions, 16 KB | **NOT TESTED** | Cần APK/AAB thực tế |

Các chặng: SDK53 Doctor17/17, SDK54 17/17, SDK55 19/19, SDK56 20/21 (Hermes known regression, đã giải thích và xử lý bằng SDK57). Typecheck, lint và Android export đều chạy ở từng chặng. Chứng cứ local/cache trong `.expo/upgrade-audit/sdk-{53..57}` là ignored, không phải artifact phát hành.

## F. Remaining Risks / bước kiểm chứng còn lại

**Blocker cần thao tác tài khoản:** đăng nhập EAS trên máy hiện tại bằng tài khoản có quyền project đã cấu hình; không gửi mật khẩu/token vào chat. Sau đăng nhập chạy từ worktree mobile:

```powershell
pnpm.cmd dlx eas-cli@24.12.0 login
pnpm.cmd dlx eas-cli@24.12.0 whoami
pnpm.cmd dlx eas-cli@24.12.0 project:info
pnpm.cmd dlx eas-cli@24.12.0 credentials --platform android
pnpm.cmd dlx eas-cli@24.12.0 build --platform android --profile development
pnpm.cmd dlx eas-cli@24.12.0 build --platform android --profile production
```

Quyền account, credentials và remote env chưa xác minh. Chọn upload key hợp lệ đang có, hoặc tạo key cho lần phát hành đầu khi xác nhận project chưa có; không dùng debug certificate. Không chạy `eas submit`. Nếu Gradle lỗi, sửa theo log thật rồi build lại; source gate pass không thay thế Gradle.

Trên artifact production: dùng bundletool dump manifest cho package, target36, versionCode và permissions; keytool -printcert -jarfile cho upload certificate; bundletool build-apks để kiểm tra APK, zipalign -c -P 16 -v 4 và ELF LOAD alignment của native .so theo hướng dẫn Android. Cần Android tools, bundletool và artifact thật; chưa chạy các bước này. [16 KB verification](https://developer.android.com/guide/practices/page-sizes).

Smoke test Android 15/16 với development build mới và backend test hợp lệ:

- Login/logout/session restore, Google OAuth/deep link, rider/mechanic tabs và Android Back.
- Schedule filters, date/time booking, rescue/job detail và payment polling.
- Location allow/deny, stop tracking khi logout/status đổi; native module callbacks.
- Avatar/field images: gallery/camera/cancel, multi-select, selected-file upload; không yêu cầu quyền đọc toàn bộ gallery.
- Safe areas, keyboard, modal/tab headers, splash/logo/production label và edge-to-edge.
- Storage migration bằng cách cài đè baseline có dữ liệu với cùng signing certificate trong test; debug baseline không thể cài đè production upload-signed APK. Không uninstall trước bài test dữ liệu.

SDK 57 tăng iOS minimum lên 16.4; iOS native/build chưa kiểm chứng. React 19/Router/Reanimated/native fetch thay đổi cần test thật dù TypeScript/bundle pass. React Compiler opt-out giữ hành vi hiện có; warnings là debt cần xử lý có regression riêng. EAS development profile còn localhost backend từ baseline; dùng LAN override khi chạy Metro để truy cập backend trên thiết bị, không sửa production endpoint trong task này.

## G. Google Play Readiness

Yêu cầu phone apps mới/updates là **API 36 từ 31/08/2026**; API35 dành cho discovery của app cũ không đủ cho lần submit mới. [Google Play target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878).

**Đáp ứng ở cấu hình source: có. Sẵn sàng publish/build đã chứng minh: chưa.** Chưa có signed AAB, native compile, merged manifest/16 KB hoặc device smoke evidence. EAS login là blocker đầu tiên; sau đó cần kiểm chứng credentials và artifact.

System photo picker phù hợp nhu cầu chọn ảnh từng lần; đã bỏ broad media/storage permissions ở config và native source, nhưng kết quả merged manifest phải kiểm tra sau build. [Play photo policy](https://support.google.com/googleplay/android-developer/answer/15800983?hl=en). API36 edge-to-edge cần acceptance layout thật. [Android 16 behavior](https://developer.android.com/about/versions/16/behavior-changes-16).

Store listing, Data Safety và Play review nằm trong quy trình phát hành riêng. Không deploy production hoặc submit trong lần triển khai này.
