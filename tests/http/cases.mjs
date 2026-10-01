import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

// Oracle: published API contracts/specs, never service/route implementation.
export const endpoints = [];
function routes(feature, base, definitions, allowed) {
  for (const [suffix, methods] of definitions) for (const method of methods.split(' ')) endpoints.push({ feature, path: base + suffix, method, allowed });
}
routes('Auth', '/api/v1/auth', [['/me', 'GET'], ['/profile', 'POST PATCH'], ['/devices', 'POST'], ['/devices/{{deviceId}}/push-token', 'PUT DELETE']], 'authenticated');
routes('Motorcycles', '/api/v1/motorcycles', [['', 'GET POST'], ['/{{motorcycleId}}', 'GET PATCH DELETE']], 'rider');
routes('Mechanic profile', '/api/v1/mechanics/me', [['/profile', 'GET PATCH'], ['/availability', 'PUT'], ['/location', 'PUT']], 'mechanic');
routes('Mechanic operations', '/api/v1/mechanics/me', [['/dashboard', 'GET'], ['/jobs', 'GET'], ['/performance', 'GET']], 'mechanic');
routes('Service requests', '/api/v1/service-requests', [['', 'GET POST'], ['/{{requestId}}', 'GET'], ['/{{requestId}}/cancel', 'POST'], ['/{{requestId}}/media', 'POST'], ['/{{requestId}}/dispatch', 'POST']], 'rider');
routes('Rescue recall', '/api/v1/service-requests', [['/{{requestId}}/rescue-mechanics/{{mechanicId}}/recall', 'POST']], 'rider');
routes('Quotes', '/api/v1/service-requests', [['/{{requestId}}/quotes', 'GET POST']], 'mixed');
routes('Quotes', '/api/v1/quotes', [['/{{quoteId}}/approve', 'POST'], ['/{{quoteId}}/reject', 'POST']], 'rider');
routes('Dispatch', '/api/v1/dispatch/offers', [['', 'GET'], ['/{{offerId}}/accept', 'POST'], ['/{{offerId}}/decline', 'POST']], 'mechanic');
routes('Assignments', '/api/v1/assignments', [['', 'GET'], ['/{{assignmentId}}/status', 'POST'], ['/{{assignmentId}}/diagnoses', 'POST']], 'assignment');
routes('Mechanic operations', '/api/v1/assignments', [['/{{assignmentId}}/eta', 'POST'], ['/{{assignmentId}}/media', 'POST'], ['/{{assignmentId}}/completion-checklist', 'POST']], 'mechanic');
routes('Recovery', '/api/v1/assignments', [['/{{assignmentId}}/recover', 'POST']], 'assignment');
routes('Reviews', '/api/v1/assignments', [['/{{assignmentId}}/review', 'POST']], 'rider');
routes('Route ETA', '/api/v1/assignments', [['/{{assignmentId}}/route-eta', 'GET']], 'mixed');
routes('Live tracking', '/api/v1/assignments', [['/{{assignmentId}}/live-location', 'GET PUT']], 'mixed');
routes('Reminders', '/api/v1/reminders', [['', 'GET POST'], ['/{{reminderId}}', 'PATCH'], ['/{{reminderId}}/snooze', 'POST']], 'rider');
routes('Notifications', '/api/v1/notifications', [['', 'GET'], ['/unread-count', 'GET'], ['/{{notificationId}}/read', 'POST'], ['/read-all', 'POST']], 'authenticated');
routes('Media uploads', '/api/v1/media/upload-intents', [['', 'POST'], ['/{{intentId}}/finalize', 'POST']], 'mixed');
routes('Admin users', '/api/v1/admin', [['/users', 'GET'], ['/users/{{userId}}', 'GET'], ['/users/{{userId}}/devices', 'GET'], ['/users/{{userId}}/activity', 'GET'], ['/users/{{userId}}/suspend', 'POST'], ['/users/{{userId}}/reactivate', 'POST'], ['/users/{{userId}}/archive', 'POST'], ['/users/{{userId}}/roles/grant', 'POST'], ['/users/{{userId}}/roles/revoke', 'POST'], ['/devices/{{deviceId}}/revoke', 'POST']], 'admin');
routes('Admin mechanics', '/api/v1/admin/mechanics', [['', 'GET'], ['/{{mechanicId}}', 'GET'], ['/{{mechanicId}}/approve', 'POST'], ['/{{mechanicId}}/reject', 'POST'], ['/{{mechanicId}}/suspend', 'POST'], ['/{{mechanicId}}/ban', 'POST'], ['/{{mechanicId}}/reactivate', 'POST'], ['/{{mechanicId}}/skills', 'PUT'], ['/{{mechanicId}}/service-radius', 'PUT'], ['/{{mechanicId}}/force-unavailable', 'POST'], ['/{{mechanicId}}/work-history', 'GET'], ['/{{mechanicId}}/performance', 'GET']], 'admin');
routes('Admin requests', '/api/v1/admin/service-requests', [['', 'GET'], ['/{{requestId}}', 'GET'], ['/{{requestId}}/timeline', 'GET'], ['/{{requestId}}/media', 'GET'], ['/{{requestId}}/assignment', 'GET'], ['/{{requestId}}/quotes', 'GET'], ['/{{requestId}}/cancel', 'POST'], ['/{{requestId}}/manual-escalate', 'POST'], ['/{{requestId}}/notes', 'POST']], 'admin');
routes('Operations', '/api/v1/admin/operations', [['/outbox-dead-letters', 'GET'], ['/dispatch-stuck', 'GET'], ['/worker-runs', 'GET']], 'admin');
routes('Workers', '/api/v1/internal/workers', [['/reminders/run', 'POST'], ['/outbox/run', 'POST'], ['/dispatch/run', 'POST'], ['/media-uploads/cleanup', 'POST'], ['/reviews/rebuild-ratings', 'POST'], ['/retention/run', 'POST'], ['/live-locations/cleanup', 'POST']], 'worker');
routes('Health', '/api/v1/internal/health', [['/live', 'GET'], ['/ready', 'GET']], 'public');
routes('Chatbot', '/api/chatbot/sessions', [['', 'POST'], ['/{{sessionId}}/messages', 'POST'], ['/{{sessionId}}/diagnosis', 'GET'], ['/{{sessionId}}/transcriptions', 'POST'], ['/{{sessionId}}/claim', 'POST']], 'session');

export const manualCases = [
  { id: 'INF-01', name: 'Google login thật/callback/refresh/logout và JWT Google', expected: 'Provider Google; API nhận JWT Supabase, chọn role đúng, chống replay code/state', requires: 'Google bật trên Supabase, callback allowlist, tài khoản Google test có tương tác; API_TEST_GOOGLE_ACCESS_TOKEN và tùy chọn refresh token' },
  { id: 'INF-02', name: 'Google huỷ consent, state thiếu/sai, code dùng lại, callback không allowlist', expected: 'Không cấp session/không nâng quyền/không open redirect', requires: 'OAuth browser với PKCE và callback của client thực; không thay bằng password login' },
  { id: 'INF-03', name: 'ASR WAV giọng Việt → transcription → diagnosis', expected: 'Chép nội dung đúng; không tự diagnosis ở transcription; không lộ audio', requires: 'Models ONNX và API_TEST_WAV_PATH WAV đã biết transcript; API_TEST_WAV_EXPECTED_TEXT' },
  { id: 'INF-04', name: 'FCM success/invalid token/timeout/retry/deduplication', expected: 'Inbox tồn tại độc lập delivery; đúng retry/dead-letter; không gửi lặp', requires: 'FCM test credentials/device và database/worker cô lập; không gửi tới device thật' },
  { id: 'INF-05', name: 'Workers reminder/dispatch/outbox cạnh tranh lease, crash, lease recovery', expected: 'Một consumer, không duplicate; rollback không residue; round hết hạn mới advance', requires: 'Project riêng và API_TEST_ALLOW_GLOBAL_WORKERS=true; kiểm soát thời gian/lease hoặc hai worker process' },
  { id: 'INF-06', name: 'Tracking enabled, replay/throttle/expiry/travel-state deletion', expected: 'Latest-only, ownership và timestamp/accuracy đúng; deletion khi hết hạn/đổi state', requires: 'LIVE_TRACKING_ENABLED=true + retention rõ ràng; không bật thay user trong lần chạy' },
  { id: 'INF-07', name: 'Google Routes lỗi quota/timeout/invalid/no route/cache expiry', expected: 'Fallback có nhãn, không thay state, không rò provider key', requires: 'Provider test/proxy chủ động gây lỗi; API test không gọi dịch vụ Maps trả phí' },
  { id: 'INF-08', name: 'Restart server, PostgreSQL chatbot persistence/shared limiter cross-instance', expected: 'Session/diagnosis restore, circuit và limit giữa hai instance đúng', requires: 'Hai instance + controlled restart + shared-runtime config; tránh thay env app ngoài run' },
  { id: 'INF-09', name: 'Retention execution, expiry orphan, audit append-only/RLS write attack', expected: 'Chỉ policy explicit xóa, bounded batch; audit update/delete bị cấm; user không ghi chéo', requires: 'Database disposable riêng được xác nhận; TEST_DATABASE_URL hiện trùng DB ứng dụng nên không reset/mutation audit thử' },
  { id: 'INF-10', name: 'Completed assignment review success/duplicate/rating aggregate', expected: 'Một review bất biến từ owner; average/count đúng; concurrent duplicate bị chặn', requires: 'Assignment completed đã có hợp lệ; workflow không thể completed qua payment đang ngoài scope' },
  { id: 'INF-11', name: 'Standard repair complete workflow sau awaiting_payment', expected: 'State đồng bộ, completion đúng, rider thấy lịch sử', requires: 'Fixture completed hợp lệ hoặc mở phạm vi payment; không giả thanh toán bằng SQL' },
  { id: 'INF-12', name: 'Stale location, expired offers/quote, 64-round cap, active workload ranking', expected: 'Không dispatch thợ không eligible, không accept offer expired, không approve expired/stale', requires: 'Controlled time/fixtures disposable; không backdate DB ứng dụng' },
  { id: 'INF-13', name: 'Malformed media MIME/signature, size/hash mismatch, orphan cleanup', expected: 'Finalize fail, không tạo media; replay không duplicate', requires: 'Storage bucket test hoạt động và đối tượng test riêng; chỉ signed URL thuộc fixture' },
];

export function buildCases(c) {
  const cases = [];
  const { http, request, status, eq, same, ok, block, values: v, actors, key, env } = c;
  const add = (feature, name, spec, check, phase = 'authenticated') => {
    if (spec.method === 'PATCH' && spec.path === '/api/v1/auth/profile') spec.contract_gap = 'AGENTS nói PATCH profile; OpenAPI và README chỉ khai báo POST. Cần thống nhất contract.';
    const test = { id: `HTTP-${String(cases.length + 1).padStart(4, '0')}`, feature, name, phase, request: spec, expectation: spec.contract_gap ?? `HTTP ${Array.isArray(spec.expected) ? spec.expected.join('/') : spec.expected}`, run: async () => { if (spec.contract_gap) block(spec.contract_gap); const result = await request(spec); if (check) await check(result.data, result); } };
    cases.push(test); return test;
  };
  const flow = (feature, name, run, expectation = 'Các bước đúng hợp đồng; không bypass state/ownership') => cases.push({ id: `HTTP-${String(cases.length + 1).padStart(4, '0')}`, feature, name, phase: 'authenticated', expectation, run });
  const saved = name => data => { ok(typeof data?.id === 'string', 'Response thiếu id'); v[name] = data.id; };
  const absentPath = endpoint => endpoint.path.replace(/\{\{[^}]+\}\}/g, '{{absent}}');
  const invalid = [400, 422]; // Both explicitly allowed by backend-api.yaml x-error-status-policy.
  const services = ['emergency_rescue', 'mobile_repair', 'at_home_service', 'periodic_maintenance', 'other'];
  const point = { latitude: 11.712345, longitude: 107.312345 };
  const reason = { reason: 'Kiểm thử HTTP black-box trên fixture riêng' };
  const requestBody = { motorcycle_id: '{{motorcycleId}}', service_type: 'mobile_repair', problem_description: 'Xe thử nghiệm khó đề máy', location: point };
  const checklist = { work_summary: 'Đã kiểm tra xe thử nghiệm, chưa chuyển trạng thái hoàn tất.', safety_checklist: { test_ride_completed: true, tools_removed: true, area_safe: true, rider_briefed: true, no_fluid_leak: true } };
  const list = data => { ok(Array.isArray(data.items), 'Response thiếu items[]'); };
  const validBody = endpoint => {
    if (endpoint.method === 'GET' || endpoint.method === 'DELETE') return undefined;
    if (endpoint.path.includes('/roles/')) return { ...reason, role: 'mechanic' };
    if (endpoint.path.endsWith('/skills')) return { ...reason, service_types: ['mobile_repair'] };
    if (endpoint.path.endsWith('/service-radius')) return { ...reason, service_radius_km: 5 };
    if (endpoint.path.endsWith('/notes')) return { ...reason, note: 'Ghi chú test' };
    if (endpoint.allowed === 'admin') return reason;
    if (endpoint.path.endsWith('/cancel')) return reason;
    if (endpoint.path.endsWith('/availability')) return { is_available: true };
    if (endpoint.path.endsWith('/location')) return point;
    if (endpoint.path.endsWith('/profile')) return endpoint.allowed === 'mechanic' ? { service_types: ['mobile_repair'] } : { display_name: 'HTTP Test' };
    if (endpoint.path.endsWith('/status')) return { status: 'en_route' };
    if (endpoint.path.endsWith('/eta')) return { eta_at: '{{future}}' };
    if (endpoint.path.endsWith('/completion-checklist')) return checklist;
    if (endpoint.path.includes('/assignments/') && endpoint.path.endsWith('/media')) return { media_reference: 'test/photo.jpg', purpose: 'work_proof', content_type: 'image/jpeg', size_bytes: 100 };
    if (endpoint.path.endsWith('/media')) return { media_type: 'image', object_reference: 'test/photo.jpg', content_type: 'image/jpeg', size_bytes: 100 };
    if (endpoint.path.endsWith('/motorcycles') || endpoint.feature === 'Motorcycles') return { brand_text: 'Honda', model_text: 'Wave' };
    if (endpoint.path.endsWith('/service-requests')) return { ...requestBody, motorcycle_id: '{{absent}}' };
    if (endpoint.path.endsWith('/snooze')) return { until: '{{future}}' };
    if (endpoint.path.endsWith('/reminders')) return { motorcycle_id: '{{absent}}', title: 'Nhắc test', next_due_at: '{{future}}', enabled: true };
    if (endpoint.feature === 'Reminders') return { motorcycle_id: '{{absent}}', title: 'Nhắc test', next_due_at: '{{future}}', enabled: false };
    if (endpoint.path.endsWith('/review')) return { rating: 5 };
    return {};
  };

  add('Health', 'Liveness công khai và chỉ trả status', { method: 'GET', path: '/api/v1/internal/health/live', role: 'anonymous', expected: 200 }, data => { eq(data.status, 'ok'); eq(Object.keys(data).length, 1, 'Liveness fields'); }, 'public');
  add('Health', 'Readiness database/configuration đã cấu hình phải ready', { method: 'GET', path: '/api/v1/internal/health/ready', role: 'anonymous', expected: 200 }, data => { eq(data.status, 'ready'); ok(Array.isArray(data.checks), 'Readiness thiếu checks'); }, 'public');
  cases.push({ id: 'OAUTH-01', feature: 'Google OAuth', name: 'Supabase bật Google provider', phase: 'public', expectation: 'HTTP 200, external.google=true', run: async () => {
    if (!env().SUPABASE_URL || !env().SUPABASE_PUBLISHABLE_KEY) block('Thiếu Supabase config');
    const r = await http('GET', '/auth/v1/settings', 'anonymous', undefined, { apikey: env().SUPABASE_PUBLISHABLE_KEY }, { origin: env().SUPABASE_URL, external: true }); status(r, 200); eq(r.data.external?.google, true, 'Google provider phải enabled');
  } });
  cases.push({ id: 'OAUTH-02', feature: 'Google OAuth', name: 'Authorize Google redirect tới Google có state và PKCE', phase: 'public', expectation: 'HTTP 302 tới accounts.google.com với state, response_type=code', run: async () => {
    if (!env().SUPABASE_URL) block('Thiếu Supabase config');
    const challenge = createHash('sha256').update('http-test-pkce-verifier-' + v.run_id).digest('base64url');
    const r = await http('GET', `/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent('http://localhost:3000/auth/callback')}&code_challenge=${challenge}&code_challenge_method=s256`, 'anonymous', undefined, { apikey: env().SUPABASE_PUBLISHABLE_KEY }, { origin: env().SUPABASE_URL, external: true });
    status(r, [302, 303]); const target = new URL(r.headers.get('location')); eq(target.hostname, 'accounts.google.com'); eq(target.searchParams.get('response_type'), 'code'); ok(!!target.searchParams.get('state'), 'Redirect thiếu state');
  } });
  cases.push({ id: 'OAUTH-03', feature: 'Google OAuth', name: 'Callback với code/state giả không cấp session', phase: 'public', expectation: 'Không access_token/refresh_token/session thành công', run: async () => {
    if (!env().SUPABASE_URL) block('Thiếu Supabase config');
    const r = await http('GET', '/auth/v1/callback?code=invalid-test-code&state=invalid-test-state', 'anonymous', undefined, { apikey: env().SUPABASE_PUBLISHABLE_KEY }, { origin: env().SUPABASE_URL, external: true });
    // OAuth errors may be redirected to the client's callback with an error code.
    status(r, [302, 303, 400, 401]); ok(!/[?#&](?:access_token|refresh_token|code)=/.test(r.headers.get('location') ?? ''), 'Callback giả cấp token/code'); ok(!r.data?.access_token && !r.data?.refresh_token, 'Callback giả cấp session');
    if (r.status < 400) ok(/[?#&]error(?:_code|_description)?=/.test(r.headers.get('location') ?? ''), 'Redirect lỗi thiếu error');
  } });

  for (const endpoint of endpoints.filter(endpoint => !['public', 'session'].includes(endpoint.allowed))) {
    for (const role of ['anonymous', 'invalid']) add(endpoint.feature, `${endpoint.method} ${endpoint.path}: ${role} bị từ chối`, { method: endpoint.method, path: absentPath(endpoint), role, ...(endpoint.method !== 'GET' && endpoint.method !== 'DELETE' ? { body: {} } : {}), expected: 401 }, undefined, 'public');
    if (endpoint.allowed === 'worker') {
      add('Workers', `${endpoint.path}: sai worker secret`, { method: 'POST', path: endpoint.path, role: 'anonymous', body: {}, headers: { 'X-Worker-Secret': 'invalid-worker-secret' }, expected: 401 }, undefined, 'public');
      for (const role of ['rider1', 'mechanic1', 'admin']) add('Workers', `${endpoint.path}: JWT ${role} không thay worker secret`, { method: 'POST', path: endpoint.path, role, body: {}, expected: 401 });
    }
    if (endpoint.allowed === 'admin') for (const role of ['rider1', 'mechanic1', 'pending']) add(endpoint.feature, `${endpoint.method} ${endpoint.path}: ${role} không có admin role`, { method: endpoint.method, path: absentPath(endpoint), role, body: validBody(endpoint), ...(endpoint.method !== 'GET' ? { key: 'role-denial' } : {}), expected: 403 });
    if (endpoint.allowed === 'mechanic') add(endpoint.feature, `${endpoint.method} ${endpoint.path}: rider không có mechanic role`, { method: endpoint.method, path: absentPath(endpoint), role: 'rider1', body: validBody(endpoint), ...(endpoint.method !== 'GET' ? { key: 'role-denial' } : {}), expected: 403 });
    if (endpoint.allowed === 'rider') add(endpoint.feature, `${endpoint.method} ${endpoint.path}: mechanic bị từ chối (resource absent)`, { method: endpoint.method, path: absentPath(endpoint), role: 'mechanic1', body: validBody(endpoint), ...(endpoint.method !== 'GET' && endpoint.method !== 'DELETE' ? { key: 'role-denial' } : {}), expected: endpoint.feature === 'Quotes' ? [403, 404] : 403 });
  }

  for (const role of ['rider1', 'rider2', 'mechanic1', 'mechanic2', 'pending', 'admin']) add('Auth', `JWT thật: actor đúng ID/roles (${role})`, { method: 'GET', path: '/api/v1/auth/me', role, expected: 200 }, data => { eq(data.id, actors[role].id); ok(data.roles.includes(role === 'admin' ? 'admin' : role.startsWith('rider') ? 'rider' : 'mechanic'), 'Sai role từ database'); });
  add('Auth', 'Bootstrap replay giữ nguyên rider', { method: 'POST', path: '/api/v1/auth/profile', role: 'rider1', body: {}, expected: 200 }, data => { eq(data.id, actors.rider1.id); ok(data.roles.includes('rider') && !data.roles.includes('admin'), 'Bootstrap thay role'); });
  add('Auth', 'Từ chối self-select admin', { method: 'POST', path: '/api/v1/auth/profile', role: 'fresh', body: { account_type: 'admin' }, expected: invalid });
  add('Auth', 'Từ chối role injection', { method: 'POST', path: '/api/v1/auth/profile', role: 'fresh', body: { account_type: 'rider', roles: ['admin'], status: 'active' }, expected: invalid });
  add('Auth', 'Chọn mechanic lần đầu', { method: 'POST', path: '/api/v1/auth/profile', role: 'fresh', body: { account_type: 'mechanic' }, expected: 200 }, data => { ok(data.roles.includes('mechanic') && !data.roles.includes('admin'), 'Sai role sau lựa chọn'); });
  add('Auth', 'Account type bất biến', { method: 'POST', path: '/api/v1/auth/profile', role: 'fresh', body: { account_type: 'rider' }, expected: [200, 409] }, (data, response) => { if (response.status === 200) ok(data.roles.includes('mechanic') && !data.roles.includes('rider'), 'Account type bị thay đổi'); });
  for (const body of [{ display_name: '' }, { display_name: 'x'.repeat(121) }, { display_name: 123 }, { unknown_field: true }]) add('Auth', 'Profile input sai bị chặn', { method: 'PATCH', path: '/api/v1/auth/profile', role: 'rider1', body, expected: invalid });
  add('Auth', 'Đổi display name', { method: 'PATCH', path: '/api/v1/auth/profile', role: 'rider1', body: { display_name: 'HTTP Test Rider Updated' }, expected: 200 });
  flow('Auth', 'JWT none/HS256/expired/tampered không được chấp nhận', async () => {
    const base64 = data => Buffer.from(JSON.stringify(data)).toString('base64url');
    for (const alg of ['none', 'HS256', 'RS256']) {
      actors.attack = { token: `${base64({ alg, typ: 'JWT' })}.${base64({ sub: actors.rider1?.id ?? randomUUID(), aud: 'authenticated', exp: 1, role: 'admin' })}.invalid` };
      status(await http('GET', '/api/v1/auth/me', 'attack'), 401);
    }
    const token = actors.rider1?.token ?? block('Thiếu rider1 JWT');
    const parts = token.split('.'); parts[1] = base64({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), app_metadata: { roles: ['admin'] } });
    actors.attack = { token: parts.join('.') }; status(await http('GET', '/api/v1/admin/users', 'attack'), 401); delete actors.attack;
  });
  flow('Google OAuth', 'Google JWT thật được backend chấp nhận và provider là google', async () => {
    const token = env().API_TEST_GOOGLE_ACCESS_TOKEN;
    if (!token) block('Chưa có API_TEST_GOOGLE_ACCESS_TOKEN từ login Google thật; password JWT không thay thế');
    const user = await http('GET', '/auth/v1/user', 'anonymous', undefined, { apikey: env().SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, { origin: env().SUPABASE_URL, external: true });
    status(user, 200); ok(user.data.identities?.some(identity => identity.provider === 'google'), 'JWT không thuộc Google identity');
    actors.google = { token, id: user.data.id }; status(await http('GET', '/api/v1/auth/me', 'google'), 200);
  });
  flow('Google OAuth', 'Refresh Google session giữ đúng user; refresh token sai bị từ chối', async () => {
    const token = env().API_TEST_GOOGLE_REFRESH_TOKEN;
    if (!token) block('Thiếu refresh token của Google session test');
    const r = await http('POST', '/auth/v1/token?grant_type=refresh_token', 'anonymous', { refresh_token: token }, { apikey: env().SUPABASE_PUBLISHABLE_KEY }, { origin: env().SUPABASE_URL, external: true }); status(r, 200); ok(!!r.data.access_token, 'Refresh không cấp token');
  });

  add('Devices', 'Đăng ký device chỉ trả metadata', { method: 'POST', path: '/api/v1/auth/devices', role: 'rider1', body: { device_key: 'http-device-{{run_id}}', platform: 'android' }, expected: 200 }, data => { saved('deviceId')(data); ok(!JSON.stringify(data).includes('http-device-'), 'Lộ raw device key'); });
  add('Devices', 'Device replay giữ nguyên id', { method: 'POST', path: '/api/v1/auth/devices', role: 'rider1', body: { device_key: 'http-device-{{run_id}}', platform: 'android' }, expected: 200 }, data => eq(data.id, v.deviceId));
  for (const body of [{}, { device_key: 'short', platform: 'android' }, { device_key: 'x'.repeat(1001), platform: 'android' }, { device_key: 'http-valid-key', platform: '' }, { device_key: 'http-valid-key', platform: 'android', push_token: 'test-token' }, { device_key: 'http-valid-key', platform: 'android', push_provider: 'fcm' }]) add('Devices', 'Device invalid/paired push fields', { method: 'POST', path: '/api/v1/auth/devices', role: 'rider1', body, expected: invalid });
  for (const role of ['rider2', 'mechanic1']) add('Devices', `Push token device khác: ${role}`, { method: 'PUT', path: '/api/v1/auth/devices/{{deviceId}}/push-token', role, body: { push_token: 'http-test-token-private', push_provider: 'fcm' }, expected: [403, 404] });
  add('Devices', 'Push đăng ký và response redacted', { method: 'PUT', path: '/api/v1/auth/devices/{{deviceId}}/push-token', role: 'rider1', body: { push_token: 'http-test-token-private', push_provider: 'fcm' }, expected: 200 }, data => { eq(data.push_token_registered, true); ok(!JSON.stringify(data).includes('http-test-token-private'), 'Lộ push token'); });
  add('Devices', 'Thu hồi push token', { method: 'DELETE', path: '/api/v1/auth/devices/{{deviceId}}/push-token', role: 'rider1', expected: 200 }, data => eq(data.push_token_registered, false));
  add('Devices', 'Thu hồi replay idempotent', { method: 'DELETE', path: '/api/v1/auth/devices/{{deviceId}}/push-token', role: 'rider1', expected: 200 }, data => eq(data.push_token_registered, false));

  add('Motorcycles', 'Tạo xe rider1', { method: 'POST', path: '/api/v1/motorcycles', role: 'rider1', body: { brand_text: 'Honda', model_text: 'Wave HTTP test', year: 2020 }, expected: 201 }, saved('motorcycleId'));
  add('Motorcycles', 'Tạo xe rider2', { method: 'POST', path: '/api/v1/motorcycles', role: 'rider2', body: { brand_text: 'Yamaha', model_text: 'Sirius HTTP test' }, expected: 201 }, saved('foreignMotorcycleId'));
  add('Motorcycles', 'List chỉ chứa xe owner', { method: 'GET', path: '/api/v1/motorcycles', role: 'rider1', expected: 200 }, data => { list(data); ok(data.items.some(item => item.id === v.motorcycleId), 'List thiếu xe mới'); ok(data.items.every(item => item.rider_id === actors.rider1.id), 'List lộ xe khác'); });
  add('Motorcycles', 'Đọc xe owner', { method: 'GET', path: '/api/v1/motorcycles/{{motorcycleId}}', role: 'rider1', expected: 200 }, data => eq(data.id, v.motorcycleId));
  for (const method of ['GET', 'PATCH', 'DELETE']) add('Motorcycles', `${method} xe owner khác bị chặn`, { method, path: '/api/v1/motorcycles/{{motorcycleId}}', role: 'rider2', ...(method === 'PATCH' ? { body: { brand_text: 'Attack', model_text: 'Attack' } } : {}), expected: 403 });
  for (const method of ['GET', 'PATCH', 'DELETE']) add('Motorcycles', `${method} UUID không tồn tại`, { method, path: '/api/v1/motorcycles/{{absent}}', role: 'rider1', ...(method === 'PATCH' ? { body: { brand_text: 'Honda', model_text: 'Wave' } } : {}), expected: 404 });
  for (const [field, bad] of [['brand_text', ''], ['brand_text', ' '.repeat(4)], ['brand_text', 'x'.repeat(101)], ['model_text', ''], ['model_text', 2], ['year', 1949], ['year', 2101], ['year', 2020.5], ['license_plate', 'x'.repeat(31)], ['notes', 'x'.repeat(1001)], ['rider_id', '{{rider2_id}}']]) add('Motorcycles', `Biên/schema ${field}=${typeof bad === 'string' ? 'invalid string' : bad}`, { method: 'POST', path: '/api/v1/motorcycles', role: 'rider1', body: { brand_text: 'Honda', model_text: 'Wave', [field]: bad }, expected: invalid });
  add('Motorcycles', 'Update xe owner', { method: 'PATCH', path: '/api/v1/motorcycles/{{motorcycleId}}', role: 'rider1', body: { brand_text: 'Honda', model_text: 'Wave đã cập nhật' }, expected: 200 }, data => eq(data.model_text, 'Wave đã cập nhật'));
  add('Motorcycles', 'Tạo xe để archive', { method: 'POST', path: '/api/v1/motorcycles', role: 'rider1', body: { brand_text: 'Honda', model_text: 'Archive test' }, expected: 201 }, saved('archivedMotorcycleId'));
  add('Motorcycles', 'Archive xe', { method: 'DELETE', path: '/api/v1/motorcycles/{{archivedMotorcycleId}}', role: 'rider1', expected: 204 });
  add('Motorcycles', 'Archive không còn đọc được', { method: 'GET', path: '/api/v1/motorcycles/{{archivedMotorcycleId}}', role: 'rider1', expected: 404 });

  for (const role of ['mechanic1', 'mechanic2', 'pending']) add('Mechanic profile', `Mechanic mới pending/unavailable (${role})`, { method: 'GET', path: '/api/v1/mechanics/me/profile', role, expected: 200 }, data => { eq(data.profile_status, 'pending'); eq(data.is_available, false); eq(data.rating_count, 0); });
  for (const body of [{ profile_status: 'active' }, { rating_avg: 5 }, { rating_count: 10 }, { user_id: '{{rider2_id}}' }, { service_radius_km: 0 }, { service_radius_km: -1 }, { service_types: [] }, { service_types: ['unknown'] }]) add('Mechanic profile', 'Không tự nâng status/rating; radius/skills valid', { method: 'PATCH', path: '/api/v1/mechanics/me/profile', role: 'mechanic1', body, expected: invalid });
  for (const role of ['mechanic1', 'mechanic2']) {
    add('Admin mechanics', `Approve ${role} thiếu idempotency`, { method: 'POST', path: `/api/v1/admin/mechanics/{{${role}_id}}/approve`, role: 'admin', body: reason, expected: invalid });
    add('Admin mechanics', `Approve ${role}`, { method: 'POST', path: `/api/v1/admin/mechanics/{{${role}_id}}/approve`, role: 'admin', body: reason, key: `approve-${role}`, expected: 200 });
    add('Admin mechanics', `Approve replay ${role}`, { method: 'POST', path: `/api/v1/admin/mechanics/{{${role}_id}}/approve`, role: 'admin', body: reason, key: `approve-${role}`, expected: 200 });
    add('Mechanic profile', `Cấu hình skills/radius ${role}`, { method: 'PATCH', path: '/api/v1/mechanics/me/profile', role, body: { service_types: services, service_radius_km: 12 }, expected: 200 });
    add('Mechanic profile', `Availability ${role}`, { method: 'PUT', path: '/api/v1/mechanics/me/availability', role, body: { is_available: true }, expected: 200 }, data => eq(data.is_available, true));
    add('Mechanic profile', `Fresh location ${role}`, { method: 'PUT', path: '/api/v1/mechanics/me/location', role, body: point, expected: 204 });
  }
  for (const body of [{ latitude: 90.1, longitude: 1 }, { latitude: 1, longitude: -180.1 }, { latitude: '10', longitude: 106 }, { ...point, location_updated_at: '{{future}}' }]) add('Mechanic profile', 'Location biên/type/client timestamp', { method: 'PUT', path: '/api/v1/mechanics/me/location', role: 'mechanic1', body, expected: invalid });
  for (const body of [{ is_available: 'true' }, {}, { is_available: true, profile_status: 'active' }]) add('Mechanic profile', 'Availability schema', { method: 'PUT', path: '/api/v1/mechanics/me/availability', role: 'mechanic1', body, expected: invalid });
  for (const route of ['/dashboard', '/jobs', '/performance']) add('Mechanic operations', `Read model ${route}`, { method: 'GET', path: `/api/v1/mechanics/me${route}`, role: 'mechanic1', expected: 200 }, data => ok(!/"(?:earnings|payout|settlement|payment)"\s*:/.test(JSON.stringify(data)), 'Read model lộ financial field'));
  for (const query of ['limit=0', 'limit=101', 'limit=abc', 'cursor=invalid', 'status=invalid', 'active_only=wrong', 'date_from=bad', 'date_from=2030-01-01&date_to=2020-01-01']) add('Mechanic operations', `Jobs filter ${query}`, { method: 'GET', path: `/api/v1/mechanics/me/jobs?${query}`, role: 'mechanic1', expected: invalid });

  for (const service of services) {
    const body = { ...requestBody, service_type: service, ...(['at_home_service', 'periodic_maintenance'].includes(service) ? { address_text: 'Địa chỉ kiểm thử độc lập', scheduled_start_at: '{{future}}' } : {}), ...(service === 'other' ? { fulfillment_mode: 'immediate_location' } : {}) };
    add('Service requests', `Tạo yêu cầu ${service}`, { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body, key: `create-${service}`, expected: 201 }, data => { saved(`${service}_request`)(data); if (service === 'mobile_repair') v.requestId = data.id; if (service === 'emergency_rescue') v.rescueRequestId = data.id; eq(data.status, 'submitted'); ok(/^COR-(EMR|MOB|HOME|MNT|OTH)-\d{8}-\d+$/.test(data.request_code), 'Request code sai'); v[`${service}_code`] = data.request_code; });
    add('Service requests', `Replay ${service} không duplicate`, { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body, key: `create-${service}`, expected: [200, 201] }, data => eq(data.id, v[`${service}_request`]));
    add('Service requests', `Key conflict ${service}`, { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body: { ...body, problem_description: 'Nội dung khác với lần đầu' }, key: `create-${service}`, expected: 409 });
  }
  add('Service requests', 'Other scheduled_visit hợp lệ', { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body: { ...requestBody, service_type: 'other', fulfillment_mode: 'scheduled_visit', address_text: 'Nhà thử nghiệm', scheduled_start_at: '{{future}}' }, key: 'other-scheduled', expected: 201 }, saved('scheduledOtherId'));
  add('Service requests', 'Create thiếu idempotency', { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body: requestBody, expected: invalid });
  for (const headers of [{ 'X-Idempotency-Key': 'short' }, { 'X-Idempotency-Key': 'x'.repeat(201) }]) add('Service requests', 'Idempotency key biên', { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body: requestBody, headers, expected: invalid });
  const badRequestBodies = [
    [{ ...requestBody, motorcycle_id: '{{foreignMotorcycleId}}' }, 403, 'Motorcycle owner khác'],
    [{ ...requestBody, motorcycle_id: '{{absent}}' }, 404, 'Motorcycle không tồn tại'],
    [{ ...requestBody, motorcycle_id: '{{archivedMotorcycleId}}' }, 404, 'Motorcycle archived'],
    [{ ...requestBody, motorcycle_id: 'not-a-uuid' }, invalid, 'UUID sai'],
    [{ ...requestBody, problem_description: 'ab' }, invalid, 'Description dưới biên'],
    [{ ...requestBody, problem_description: 'x'.repeat(3001) }, invalid, 'Description vượt biên'],
    [{ ...requestBody, service_type: 'invalid' }, invalid, 'Service type sai'],
    [{ ...requestBody, service_type: 'emergency_rescue', location: undefined }, invalid, 'Emergency thiếu location'],
    [{ ...requestBody, service_type: 'emergency_rescue', scheduled_start_at: '{{future}}' }, invalid, 'Emergency không schedule'],
    [{ ...requestBody, location: undefined, address_text: undefined }, invalid, 'Mobile thiếu location/address'],
    [{ ...requestBody, scheduled_start_at: '{{future}}' }, invalid, 'Mobile không schedule'],
    [{ ...requestBody, service_type: 'at_home_service' }, invalid, 'At home thiếu schedule/address'],
    [{ ...requestBody, service_type: 'periodic_maintenance', scheduled_start_at: '{{past}}' }, invalid, 'Maintenance không được quá khứ'],
    [{ ...requestBody, service_type: 'other' }, invalid, 'Other thiếu fulfillment_mode'],
    [{ ...requestBody, fulfillment_mode: 'immediate_location' }, invalid, 'Non-other không có fulfillment_mode'],
    [{ ...requestBody, location: { latitude: 91, longitude: 181 } }, invalid, 'Coordinates ngoài biên'],
    [{ ...requestBody, rider_id: '{{rider2_id}}', status: 'completed' }, invalid, 'Owner/status injection'],
    [{ ...requestBody, safety_answers: { token: 'private-value', raw_audio: 'base64' } }, 201, 'Safety answers additionalProperties theo contract; audit phải sanitized'],
  ];
  for (const [body, expected, label] of badRequestBodies) add('Service requests', label, { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body, key: `bad-request-${cases.length}`, expected });
  add('Service requests', 'List chỉ request owner', { method: 'GET', path: '/api/v1/service-requests', role: 'rider1', expected: 200 }, data => { list(data); ok(data.items.every(item => item.rider_id === actors.rider1.id), 'Request list lộ owner khác'); });
  for (const query of ['limit=0', 'limit=101', 'cursor=invalid', 'status=invalid', 'service_type=invalid']) add('Service requests', `Request filter ${query}`, { method: 'GET', path: `/api/v1/service-requests?${query}`, role: 'rider1', expected: invalid, contract_gap: 'Contract chỉ khai báo cursor string; chưa quy định limit/status/service_type hoặc định dạng cursor invalid. Chưa có oracle validation.' });
  for (const suffix of ['', '/media', '/dispatch', '/cancel']) add('Service requests', `Foreign owner ${suffix || '/read'}`, { method: suffix ? 'POST' : 'GET', path: `/api/v1/service-requests/{{requestId}}${suffix}`, role: 'rider2', ...(suffix === '/media' ? { body: { media_type: 'image', object_reference: 'test/photo.jpg', content_type: 'image/jpeg' } } : suffix === '/cancel' ? { body: reason } : {}), expected: 403 });
  add('Service requests', 'Read nonexistent request', { method: 'GET', path: '/api/v1/service-requests/{{absent}}', role: 'rider1', expected: 404 });
  add('Service requests', 'Media metadata tạo được', { method: 'POST', path: '/api/v1/service-requests/{{requestId}}/media', role: 'rider1', body: { media_type: 'image', object_reference: 'test/http/photo.jpg', content_type: 'image/jpeg', size_bytes: 100 }, expected: 201 });
  add('Service requests', 'Media raw data không được nhận', { method: 'POST', path: '/api/v1/service-requests/{{requestId}}/media', role: 'rider1', body: { media_type: 'image', object_reference: 'data:image/jpeg;base64,AAAA', content_type: 'image/jpeg', raw_media: 'AAAA' }, expected: invalid });
  flow('Service requests', 'Concurrent cùng key chỉ tạo 1 request', async () => {
    const spec = { method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body: { ...requestBody, problem_description: `Concurrent-${v.run_id}` }, key: 'concurrent-create', expected: [200, 201] };
    const responses = await Promise.all(Array.from({length: 4}, () => http(spec.method, spec.path, spec.role, spec.body, { 'X-Idempotency-Key': key(spec.key) })));
    for (const response of responses) status(response, [200, 201, 409]);
    const successes = responses.filter(response => response.status < 300); ok(successes.length > 0, 'Không request nào thành công');
    const replay = await request(spec); successes.push(replay);
    eq(new Set(successes.map(result => result.data.id)).size, 1, 'Concurrent duplicate'); v.concurrentRequestId = replay.data.id;
    const listed = await request({ method: 'GET', path: '/api/v1/service-requests', role: 'rider1', expected: 200 });
    if (listed.data.next_cursor) block('Cần thu thập toàn bộ cursor pages để xác minh không duplicate resource');
    eq(listed.data.items.filter(item => item.problem_description === spec.body.problem_description).length, 1, 'Một logical resource trong owner list');
  });
  add('Service requests', 'Cancel trước dispatch', { method: 'POST', path: '/api/v1/service-requests/{{at_home_service_request}}/cancel', role: 'rider1', body: reason, expected: 200 }, data => eq(data.status, 'canceled'));
  add('Service requests', 'Canceled không dispatch', { method: 'POST', path: '/api/v1/service-requests/{{at_home_service_request}}/dispatch', role: 'rider1', expected: 409 });

  flow('Dispatch', 'Làm mới location đúng API trước dispatch', async () => { for (const role of ['mechanic1', 'mechanic2']) await request({ method: 'PUT', path: '/api/v1/mechanics/me/location', role, body: point, expected: 204 }); });
  add('Dispatch', 'Dispatch request có thợ eligible', { method: 'POST', path: '/api/v1/service-requests/{{requestId}}/dispatch', role: 'rider1', expected: 202 }, data => { ok(data !== null, 'Dispatch thiếu result'); });
  flow('Dispatch', 'Offers riêng mỗi mechanic; pending không được offer', async () => {
    for (const role of ['mechanic1', 'mechanic2']) {
      const r = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role, expected: 200 }); list(r.data);
      ok(r.data.items.every(item => item.mechanic_id === actors[role].id), 'Offers lộ mechanic khác');
      const offer = r.data.items.find(item => item.request_id === v.requestId) ?? block(`Không có offer request mới cho ${role}`); v[`${role}_offer`] = offer.id;
    }
    const r = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role: 'pending', expected: 200 }); ok(!r.data.items?.some(item => item.request_id === v.requestId), 'Pending profile nhận offer');
  });
  add('Dispatch', 'Không accept offer thuộc mechanic khác', { method: 'POST', path: '/api/v1/dispatch/offers/{{mechanic1_offer}}/accept', role: 'mechanic2', expected: 403 });
  flow('Dispatch', 'Hai thợ accept đồng thời chỉ một thắng', async () => {
    if (!v.mechanic1_offer || !v.mechanic2_offer) block('Thiếu hai offer cùng request');
    const responses = await Promise.all(['mechanic1', 'mechanic2'].map(role => http('POST', `/api/v1/dispatch/offers/{{${role}_offer}}/accept`, role)));
    eq(responses.filter(r => r.status === 201).length, 1, 'Số người thắng'); eq(responses.filter(r => r.status === 409).length, 1, 'Số conflict');
    const winner = responses.findIndex(r => r.status === 201); const data = responses[winner].data;
    ok(typeof data.id === 'string', 'Accept thiếu assignment id'); v.assignmentId = data.id; v.winnerRole = winner === 0 ? 'mechanic1' : 'mechanic2'; v.loserRole = winner === 0 ? 'mechanic2' : 'mechanic1'; actors.assigned = actors[v.winnerRole]; actors.unassigned = actors[v.loserRole];
  });
  add('Assignments', 'Owner sees accepted assignment', { method: 'GET', path: '/api/v1/assignments', role: 'assigned', expected: 200 }, data => { list(data); eq(data.items.filter(item => item.request_id === v.requestId).length, 1); eq(data.items.find(item => item.id === v.assignmentId)?.status, 'accepted'); });
  for (const next of ['on_site', 'diagnosis', 'in_progress', 'completed', 'invalid']) add('Assignments', `Không skip accepted → ${next}`, { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/status', role: 'assigned', body: { status: next }, expected: next === 'invalid' ? invalid : 409 });
  for (const role of ['rider1', 'rider2', 'unassigned']) add('Assignments', `Không đổi state khi không assigned (${role})`, { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/status', role, body: { status: 'en_route' }, expected: 403 });
  for (const suffix of ['/eta', '/media', '/completion-checklist', '/diagnoses', '/recover']) add('Mechanic operations', `Mechanic khác không ghi ${suffix}`, { method: 'POST', path: `/api/v1/assignments/{{assignmentId}}${suffix}`, role: 'unassigned', body: suffix === '/eta' ? { eta_at: '{{future}}' } : suffix === '/media' ? { media_reference: 'test/photo.jpg', purpose: 'work_proof', content_type: 'image/jpeg', size_bytes: 100 } : suffix === '/completion-checklist' ? checklist : suffix === '/diagnoses' ? { diagnosis_text: 'Chẩn đoán test' } : { reason_code: 'cannot_continue' }, key: `foreign-${suffix}`, expected: [403, 404] });
  for (const suffix of ['/eta', '/media', '/completion-checklist']) {
    const body = suffix === '/eta' ? { eta_at: '{{future}}' } : suffix === '/media' ? { media_reference: 'test/photo.jpg', purpose: 'work_proof', content_type: 'image/jpeg', size_bytes: 100 } : checklist;
    add('Mechanic operations', `${suffix} thiếu idempotency`, { method: 'POST', path: `/api/v1/assignments/{{assignmentId}}${suffix}`, role: 'assigned', body, expected: invalid });
    add('Mechanic operations', `${suffix} tạo metadata`, { method: 'POST', path: `/api/v1/assignments/{{assignmentId}}${suffix}`, role: 'assigned', body, key: suffix, expected: 201 }, data => { ok(typeof data.id === 'string', 'Metadata thiếu id'); v[suffix] = data.id; });
    add('Mechanic operations', `${suffix} replay không duplicate`, { method: 'POST', path: `/api/v1/assignments/{{assignmentId}}${suffix}`, role: 'assigned', body, key: suffix, expected: [200, 201] }, data => eq(data.id, v[suffix]));
    add('Mechanic operations', `${suffix} key khác payload conflict`, { method: 'POST', path: `/api/v1/assignments/{{assignmentId}}${suffix}`, role: 'assigned', body: suffix === '/eta' ? { ...body, delay_reason: 'Đổi lý do retry' } : suffix === '/media' ? { ...body, size_bytes: 101 } : { ...body, work_summary: 'Thay đổi nội dung retry' }, key: suffix, expected: 409 });
  }
  for (const body of [{ eta_at: '{{past}}' }, { eta_at: 'not-a-date' }, { eta_at: '2099-01-01T00:00:00Z' }, { eta_at: '{{future}}', delay_reason: 'x'.repeat(3001) }, { eta_at: '{{future}}', status: 'completed' }]) add('Mechanic operations', 'ETA biên/schema', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/eta', role: 'assigned', body, key: `eta-bad-${cases.length}`, expected: invalid });
  for (const body of [{}, { ...checklist, safety_checklist: { area_safe: 'true' } }, { ...checklist, status: 'completed' }, { ...checklist, work_summary: '' }]) add('Mechanic operations', 'Checklist không bypass completion', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/completion-checklist', role: 'assigned', body, key: `checklist-bad-${cases.length}`, expected: invalid });
  add('Assignments', 'Metadata/checklist không tự complete', { method: 'GET', path: '/api/v1/assignments', role: 'assigned', expected: 200 }, data => eq(data.items.find(item => item.id === v.assignmentId)?.status, 'accepted'));
  for (const role of ['rider1', 'assigned', 'admin']) add('Route ETA', `Advisory ETA allowed ${role}`, { method: 'GET', path: '/api/v1/assignments/{{assignmentId}}/route-eta', role, expected: 200 }, data => { ok(['available', 'fallback', 'unavailable'].includes(data.status), 'ETA status sai'); ok(['google_routes', 'straight_line_fallback', 'none'].includes(data.source), 'ETA source sai'); ok(!!data.advisory?.message, 'ETA thiếu advisory'); });
  for (const role of ['rider2', 'unassigned']) add('Route ETA', `ETA foreign ${role}`, { method: 'GET', path: '/api/v1/assignments/{{assignmentId}}/route-eta', role, expected: 403 });
  flow('Live tracking', 'Disabled reject ingest có kiểm soát', async () => {
    if (/^(true|1)$/i.test(env().LIVE_TRACKING_ENABLED ?? '')) block('Case disabled chỉ áp dụng khi config disabled; enabled suite cần retention fixture');
    status(await http('PUT', '/api/v1/assignments/{{assignmentId}}/live-location', 'assigned', { ...point, observed_at: new Date().toISOString(), accuracy_meters: 10 }), 409);
  });

  add('Assignments', 'accepted → en_route', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/status', role: 'assigned', body: { status: 'en_route' }, expected: 200 }, data => eq(data.status, 'en_route'));
  add('Assignments', 'Request state đồng bộ mechanic_en_route', { method: 'GET', path: '/api/v1/service-requests/{{requestId}}', role: 'rider1', expected: 200 }, data => eq(data.status, 'mechanic_en_route'));
  add('Assignments', 'en_route không quay accepted', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/status', role: 'assigned', body: { status: 'accepted' }, expected: 409 });
  add('Assignments', 'en_route → on_site', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/status', role: 'assigned', body: { status: 'on_site' }, expected: 200 }, data => eq(data.status, 'on_site'));
  add('Assignments', 'on_site → diagnosis', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/status', role: 'assigned', body: { status: 'diagnosis' }, expected: 200 }, data => eq(data.status, 'diagnosis'));
  add('Diagnosis', 'Diagnosis tạo text tiếng Việt', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/diagnoses', role: 'assigned', body: { diagnosis_text: 'Kiểm tra bugi, có dấu hiệu hao mòn.', recommended_work_text: 'Thay bugi sau khi khách duyệt.' }, expected: 201 }, saved('diagnosisId'));
  add('Diagnosis', 'Diagnosis revision trước quote giữ một current diagnosis', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/diagnoses', role: 'assigned', body: { diagnosis_text: 'Kiểm tra bổ sung hệ thống điện.' }, expected: 201 }, data => { eq(data.id, v.diagnosisId, 'Một current diagnosis FR-014A'); eq(data.diagnosis_text, 'Kiểm tra bổ sung hệ thống điện.'); });
  for (const body of [{}, { diagnosis_text: 'ab' }, { diagnosis_text: 'x'.repeat(5001) }, { diagnosis_text: 'Test valid', mechanic_id: '{{rider2_id}}' }]) add('Diagnosis', 'Diagnosis schema boundary/identity injection', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/diagnoses', role: 'assigned', body, expected: invalid });

  const quoteBody = { assignment_id: '{{assignmentId}}', diagnosis_id: '{{diagnosisId}}', lines: [{ line_type: 'labor', description: 'Kiểm tra xe', quantity: 1, unit_amount: 100000 }, { line_type: 'part', description: 'Bugi', quantity: 2, unit_amount: 50000 }], discount_amount: 10000 };
  for (const body of [{ ...quoteBody, lines: [] }, { ...quoteBody, lines: [{ line_type: 'part', description: 'Bugi', quantity: 0, unit_amount: 1 }] }, { ...quoteBody, lines: [{ line_type: 'part', description: 'Bugi', quantity: 1, unit_amount: -1 }] }, { ...quoteBody, lines: [{ line_type: 'part', description: 'Bugi', quantity: 1, unit_amount: 1.5 }] }, { ...quoteBody, discount_amount: 1000000 }, { ...quoteBody, total_amount: 1 }]) add('Quotes', 'Quote lines/money validation không nhận total client', { method: 'POST', path: '/api/v1/service-requests/{{requestId}}/quotes', role: 'assigned', body, expected: invalid });
  add('Quotes', 'Tạo quote v1; tổng do backend tính', { method: 'POST', path: '/api/v1/service-requests/{{requestId}}/quotes', role: 'assigned', body: quoteBody, expected: 201 }, data => { saved('quoteV1')(data); eq(data.total_amount, 190000); eq(data.currency, 'VND'); eq(data.status, 'pending'); });
  add('Quotes', 'Tạo quote v2 bất biến', { method: 'POST', path: '/api/v1/service-requests/{{requestId}}/quotes', role: 'assigned', body: { ...quoteBody, discount_amount: 20000 }, expected: 201 }, data => { saved('quoteId')(data); eq(data.total_amount, 180000); ok(data.id !== v.quoteV1, 'Quote mới ghi đè ID'); });
  add('Quotes', 'Approve quote cũ bị chặn', { method: 'POST', path: '/api/v1/quotes/{{quoteV1}}/approve', role: 'rider1', body: {}, expected: 409 });
  for (const role of ['rider2', 'unassigned']) add('Quotes', `Không approve quote khi không owner ${role}`, { method: 'POST', path: '/api/v1/quotes/{{quoteId}}/approve', role, body: {}, expected: 403 });
  for (const role of ['rider1', 'assigned', 'admin']) add('Quotes', `Xem quote history ${role}`, { method: 'GET', path: '/api/v1/service-requests/{{requestId}}/quotes', role, expected: 200 }, data => { list(data); ok(data.items.some(item => item.id === v.quoteV1 && item.total_amount === 190000), 'History v1 bị ghi đè'); });
  add('Quotes', 'Approve latest dừng awaiting_payment (không gọi payment API)', { method: 'POST', path: '/api/v1/quotes/{{quoteId}}/approve', role: 'rider1', body: {}, expected: 200 });
  add('Quotes', 'Request sau approve awaiting_payment', { method: 'GET', path: '/api/v1/service-requests/{{requestId}}', role: 'rider1', expected: 200 }, data => eq(data.status, 'awaiting_payment'));

  for (const rating of [0, 6, 1.5, '5']) add('Reviews', `Review rating invalid ${rating}`, { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/review', role: 'rider1', body: { rating }, key: `bad-rating-${rating}`, expected: invalid });
  add('Reviews', 'Assignment chưa complete không được review', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/review', role: 'rider1', body: { rating: 5, comment: 'Kiểm thử' }, key: 'review-incomplete', expected: 409 });
  add('Reviews', 'Rider khác không review', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/review', role: 'rider2', body: { rating: 5 }, key: 'review-foreign', expected: [403, 404] });
  flow('Reviews', 'Completed review happy path cần fixture hợp lệ', async () => block('Không tạo assignment completed giả; payment ngoài scope, INF-10'));
  add('Recovery', 'Không recovery sau quote approval', { method: 'POST', path: '/api/v1/assignments/{{assignmentId}}/recover', role: 'assigned', body: { reason_code: 'cannot_continue' }, key: 'recover-after-quote', expected: 409 });

  // Rescue after_repair permits the non-payment portion of the full travel/repair workflow.
  flow('Dispatch', 'Làm mới idle mechanic trước rescue dispatch', async () => request({ method: 'PUT', path: '/api/v1/mechanics/me/location', role: 'unassigned', body: point, expected: 204 }));
  add('Dispatch', 'Dispatch rescue cho mechanic còn idle', { method: 'POST', path: '/api/v1/service-requests/{{rescueRequestId}}/dispatch', role: 'rider1', expected: 202 });
  flow('Dispatch', 'Busy mechanic bị loại, idle mechanic accept rescue', async () => {
    if (!actors.unassigned || !v.rescueRequestId) block('Thiếu fixture winner/loser');
    const busy = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role: 'assigned', expected: 200 }); ok(!busy.data.items.some(item => item.request_id === v.rescueRequestId && item.status === 'offered'), 'Busy mechanic vẫn nhận offer');
    const idle = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role: 'unassigned', expected: 200 });
    const offer = idle.data.items.find(item => item.request_id === v.rescueRequestId) ?? block('Không có rescue offer cho idle mechanic');
    const accepted = await request({ method: 'POST', path: `/api/v1/dispatch/offers/${offer.id}/accept`, role: 'unassigned', expected: 201 }); v.rescueAssignmentId = accepted.data.id;
  });
  add('Rescue', 'Rescue chưa duyệt labor không được đi', { method: 'POST', path: '/api/v1/assignments/{{rescueAssignmentId}}/status', role: 'unassigned', body: { status: 'en_route' }, expected: 409 });
  const labor = { assignment_id: '{{rescueAssignmentId}}', purpose: 'rescue_labor', labor_pricing: { base_amount: 100000, distance_amount: 20000, weather_amount: 10000, time_amount: 30000, weather: 'rain' } };
  add('Rescue', 'Báo labor trước khi đi', { method: 'POST', path: '/api/v1/service-requests/{{rescueRequestId}}/quotes', role: 'unassigned', body: labor, expected: 201 }, data => { saved('laborQuoteId')(data); eq(data.total_amount, 160000); });
  add('Rescue', 'Approve labor after_repair (chỉ workflow)', { method: 'POST', path: '/api/v1/quotes/{{laborQuoteId}}/approve', role: 'rider1', body: { payment_timing: 'after_repair' }, expected: 200 });
  for (const next of ['en_route', 'on_site', 'diagnosis']) add('Rescue', `Rescue travel → ${next}`, { method: 'POST', path: '/api/v1/assignments/{{rescueAssignmentId}}/status', role: 'unassigned', body: { status: next }, expected: 200 }, data => eq(data.status, next));
  add('Rescue', 'Labor đã duyệt không sửa lại', { method: 'POST', path: '/api/v1/service-requests/{{rescueRequestId}}/quotes', role: 'unassigned', body: { ...labor, labor_pricing: { ...labor.labor_pricing, base_amount: 200000 } }, expected: 409 });
  add('Rescue', 'Final quote chỉ được parts', { method: 'POST', path: '/api/v1/service-requests/{{rescueRequestId}}/quotes', role: 'unassigned', body: { assignment_id: '{{rescueAssignmentId}}', purpose: 'rescue_final', lines: [{ line_type: 'labor', description: 'Double labor', quantity: 1, unit_amount: 100000 }] }, expected: invalid });
  const parts = { assignment_id: '{{rescueAssignmentId}}', purpose: 'rescue_final', lines: [{ line_type: 'part', description: 'Bugi cứu hộ', quantity: 1, unit_amount: 50000 }] };
  add('Rescue', 'Final quote cộng labor cố định', { method: 'POST', path: '/api/v1/service-requests/{{rescueRequestId}}/quotes', role: 'unassigned', body: parts, expected: 201 }, data => { saved('finalQuoteId')(data); eq(data.total_amount, 210000); });
  add('Rescue', 'Reject parts không được bắt đầu sửa', { method: 'POST', path: '/api/v1/quotes/{{finalQuoteId}}/reject', role: 'rider1', expected: 200 });
  add('Rescue', 'Rejected final không in_progress', { method: 'POST', path: '/api/v1/assignments/{{rescueAssignmentId}}/status', role: 'unassigned', body: { status: 'in_progress' }, expected: 409 });
  add('Rescue', 'Báo parts revision', { method: 'POST', path: '/api/v1/service-requests/{{rescueRequestId}}/quotes', role: 'unassigned', body: parts, expected: 201 }, saved('finalQuoteId'));
  add('Rescue', 'Approve parts quay diagnosis', { method: 'POST', path: '/api/v1/quotes/{{finalQuoteId}}/approve', role: 'rider1', body: {}, expected: 200 });
  add('Rescue', 'Bắt đầu sửa sau duyệt parts', { method: 'POST', path: '/api/v1/assignments/{{rescueAssignmentId}}/status', role: 'unassigned', body: { status: 'in_progress' }, expected: 200 });
  add('Rescue', 'Sửa xong tới awaiting_payment, dừng trước payment', { method: 'POST', path: '/api/v1/assignments/{{rescueAssignmentId}}/status', role: 'unassigned', body: { status: 'awaiting_payment' }, expected: 200 });

  add('Recovery', 'Approve mechanic dùng riêng cho recovery/cancel/recall', { method: 'POST', path: '/api/v1/admin/mechanics/{{workflow_id}}/approve', role: 'admin', body: reason, key: 'approve-workflow', expected: 200 });
  add('Recovery', 'Cấu hình mechanic workflow', { method: 'PATCH', path: '/api/v1/mechanics/me/profile', role: 'workflow', body: { service_types: services, service_radius_km: 12 }, expected: 200 });
  add('Recovery', 'Mechanic workflow available', { method: 'PUT', path: '/api/v1/mechanics/me/availability', role: 'workflow', body: { is_available: true }, expected: 200 });
  const workflowJob = async (service = 'mobile_repair') => {
    if (!actors.workflow || !v.motorcycleId) block('Thiếu fixture mechanic workflow/motorcycle');
    await request({ method: 'PUT', path: '/api/v1/mechanics/me/location', role: 'workflow', body: point, expected: 204 });
    const created = await request({ method: 'POST', path: '/api/v1/service-requests', role: 'rider1', body: { ...requestBody, service_type: service }, key: `workflow-${randomUUID()}`, expected: 201 });
    const id = created.data.id;
    await request({ method: 'POST', path: `/api/v1/service-requests/${id}/dispatch`, role: 'rider1', expected: 202 });
    const offers = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role: 'workflow', expected: 200 });
    const offer = offers.data.items.find(item => item.request_id === id) ?? block('Không có offer cho workflow mechanic');
    return { id, offerId: offer.id };
  };
  const acceptJob = async service => {
    const job = await workflowJob(service);
    const accepted = await request({ method: 'POST', path: `/api/v1/dispatch/offers/${job.offerId}/accept`, role: 'workflow', expected: 201 });
    return { ...job, assignmentId: accepted.data.id };
  };
  flow('Dispatch', 'Decline offer, không còn accept được và không assignment', async () => {
    const job = await workflowJob();
    await request({ method: 'POST', path: `/api/v1/dispatch/offers/${job.offerId}/decline`, role: 'workflow', expected: 204 });
    await request({ method: 'POST', path: `/api/v1/dispatch/offers/${job.offerId}/accept`, role: 'workflow', expected: 409 });
    const assignments = await request({ method: 'GET', path: '/api/v1/assignments', role: 'workflow', expected: 200 }); ok(!assignments.data.items.some(item => item.request_id === job.id), 'Decline vẫn tạo assignment');
    await request({ method: 'POST', path: `/api/v1/service-requests/${job.id}/cancel`, role: 'rider1', body: reason, expected: 200 });
  });
  for (const role of ['rider1', 'admin']) flow('Cancellation', `${role} cancel offered đóng mọi offer`, async () => {
    const job = await workflowJob();
    await request({ method: 'POST', path: `${role === 'admin' ? '/api/v1/admin' : '/api/v1'}/service-requests/${job.id}/cancel`, role, body: reason, ...(role === 'admin' ? { key: `cancel-${job.id}` } : {}), expected: 200 });
    const offers = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role: 'workflow', expected: 200 }); ok(!offers.data.items.some(item => item.id === job.offerId), 'Cancel để lại open offer');
    await request({ method: 'POST', path: `/api/v1/dispatch/offers/${job.offerId}/accept`, role: 'workflow', expected: 409 });
    await request({ method: 'POST', path: `/api/v1/service-requests/${job.id}/cancel`, role: 'rider1', body: reason, expected: 409 });
  });
  flow('Recovery', 'Pre-quote recovery/replay/conflict và release mechanic', async () => {
    const job = await acceptJob(); v.recoveredAssignmentId = job.assignmentId;
    await request({ method: 'POST', path: `/api/v1/assignments/${job.assignmentId}/recover`, role: 'workflow', body: { reason_code: 'cannot_continue' }, expected: invalid });
    await request({ method: 'POST', path: `/api/v1/assignments/${job.assignmentId}/recover`, role: 'workflow', body: { reason_code: 'no_show' }, key: 'recover-role-denial', expected: 403 });
    const recovered = await request({ method: 'POST', path: `/api/v1/assignments/${job.assignmentId}/recover`, role: 'admin', body: { reason_code: 'lost_contact' }, key: 'recover-valid', expected: 200 }); eq(recovered.data.status, 'recovery_canceled'); eq(recovered.data.redispatch_status, 'queued');
    const replay = await request({ method: 'POST', path: `/api/v1/assignments/${job.assignmentId}/recover`, role: 'admin', body: { reason_code: 'lost_contact' }, key: 'recover-valid', expected: 200 }); same(replay.data, recovered.data, 'Recovery replay');
    await request({ method: 'POST', path: `/api/v1/assignments/${job.assignmentId}/recover`, role: 'admin', body: { reason_code: 'no_show' }, key: 'recover-valid', expected: 409 });
    const current = await request({ method: 'GET', path: `/api/v1/service-requests/${job.id}`, role: 'rider1', expected: 200 }); eq(current.data.status, 'submitted');
    const assignments = await request({ method: 'GET', path: '/api/v1/assignments', role: 'workflow', expected: 200 }); eq(assignments.data.items.find(item => item.id === job.assignmentId)?.status, 'recovery_canceled');
    await request({ method: 'POST', path: `/api/v1/assignments/${job.assignmentId}/eta`, role: 'workflow', body: {eta_at:'{{future}}'}, key: 'eta-terminal', expected: 409 });
  });
  flow('Cancellation', 'Cancel vs accept race không có canceled request chứa active assignment', async () => {
    const job = await workflowJob();
    const [cancel, accept] = await Promise.all([http('POST', `/api/v1/service-requests/${job.id}/cancel`, 'rider1', reason), http('POST', `/api/v1/dispatch/offers/${job.offerId}/accept`, 'workflow')]);
    ok((cancel.status === 200 && accept.status === 409) || (cancel.status === 409 && accept.status === 201), `Race sai outcomes cancel=${cancel.status} accept=${accept.status}`);
    const current = await request({ method: 'GET', path: `/api/v1/service-requests/${job.id}`, role: 'rider1', expected: 200 }); eq(current.data.status, cancel.status === 200 ? 'canceled' : 'assigned');
    if (accept.status === 201) await request({ method: 'POST', path: `/api/v1/assignments/${accept.data.id}/recover`, role: 'workflow', body: { reason_code: 'cannot_continue' }, key: `recover-race-${job.id}`, expected: 200 });
  });
  flow('Rescue recall', 'Reject labor giải phóng assignment, rider recall đúng mechanic', async () => {
    const job = await acceptJob('emergency_rescue');
    const q = await request({ method: 'POST', path: `/api/v1/service-requests/${job.id}/quotes`, role: 'workflow', body: { ...labor, assignment_id: job.assignmentId }, expected: 201 });
    await request({ method: 'POST', path: `/api/v1/quotes/${q.data.id}/reject`, role: 'rider1', expected: 200 });
    const assignments = await request({ method: 'GET', path: '/api/v1/assignments', role: 'workflow', expected: 200 }); eq(assignments.data.items.find(item => item.id === job.assignmentId)?.status, 'recovery_canceled');
    await request({ method: 'POST', path: `/api/v1/service-requests/${job.id}/rescue-mechanics/${actors.workflow.id}/recall`, role: 'rider2', expected: 403 });
    // RESCUE-WORKFLOW.md specifies the operation/result but leaves its success status unspecified.
    await request({ method: 'POST', path: `/api/v1/service-requests/${job.id}/rescue-mechanics/${actors.workflow.id}/recall`, role: 'rider1', expected: [200, 201, 202] });
    const offers = await request({ method: 'GET', path: '/api/v1/dispatch/offers', role: 'workflow', expected: 200 }); ok(offers.data.items.some(item => item.request_id === job.id), 'Recall không tạo offer');
    await request({ method: 'POST', path: `/api/v1/service-requests/${job.id}/cancel`, role: 'rider1', body: reason, expected: 200 });
  });

  const reminder = { motorcycle_id: '{{motorcycleId}}', title: 'Nhắc bảo dưỡng test', next_due_at: '{{future}}', interval_days: 30, enabled: true };
  add('Reminders', 'Tạo reminder date/time', { method: 'POST', path: '/api/v1/reminders', role: 'rider1', body: reminder, expected: 201 }, saved('reminderId'));
  add('Reminders', 'List chỉ reminder owner', { method: 'GET', path: '/api/v1/reminders', role: 'rider1', expected: 200 }, data => { list(data); ok(data.items.every(item => item.rider_id === actors.rider1.id), 'Reminder list lộ owner'); });
  for (const [body, expected] of [[{ ...reminder, motorcycle_id: '{{foreignMotorcycleId}}' }, 403], [{ ...reminder, interval_days: 0 }, invalid], [{ ...reminder, interval_days: 3651 }, invalid], [{ ...reminder, title: '' }, invalid], [{ ...reminder, title: 'x'.repeat(201) }, invalid], [{ ...reminder, enabled: 'true' }, invalid], [{ ...reminder, next_due_at: 'invalid' }, invalid], [{ ...reminder, odometer_km: 1000 }, invalid]]) add('Reminders', 'Reminder ownership/boundary/no kilometre', { method: 'POST', path: '/api/v1/reminders', role: 'rider1', body, expected });
  for (const suffix of ['', '/snooze']) add('Reminders', 'Rider khác không sửa/snooze reminder', { method: suffix ? 'POST' : 'PATCH', path: `/api/v1/reminders/{{reminderId}}${suffix}`, role: 'rider2', body: suffix ? { until: '{{future}}' } : { ...reminder, enabled: false }, expected: 403 });
  add('Reminders', 'Snooze future', { method: 'POST', path: '/api/v1/reminders/{{reminderId}}/snooze', role: 'rider1', body: { until: '{{future}}' }, expected: 200 });
  add('Reminders', 'Snooze past bị chặn', { method: 'POST', path: '/api/v1/reminders/{{reminderId}}/snooze', role: 'rider1', body: { until: '{{past}}' }, expected: invalid });
  add('Reminders', 'Disable reminder', { method: 'PATCH', path: '/api/v1/reminders/{{reminderId}}', role: 'rider1', body: { ...reminder, enabled: false }, expected: 200 }, data => eq(data.enabled, false));

  for (const role of ['rider1', 'rider2', 'mechanic1', 'mechanic2', 'admin']) {
    add('Notifications', `Inbox ${role}`, { method: 'GET', path: '/api/v1/notifications?limit=2', role, expected: 200 }, data => { list(data); ok(data.items.length <= 2, 'Inbox vượt limit'); if (role === 'rider1' && data.items.length) v.notificationId = data.items[0].id; });
    add('Notifications', `Unread count ${role}`, { method: 'GET', path: '/api/v1/notifications/unread-count', role, expected: 200 }, data => ok(Number.isInteger(data.unread_count) && data.unread_count >= 0, 'Unread count sai'));
  }
  for (const query of ['limit=0', 'limit=101', 'limit=abc', 'cursor=invalid', 'unread_only=wrong']) add('Notifications', `Inbox invalid filter ${query}`, { method: 'GET', path: `/api/v1/notifications?${query}`, role: 'rider1', expected: invalid });
  add('Notifications', 'Mark foreign notification không tiết lộ', { method: 'POST', path: '/api/v1/notifications/{{notificationId}}/read', role: 'rider2', expected: 404 });
  add('Notifications', 'Mark nonexistent notification', { method: 'POST', path: '/api/v1/notifications/{{absent}}/read', role: 'rider1', expected: 404 });
  add('Notifications', 'Mark read owner', { method: 'POST', path: '/api/v1/notifications/{{notificationId}}/read', role: 'rider1', expected: 200 }, data => { ok(!!data.read_at, 'Mark read thiếu timestamp'); v.firstReadAt = data.read_at; });
  add('Notifications', 'Mark read replay giữ timestamp', { method: 'POST', path: '/api/v1/notifications/{{notificationId}}/read', role: 'rider1', expected: 200 }, data => eq(data.read_at, v.firstReadAt));
  add('Notifications', 'Mark read all owner', { method: 'POST', path: '/api/v1/notifications/read-all', role: 'rider1', expected: 200 }, data => ok(Number.isInteger(data.marked_read), 'Thiếu marked_read'));
  add('Notifications', 'Unread count sau mark all = 0', { method: 'GET', path: '/api/v1/notifications/unread-count', role: 'rider1', expected: 200 }, data => eq(data.unread_count, 0));

  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
  const upload = { resource_type: 'service_request', resource_id: '{{requestId}}', purpose: 'problem_photo', content_type: 'image/png', size_bytes: image.length, sha256: createHash('sha256').update(image).digest('hex') };
  for (const body of [{ ...upload, content_type: 'application/x-executable' }, { ...upload, size_bytes: -1 }, { ...upload, sha256: 'invalid' }, { ...upload, resource_type: 'unknown' }, { ...upload, object_key: 'other-user/photo.png' }, { ...upload, raw_media: 'base64' }]) add('Media uploads', 'Signed intent schema/type/path injection', { method: 'POST', path: '/api/v1/media/upload-intents', role: 'rider1', body, key: `bad-upload-${cases.length}`, expected: invalid });
  add('Media uploads', 'Intent resource foreign bị 404', { method: 'POST', path: '/api/v1/media/upload-intents', role: 'rider2', body: upload, key: 'foreign-upload', expected: 404 });
  add('Media uploads', 'Intent nonexistent resource bị 404', { method: 'POST', path: '/api/v1/media/upload-intents', role: 'rider1', body: { ...upload, resource_id: '{{absent}}' }, key: 'absent-upload', expected: 404 });
  flow('Media uploads', 'Signed upload → finalize → replay', async () => {
    const intent = await request({ method: 'POST', path: '/api/v1/media/upload-intents', role: 'rider1', body: upload, key: 'valid-upload', expected: 201 });
    ok(!!intent.data.upload_url && !!intent.data.intent_id, 'Intent thiếu signed URL/id'); v.intentId = intent.data.intent_id;
    const signed = new URL(intent.data.upload_url); eq(signed.origin, new URL(env().SUPABASE_URL).origin, 'Upload phải cùng test Supabase project');
    const uploaded = await fetch(signed, { method: intent.data.upload_method, headers: intent.data.required_headers, body: image, signal: AbortSignal.timeout(30000) }); ok(uploaded.ok, `Signed PUT HTTP ${uploaded.status}`);
    const finalized = await request({ method: 'POST', path: '/api/v1/media/upload-intents/{{intentId}}/finalize', role: 'rider1', body: {}, key: 'finalize-upload', expected: 201 });
    ok(!JSON.stringify(finalized.data).includes('upload_url'), 'Finalize trả signed URL');
    const replay = await request({ method: 'POST', path: '/api/v1/media/upload-intents/{{intentId}}/finalize', role: 'rider1', body: {}, key: 'finalize-upload', expected: [200, 201] }); same(replay.data, finalized.data, 'Finalize replay');
  });

  for (const endpoint of endpoints.filter(endpoint => endpoint.allowed === 'admin' && endpoint.method === 'GET' && !endpoint.path.endsWith('/notes'))) add(endpoint.feature, `Admin read ${endpoint.path}`, { method: 'GET', path: endpoint.path, role: 'admin', expected: 200 });
  for (const route of ['/api/v1/admin/users', '/api/v1/admin/mechanics', '/api/v1/admin/service-requests', '/api/v1/admin/operations/worker-runs']) for (const query of ['limit=0', 'limit=101', 'cursor=invalid']) add('Operations', `Admin filter ${route}?${query}`, { method: 'GET', path: `${route}?${query}`, role: 'admin', expected: invalid });
  for (const body of [{}, { reason: 'short' }, { reason: 'x'.repeat(501) }]) add('Admin users', 'Admin reason required và bounds', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/suspend', role: 'admin', body, key: `bad-reason-${cases.length}`, expected: invalid });
  add('Admin users', 'Suspend rider2 riêng', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/suspend', role: 'admin', body: reason, key: 'suspend-rider2', expected: 200 });
  add('Admin users', 'Suspended user bị chặn', { method: 'GET', path: '/api/v1/motorcycles', role: 'rider2', expected: 403 });
  add('Admin users', 'Suspend replay không tạo event trùng', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/suspend', role: 'admin', body: reason, key: 'suspend-rider2', expected: 200 });
  add('Admin users', 'Suspend same key body khác conflict', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/suspend', role: 'admin', body: { reason: 'Lý do khác cho replay test' }, key: 'suspend-rider2', expected: 409 });
  add('Admin users', 'Reactivate rider2', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/reactivate', role: 'admin', body: reason, key: 'reactivate-rider2', expected: 200 });
  add('Admin users', 'Reactivated user dùng API lại', { method: 'GET', path: '/api/v1/motorcycles', role: 'rider2', expected: 200 });
  add('Admin users', 'Grant role cho fixture rider2', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/roles/grant', role: 'admin', body: { ...reason, role: 'mechanic' }, key: 'grant-role', expected: 200 });
  add('Admin users', 'Revoke role fixture rider2', { method: 'POST', path: '/api/v1/admin/users/{{rider2_id}}/roles/revoke', role: 'admin', body: { ...reason, role: 'mechanic' }, key: 'revoke-role', expected: 200 });
  flow('Admin users', 'Không revoke last admin chỉ khi fixture thực sự là admin cuối', async () => {
    const r = await http('GET', '/rest/v1/user_roles?role=eq.admin&select=user_id', 'anonymous', undefined, { apikey: env().SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env().SUPABASE_SERVICE_ROLE_KEY}` }, { origin: env().SUPABASE_URL, external: true }); status(r, 200);
    if (r.data.length !== 1 || r.data[0].user_id !== actors.admin?.id) block('Project có admin khác; không giả tiền điều kiện last admin');
    await request({ method: 'POST', path: '/api/v1/admin/users/{{admin_id}}/roles/revoke', role: 'admin', body: { ...reason, role: 'admin' }, key: 'revoke-last-admin', expected: 409 });
  });
  add('Admin users', 'Admin revoke device fixture', { method: 'POST', path: '/api/v1/admin/devices/{{deviceId}}/revoke', role: 'admin', body: reason, key: 'revoke-device', expected: 200 });
  add('Admin requests', 'Admin add internal note', { method: 'POST', path: '/api/v1/admin/service-requests/{{requestId}}/notes', role: 'admin', body: { ...reason, note: 'Ghi chú nội bộ HTTP test' }, key: 'internal-note', expected: 201 });
  add('Admin requests', 'Manual escalate request chưa dispatch', { method: 'POST', path: '/api/v1/admin/service-requests/{{other_request}}/manual-escalate', role: 'admin', body: reason, key: 'manual-escalate', expected: 200 });
  add('Admin requests', 'Admin cancel request chưa assign', { method: 'POST', path: '/api/v1/admin/service-requests/{{periodic_maintenance_request}}/cancel', role: 'admin', body: reason, key: 'admin-cancel', expected: 200 });
  for (const body of [{ ...reason, service_types: [] }, { ...reason, service_types: ['invalid'] }]) add('Admin mechanics', 'Admin skills schema', { method: 'PUT', path: '/api/v1/admin/mechanics/{{pending_id}}/skills', role: 'admin', body, key: `bad-skills-${cases.length}`, expected: invalid });
  add('Admin mechanics', 'Admin update pending mechanic skills', { method: 'PUT', path: '/api/v1/admin/mechanics/{{pending_id}}/skills', role: 'admin', body: { ...reason, service_types: ['mobile_repair'] }, key: 'pending-skills', expected: 200 });
  add('Admin mechanics', 'Admin update radius', { method: 'PUT', path: '/api/v1/admin/mechanics/{{pending_id}}/service-radius', role: 'admin', body: { ...reason, service_radius_km: 5 }, key: 'pending-radius', expected: 200 });
  for (const radius of [0, -1, 101]) add('Admin mechanics', 'Admin radius biên', { method: 'PUT', path: '/api/v1/admin/mechanics/{{pending_id}}/service-radius', role: 'admin', body: { ...reason, service_radius_km: radius }, key: `bad-radius-${radius}`, expected: invalid });
  add('Admin mechanics', 'Reject pending mechanic riêng', { method: 'POST', path: '/api/v1/admin/mechanics/{{pending_id}}/reject', role: 'admin', body: reason, key: 'reject-pending', expected: 200 });
  add('Admin mechanics', 'Approve fresh mechanic riêng', { method: 'POST', path: '/api/v1/admin/mechanics/{{fresh_id}}/approve', role: 'admin', body: reason, key: 'approve-fresh', expected: 200 });
  for (const [command, expected] of [['suspend', 200], ['reactivate', 200], ['force-unavailable', 200], ['ban', 200], ['reactivate', 409]]) {
    if (command === 'force-unavailable') flow('Admin mechanics', 'Force available mechanic unavailable', async () => {
      await request({ method: 'PUT', path: '/api/v1/mechanics/me/availability', role: 'fresh', body: { is_available: true }, expected: 200 });
      await request({ method: 'POST', path: '/api/v1/admin/mechanics/{{fresh_id}}/force-unavailable', role: 'admin', body: reason, key: 'force-fresh', expected: 200 });
      const profile = await request({ method: 'GET', path: '/api/v1/mechanics/me/profile', role: 'fresh', expected: 200 }); eq(profile.data.is_available, false);
    });
    else add('Admin mechanics', `Fresh fixture lifecycle ${command} (${expected})`, { method: 'POST', path: `/api/v1/admin/mechanics/{{fresh_id}}/${command}`, role: 'admin', body: reason, key: `fresh-${command}-${cases.length}`, expected });
  }

  flow('Workers', 'Retention dry-run: không xóa dữ liệu', async () => {
    if (!env().INTERNAL_WORKER_SECRET) block('Thiếu worker secret');
    const r = await request({ method: 'POST', path: '/api/v1/internal/workers/retention/run', role: 'anonymous', body: { dry_run: true, limit: 1 }, headers: { 'X-Worker-Secret': env().INTERNAL_WORKER_SECRET }, expected: 200 });
    ok(r.data.mode === 'dry_run' || r.data.mode === 'disabled', 'Retention không phải dry-run/disabled'); ok((r.data.classes ?? []).every(item => item.deleted === 0), 'Dry run xóa dữ liệu');
  });
  for (const route of ['/reminders/run', '/dispatch/run', '/outbox/run', '/media-uploads/cleanup', '/reviews/rebuild-ratings', '/live-locations/cleanup']) flow('Workers', `Worker authorized ${route} cần project cô lập`, async () => {
    if (env().API_TEST_ALLOW_GLOBAL_WORKERS !== 'true') block('Worker có thể xử lý dữ liệu ngoài fixture; chỉ chạy với API_TEST_ALLOW_GLOBAL_WORKERS=true trên project disposable');
    if (!env().INTERNAL_WORKER_SECRET) block('Thiếu worker secret');
    const r = await http('POST', `/api/v1/internal/workers${route}`, 'anonymous', { limit: 1 }, { 'X-Worker-Secret': env().INTERNAL_WORKER_SECRET }); status(r, route === '/live-locations/cleanup' ? 200 : 202);
  });

  add('Chatbot', 'Tạo anonymous session cookie owner', { method: 'POST', path: '/api/chatbot/sessions', role: 'anonymous', expected: 200 }, (data, response) => { ok(typeof data.session_id === 'string', 'Session thiếu id'); v.sessionId = data.session_id; const cookie = response.headers.get('set-cookie'); ok(cookie?.includes('HttpOnly') && cookie?.includes('SameSite=Lax'), 'Ownership cookie không an toàn'); v.chat_cookie = cookie.split(';')[0]; });
  add('Chatbot', 'Session ownership không có credential bị 404', { method: 'GET', path: '/api/chatbot/sessions/{{sessionId}}/diagnosis', role: 'anonymous', expected: 404 });
  add('Chatbot', 'Session ownership sai token bị 404', { method: 'POST', path: '/api/chatbot/sessions/{{sessionId}}/messages', role: 'anonymous', body: { input_mode: 'text', content_text: 'Xe khó đề' }, headers: { 'X-Chatbot-Session-Token': 'wrong-session-token' }, expected: 404 });
  for (const body of [{}, { input_mode: 'text', content_text: '' }, { input_mode: 'text', content_text: '    ' }, { input_mode: 'invalid', content_text: 'Xe khó đề' }, { input_mode: 'text', content_text: 1 }]) add('Chatbot', 'Messages schema/empty text', { method: 'POST', path: '/api/chatbot/sessions/{{sessionId}}/messages', role: 'anonymous', body, headers: { Cookie: '{{chat_cookie}}' }, expected: 400 });
  for (const text of ['Xe khó đề và đèn yếu', 'Xe chạy kêu lạ chưa rõ vị trí', 'Xe bị mất phanh', 'Xe rò xăng và có mùi xăng', 'Xe bị đảo tay lái khi chạy', 'Xe có khói và mùi khét', 'Xe đang chạy thì chết máy']) add('Chatbot', `Diagnosis: ${text}`, { method: 'POST', path: '/api/chatbot/sessions/{{sessionId}}/messages', role: 'anonymous', body: { input_mode: 'text', content_text: text }, headers: { Cookie: '{{chat_cookie}}' }, expected: 200 }, data => {
    v.latestDiagnosis = data;
    ok(typeof data.short_answer === 'string' && data.short_answer.length > 0, 'Thiếu short_answer'); ok(data.overall_confidence >= 0 && data.overall_confidence <= 1, 'Confidence ngoài biên'); ok(['low', 'medium', 'high', 'critical'].includes(data.risk_level), 'Risk invalid');
    ok(Array.isArray(data.top_hypotheses) && data.top_hypotheses.length <= 2, 'Hypotheses quá dài'); ok(Array.isArray(data.followup_questions) && data.followup_questions.length <= 2, 'Followup quá dài');
    if (text !== 'Xe khó đề và đèn yếu' && text !== 'Xe chạy kêu lạ chưa rõ vị trí') { ok(['high', 'critical'].includes(data.risk_level), 'Dangerous symptom không override risk'); eq(data.can_continue_riding, false, 'Dangerous riding'); }
    if (text.includes('chưa rõ')) ok(data.top_hypotheses.some(item => item.component_code === 'UNKNOWN'), 'Vague running noise không được đoán linh kiện'); v.latestDiagnosis = data;
  });
  add('Chatbot', 'Restore diagnosis đúng latest', { method: 'GET', path: '/api/chatbot/sessions/{{sessionId}}/diagnosis', role: 'anonymous', headers: { Cookie: '{{chat_cookie}}' }, expected: 200 }, data => same(data.diagnosis, v.latestDiagnosis, 'Latest diagnosis'));
  add('Chatbot', 'Claim thiếu bearer bị từ chối không lộ session', { method: 'POST', path: '/api/chatbot/sessions/{{sessionId}}/claim', role: 'anonymous', headers: { Cookie: '{{chat_cookie}}' }, expected: 404 });
  add('Chatbot', 'Claim có JWT nhưng thiếu cookie bị 404', { method: 'POST', path: '/api/chatbot/sessions/{{sessionId}}/claim', role: 'rider1', expected: 404 });
  add('Chatbot', 'Claim với đủ JWT và cookie', { method: 'POST', path: '/api/chatbot/sessions/{{sessionId}}/claim', role: 'rider1', headers: { Cookie: '{{chat_cookie}}' }, expected: 200 }, data => { eq(data.claimed, true); eq(data.owner_user_id, actors.rider1.id); });
  add('Chatbot', 'Sau claim owner JWT restore', { method: 'GET', path: '/api/chatbot/sessions/{{sessionId}}/diagnosis', role: 'rider1', expected: 200 });
  add('Chatbot', 'Sau claim rider khác không restore', { method: 'GET', path: '/api/chatbot/sessions/{{sessionId}}/diagnosis', role: 'rider2', expected: 404 });
  add('Chatbot', 'Anonymous cookie cũ không còn quyền sau claim', { method: 'GET', path: '/api/chatbot/sessions/{{sessionId}}/diagnosis', role: 'anonymous', headers: { Cookie: '{{chat_cookie}}' }, expected: 404 });
  flow('ASR', 'Reject multipart thiếu file/sai WAV', async () => {
    if (!v.sessionId || !actors.rider1) block('Thiếu claimed session fixture');
    status(await http('POST', '/api/chatbot/sessions/{{sessionId}}/transcriptions', 'rider1', new FormData()), 400);
    const form = new FormData(); form.append('audio_file', new Blob(['not-wav'], { type: 'audio/wav' }), 'invalid.wav'); status(await http('POST', '/api/chatbot/sessions/{{sessionId}}/transcriptions', 'rider1', form), 400);
  });
  flow('ASR', 'WAV thật → transcription → text diagnosis', async () => {
    const file = env().API_TEST_WAV_PATH;
    if (!file || !existsSync(file)) block('Chưa có API_TEST_WAV_PATH/models ONNX hợp lệ');
    const form = new FormData(); form.append('audio_file', new Blob([readFileSync(file)], {type:'audio/wav'}), 'http-test.wav');
    const r = await http('POST', '/api/chatbot/sessions/{{sessionId}}/transcriptions', 'rider1', form); status(r, 200); ok(typeof r.data.transcribed_text === 'string' && r.data.transcribed_text.length > 0, 'ASR text rỗng');
    if (env().API_TEST_WAV_EXPECTED_TEXT) ok(r.data.transcribed_text.includes(env().API_TEST_WAV_EXPECTED_TEXT), 'Transcript không khớp expected');
    status(await http('POST', '/api/chatbot/sessions/{{sessionId}}/messages', 'rider1', {input_mode:'text',content_text:r.data.transcribed_text}), 200);
  });
  flow('Chatbot', 'Rate limit valid text tối đa 10/hour theo task T006', async () => {
    if (!v.sessionId || !actors.rider1) block('Thiếu session fixture');
    let limited;
    for (let i = 0; i < 12; i++) { const r = await http('POST', '/api/chatbot/sessions/{{sessionId}}/messages', 'rider1', { input_mode: 'text', content_text: 'Xe khó đề và đèn yếu' }); if (r.status === 429) { limited = r; break; } status(r, 200); }
    ok(!!limited, '12 valid messages không có 429 theo limit 10/hour'); ok(!!limited.headers.get('retry-after'), '429 thiếu Retry-After');
  });
  flow('RLS', 'Supabase REST chỉ thấy motorcycle owner bằng user JWT', async () => {
    if (!v.motorcycleId || !v.foreignMotorcycleId) block('Thiếu motorcycles fixture');
    for (const role of ['rider1', 'rider2']) {
      const r = await http('GET', `/rest/v1/motorcycles?select=id,rider_id&id=in.(${v.motorcycleId},${v.foreignMotorcycleId})`, role, undefined, { apikey: env().SUPABASE_PUBLISHABLE_KEY }, { origin: env().SUPABASE_URL, external: true }); status(r, 200);
      ok(Array.isArray(r.data) && r.data.length === 1, 'RLS thiếu/đọc chéo rows'); eq(r.data[0].rider_id, actors[role].id, 'RLS ownership');
    }
  });
  return cases;
}
