# Phân tích lỗi navigation context trên màn hình Đặt lịch & Lịch sử

Ngày phân tích: 08/10/2026.

## 2. Kết luận và mức độ chắc chắn

**Lỗi được ghi nhận là lỗi render ở frontend mobile, tại cây component của ScheduleScreen. Hiện chưa có bằng chứng cho thấy backend API là nguyên nhân trực tiếp.**

| Nhận định | Mức độ chắc chắn | Căn cứ / giới hạn |
| --- | --- | --- |
| Exception đang xuất hiện ở FE React Native | Đã xác định | Ảnh ghi Render Error; log chỉ ra CssInterop.Pressable được tạo bởi ScheduleScreen. |
| App sử dụng Expo Router và có navigation container trong cây component bị lỗi | Đã xác định | Log có ExpoRoot, ContextNavigator, NavigationContainerInner và BaseNavigationContainer. |
| App đơn giản là chưa được bọc bởi NavigationContainer | Chưa được chứng minh | Container đã xuất hiện trong cùng stack; thông báo lỗi chung không xác định nguyên nhân này. |
| NativeWind/CSS interop khi style thay đổi là hướng điều tra ưu tiên | Giả thuyết có cơ sở | Component đầu là CssInterop.Pressable; có báo cáo tương tự khi đổi style có điều kiện. Chưa xác nhận class hoặc cơ chế cụ thể của bản FE này. |
| Backend API đang bị lỗi | Chưa được chứng minh | Tài liệu cung cấp không có HTTP status, response hoặc exception backend tương ứng. |
| Backend API đang hoạt động hoàn toàn đúng | Chưa được chứng minh | Việc màn hình có dữ liệu/số đếm không chứng minh toàn bộ API khỏe; dữ liệu có thể đến từ cache hoặc state có sẵn. |

Việc cần làm trước mắt là xác định đường gọi gây exception trên **đúng bản FE đang chạy**, rồi kiểm tra nút bấm/style trong ScheduleScreen. Chưa có căn cứ để sửa API hoặc schema backend vì thông báo này.

## 3. Bằng chứng cụ thể từ log và ảnh

### E1. Lỗi được báo tại Pressable của ScheduleScreen

[Dòng 4 của log](C:/Users/ADMIN/Desktop/callstackerror.txt:4):

```text
in CssInterop.Pressable (created by ScheduleScreen)
```

Pressable là component tương tác của React Native. CssInterop là lớp chuyển đổi/xử lý style; tên wrapper này phù hợp với việc dùng NativeWind/react-native-css-interop.

Điều này xác định vùng render cần điều tra, **không tự chứng minh Pressable hoặc NativeWind có bug**. Một component xuất hiện đầu component stack có thể là nơi exception được biểu hiện, còn thao tác gây exception nằm trong hàm thư viện sâu hơn.

### E2. Màn hình nằm trong hệ thống điều hướng

[Dòng 19–27 của log, bắt đầu tại dòng 19](C:/Users/ADMIN/Desktop/callstackerror.txt:19) có các component liên quan:

```text
ScheduleScreen
Route(schedule)
SceneView
NavigationProvider (created by BottomTabNavigator)
```

Các component này cho thấy ScheduleScreen đang được dựng như một route trong tab navigator. Chưa có bằng chứng rằng màn hình hoàn toàn đứng ngoài hệ thống điều hướng.

### E3. NavigationContainer đã tồn tại

[Dòng 153–156, bắt đầu tại dòng 153](C:/Users/ADMIN/Desktop/callstackerror.txt:153):

```text
in BaseNavigationContainer
in NavigationContainerInner (created by ContextNavigator)
in ContextNavigator (created by ExpoRoot)
in ExpoRoot (created by App)
```

Đây là điểm quan trọng nhất để tránh sửa theo thông báo chung một cách máy móc. Tài liệu Expo Router xác nhận router quản lý NavigationContainer; không cần tự thêm container để thực hiện điều hướng thông thường. [Nguồn S1](https://expo.github.io/router/docs/migration/react-navigation/navigation-container/).

Tuy nhiên, container có trong stack vẫn chưa loại trừ mọi lỗi context: consumer có thể đọc một context khác do dependency bị trùng, hoặc code khác có thể truy cập giá trị context mặc định thay vì giá trị đã được provider cấp.

### E4. Lỗi lặp lại, chưa có function call stack đủ chi tiết

Cùng thông báo xuất hiện ở các dòng 1, 169, 343 và 511. Component đầu tương ứng ở các dòng 4, 172, 346 và 514 đều là CssInterop.Pressable của ScheduleScreen.

Bốn lần ghi log không có nghĩa là bốn nguyên nhân khác nhau. Ảnh ghi “Log 2 of 3” cũng không đủ để suy luận có ba bug riêng.

File chủ yếu là **component stack**: chuỗi component cha/con. Để chốt nguyên nhân cần **function call stack**: các hàm được gọi và vị trí file/dòng gây exception. Phần 40 frame đang thu gọn trong ảnh có thể chứa thông tin này.

### E5. Vùng bộ lọc là điểm kiểm tra đầu tiên, chưa phải vị trí đã xác nhận

Ảnh 1 khoanh vùng Đã hủy / Hoàn tất. Nếu các nút đó chỉ cập nhật bộ lọc, việc nhấn nút vẫn có thể gây render lại và kích hoạt lỗi style; không nhất thiết phải gọi router.push hoặc navigation.navigate.

Ảnh tĩnh không chứng minh được nút nào vừa được nhấn, lỗi xảy ra trước/sau API response hay loading có liên quan đến crash. Cần ghi lại thao tác tái hiện chính xác.

### E6. Các log phụ chưa phải nguyên nhân

- Dòng 338: “Bridgeless mode is enabled” thông báo chế độ runtime; riêng dòng này không chứng minh lỗi kiến trúc native.
- Dòng 342: deep-link không phải auth callback nên được bỏ qua; chưa có lỗi xác thực đi kèm trong tài liệu.
- Biểu tượng loading có thể phản ánh request đang chạy hoặc state chưa được dọn; không đủ để kết luận backend treo.
- Các số đếm 1 / 2 / 0 không xác định được nguồn dữ liệu hoặc chất lượng response API.

## 4. Nhận định về các nguyên nhân khả dĩ

### H1. CSS interop gặp vấn đề khi style thay đổi theo state

Đây là hướng kiểm tra ưu tiên vì phù hợp với CssInterop.Pressable và vùng nút lọc được đánh dấu. Các class cần kiểm tra **nếu thực sự có trong bản FE đang chạy** gồm shadow-*, transition-*, animate-* và transform được thêm/bỏ theo trạng thái.

NativeWind issue #1711 báo cáo lỗi cùng thông báo khi đổi class shadow theo điều kiện; tác giả tránh được lỗi bằng cách bỏ class liên quan hoặc dùng style native tương đương. Đây là một báo cáo tương tự, không phải chứng minh cho app hiện tại. [Nguồn S3](https://github.com/nativewind/nativewind/issues/1711).

Không nên kết luận rằng mọi class shadow hoặc mọi class có điều kiện đều gây lỗi. Cần thử thay đổi từng yếu tố trên component có vấn đề.

### H2. Cảnh báo của CSS interop vô tình đọc getter của context

Một báo cáo khác mô tả printUpgradeWarning duyệt props để tạo thông báo trong môi trường dev. Nếu quá trình đó đọc getter của context React Navigation mặc định, getter có thể ném lỗi navigation context. [Nguồn S4](https://github.com/nativewind/nativewind/issues/1812).

Mã nguồn React Navigation định nghĩa đúng thông báo đang thấy tại NavigationStateContext; các getter mặc định như getKey/getState ném exception đó. Điều này giải thích vì sao thao tác đọc context không đúng có thể tạo thông báo thiếu container. [Nguồn S2](https://github.com/react-navigation/react-navigation/blob/main/packages/core/src/NavigationStateContext.tsx).

**H2 là một cơ chế cụ thể cần xác minh trong H1, không phải nguyên nhân đã được xác nhận.** Dấu hiệu cần tìm trong function call stack:

```text
renderComponent
→ printUpgradeWarning
→ stringify / replace / Object.entries
→ getter của NavigationStateContext, ví dụ getKey hoặc getState
```

Nếu stack thực tế không có đường gọi này, không được mặc định gán crash cho printUpgradeWarning. Báo cáo upstream cũng không bảo đảm bản dependency của nhóm FE có cùng hành vi.

### H3. Dependency điều hướng bị trùng hoặc không tương thích

Nếu provider dùng context từ một bản module còn consumer dùng bản module khác, hai bên có thể không chia sẻ cùng context dù container xuất hiện trong cây React.

Cần kiểm tra phiên bản và đường resolve của @react-navigation/core, @react-navigation/native, expo-router, React và các dependency liên quan. Việc thấy nhiều entry trong lockfile chỉ là dấu hiệu cần xem xét; chưa đủ để kết luận runtime đang dùng hai context khác nhau.

### H4. Component hoặc hook điều hướng đọc context không đúng chỗ

Kiểm tra custom button, Link/asChild, wrapper, provider hoặc hook điều hướng được dùng trong nhánh UI chỉ xuất hiện khi đổi bộ lọc. Nếu có component được dựng trong một React root riêng, cần kiểm tra context của root đó.

Không mặc định coi việc có nhiều Stack/Tabs hoặc provider lồng nhau là sai: đây có thể là cấu trúc điều hướng bình thường. Chỉ sửa cấu trúc khi xác định được consumer và provider không khớp.

### H5. Dữ liệu hoặc lỗi API kích hoạt một nhánh FE đang lỗi

API response có thể làm FE đổi state và đi vào nhánh render có bug. Khi đó API là tác nhân kích hoạt về thời điểm, nhưng exception render vẫn cần được xử lý tại FE.

Nếu response vi phạm contract, có thể cần sửa thêm BE. Muốn kết luận điều này phải có request/response và contract cụ thể; tài liệu hiện tại chưa cung cấp chúng.

## 5. Quy trình debug đề xuất

### Bước 1 — Ghi lại môi trường và cách tái hiện

Trên máy đang chạy bản FE lỗi, ghi lại:

- Commit hoặc bản source hiện tại, package manager và lockfile đang sử dụng.
- Expo Go hay development build; thiết bị/Android; chế độ dev hay release.
- Phiên bản Expo, Expo Router, React Native, NativeWind, CSS interop và Reanimated.
- Thao tác dẫn đến lỗi: mở màn hình, nhấn bộ lọc nào, có đang loading hay không.
- Lỗi có tái hiện khi khởi động app mới hay chỉ sau Fast Refresh.

Nếu dùng pnpm, chạy trong **thư mục dự án FE thực tế**:

```powershell
pnpm.cmd list expo expo-router react react-native nativewind react-native-reanimated --depth 0
pnpm.cmd why react-native-css-interop
pnpm.cmd why @react-navigation/core
pnpm.cmd why @react-navigation/native
pnpm.cmd exec expo install --check
```

Các lệnh này phục vụ kiểm tra. Nếu FE dùng npm/yarn thì dùng công cụ tương ứng với lockfile hiện có, không đổi package manager chỉ để debug.

### Bước 2 — Lấy function call stack tại lần lỗi đầu tiên

1. Mở toàn bộ frame của Call Stack trên màn hình lỗi.
2. Mở React Native DevTools; log được cung cấp có hướng dẫn nhấn j tại terminal.
3. Bật Pause on exceptions; nếu lỗi bị công cụ bắt lại trước khi dừng, cân nhắc bật thêm pause on caught exceptions để bắt đúng thời điểm.
4. Tái hiện lỗi và lấy hàm/file/dòng đầu tiên gây throw, cùng đường gọi từ component FE vào thư viện.

Không chỉ chụp component stack. Đường gọi hàm sẽ phân biệt lỗi CSS interop, hook điều hướng và dependency.

### Bước 3 — Cô lập nhóm nút và nhánh nội dung

Giữ nguyên route/layout hiện tại. Thử thay đổi từng phần:

| Thử nghiệm | Nếu lỗi biến mất | Hướng điều tra tiếp |
| --- | --- | --- |
| Giữ dữ liệu và handler, bỏ riêng style nghi vấn trên nút lọc | Style là tác nhân đáng nghi | Thêm lại từng class để tìm thay đổi nhỏ nhất tái hiện lỗi. |
| Dùng Pressable/Text với style native đơn giản cho nhóm nút | Liên quan styling hoặc wrapper ở vùng nút | So sánh từng lớp style/wrapper với bản cũ. |
| Giữ nút đổi bộ lọc nhưng tạm thay nội dung bên dưới bằng Text tĩnh | Có thể nằm ở nhánh danh sách/card được render | Thêm lại từng component con. |
| Dùng fixture cố định có cùng hình dạng dữ liệu thay cho request | Nếu vẫn lỗi, request API không cần thiết để tái hiện | Debug FE độc lập với mạng/backend. |
| Fixture không lỗi nhưng response thật có lỗi | Có khác biệt dữ liệu hoặc thời điểm cập nhật | So sánh response, nhánh render, loading và thứ tự cập nhật state. |

Không đổi đồng thời layout, dependency, API và CSS: như vậy khó biết thay đổi nào thực sự xử lý lỗi.

### Bước 4 — Kiểm tra dependency/context nếu style đơn giản vẫn lỗi

- Đọc kết quả why và kiểm tra module mà provider/consumer thực tế đang resolve.
- Đối chiếu dependency với SDK của dự án; xử lý các bất tương thích đã xác định.
- Kiểm tra imports, custom navigator, custom wrapper và vị trí gọi hook.
- Nếu chưa tìm được, tạo màn hình tái hiện tối thiểu dùng đúng phiên bản dependency hiện tại.

Không nâng toàn bộ package lên latest hoặc thêm overrides tùy ý trước khi có nguyên nhân. Việc nâng major Expo/NativeWind có thể kéo theo thay đổi ngoài lỗi đang điều tra.

### Bước 5 — Kiểm tra request riêng nếu có bằng chứng mạng

Thu thập endpoint, method, HTTP status, request ID và response đã che thông tin nhạy cảm. Kiểm tra dữ liệu có đúng contract không.

FE cần xử lý loading/success/error và dọn loading khi request kết thúc. Nếu phát hiện spinner không dừng, ghi nhận như một lỗi riêng; không mặc định dùng nó để giải thích exception navigation context.

## 6. Hướng fix đề xuất theo kết quả debug

### F1. Nếu xác nhận class/style là tác nhân

Sửa phạm vi nhỏ nhất: bỏ hiệu ứng không cần thiết hoặc chuyển đúng phần style gây lỗi sang style/StyleSheet native. Giữ nguyên bộ lọc, dữ liệu và hành vi người dùng.

Ví dụ minh họa cho một nút lọc; filter/setFilter đại diện cho state hiện có của FE, không phải trích từ source của nhóm:

```tsx
<Pressable
  onPress={() => setFilter('canceled')}
  style={({ pressed }) => ({
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: filter === 'canceled' ? '#ffffff' : 'transparent',
    opacity: pressed ? 0.7 : 1,
  })}
>
  <Text>Đã hủy</Text>
</Pressable>
```

Nếu cần giữ shadow, dùng style native phù hợp nền tảng sau khi đã xác định shadow class là tác nhân. Không cần chuyển toàn bộ app khỏi NativeWind.

### F2. Nếu xác nhận lỗi trong printUpgradeWarning/stringify

Ưu tiên workaround nhỏ tại component để tránh đường gọi gây lỗi. Nếu có bản upstream sửa đúng vấn đề và tương thích SDK hiện tại, kiểm tra rồi cập nhật có kiểm soát.

Chỉ cân nhắc patch thư viện có lưu trong repo nếu workaround không đáp ứng yêu cầu. Patch phải có ca tái hiện tối thiểu và được kiểm tra lại khi nâng dependency. Sửa trực tiếp node_modules không tạo ra bản fix có thể tái lập khi cài lại.

Không dùng tắt cảnh báo, nuốt exception hoặc chuyển sang release build để che triệu chứng. H2 có thể phụ thuộc chế độ dev, nhưng điều đó chưa được xác minh cho app này.

### F3. Nếu xác nhận dependency bị trùng/lệch

Đồng bộ các phiên bản theo SDK và dependency graph thực tế, giữ lockfile tái lập được môi trường. Chỉ dedupe/override khi đã xác định entry nào gây conflict.

Sau thay đổi source/config/dependency liên quan bundling, có thể khởi động lại Metro với cache sạch:

```powershell
pnpm.cmd exec expo start --clear
```

Clear cache là bước kiểm tra sau thay đổi, không phải bằng chứng đã sửa nguyên nhân. Nếu thay dependency native của development build, cần build lại app tương ứng.

### F4. Nếu xác nhận consumer nằm sai context

Sửa vị trí component/hook hoặc imports để consumer nhận đúng provider của cây điều hướng hiện tại. Với Expo Router, giữ router quản lý container và kiểm tra layout/custom navigator đang dùng.

Không thêm NavigationContainer vào ScheduleScreen chỉ vì thông báo đề nghị như vậy; log đã có container và cần giải thích được vì sao consumer vẫn không nhận context.

### F5. Nếu response thật sai contract

Sửa nơi tạo response nếu BE trả sai contract; đồng thời FE phải hiển thị lỗi được kiểm soát khi nhận response bất hợp lệ. Ghi lỗi HTTP/contract thành vấn đề riêng với bằng chứng request/response.

Không bỏ validation hoặc sửa nghiệp vụ API để tránh một lỗi render chưa rõ nguyên nhân.

## 7. Kiểm chứng sau khi sửa

| Ca kiểm tra | Kết quả cần đạt |
| --- | --- |
| Khởi động app mới và mở Đặt lịch & Lịch sử | Không red screen; bộ lọc và dữ liệu đúng. |
| Chuyển Sắp tới → Đã hủy → Hoàn tất và quay lại nhiều lần | Không exception; trạng thái chọn và nội dung đồng bộ. |
| Bộ lọc có dữ liệu và bộ lọc rỗng | Cả danh sách và empty state render đúng. |
| Đổi bộ lọc trong lúc loading và sau khi response về | Không crash; loading kết thúc đúng trạng thái request. |
| Request thất bại có kiểm soát trong môi trường test/dev | FE hiển thị lỗi phù hợp, không xuất hiện exception navigation context. |
| Rời màn hình rồi quay lại; mở lại app sau khi tắt | Fix không chỉ hoạt động nhờ Fast Refresh hoặc state còn lưu trong phiên. |

Một lần hết red screen chưa đủ xác nhận nguyên nhân. Cần chứng minh ca tái hiện cũ thất bại trước thay đổi và hoạt động sau thay đổi. Lint/typecheck có ích nhưng không thay thế việc tái hiện lỗi runtime trên app.

## 8. Thông tin cần nhóm FE cung cấp để chốt bản vá

- Source đang chạy của ScheduleScreen, component nút/wrapper liên quan và các layout điều hướng của màn hình.
- package.json, lockfile và cấu hình Babel/Metro/NativeWind liên quan.
- Function call stack đầy đủ tại lần lỗi đầu tiên.
- Các bước tái hiện cụ thể và môi trường chạy.
- Request/response đã che dữ liệu nhạy cảm nếu việc tái hiện phụ thuộc API.

Các tài liệu này giúp chọn đúng bản vá; không cần toàn bộ repo hoặc file chứa secret để bắt đầu. Hiện chưa có căn cứ chốt một dòng code cụ thể của bản FE đang chạy.

## 9. Nguồn đối chiếu

1. [S1 — Expo Router: Navigation Container](https://expo.github.io/router/docs/migration/react-navigation/navigation-container/): tài liệu chính thức được lưu trữ, giải thích việc Expo Router quản lý container. Không dùng các ví dụ API ở tài liệu cũ để mặc định phiên bản của app hiện tại.
2. [S2 — React Navigation: NavigationStateContext.tsx](https://github.com/react-navigation/react-navigation/blob/main/packages/core/src/NavigationStateContext.tsx): mã nguồn định nghĩa thông báo và getter mặc định ném exception. Đây là đối chiếu cơ chế, không xác định phiên bản dependency của nhóm FE.
3. [S3 — NativeWind issue #1711](https://github.com/nativewind/nativewind/issues/1711): báo cáo lỗi khi đổi class shadow có điều kiện và workaround được tác giả mô tả.
4. [S4 — NativeWind issue #1812](https://github.com/nativewind/nativewind/issues/1812): báo cáo về printUpgradeWarning/stringify truy cập getter context và gây crash trong dev.

S3/S4 là báo cáo trên repository của thư viện, không phải kết luận đã xác minh cho CareOnRoad. Hướng ưu tiên là bắt exception đầy đủ, cô lập style tại ScheduleScreen rồi mới quyết định fix thư viện, dependency hoặc context.
