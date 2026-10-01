# CareOnRoad dependency and workspace recovery plan

## 1. Mục đích

Tài liệu này ghi nhận trạng thái thực tế của nhánh `mono/mobile/break`, phản biện ba phương án đồng bộ phiên bản đã được đề xuất, và đưa ra kế hoạch khôi phục có phạm vi nhỏ nhất để API, web và mobile cùng tồn tại ổn định trong một repository.

Kết luận chính:

> Không nên ép API, web và mobile dùng cùng một phiên bản React/Next.js. API và web có thể tiếp tục dùng root workspace, nhưng mobile Expo SDK 52 nên có **installation boundary và lockfile riêng ngay trong cùng repository** để React 18/native dependencies không bị graph React 19 của web/API làm nhiễu.

Phương án được đề xuất trong tài liệu này được gọi là **Phương án D2 — One repository, two installation boundaries**.

## 2. Phạm vi và nguồn kiểm tra

Phân tích được thực hiện trên:

- Repository: `D:\fpt\subject\EXE101\CareOnRoad-mobile-break`
- Branch: `mono/mobile/break`
- Commit: `0d178c1` — `backup mobile-break`
- Trạng thái ban đầu: working tree sạch và đồng bộ với `origin/mono/mobile/break`
- Package manager được khai báo ở root: pnpm `11.22.0`

Không sử dụng trạng thái của `CareOnRoad-Application` để kết luận về nhánh này.

Các tài liệu phương án được phản biện:

- `option-a-bump-all.md`
- `option-b-keep-api.md`
- `option-c-separate-api.md`
- `README.md` trong thư mục tài liệu quyết định

## 3. Thực trạng codebase

### 3.1. Ma trận phiên bản theo manifest hiện tại

| Workspace | Framework/runtime | React | Renderer | Ghi chú |
|---|---|---:|---:|---|
| `apps/api` | Next.js `^15.0.0`, lock đang resolve `15.5.25` | `^19.0.0`, lock đang resolve `19.2.4` | React DOM `19.2.4` | API-only Next.js App Router service |
| `apps/web` | Next.js `16.3.4` | `19.2.8` | React DOM `19.2.8` | Next.js web application |
| `apps/mobile` | Expo `~52.0.42`, React Native `0.76.9` | `18.3.1` | React Native `0.76.9` | Đã chuyển từ Next.js sang Expo Router |

Bộ `Expo SDK 52 + React Native 0.76.9 + React 18.3.1` là một bộ tương thích chính thức. Template của Expo SDK 52 cũng sử dụng đúng React `18.3.1` và React Native `0.76.9`:

- <https://raw.githubusercontent.com/expo/expo/sdk-52/templates/expo-template-default/package.json>
- <https://raw.githubusercontent.com/expo/expo/sdk-52/packages/expo/bundledNativeModules.json>

Vì vậy React 18 trong mobile không phải là bằng chứng cho thấy monorepo bị hỏng.

### 3.2. Root lockfile không khớp với mobile manifest

`apps/mobile/package.json` đã được đổi sang Expo tại commit `0d178c1`, nhưng root `pnpm-lock.yaml` không được cập nhật trong commit đó.

Importer `apps/mobile` trong root lockfile vẫn mô tả ứng dụng Next.js cũ:

- Next.js `16.2.6`
- React `19.2.4`
- React DOM `19.2.4`
- `@base-ui/react`
- `@vercel/analytics`
- `lucide-react`
- `shadcn`
- Tailwind CSS 4 và các package web khác

Trong khi manifest hiện tại yêu cầu Expo, React Native và các native modules.

Hậu quả:

- `pnpm install --frozen-lockfile` trong CI hoặc clean checkout sẽ từ chối lockfile lỗi thời.
- Cài đặt không frozen có thể tự regenerate một dependency graph lớn ngoài ý muốn.
- Kết quả cài đặt giữa các máy không còn tái lập được.
- Công cụ kiểm tra dependency có thể báo hàng loạt sai lệch vốn xuất phát từ lockfile cũ.

Đây là lỗi trực tiếp cần sửa trước khi thảo luận việc nâng Next.js hoặc React.

### 3.3. Web tạo một pnpm workspace lồng bên trong root workspace

Repository hiện có:

- `pnpm-workspace.yaml` và `pnpm-lock.yaml` ở root;
- `apps/web/pnpm-workspace.yaml`;
- `apps/web/pnpm-lock.yaml`.

`apps/web/pnpm-lock.yaml` còn chứa hai YAML document nối tiếp nhau:

1. Document đầu tiên khai báo pnpm `12.3.4` như một config dependency.
2. Document thứ hai chứa dependency graph của web.

Trong khi root và `apps/web/package.json` đều khai báo pnpm `11.22.0`.

Hậu quả:

- Chạy pnpm từ root và từ `apps/web` có thể chọn hai workspace root khác nhau.
- Có hai nguồn sự thật cho dependency graph của cùng một ứng dụng.
- pnpm version trong lockfile web không khớp với version được pin ở repository.
- CI, local development và deployment có thể cài các graph khác nhau.

Nested workspace của web là lỗi cấu trúc và nên bị xóa. Tuy nhiên, kết quả kiểm thử thực tế cho thấy không nên suy rộng thành “toàn repository bắt buộc chỉ có một lockfile”. Với Expo SDK 52, pnpm phải dùng layout hoisted; trong một workspace chung, type peer của các package mobile đã resolve sang `@types/react@19` ở root dù mobile khai báo `@types/react@18`. Vì vậy ranh giới riêng có chủ đích nên đặt ở **mobile**, không phải ở web.

Cấu trúc mục tiêu:

- root workspace + root lockfile: API, web và các package framework-neutral;
- `apps/mobile` workspace + lockfile riêng: Expo/React Native lane;
- vẫn là một Git repository, không copy source và không tách project thành hai repository.

Tài liệu tham khảo:

- <https://pnpm.io/workspaces>
- <https://pnpm.io/settings>

### 3.4. Root scripts vẫn trỏ tới mobile Next.js cũ

Root `package.json` hiện gọi:

- `dev:mobile` → `pnpm --filter @careonroad/mobile dev`
- `build:mobile` → `pnpm --filter @careonroad/mobile build`

Nhưng `apps/mobile/package.json` không còn script `dev` hoặc `build`. Mobile hiện có:

- `start`
- `android`
- `ios`
- `web`
- `prebuild`
- `lint`
- `typecheck`

Do đó các command được README hướng dẫn để chạy mobile hiện không hợp lệ, bất kể dependency version có được đồng bộ hay không.

### 3.5. Cấu hình Metro đang giải quyết sai tầng vấn đề

`apps/mobile/metro.config.js` đang tự cấu hình:

- `watchFolders` cho root `node_modules` và `packages`;
- `resolver.nodeModulesPaths`;
- `resolver.unstable_enableSymlinks`;
- blocklist cho `apps/web` và `apps/api`;
- custom resolver cho `react`, `react-dom` và `react-native`;
- `fs.realpathSync` vào symlink do pnpm tạo.

Custom resolver trả đường dẫn thực của thư mục package dưới dạng `sourceFile`. Cấu hình này phụ thuộc vào layout vật lý của `.pnpm` store và rất dễ tạo lỗi resolution hoặc SHA-1 trong Metro.

Từ SDK 52, Expo đã tự động cấu hình monorepo khi ứng dụng sử dụng `expo/metro-config`. Hướng dẫn chính thức khuyên bỏ các cấu hình thủ công như `watchFolders` và custom node module paths nếu chúng chỉ tồn tại để hỗ trợ monorepo:

- <https://docs.expo.dev/guides/monorepos/>

Khác phiên bản React giữa các ứng dụng độc lập không cần được giải quyết bằng custom Metro resolver. Điều bắt buộc là bundle mobile chỉ resolve một React instance tương thích với React Native của mobile.

### 3.6. Cấu hình NativeWind hiện chưa hợp lệ

Mobile dùng NativeWind 4 nhưng có các vấn đề sau:

- `withNativeWind(config, { input: './nativewind.config.ts' })` trỏ `input` tới TypeScript config thay vì CSS.
- `app/global.css` có tồn tại nhưng chưa được import trong root layout.
- Babel config chỉ khai báo `jsxImportSource`, chưa có đầy đủ NativeWind Babel preset theo hướng dẫn v4.
- `react-native-reanimated` không được khai báo trực tiếp; nó chỉ xuất hiện trong overrides.

Theo NativeWind, `input` phải là đường dẫn tới file CSS chứa các Tailwind directives và file đó phải được import ở component gốc:

- <https://www.nativewind.dev/docs/getting-started/installation>
- <https://www.nativewind.dev/docs/api/with-nativewind>

Các lỗi này có thể làm mobile không bundle hoặc không có style sau khi dependency tree được sửa.

### 3.7. Metro packages và overrides đang tự mâu thuẫn

Mobile khai báo trực tiếp:

- `metro-cache: 0.81.5`
- `metro-config: 0.81.5`

Nhưng `pnpm.overrides` trong cùng manifest lại ép một nhóm Metro package xuống `0.81.0`.

Ngoài ra `test-bundle.cjs` hardcode đường dẫn vật lý chứa `metro@0.81.5` trong `.pnpm`. Đường dẫn này thay đổi khi peer dependency graph, pnpm version hoặc package patch version thay đổi.

Đây là workaround không thể tái lập ổn định và không nên trở thành build path chính thức.

### 3.8. API và shared packages không tạo React runtime conflict với mobile

Kiểm tra source hiện tại cho thấy:

- `apps/api` không import React hoặc React DOM trong code ứng dụng.
- `packages/api-contract`, `packages/domain` và `packages/config` hiện chỉ là package khung.
- Chưa có workspace app nào import các package `@careonroad/*` này.
- Chưa có shared React component library dùng chung giữa web và mobile.

React chỉ báo Invalid Hook Call do duplicate React khi component và renderer trong cùng một ứng dụng resolve sang hai React module khác nhau. Nhiều React copy độc lập trong các ứng dụng/process riêng biệt được hỗ trợ:

- <https://react.dev/warnings/invalid-hook-call-warning>

Do đó API React 19, web React 19 và mobile React 18 có thể cùng tồn tại trong một repository và trong các runtime độc lập. Tuy nhiên, kết quả thực nghiệm bên dưới chứng minh rằng **runtime independence không tự bảo đảm TypeScript/peer isolation** khi Expo SDK 52 buộc pnpm dùng hoisted installation. Đây là lý do cần tách installation boundary cho mobile.

### 3.9. API lint tooling đang lệch major với Next.js

API dùng Next.js 15 nhưng manifest khai báo:

- `@next/eslint-plugin-next: ^16.2.9`
- `eslint-config-next: ^16.2.9`

Root lock hiện resolve chúng thành `16.3.4`.

Đây là version mismatch thực sự nên được xử lý. Nếu giữ API ở Next.js 15 thì Next ESLint plugin/config cũng nên về dòng 15.x tương ứng. Sự xuất hiện của `eslint-config-next 16` trong lockfile không chứng minh rằng API đã sẵn sàng nâng lên Next 16.

### 3.10. Tài liệu repository đang stale

Root README vẫn mô tả `apps/mobile` là một Next.js application, trong khi code hiện tại đã là Expo Router và có native Android project.

Tài liệu command cũng vẫn hướng dẫn `dev:mobile` theo script cũ. Documentation cần được cập nhật sau khi workspace recovery hoàn tất, không nên được dùng như bằng chứng cho dependency state hiện tại.

### 3.11. Kết quả kiểm chứng thực tế trên disposable clone

Để không sửa codebase gốc, toàn bộ install và build được chạy trên một local clone tạm của `CareOnRoad-mobile-break`. Baseline và prototype cho kết quả sau.

#### Baseline hiện tại

- `pnpm install --frozen-lockfile --ignore-scripts`: **fail** với `ERR_PNPM_OUTDATED_LOCKFILE`; pnpm liệt kê trực tiếp việc importer mobile không khớp manifest.
- Regenerate root lockfile rồi chạy `pnpm peers check`: **fail** vì `react-native-reanimated@4.6.0` và `react-native-worklets@0.12.2` yêu cầu React Native mới hơn `0.76.9`.
- Mobile typecheck: **fail hàng loạt** với `@types/react@19.2.14` không assign được cho React 18 (`bigint` trong `ReactNode`).
- `dev:mobile` và `build:mobile`: **fail** vì gọi script không tồn tại.
- Mobile lint: **fail** vì chưa có ESLint/config riêng.
- API typecheck/lint và web lint: **pass**, cho thấy không cần nâng API lên Next 16 để xử lý incident.
- Android export với custom Metro baseline bị treo lâu ở `Starting Metro Bundler` và không cho một kết quả tái lập đủ tin cậy.

#### Prototype “một root workspace/lockfile, nhiều version lane”

Prototype đã thử:

- `nodeLinker: hoisted`;
- `resolvePeersFromWorkspaceRoot: false`;
- pin trực tiếp `react-native-reanimated ~3.16.1`;
- bỏ mobile overrides;
- đơn giản hóa Metro và sửa NativeWind.

Kết quả:

- peer-check: **pass**;
- mobile typecheck: **vẫn fail** vì các declaration package được hoist tiếp tục import `@types/react@19` từ root.

Điểm này bác bỏ chính giả định ban đầu rằng một shared lockfile tự nó đủ để cách ly React 18/19 cho stack hiện tại.

#### Prototype được khuyến nghị: mobile installation boundary riêng

Prototype tiếp theo loại `apps/mobile` khỏi root workspace, tạo `apps/mobile/pnpm-workspace.yaml` + `apps/mobile/pnpm-lock.yaml`, và dùng `nodeLinker: hoisted` chỉ trong mobile. Đồng thời prototype:

- pin các package theo Expo SDK 52;
- khai báo trực tiếp Reanimated và Babel preset;
- bỏ overrides Metro/worklets;
- sửa Metro/NativeWind;
- thêm ESLint 8 + `eslint-config-expo` 8 cho SDK 52;
- sửa root scripts để chuyển command vào `apps/mobile`.

Kết quả thực nghiệm:

| Gate | Kết quả |
|---|---|
| Mobile `pnpm peers check` | Pass, không còn peer issue |
| `expo install --check` | Pass, dependencies up to date |
| Mobile TypeScript | Pass |
| Mobile ESLint | Pass với 0 error, 21 warning unused-code có sẵn |
| Android `expo export` | Pass; 2,884 modules, Hermes bundle khoảng 5.82 MB |
| API typecheck | Pass |
| API lint | Pass |
| API Next 15 production build | Pass, 38 static-generation steps và route build hoàn tất |
| Web lint | Pass |
| Web Next 16 production build | Pass |
| API unit/static/route suite | 510/512 test pass; 2 test fail do `admin-scope.static.test.ts` vẫn cấm payment artifacts đã tồn tại, không do dependency boundary |

Đây là bằng chứng chính để chọn D2 thay cho bản D ban đầu.

## 4. Phản biện các phương án đã đề xuất

## 4.1. Phương án A — Bump tất cả lên Next 16.3.4 và React 19.2.8

### Phần hợp lý

- Thống nhất package manager và cách chạy command từ root.
- Loại bỏ workspace/lockfile riêng trong `apps/web`.
- Cần kiểm tra async request APIs trước khi nâng Next.js.
- Cần chạy đầy đủ typecheck, lint, test và build sau migration.

### Phần không phù hợp với codebase hiện tại

#### Ép mobile Expo SDK 52 lên React 19.2.8 là sai compatibility lane

Expo SDK 52 gắn với React Native 0.76 và React 18.3.1. Việc đổi riêng React thành 19.2.8 không phải là dependency alignment; đó là tạo một tổ hợp không được SDK hiện tại bảo đảm.

Muốn mobile dùng React 19 cần nâng Expo SDK và React Native theo compatibility matrix, xử lý native Android project, Expo Router, NativeWind và toàn bộ native modules. Đây phải là một migration độc lập.

#### Khác React giữa các app không đồng nghĩa duplicate React trong một app

Ba app chạy bằng ba runtime/bundler độc lập. Việc dependency graph chứa React 18 và React 19 không tự tạo Invalid Hook Call. pnpm có thể lưu nhiều version, nhưng prototype đã chứng minh layout hoisted của SDK 52 vẫn có thể làm `@types/react@19` rò vào mobile; vì vậy cần mobile installation boundary riêng.

Duplicate React chỉ trở thành lỗi khi Metro hoặc Webpack resolve hai React instance vào cùng một bundle. Cách xử lý là sửa workspace resolution và bundler config, không phải ép toàn monorepo về một version.

#### Nâng API lên Next 16 là rủi ro không cần thiết cho incident hiện tại

Codebase API hiện có khoảng:

- 96 Next route files;
- 538 file TypeScript/TSX;
- native `sherpa-onnx-node` integration;
- test suite và nhiều PostgreSQL integration paths.

Next 16 có các thay đổi đáng kể như Node.js 20.9+ minimum, Turbopack mặc định và loại bỏ compatibility behavior của async request APIs. Xem:

- <https://nextjs.org/docs/app/guides/upgrading/version-16>

Ước tính 2–4 giờ trong tài liệu A không phản ánh đủ phạm vi xác minh cần thiết.

### Kết luận cho A

Không chọn A trong incident này. Tách việc nâng API Next 16 và nâng Expo thành các task riêng sau khi workspace hiện tại đã tái lập được clean install.

## 4.2. Phương án B — Giữ API Next 15 nhưng downgrade API xuống React 18

### Vấn đề trong cách đặt phương án

Giữ API Next 15 không đòi hỏi downgrade React của API xuống 18. API hiện đã dùng Next 15 + React 19, phù hợp với Next.js 15 App Router.

Next 15 yêu cầu React 19 cho App Router theo upgrade guide:

- <https://nextjs.org/docs/app/guides/upgrading/version-15>

Do đó phần downgrade API React 18 của B là không cần thiết và không nên thực hiện.

### Biến thể đúng của B

Một biến thể hợp lý là:

- API: Next 15 + React 19;
- Web: Next 16 + React 19;
- Mobile: Expo 52 + React 18.3.1;
- API/web/shared packages dùng root workspace và root lockfile;
- mobile giữ trong cùng repository nhưng có workspace/lockfile riêng.

Biến thể này chính là nền tảng của Phương án D2. Nó giữ phần đúng của B là không nâng API vô cớ, đồng thời thêm isolation mà kiểm thử thực tế cho thấy Expo SDK 52 cần.

### Shared package không buộc phải build hai lần

Các package domain, API contract và config nên là framework-neutral TypeScript packages và không nên phụ thuộc React.

Nếu tương lai cần chia sẻ UI, nên tách rõ:

- `ui-web` cho React DOM/Next.js;
- `ui-native` cho React Native/Expo;
- `design-tokens` chỉ chứa token thuần dữ liệu.

Không nên cố dùng một React component package cho cả DOM và React Native chỉ để có cùng version.

### Kết luận cho B

Không chọn B nguyên bản. Chọn biến thể giữ API Next 15 + React 19, không downgrade API và không ép mobile rời React 18.

## 4.3. Phương án C — Tách API khỏi Next.js sang Hono/Fastify

### Giá trị dài hạn

- Backend không còn mang React/React DOM peer dependencies.
- Runtime backend rõ ràng hơn.
- Có thể phù hợp nếu team muốn tự host một Node server thay vì sử dụng Next deployment model.

### Vì sao không giải quyết incident hiện tại

- Lỗi hiện tại là stale lockfile, nested workspace và mobile bundler config.
- Chuyển framework không sửa root scripts, NativeWind hoặc Metro resolution.
- Phải chuyển khoảng 96 route files cùng middleware, auth, workers, webhook và test adapters.
- Phải xác minh lại native ASR externalization và deployment topology.

Đây là một quyết định kiến trúc, không phải dependency repair.

### Kết luận cho C

Không chọn C để sửa incident. Nếu team vẫn quan tâm, tạo RFC riêng với tiêu chí deployment, ownership, migration cost và rollback plan.

## 5. Phương án đề xuất: D2 — One repository, two installation boundaries

### 5.1. Nguyên tắc

1. Một Git repository, không duplicate source và không split repository.
2. Hai installation boundary có chủ đích:
   - root: API, web, framework-neutral packages;
   - `apps/mobile`: Expo SDK 52 và native dependencies.
3. Mỗi boundary có `pnpm-workspace.yaml` và generated lockfile riêng; không có workspace/lockfile riêng cho web.
4. Cả hai boundary pin cùng pnpm `11.22.0` để command semantics không lệch.
5. Mobile dùng `nodeLinker: hoisted` vì Expo SDK 52 chưa hỗ trợ isolated installation như SDK 54+.
6. Phiên bản framework được quyết định theo compatibility matrix của từng app.
7. `react` và renderer phải khớp bên trong từng runtime; không ép một version toàn repository.
8. Shared packages mặc định không phụ thuộc React. Nếu mobile cần import package shared trong tương lai, package đó phải được publish/pack hoặc có cơ chế source dependency được thiết kế rõ, thay vì âm thầm dựa vào root hoisting.
9. Không nâng major framework trong cùng patch recovery.
10. Không giữ workaround Metro dựa vào đường dẫn vật lý `.pnpm`.

### 5.2. Ma trận mục tiêu giai đoạn recovery

| Workspace | Phiên bản mục tiêu | Hành động |
|---|---|---|
| Root | pnpm `11.22.0`; workspace chứa API/web/packages | Giữ; không chứa mobile importer |
| API | Next `15.5.x`, React/React DOM cùng bản 19.x | Giữ; pin rõ hơn nếu cần |
| API lint | Next ESLint plugin/config 15.x | Đưa về cùng major với API |
| Web | Next `16.3.4`, React/React DOM `19.2.8` | Giữ |
| Mobile | Expo SDK 52, RN `0.76.9`, React `18.3.1`; pnpm hoisted boundary | Giữ và align bằng Expo CLI |
| Lockfiles | Root lock cho API/web; mobile lock cho Expo | Regenerate độc lập sau khi manifests ổn định |

## 6. Kế hoạch triển khai

## Phase 0 — Bảo toàn và baseline

Mục tiêu: bảo đảm thay đổi có thể review và rollback.

1. Tiếp tục làm trên branch được tạo từ `mono/mobile/break`.
2. Ghi lại commit baseline `0d178c1`.
3. Xác nhận working tree sạch.
4. Không chạy seed, migration hoặc command dùng production credentials.
5. Không trộn migration framework lớn vào recovery patch.

Tiêu chí hoàn thành:

- Có baseline commit rõ ràng.
- Recovery diff chỉ liên quan workspace, package manifests, bundler config, scripts và docs.

## Phase 1 — Thiết lập hai installation boundary rõ ràng

Mục tiêu: root graph và mobile graph độc lập nhưng vẫn được vận hành từ một repository.

1. Xóa `apps/web/pnpm-workspace.yaml` và malformed `apps/web/pnpm-lock.yaml`.
2. Đổi root `pnpm-workspace.yaml` từ glob `apps/*` sang danh sách rõ ràng:
   - `apps/api`;
   - `apps/web`;
   - `packages/*`.
3. Tạo `apps/mobile/pnpm-workspace.yaml` với package `.` và `nodeLinker: hoisted`.
4. Pin pnpm `11.22.0` ở cả root và mobile manifest.
5. Tạo mobile lockfile từ chính boundary mobile; không copy hoặc chỉnh tay importer từ root lockfile.
6. Bỏ `pnpm.overrides` trong mobile; khai báo trực tiếp dependency đúng version.
7. CI phải chạy hai frozen install rõ ràng:

   ```powershell
   pnpm.cmd install --frozen-lockfile
   pnpm.cmd --dir apps/mobile install --frozen-lockfile
   ```

8. Với pnpm 11, không fan-out nhiều `pnpm run` đồng thời ngay sau khi lockfile đổi. `verifyDepsBeforeRun` có thể tự khởi chạy các install cạnh tranh nhau; install explicit trước rồi mới chạy gates.

Tiêu chí hoàn thành:

- Root workspace không còn importer mobile.
- Mobile có workspace/lockfile riêng với React 18 lane.
- Web không còn nested workspace/lockfile.
- Cả hai lockfile dùng cùng pnpm major.

## Phase 2 — Sửa root commands và manifest consistency

Mục tiêu: command tại root phản ánh đúng framework hiện tại.

1. Đổi `dev:mobile` thành `pnpm --dir apps/mobile start`.
2. Quyết định nghĩa của `build:mobile`:
   - dùng `expo export` nếu cần static/bundle verification; hoặc
   - dùng EAS/native build trong pipeline riêng; hoặc
   - bỏ script cho tới khi build contract được định nghĩa.
3. Thêm root commands riêng cho mobile lint/typecheck bằng `pnpm --dir apps/mobile ...`.
4. Align API Next ESLint plugin/config về dòng 15.x.
5. Giữ React và renderer cùng patch version bên trong từng app.
6. Không đổi API sang Next 16 trong phase này.

Tiêu chí hoàn thành:

- Mọi root script đều trỏ tới script tồn tại.
- Không còn mismatch major Next 15 / ESLint Next 16 trong API.

## Phase 3 — Align mobile dependencies theo Expo SDK 52

Mục tiêu: dependency graph mobile theo compatibility matrix chính thức.

1. Dùng Expo CLI để kiểm tra và sửa version:

   ```powershell
   pnpm.cmd --dir apps/mobile exec expo install --check
   pnpm.cmd --dir apps/mobile exec expo install --fix
   ```

2. Khai báo trực tiếp các dependency thực sự được cấu hình hoặc sử dụng, đặc biệt:
   - `babel-preset-expo`;
   - `react-native-reanimated ~3.16.1`;
   - `react-dom` và package web tương thích nếu Expo web là target được hỗ trợ;
   - `eslint ^8.57.1` và `eslint-config-expo ~8.0.1` nếu giữ lint cho SDK 52.
3. Không dùng override để “cài hộ” một package chưa được khai báo.
4. Không đổi React 18.3.1 sang React 19 khi vẫn ở Expo SDK 52.
5. Không dùng caret cho native package mà Expo yêu cầu patch/minor cụ thể. Prototype chỉ pass `expo install --check` sau khi đổi:
   - `@expo/vector-icons` từ `^14.0.4` thành `~14.0.4`;
   - Async Storage từ `^1.23.1` thành `1.23.1`;
   - Gesture Handler từ `^2.20.2` thành `~2.20.2`.

Tiêu chí hoàn thành:

- `expo install --check` không còn mismatch quan trọng.
- Mobile manifest khai báo trực tiếp các tool/package mà config của nó require.

## Phase 4 — Đơn giản hóa Metro và sửa NativeWind

Mục tiêu: trở về cấu hình framework-supported.

1. Bắt đầu từ `getDefaultConfig(__dirname)` của `expo/metro-config`.
2. Bỏ custom `watchFolders`, `nodeModulesPaths`, blocklist và React realpath resolver nếu không còn lỗi tái hiện.
3. Chỉ giữ wrapper NativeWind cần thiết.
4. Trỏ NativeWind `input` tới file CSS thực, ví dụ `./app/global.css`.
5. Import CSS ở root layout.
6. Hoàn thiện NativeWind Babel preset theo đúng version đang sử dụng.
7. Bỏ `test-bundle.cjs` khỏi verification path hoặc sửa nó để resolve Metro bằng package name thay vì đường dẫn `.pnpm` hardcoded.
8. Sau thay đổi config, xóa cache bằng command framework-supported:

   ```powershell
   pnpm.cmd --dir apps/mobile exec expo start --clear
   ```

Tiêu chí hoàn thành:

- Metro config không chứa đường dẫn `.pnpm` hoặc resolver React thủ công.
- NativeWind đọc file CSS và styles xuất hiện trong runtime.
- Mobile bundle chỉ có một React 18.3.1 instance.

## Phase 5 — Regenerate hai lockfile độc lập

Mục tiêu: mỗi generated lockfile phản ánh đúng manifest trong boundary của nó.

1. Sau Phase 1–4, regenerate root lockfile cho API/web/shared packages.
2. Regenerate `apps/mobile/pnpm-lock.yaml` từ mobile boundary.
3. Review root lock để chắc chắn không còn importer `apps/mobile`.
4. Review mobile lock để chắc chắn không còn Next.js/web-only dependencies cũ, React 19, Reanimated 4 hoặc Worklets 0.12.
5. Xác nhận mobile trực tiếp resolve:
   - React `18.3.1`;
   - React Native `0.76.9`;
   - Reanimated `~3.16.1`;
   - `@types/react` 18.x.
6. Không chỉnh tay generated lockfile.

Tiêu chí hoàn thành:

- Clean checkout pass cả hai frozen install.
- Chạy lại cả hai install không tạo diff mới.

## Phase 6 — Verification matrix

### Workspace

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd --dir apps/mobile install --frozen-lockfile
pnpm.cmd --dir apps/mobile peers check
pnpm.cmd --dir apps/mobile why react
pnpm.cmd --dir apps/mobile why react-native
```

Kỳ vọng:

- Mobile resolve React `18.3.1` và RN `0.76.9`.
- React 19 của API/web không đi vào Metro mobile bundle.

### Mobile

```powershell
pnpm.cmd --dir apps/mobile exec expo install --check
pnpm.cmd --dir apps/mobile exec expo-doctor
pnpm.cmd --dir apps/mobile typecheck
pnpm.cmd --dir apps/mobile lint
pnpm.cmd --dir apps/mobile export:android
```

Sau đó xác minh ít nhất:

- Expo/Metro start với cache sạch;
- Android debug bundle hoặc app launch;
- role selection;
- rider tabs;
- mechanic tabs;
- NativeWind styles;
- Fast Refresh;
- không có Invalid Hook Call;
- không có Metro SHA-1 hoặc module resolution error.

### API

```powershell
pnpm.cmd run typecheck
pnpm.cmd run lint:api
pnpm.cmd test
pnpm.cmd run build:api
```

Không chạy DB integration suite nếu chưa có test database được cấp phép.

### Web

```powershell
pnpm.cmd run lint:web
pnpm.cmd run build:web
```

### Reproducibility

1. Clean install trên một checkout mới.
2. Chạy lại cả root và mobile frozen install.
3. Xác nhận không có diff ở cả hai lockfile.
4. Xác nhận root command thực sự chuyển vào mobile boundary, không dùng root filter để tìm package đã bị exclude.
5. Xác nhận command được README hướng dẫn thực sự tồn tại.

## Phase 7 — Documentation và merge strategy

1. Cập nhật root README: mobile là Expo Router, không còn Next.js.
2. Ghi rõ root command cho API/web và `pnpm --dir apps/mobile ...` cho mobile; không yêu cầu developer tự đoán workspace root.
3. Ghi rõ version lane của từng app.
4. Không mô tả nhiều React versions trong workspace là lỗi mặc định.
5. Chia commit/PR nhỏ:
   - workspace và scripts;
   - mobile dependency alignment;
   - Metro/NativeWind;
   - regenerated root/mobile lockfiles;
   - docs.
6. Chỉ merge sau khi verification matrix pass.

## 7. Những việc không làm trong recovery patch

- Không bump API lên Next.js 16.
- Không bump Expo SDK chỉ để mobile dùng React 19.
- Không chuyển API sang Hono/Fastify.
- Không ép một React version toàn monorepo bằng global override.
- Không tạo lockfile tùy tiện cho từng app; chỉ giữ hai boundary có chủ đích là root và mobile.
- Không tạo workspace/lockfile riêng cho web.
- Không hardcode `.pnpm` store paths.
- Không dùng `--force` hoặc bỏ qua peer dependency warning để đạt build xanh giả.
- Không thay đổi API behavior, database schema hoặc product workflow.

## 8. Rủi ro và biện pháp giảm thiểu

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| Regenerate hai lockfile tạo diff lớn | Trung bình | Ổn định manifests trước; review từng boundary độc lập |
| Mobile vô tình nhập lại root workspace | Cao | Root workspace dùng danh sách app rõ ràng; CI kiểm tra root lock không có importer mobile |
| Expo SDK 52 không phù hợp isolated pnpm layout | Cao | Mobile boundary dùng `nodeLinker: hoisted`; bỏ custom resolver; clean install |
| NativeWind vẫn không compile | Trung bình | Sửa CSS input/import/Babel; verify theo tài liệu NativeWind |
| Native module thiếu hoặc lệch version | Cao | `expo install --check`, `--fix`, Expo Doctor và Android launch |
| API bị ảnh hưởng bởi workspace change | Trung bình | Chạy typecheck, lint, unit tests và API build |
| Web dùng nhầm nested lockfile cũ | Cao | Xóa web workspace/lockfile và verify frozen install từ root |
| Team cài mobile bằng root command | Trung bình | Root scripts dùng `--dir apps/mobile`; README và CI ghi hai bước install rõ ràng |
| Shared package tương lai cần dùng ở mobile | Trung bình | Chỉ chia sẻ package framework-neutral; thiết kế cơ chế pack/source dependency rõ trước khi thêm |
| pnpm 11 auto-install chạy đua khi gate song song | Trung bình | Chạy explicit frozen install trước; không fan-out các pnpm gate trên dependency tree stale |

## 9. Điều kiện hoàn tất

Recovery được xem là hoàn tất khi đồng thời đạt tất cả điều kiện sau:

- Root boundary và mobile boundary được khai báo rõ; web không còn nested boundary.
- Cả root và mobile frozen install thành công từ clean checkout.
- Root scripts không gọi script không tồn tại.
- API Next 15 + React 19 vẫn typecheck/lint/build thành công; hai static-scope test stale phải được sửa hoặc re-baseline bằng task riêng trước khi yêu cầu full suite xanh.
- Web Next 16 + React 19 vẫn lint/build thành công.
- Mobile Expo 52 + RN 0.76.9 + React 18.3.1 pass Expo Doctor, typecheck và Android bundle/launch.
- Mobile không có Invalid Hook Call, Metro resolution hoặc SHA-1 error.
- NativeWind styles được load đúng.
- Chạy lại cả hai install/check không tạo diff.
- README phản ánh đúng kiến trúc hiện tại.

## 10. Quyết định đề xuất

Chọn **Phương án D2 — One repository, two installation boundaries**.

Đây không phải Option C theo nghĩa rewrite/tách API, cũng không phải tách repository. Đây là biến thể tối thiểu của ý tưởng “các app có graph không tương thích thì cài độc lập”: chỉ mobile được tách graph vì Expo SDK 52 cần hoisted dependencies và thực nghiệm đã chứng minh shared hoisted graph làm nhiễu React types.

Ưu tiên sửa theo thứ tự:

1. Root/mobile installation boundaries và hai lockfile.
2. Root scripts và manifest consistency.
3. Expo dependency compatibility.
4. Metro và NativeWind.
5. Clean verification cho mobile, API và web.
6. Documentation.

Sau khi recovery hoàn tất, tạo các initiative riêng nếu team muốn:

- nâng API từ Next 15 lên Next 16;
- nâng Expo SDK để mobile chuyển sang React 19;
- đánh giá tách API sang Node/Hono/Fastify.

Ba initiative này không nên được gộp vào patch sửa dependency/workspace hiện tại.
