import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCases, endpoints, manualCases } from './cases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'tests/http');
const requireApi = createRequire(path.join(root, 'apps/api/package.json'));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const values = { absent: randomUUID(), run_id: runId, future: new Date(Date.now() + 86400000).toISOString(), past: new Date(Date.now() - 86400000).toISOString() };
const actors = {};
const createdUsers = [];
const cleanup = [];
const secrets = new Set();
const results = [];
const calls = [];
const readOnly = process.argv.includes('--read-only');
const recheckIndex = process.argv.indexOf('--recheck');
const reuseId = recheckIndex < 0 ? null : process.argv[recheckIndex + 1];
const workflowsOnly = process.argv.includes('--workflows-only');
const reviewsOnly = process.argv.includes('--reviews-only');
let planned = 752;
let server;
let activeCase;

class Blocked extends Error {}
const block = reason => { throw new Blocked(reason); };
const eq = (actual, expected, label = 'Giá trị') => assert.ok(Object.is(actual, expected), `${label} không đúng hợp đồng`);
const same = (actual, expected, label = 'JSON') => { try { assert.deepStrictEqual(actual, expected); } catch { throw new Error(`${label} không đúng hợp đồng`); } };
const ok = (condition, message) => assert.ok(condition, message);
const idempotencyKeys = {};
const key = name => idempotencyKeys[name] ??= `http-${runId}-${name}`;
function resolve(value) {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{([^}]+)\}\}$/);
    if (exact) return values[exact[1]] ?? block(`Thiếu fixture ${exact[1]}`);
    return value.replace(/\{\{([^}]+)\}\}/g, (_, name) => String(values[name] ?? block(`Thiếu fixture ${name}`)));
  }
  if (Array.isArray(value)) return value.map(resolve);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, resolve(item)]));
  return value;
}
function sanitized(message) {
  let result = String(message);
  for (const secret of secrets) if (secret.length >= 8) result = result.split(secret).join('[REDACTED]');
  return result.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/postgres(?:ql)?:\/\/\S+/gi, '[DATABASE_URL]').slice(0, 500);
}
function noSecrets(body) {
  const text = JSON.stringify(body);
  for (const secret of secrets) if (secret.length >= 8) ok(!text.includes(secret), 'Response lộ credential');
  ok(!/"(?:access_token|refresh_token|service_role_key|device_key_hash|push_token_ciphertext|private_key|stack)"\s*:/i.test(text), 'Response lộ trường nội bộ hoặc credential');
}
async function http(method, route, role = 'anonymous', body, headers = {}, options = {}) {
  const caseId = activeCase;
  const origin = options.origin ?? process.env.API_TEST_BASE_URL ?? 'http://127.0.0.1:3100';
  const authorization = role === 'invalid' ? 'Bearer invalid.jwt.token' : actors[role]?.token ? `Bearer ${actors[role].token}` : undefined;
  if (!['anonymous', 'invalid'].includes(role) && !authorization) block(`Không có JWT cho ${role}`);
  const start = Date.now();
  const response = await fetch(`${origin}${resolve(route)}`, {
    method, headers: { ...(authorization ? { Authorization: authorization } : {}), ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...resolve(headers) },
    body: body === undefined ? undefined : body instanceof FormData ? body : options.raw ? body : JSON.stringify(resolve(body)),
    redirect: 'manual', signal: AbortSignal.timeout(Number(process.env.API_TEST_TIMEOUT_MS ?? 45000))
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  const call = { case_id: caseId, method, path: resolve(route), role, status: response.status, elapsed_ms: Date.now() - start, error_code: data?.error_code ?? data?.error?.code ?? null };
  calls.push(call);
  if (!options.external) {
    if (response.status !== 204) {
      ok(response.headers.get('content-type')?.includes('application/json'), `HTTP ${response.status}: response không phải JSON`);
      ok(data !== null, 'JSON response rỗng/sai');
    }
    noSecrets(data);
    if (response.status >= 400) {
      ok(typeof (data?.error_code ?? data?.error?.code) === 'string', 'Error thiếu mã lỗi theo tài liệu');
      ok(!/\b(?:SELECT|INSERT INTO|UPDATE public\.|node_modules|Error:|at async)\b/.test(JSON.stringify(data)), 'Error lộ SQL/stack');
    }
  }
  return { status: response.status, data, headers: response.headers };
}
function status(response, expected) {
  const statuses = Array.isArray(expected) ? expected : [expected];
  ok(statuses.includes(response.status), `Mong HTTP ${statuses.join('/')} nhưng nhận ${response.status} (${response.data?.error_code ?? response.data?.error?.code ?? 'không có mã lỗi'})`);
}
async function request(spec) {
  const response = await http(spec.method, spec.path, spec.role, spec.body, spec.key ? { 'X-Idempotency-Key': key(spec.key), ...spec.headers } : spec.headers, spec.options);
  status(response, spec.expected);
  return response;
}
const context = { http, request, status, eq, same, ok, block, values, actors, key, resolve, env: () => process.env };
const cases = buildCases(context);

function inventory() {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name === 'route.ts' ? [path.join(dir, entry.name)] : []);
  const routes = walk(path.join(root, 'apps/api/app/api')).map(file => '/api/' + path.relative(path.join(root, 'apps/api/app/api'), path.dirname(file)).replaceAll('\\', '/').replace(/\[([^\]]+)\]/g, '{$1}'));
  const excluded = routes.filter(route => /payment/.test(route));
  const missing = routes.filter(route => !excluded.includes(route) && !endpoints.some(endpoint => endpoint.path.replace(/\{\{([^}]+)\}\}/g, '{$1}') === route));
  return { route_directories: routes.length, excluded_payment: excluded, unmapped: missing };
}
function exportCatalogue() {
  mkdirSync(directory, { recursive: true });
  const catalogue = cases.map(({ run, ...test }) => test);
  writeFileSync(path.join(directory, 'test-cases.json'), JSON.stringify({ sources: ['AGENTS.md', 'apps/api/README.md', 'apps/api/RESCUE-WORKFLOW.md', 'specs/*/contracts/*', 'specs/*/spec.md'], approach: 'Black-box HTTP; không đọc implementation hoặc unit test để tạo oracle.', cases: catalogue, manual: manualCases, inventory: inventory() }, null, 2));
  const rows = catalogue.map(test => `| ${test.id} | ${test.feature} | ${test.request?.role ?? 'workflow'} | ${test.request ? `${test.request.method} ${test.request.path}` : 'Nhiều request trong cases.mjs'} | ${test.expectation.replaceAll('|', '/')} | ${test.name.replaceAll('|', '/')} |`);
  writeFileSync(path.join(directory, 'TEST-CASES.md'), ['# Catalogue kiểm thử HTTP', '', 'Chi tiết payload/headers trong test-cases.json; assertion nghiệp vụ trong cases.mjs. Mapped route không có nghĩa mọi case đã chạy/pass. Payment ngoài phạm vi.', '', '| ID | Feature | Role | Request | Expected | Case |', '|---|---|---|---|---|---|', ...rows, '', '## Tiền điều kiện bổ sung', '', ...manualCases.map(test => `- **${test.id} ${test.name}**: ${test.expected}. Cần: ${test.requires}.`), ''].join('\n'));
  const variables = new Set(['base_url', 'supabase_url', 'supabase_publishable_key', 'rider1_token', 'rider2_token', 'mechanic1_token', 'mechanic2_token', 'pending_token', 'admin_token', 'worker_secret']);
  const items = catalogue.filter(test => test.request && !test.request.contract_gap).map(test => {
    const spec = test.request;
    const rawBody = spec.body === undefined ? undefined : JSON.stringify(spec.body, null, 2);
    for (const text of [spec.path, rawBody ?? '']) for (const match of text.matchAll(/\{\{([^}]+)\}\}/g)) variables.add(match[1]);
    const expected = Array.isArray(spec.expected) ? spec.expected : [spec.expected];
    const bearer = spec.role === 'invalid' ? 'invalid.jwt.token' : `{{${spec.role}_token}}`;
    if (!['anonymous', 'invalid'].includes(spec.role)) variables.add(`${spec.role}_token`);
    const keyVariable = spec.key ? `key_${spec.key.replace(/[^a-z0-9]/gi, '_')}` : null;
    if (keyVariable) variables.add(keyVariable);
    const header = [ ...(spec.role !== 'anonymous' ? [{ key: 'Authorization', value: `Bearer ${bearer}` }] : []), ...(rawBody ? [{ key: 'Content-Type', value: 'application/json' }] : []), ...(keyVariable ? [{ key: 'X-Idempotency-Key', value: `{{${keyVariable}}}` }] : []), ...Object.entries(spec.headers ?? {}).map(([key, value]) => ({key, value})) ];
    return { name: `${test.id} ${test.name}`, request: { method: spec.method, header, url: `{{base_url}}${spec.path}`, ...(rawBody ? { body: { mode: 'raw', raw: rawBody, options: { raw: { language: 'json' } } } } : {}), description: `${test.feature}; role=${spec.role}. ${test.expectation ?? ''} ${spec.key ? 'Replay/conflict dùng cùng biến key, đổi test_run_id khi bắt đầu run mới.' : ''} Runner Node kiểm tra đầy đủ invariant workflow.` }, event: [ ...(keyVariable ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: [`if (!pm.collectionVariables.get('test_run_id')) pm.collectionVariables.set('test_run_id', pm.variables.replaceIn('{{$guid}}'));`, `if (!pm.collectionVariables.get('${keyVariable}')) pm.collectionVariables.set('${keyVariable}', 'http-' + pm.collectionVariables.get('test_run_id') + '-${keyVariable}');`] } }] : []), { listen: 'test', script: { type: 'text/javascript', exec: [`pm.test('HTTP theo hợp đồng', () => pm.expect(${JSON.stringify(expected)}).to.include(pm.response.code));`, "pm.test('Không lỗi 5xx', () => pm.expect(pm.response.code).to.be.below(500));", "if (pm.response.code !== 204) pm.test('JSON response', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json'));", "if (pm.response.code >= 400) pm.test('Error có mã lỗi', () => { const d = pm.response.json(); pm.expect(d.error_code || (d.error && d.error.code)).to.be.a('string'); });" ] } }] };
  });
  variables.add('test_run_id');
  writeFileSync(path.join(directory, 'careonroad.postman_collection.json'), JSON.stringify({ info: { name: 'CareOnRoad black-box API — no payment', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Không chứa secrets. Case workflow tổng hợp/chạy đồng thời ở runner Node; collection chứa từng request đã khai báo. Điền fixture/JWT test trước khi chạy, không Run All vào production.' }, variable: [...variables].map(key => ({ key, value: key === 'base_url' ? 'http://127.0.0.1:3100' : '' })), item: items }, null, 2));
  console.log(`Catalogue: ${cases.length} automated cases, ${manualCases.length} manual/infrastructure cases; ${items.length} Postman requests.`);
}
exportCatalogue();
if (process.argv.includes('--list')) process.exit(0);
if (process.argv.includes('--self-check')) {
  vSelfCheck();
  console.log('Runner self-check PASS: placeholder types, missing fixtures, exact status, secret redaction, payment exclusion, unique case ids.');
  process.exit(0);
}
function vSelfCheck() {
  values.check_number = 7;
  eq(resolve('{{check_number}}'), 7);
  eq(resolve('x/{{check_number}}'), 'x/7');
  const stableKey = key('/eta'); values['/eta'] = randomUUID(); eq(key('/eta'), stableKey, 'Idempotency key độc lập fixture');
  same({ a: 1, b: 2 }, { b: 2, a: 1 });
  delete values['/eta']; delete idempotencyKeys['/eta'];
  assert.throws(() => resolve('{{not_defined}}'), Blocked);
  assert.throws(() => status({status: 500, data: {}}, 200));
  secrets.add('self-check-secret'); eq(sanitized('self-check-secret'), '[REDACTED]');
  assert.throws(() => noSecrets({ leaked: 'self-check-secret' }));
  ok(endpoints.every(endpoint => !/payment/.test(endpoint.path)), 'Payment route trong catalogue');
  eq(new Set(cases.map(test => test.id)).size, cases.length);
  ok(!/[?#&](?:access_token|refresh_token|code)=/.test('http://localhost/#error_code=bad_oauth_state'), 'error_code không phải authorization code');
  eq(inventory().unmapped.length, 0, 'Có route ngoài payment chưa mapping');
  delete values.check_number; secrets.delete('self-check-secret');
}

for (const file of ['.env', '.env.local', 'apps/api/.env', 'apps/api/.env.local']) if (existsSync(path.join(root, file))) process.loadEnvFile(path.join(root, file));
for (const [name, value] of Object.entries(process.env)) if (/KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL/.test(name) && value) secrets.add(value);

async function provision() {
  if (process.env.API_TEST_ALLOW_MUTATIONS !== 'true') block('Cần API_TEST_ALLOW_MUTATIONS=true để tạo tài khoản/dữ liệu riêng trên dev/test');
  const origin = process.env.SUPABASE_URL;
  if (!origin || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_PUBLISHABLE_KEY) block('Thiếu cấu hình Supabase fixture');
  const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  for (const role of ['rider1', 'rider2', 'mechanic1', 'mechanic2', 'pending', 'admin', 'fresh', 'workflow']) {
    const password = randomBytes(24).toString('base64url');
    secrets.add(password);
    const email = `http-${runId}-${role}@example.com`;
    const userResponse = await fetch(`${origin}/auth/v1/admin/users`, { method: 'POST', headers, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: `HTTP Test ${role}`, http_test_run: runId } }), signal: AbortSignal.timeout(30000) });
    if (userResponse.status !== 200 && userResponse.status !== 201) block(`Không tạo được fixture Auth ${role}: HTTP ${userResponse.status}`);
    const user = await userResponse.json();
    createdUsers.push({ role, id: user.id });
    const login = await fetch(`${origin}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(30000) });
    const auth = await login.json();
    if (login.status !== 200 || !auth.access_token) block(`Không đăng nhập được fixture ${role}: HTTP ${login.status}`);
    secrets.add(auth.access_token); if (auth.refresh_token) secrets.add(auth.refresh_token);
    actors[role] = { id: user.id, token: auth.access_token, refresh: auth.refresh_token };
    values[role === 'rider1' ? 'userId' : `${role}_id`] = user.id;
    if (role === 'mechanic1') values.mechanicId = user.id;
    if (role !== 'fresh') {
      const account_type = ['mechanic1', 'mechanic2', 'pending', 'workflow'].includes(role) ? 'mechanic' : 'rider';
      const profile = await http('POST', '/api/v1/auth/profile', role, { account_type });
      if (profile.status !== 200) block(`Bootstrap ${role}: HTTP ${profile.status}; migration/account_type có thể chưa khớp tài liệu`);
      eq(profile.data.id, user.id, 'Actor id');
    }
  }
  // Fixture setup only: one test administrator. Assertions never use service-role JWT.
  const grant = await fetch(`${origin}/rest/v1/user_roles`, { method: 'POST', headers, body: JSON.stringify({ user_id: actors.admin.id, role: 'admin' }), signal: AbortSignal.timeout(30000) });
  if (grant.status !== 201) block(`Không cấp được admin cho fixture riêng: HTTP ${grant.status}`);
  values.fixture_ready = true;
}
async function startServer() {
  if (process.env.API_TEST_BASE_URL) return;
  server = spawn(process.execPath, [requireApi.resolve('next/dist/bin/next'), 'dev', '-p', '3100', '-H', '127.0.0.1'], { cwd: path.join(root, 'apps/api'), env: { ...process.env, GEMINI_API_KEY: '', OPENROUTER_API_KEY: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  // Do not echo application logs: a database/provider error might include credentials.
  server.stdout.on('data', () => {}); server.stderr.on('data', () => {});
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const result = await fetch('http://127.0.0.1:3100/api/v1/internal/health/live', { signal: AbortSignal.timeout(2000) }); if (result.status === 200) return; } catch {}
    if (server.exitCode !== null) block(`API server kết thúc với exit ${server.exitCode}`);
    await new Promise(done => setTimeout(done, 1000));
  }
  block('API server không sẵn sàng trong 60 giây');
}
async function execute(test) {
  activeCase = test.id;
  const start = Date.now();
  let outcome = 'PASS'; let reason = '';
  try { await test.run(); } catch (error) { outcome = error instanceof Blocked ? 'BLOCKED' : 'FAIL'; reason = sanitized(error.message); }
  results.push({ id: test.id, feature: test.feature, name: test.name, status: outcome, reason, elapsed_ms: Date.now() - start });
  if (outcome !== 'PASS' || results.length % 25 === 0) console.log(`${test.id} ${outcome}${reason ? `: ${reason}` : ` (${results.length}/${planned})`}`);
  writeFileSync(path.join(directory, 'progress.json'), JSON.stringify({ run_id: runId, completed: results.length, planned, counts: counts(), last: results.at(-1) }, null, 2));
}
async function recheck() {
  ok(process.env.API_TEST_ALLOW_MUTATIONS === 'true', 'Recheck cần mutation authorization');
  ok(reuseId && path.basename(reuseId) === reuseId, 'Run ID không hợp lệ');
  const source = JSON.parse(readFileSync(path.join(directory, 'reports', reuseId, 'results.json')));
  eq(source.run_id, reuseId); eq(Object.keys(source.fixtures).length, 8, 'Chỉ reuse đúng tám fixture');
  const adminHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  for (const role of ['rider1', 'rider2', 'mechanic1', 'mechanic2', 'pending', 'admin', 'fresh', 'workflow']) {
    const id = source.fixtures[role]?.id;
    ok(/^[0-9a-f-]{36}$/i.test(id ?? ''), 'Fixture ID không hợp lệ');
    const fetched = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: adminHeaders, signal: AbortSignal.timeout(15000) }); status({ status: fetched.status }, 200);
    const payload = await fetched.json(); const user = payload.user ?? payload;
    eq(user.user_metadata?.http_test_run, reuseId, 'Không được đổi user ngoài run gốc');
    eq(user.user_metadata?.full_name, `HTTP Test ${role}`, 'Role fixture không khớp');
    createdUsers.push({ role, id });
    const password = randomBytes(24).toString('base64url'); secrets.add(password);
    const updated = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ password, ban_duration: 'none' }), signal: AbortSignal.timeout(15000) }); status({status:updated.status}, 200);
    const login = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password }), signal: AbortSignal.timeout(15000) }); status({status:login.status}, 200);
    const auth = await login.json(); ok(!!auth.access_token, 'Login thiếu token'); secrets.add(auth.access_token); if (auth.refresh_token) secrets.add(auth.refresh_token);
    actors[role] = { id, token: auth.access_token, refresh: auth.refresh_token };
    values[role === 'rider1' ? 'userId' : `${role}_id`] = id;
  }
  // Recover only UUID placeholders from the sanitized trace, never credentials.
  for (const test of cases.filter(test => test.request)) {
    const names = [];
    const pattern = test.request.path.split(/(\{\{[^}]+\}\})/).map(part => {
      const name = part.match(/^\{\{([^}]+)\}\}$/)?.[1];
      if (name) { names.push(name); return '([0-9a-f-]{36})'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    const trace = source.calls.find(call => call.case_id === test.id && call.method === test.request.method);
    const match = trace?.path.match(new RegExp(`^${pattern}$`, 'i'));
    if (match) names.forEach((name, i) => { if (name !== 'absent') values[name] ??= match[i + 1]; });
  }
  const winner = source.calls.find(call => call.path.endsWith('/accept') && call.status === 201 && ['mechanic1', 'mechanic2'].includes(call.role))?.role;
  ok(!!winner, 'Thiếu winner gốc'); actors.assigned = actors[winner]; actors.unassigned = actors[winner === 'mechanic1' ? 'mechanic2' : 'mechanic1'];
  const otherBike = await request({method:'GET', path:'/api/v1/motorcycles', role:'rider2', expected:200}); values.foreignMotorcycleId = otherBike.data.items[0]?.id;
  const runIds = async ids => { for (const id of ids) { const test = cases.find(test => test.id === id); ok(!!test, `Case ${id} không tồn tại`); await execute(test); } };
  const custom = (id, feature, name, run) => execute({ id, feature, name, run });
  if (reviewsOnly) {
    let assignmentId; let requestId; let review; let replayKey;
    const fixturePatch = async (table, id, ownerField, ownerId, body) => {
      const r = await http('PATCH', `/rest/v1/${table}?id=eq.${id}&${ownerField}=eq.${ownerId}&select=id,status`, 'anonymous', body, {...adminHeaders, Prefer:'return=representation'}, {origin:process.env.SUPABASE_URL,external:true});
      status(r,200); eq(r.data.length,1,'Chỉ đổi một fixture row'); eq(r.data[0].id,id); eq(r.data[0].status,body.status);
    };
    await custom('REVIEW-PREPARE', 'Fixtures', 'Chuẩn bị completed assignment test riêng, không payment', async () => {
      const jobs = await request({method:'GET',path:'/api/v1/assignments',role:'workflow',expected:200});
      const candidates = jobs.data.items.filter(item => item.status === 'diagnosis' && item.mechanic_id === actors.workflow.id); eq(candidates.length,1,'Chọn đúng metadata fixture riêng');
      assignmentId = candidates[0].id; requestId = candidates[0].request_id;
      const req = await request({method:'GET',path:`/api/v1/service-requests/${requestId}`,role:'rider1',expected:200}); eq(req.data.rider_id,actors.rider1.id); eq(req.data.problem_description,'Assignment recheck độc lập');
      const quotes = await request({method:'GET',path:`/api/v1/service-requests/${requestId}/quotes`,role:'rider1',expected:200}); eq(quotes.data.items.length,0,'Không đổi fixture có quote/payment');
      await fixturePatch('assignments',assignmentId,'mechanic_id',actors.workflow.id,{status:'completed',completed_at:new Date().toISOString()});
    });
    await custom('REVIEW-STATE-MISMATCH', 'Reviews', 'Assignment completed nhưng request chưa completed bị 409', async () => request({method:'POST',path:`/api/v1/assignments/${assignmentId}/review`,role:'rider1',body:{rating:5},key:'review-mismatch',expected:409}));
    await custom('REVIEW-COMPLETE-FIXTURE', 'Fixtures', 'Chuẩn bị request completed của đúng owning rider', async () => fixturePatch('service_requests',requestId,'rider_id',actors.rider1.id,{status:'completed'}));
    await custom('REVIEW-COMPLETED-ROLES', 'Reviews', 'Foreign rider/admin/mechanic không review completed fixture', async () => {
      for (const role of ['rider2','admin','workflow']) await request({method:'POST',path:`/api/v1/assignments/${assignmentId}/review`,role,body:{rating:5},key:`completed-review-${role}`,expected:role==='workflow'?403:404});
    });
    await custom('REVIEW-COMMENT-BOUNDARIES', 'Reviews', 'Whitespace/oversized comment và rider identity injection', async () => {
      for (const body of [{rating:5,comment:'  '},{rating:5,comment:'x'.repeat(1001)},{rating:5,rider_id:actors.rider2.id}]) await request({method:'POST',path:`/api/v1/assignments/${assignmentId}/review`,role:'rider1',body,key:`review-bad-${randomUUID()}`,expected:[400,422]});
    });
    await custom('HTTP-0587', 'Reviews', 'Completed review concurrency/replay/immutable/aggregate', async () => {
      const body = {rating:5,comment:'Review privacy marker'};
      const responses = await Promise.all([0,1,2,3].map(async i => ({i,...await http('POST',`/api/v1/assignments/${assignmentId}/review`,'rider1',body,{'X-Idempotency-Key':key(`review-race-${i}`)})})));
      for (const response of responses) status(response,[200,201,409]);
      const first = responses.find(response => response.status === 201) ?? block('Không có review created trong race'); review = first.data; replayKey = `review-race-${first.i}`;
      for (const response of responses) { const retry = await request({method:'POST',path:`/api/v1/assignments/${assignmentId}/review`,role:'rider1',body,key:`review-race-${response.i}`,expected:[200,201]}); eq(retry.data.id,review.id,'Concurrent retry không được duplicate'); }
      eq(review.rating,5); eq(review.mechanic_id,actors.workflow.id); eq(review.mechanic_rating.average,5); eq(review.mechanic_rating.count,1);
      ok(!('rider_id' in review) && !('idempotency_key' in review),'Review lộ identity/key');
      const rows = await http('GET',`/rest/v1/service_reviews?assignment_id=eq.${assignmentId}&select=id,rating`,'anonymous',undefined,adminHeaders,{origin:process.env.SUPABASE_URL,external:true}); status(rows,200); eq(rows.data.length,1,'Chỉ một immutable review row');
      const replay = await request({method:'POST',path:`/api/v1/assignments/${assignmentId}/review`,role:'rider1',body,key:replayKey,expected:[200,201]}); same(replay.data,review,'Canonical review replay');
      for (const name of [replayKey,'different-review-key']) await request({method:'POST',path:`/api/v1/assignments/${assignmentId}/review`,role:'rider1',body:{rating:1,comment:'Đổi review bị chặn'},key:name,expected:409});
    });
    await custom('REVIEW-SECOND-AGGREGATE', 'Reviews', 'Hai review độc lập: average 3.5, count 2', async () => {
      await request({method:'PUT',path:'/api/v1/mechanics/me/availability',role:'workflow',body:{is_available:true},expected:200});
      await request({method:'PUT',path:'/api/v1/mechanics/me/location',role:'workflow',body:{latitude:11.712345,longitude:107.312345},expected:204});
      const created = await request({method:'POST',path:'/api/v1/service-requests',role:'rider1',body:{motorcycle_id:'{{motorcycleId}}',service_type:'mobile_repair',problem_description:'Fixture review aggregate thứ hai',location:{latitude:11.712345,longitude:107.312345}},key:'review-second-request',expected:201});
      await request({method:'POST',path:`/api/v1/service-requests/${created.data.id}/dispatch`,role:'rider1',expected:202});
      const offers = await request({method:'GET',path:'/api/v1/dispatch/offers',role:'workflow',expected:200}); const offer = offers.data.items.find(item=>item.request_id===created.data.id) ?? block('Thiếu offer fixture review');
      const accepted = await request({method:'POST',path:`/api/v1/dispatch/offers/${offer.id}/accept`,role:'workflow',expected:201});
      await fixturePatch('assignments',accepted.data.id,'mechanic_id',actors.workflow.id,{status:'completed',completed_at:new Date().toISOString()});
      await fixturePatch('service_requests',created.data.id,'rider_id',actors.rider1.id,{status:'completed'});
      const second = await request({method:'POST',path:`/api/v1/assignments/${accepted.data.id}/review`,role:'rider1',body:{rating:2},key:'second-review',expected:201}); eq(second.data.mechanic_rating.average,3.5); eq(second.data.mechanic_rating.count,2);
      const profile = await request({method:'GET',path:'/api/v1/mechanics/me/profile',role:'workflow',expected:200}); eq(profile.data.rating_avg,3.5); eq(profile.data.rating_count,2);
    });
    return;
  }
  const isolatedWorkflows = async () => {
    // Admin grant in the full run created this own pending mechanic profile.
    // Keep the diagnosis fixture unchanged; do not recover ineligible work.
    actors.workflow = actors.rider2; values.workflow_id = actors.rider2.id;
    await custom('RECHECK-IDLE-MECHANIC', 'Fixtures', 'Approve idle mechanic profile của rider2 fixture riêng', async () => {
      const profile = await request({method:'GET',path:'/api/v1/mechanics/me/profile',role:'workflow',expected:200});
      if (profile.data.profile_status === 'pending') await request({method:'POST',path:'/api/v1/admin/mechanics/{{workflow_id}}/approve',role:'admin',body:{reason:'Chuẩn bị mechanic fixture riêng cho workflow recheck'},key:'approve-idle-recheck',expected:200});
      else eq(profile.data.profile_status,'active','Fixture mechanic cần pending/active');
      const jobs = await request({method:'GET',path:'/api/v1/mechanics/me/jobs?active_only=true',role:'workflow',expected:200}); eq(jobs.data.items.length,0,'Fixture workflow phải idle');
    });
    await runIds(['HTTP-0608','HTTP-0609','HTTP-0610','HTTP-0611','HTTP-0612','HTTP-0613','HTTP-0614','HTTP-0615']);
    await custom('HTTP-0717', 'Admin mechanics', 'Force available idle fixture unavailable', async () => {
      await request({method:'PUT',path:'/api/v1/mechanics/me/availability',role:'workflow',body:{is_available:true},expected:200});
      await request({method:'POST',path:'/api/v1/admin/mechanics/{{workflow_id}}/force-unavailable',role:'admin',body:{reason:'Kiểm thử force-unavailable riêng'},key:'force-idle-workflow',expected:200});
      const r = await request({method:'GET',path:'/api/v1/mechanics/me/profile',role:'workflow',expected:200}); eq(r.data.is_available,false);
    });
  };
  if (workflowsOnly) { await isolatedWorkflows(); return; }
  const original = { assignmentId: values.assignmentId, requestId: values.requestId, assigned: actors.assigned, unassigned: actors.unassigned };
  await runIds(['OAUTH-01','OAUTH-02','HTTP-0010','HTTP-0011','HTTP-0065','HTTP-0081','HTTP-0084','HTTP-0128','HTTP-0367','HTTP-0368','HTTP-0369','HTTP-0370','HTTP-0371','HTTP-0409','HTTP-0429','HTTP-0435','HTTP-0490','HTTP-0491','HTTP-0492','HTTP-0493','HTTP-0494','HTTP-0495','HTTP-0496','HTTP-0500','HTTP-0504','HTTP-0505','HTTP-0506','HTTP-0507','HTTP-0589','HTTP-0626','HTTP-0630','HTTP-0660','HTTP-0700']);
  await custom('HTTP-0366', 'Auth', 'Account type bất biến trên workflow fixture (fresh đã bị ban nghiệp vụ)', async () => {
    const r = await request({method:'POST',path:'/api/v1/auth/profile',role:'workflow',body:{account_type:'rider'},expected:[200,409]});
    if (r.status === 200) ok(r.data.roles.includes('mechanic') && !r.data.roles.includes('rider'), 'Account type bị thay đổi');
  });
  await custom('RECHECK-PREPARE', 'Fixtures', 'Tạo assignment mới trên workflow fixture cho metadata/diagnosis', async () => {
    await request({method:'PUT',path:'/api/v1/mechanics/me/availability',role:'workflow',body:{is_available:true},expected:200});
    await request({method:'PUT',path:'/api/v1/mechanics/me/location',role:'workflow',body:{latitude:11.712345,longitude:107.312345},expected:204});
    const created = await request({method:'POST',path:'/api/v1/service-requests',role:'rider1',body:{motorcycle_id:'{{motorcycleId}}',service_type:'mobile_repair',problem_description:'Assignment recheck độc lập',location:{latitude:11.712345,longitude:107.312345}},key:'prepare-recheck',expected:201}); values.requestId = created.data.id;
    await request({method:'POST',path:'/api/v1/service-requests/{{requestId}}/dispatch',role:'rider1',expected:202});
    const offers = await request({method:'GET',path:'/api/v1/dispatch/offers',role:'workflow',expected:200}); const offer = offers.data.items.find(item => item.request_id === values.requestId) ?? block('Thiếu offer riêng');
    const accepted = await request({method:'POST',path:`/api/v1/dispatch/offers/${offer.id}/accept`,role:'workflow',expected:201}); values.assignmentId = accepted.data.id;
    actors.assigned = actors.workflow; actors.unassigned = actors.mechanic1;
  });
  await runIds(cases.filter(test => test.id >= 'HTTP-0521' && test.id <= 'HTTP-0547').map(test => test.id));
  await runIds(cases.filter(test => test.id >= 'HTTP-0554' && test.id <= 'HTTP-0564').map(test => test.id));
  await custom('RECHECK-RECOVERY-DIAGNOSIS-GUARD', 'Recovery', 'Diagnosis không còn eligible để recovery (FR-001)', async () => {
    await request({method:'POST',path:'/api/v1/assignments/{{assignmentId}}/recover',role:'admin',body:{reason_code:'lost_contact'},key:'release-recheck',expected:409});
  });
  values.assignmentId = original.assignmentId; values.requestId = original.requestId; actors.assigned = original.assigned; actors.unassigned = original.unassigned;
  await custom('RECHECK-DIAGNOSIS-FROZEN', 'Diagnosis', 'Diagnosis đã có quote không được sửa', async () => request({method:'POST',path:'/api/v1/assignments/{{assignmentId}}/diagnoses',role:'assigned',body:{diagnosis_text:'Không được ghi đè diagnosis đã báo giá'},expected:409}));
  await isolatedWorkflows();
  await runIds(['HTTP-0727','HTTP-0741','HTTP-0742','HTTP-0743']);
  await custom('RECHECK-CANONICAL-SAFETY', 'Chatbot', 'Câu mẫu spec: chết máy khi đang chạy', async () => {
    const r = await request({method:'POST',path:'/api/chatbot/sessions/{{sessionId}}/messages',role:'anonymous',body:{input_mode:'text',content_text:'Xe chết máy khi đang chạy'},headers:{Cookie:'{{chat_cookie}}'},expected:200});
    ok(['high','critical'].includes(r.data.risk_level), 'Câu mẫu spec không high/critical'); eq(r.data.can_continue_riding,false);
  });
  await runIds(['HTTP-0745','HTTP-0751']);
}
function counts() { return Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(status => [status, results.filter(result => result.status === status).length])); }
function report() {
  const byFeature = [...new Set(results.map(result => result.feature))].map(feature => ({ feature, ...Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(status => [status, results.filter(result => result.feature === feature && result.status === status).length])) }));
  const data = { run_id: runId, mode: reuseId ? 'recheck-same-eight-fixtures' : readOnly ? 'read-only' : 'mutating-fixtures', fixture_source_run: reuseId, finished_at: new Date().toISOString(), case_source_sha256: createHash('sha256').update(readFileSync(path.join(directory, 'cases.mjs'))).digest('hex'), runner_source_sha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), counts: counts(), by_feature: byFeature, results, calls, inventory: inventory(), fixtures: Object.fromEntries(createdUsers.map(user => [user.role, { id: user.id }])), cleanup, manual: manualCases };
  const output = path.join(directory, 'reports', runId); mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(data, null, 2));
  const failures = results.filter(result => result.status !== 'PASS');
  const md = [`# Báo cáo HTTP black-box CareOnRoad`, '', `Run: ${runId}. Mode: ${data.mode}. Payment bị loại khỏi phạm vi.`, '', `**${counts().PASS} PASS · ${counts().FAIL} FAIL · ${counts().BLOCKED} BLOCKED / ${reuseId ? results.length : cases.length} case trong run.**`, '', 'Không đọc implementation/unit tests để thiết kế oracle; dùng tài liệu/contracts và HTTP thật. Request quyền dùng Supabase JWT thật khi fixture setup được phép. Không sửa application để làm test pass. Không reset schema, không seed tài khoản có sẵn, không gọi payOS. BLOCKED không phải PASS.', '', '## Kết quả theo feature', '', '| Feature | PASS | FAIL | BLOCKED |', '|---|---:|---:|---:|', ...byFeature.map(row => `| ${row.feature} | ${row.PASS} | ${row.FAIL} | ${row.BLOCKED} |`), '', '## Các case chưa đạt', '', '| Case | Trạng thái | Lý do |', '|---|---|---|', ...failures.map(result => `| ${result.id}: ${result.name} | ${result.status} | ${result.reason.replaceAll('|', '/')} |`), '', '## Giới hạn thực tế', '', 'Không thể khẳng định bao phủ mọi tổ hợp dữ liệu/thời điểm. Catalogue bao phủ HTTP method đã khai báo, ma trận xác thực/role, ownership, biên dữ liệu, idempotency, các luồng có thể chạy không cần payment. Các case sau cần hạ tầng/fixture hoặc thao tác thật:', '', ...manualCases.map(test => `- **${test.id} ${test.name}** — ${test.expected}; điều kiện: ${test.requires}.`), '', '## Fixture riêng', '', createdUsers.length ? 'Tài khoản fixture được yêu cầu ban sau chạy (chi tiết cleanup trong results.json). Domain/history/audit được giữ để điều tra; không tự xoá database. Không dùng service-role cho request kiểm tra quyền.' : 'Lần chạy này không tạo tài khoản/fixture và không đổi trạng thái dữ liệu. Các case cần mutation/authenticated fixture bị BLOCKED.', '', `Inventory chưa có mapping: ${JSON.stringify(data.inventory.unmapped)}.`, '', 'Mỗi request, mã lỗi, thời gian và role được lưu trong results.json; response body/token/email/password không được ghi.', ''];
  writeFileSync(path.join(output, 'REPORT.md'), md.join('\n'));
  writeFileSync(path.join(directory, 'LATEST.md'), md.join('\n'));
  writeFileSync(path.join(directory, 'progress.json'), JSON.stringify({ run_id: runId, completed: results.length, planned: reuseId ? results.length : cases.length, counts: counts(), finished: true }, null, 2));
  console.log(JSON.stringify({ run_id: runId, ...counts(), report: path.relative(root, path.join(output, 'REPORT.md')) }));
}

try {
  await startServer();
  if (reuseId) { planned = reviewsOnly ? 7 : workflowsOnly ? 10 : 92; activeCase = 'RECHECK-SETUP'; await recheck(); }
  else {
  for (const test of cases.filter(test => test.phase === 'public')) {
    if (readOnly && test.request && test.request.method !== 'GET') results.push({ id: test.id, feature: test.feature, name: test.name, status: 'BLOCKED', reason: 'Read-only run: không gọi mutation methods', elapsed_ms: 0 });
    else await execute(test);
  }
  if (readOnly) {
    for (const test of cases.filter(test => test.phase !== 'public')) results.push({ id: test.id, feature: test.feature, name: test.name, status: 'BLOCKED', reason: 'Chưa xác nhận project test cô lập/approval mutation fixture; read-only run', elapsed_ms: 0 });
  } else {
    activeCase = 'SETUP';
    try { await provision(); } catch (error) { console.log(`SETUP BLOCKED: ${sanitized(error.message)}`); }
    for (const test of cases.filter(test => test.phase !== 'public')) await execute(test);
  }
  }
} catch (error) {
  console.log(`RUN BLOCKED: ${sanitized(error.message)}`);
  if (reuseId) results.push({id:'RECHECK-BLOCKED',feature:'Fixtures',name:'Không đủ tiền điều kiện recheck',status:'BLOCKED',reason:sanitized(error.message),elapsed_ms:0});
  else for (const test of cases) if (!results.some(result => result.id === test.id)) results.push({ id: test.id, feature: test.feature, name: test.name, status: 'BLOCKED', reason: sanitized(error.message), elapsed_ms: 0 });
} finally {
  activeCase = 'CLEANUP';
  for (const { role, id } of createdUsers) {
    if (['mechanic1', 'mechanic2', 'pending', 'fresh', 'workflow', ...(reuseId ? ['rider2'] : [])].includes(role) && actors[role]?.token) {
      try {
        const availability = await http('PUT', '/api/v1/mechanics/me/availability', role, { is_available: false });
        cleanup.push({ role, action: 'unavailable', status: availability.status });
      } catch { cleanup.push({ role, action: 'unavailable', status: 'unreachable' }); }
    }
    try {
      const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ban_duration: '87600h' }), signal: AbortSignal.timeout(15000) });
      cleanup.push({ role, action: 'ban_auth', status: response.status });
      if (response.status !== 200) console.log(`CLEANUP BLOCKED ${role}: HTTP ${response.status}`);
    } catch { console.log(`CLEANUP BLOCKED ${role}: Supabase unreachable`); }
  }
  if (server) server.kill();
  report();
}
process.exitCode = counts().FAIL || counts().BLOCKED ? 1 : 0;
