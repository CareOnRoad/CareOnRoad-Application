import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProviders, sign } from './providers.mjs';
import { buildCases } from './cases.mjs';
import { buildExtraCases } from './extra-cases.mjs';
import { buildLivePaymentCase } from './live-payment.mjs';
import {controlOwnedApi} from './control-owned-api.mjs';
import {prepareLegacyFixtures,testLegacyCase} from './legacy-fixtures.mjs';

const directory = dirname(fileURLToPath(import.meta.url)); const root = resolve(directory, '../..');
const livePayment = process.argv.includes('--live-payment-smoke');
const missingFcm = process.argv.includes('--missing-fcm-smoke');
const paymentCrash=process.argv.includes('--payment-crash-smoke');const pushCrash=process.argv.includes('--push-crash-smoke');
const fencing=process.argv.includes('--fencing-smoke');
const legacy=process.argv.includes('--legacy-smoke');
const legacyCommit='5307fcc67057ff3964475a89a3dc98bd745c09f9';
const requireApi = createRequire(join(root, 'apps/api/package.json'));
const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(4).toString('hex')}`;
const schema = `cor_http_${randomBytes(8).toString('hex')}`;
const output = join(directory, 'reports', runId); mkdirSync(output, { recursive: true });
const clockFile = join(output, 'clock-offset.txt'); writeFileSync(clockFile, '0');
const port = Number(process.argv.find(x=>x.startsWith('--port='))?.slice(7) || process.env.WORKFLOW_TEST_PORT || 3210);
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535,'Invalid test port');
const origin = `http://127.0.0.1:${port}`;
assert.ok(!(paymentCrash||pushCrash||fencing||legacy)||!livePayment,'Process-control modes require simulated providers');
assert.ok(!fencing||port<=65435,'Secondary test port out of range');const secondaryOrigin=`http://127.0.0.1:${port+100}`;
const actors = {}; const state = {}; const results = []; const calls = []; const cleanup = []; const postman = [];
const secrets = new Set(); const diagnostics = []; const faultEvents=[]; let activeCase = 'SETUP'; let phase = 'configuration'; let database; let scoped; let server; let secondaryServer; let pausedWorker; let launchApi; let provider; let offset = 0;
const checksum = randomBytes(32).toString('hex'); const workerSecret = randomBytes(32).toString('hex');
secrets.add(checksum); secrets.add(workerSecret);
class Blocked extends Error {}
const block = message => { throw new Blocked(message); };
const key = () => `wf-${randomUUID()}`;
const now = () => Date.now() + offset;
const shift = milliseconds => { offset += milliseconds; writeFileSync(clockFile, String(offset)); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = message => {
  let value = String(message);
  for (const secret of secrets) if (secret?.length > 7) value = value.replaceAll(secret, '[REDACTED]');
  return value.replace(/(?:postgres(?:ql)?:\/\/|Bearer\s+)\S+/gi, '[REDACTED]').replaceAll('|', '/').slice(0, 650);
};
const expectedStatus = (response, statuses) => {
  assert.ok((Array.isArray(statuses) ? statuses : [statuses]).includes(response.status),
    `HTTP expected ${JSON.stringify(statuses)}; actual ${response.status}; error=${response.data?.error_code || response.data?.error?.code || 'none'}`);
};
function checkRedaction(data) {
  const text = JSON.stringify(data);
  for (const secret of secrets) if (secret?.length > 7) assert.ok(!text.includes(secret), 'API leaked a credential');
  assert.ok(!/"(?:credential_ciphertext|credential_iv|credential_tag|credential_fingerprint|lease_token|dedupe_key|access_token|refresh_token|service_role_key|private_key|stack)"\s*:/i.test(text), 'API leaked internal/secret fields');
}
async function http(method, path, role = 'rider', body, statuses = 200, headers = {},requestOrigin=origin) {
  if (!['anonymous','invalid','worker'].includes(role) && !actors[role]) block(`Missing actor ${role}`);
  if (actors[role]?.token && Date.now() >= actors[role].expiresAt - 60_000) {
    const actor = actors[role];
    actor.refreshing ||= authRequest(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: actor.refreshToken })
    }).then(async response => {
      if(response.status !== 200) block(`Fixture token refresh HTTP ${response.status}`);
      applyTokens(actor, await response.json());
    }).finally(() => { actor.refreshing = undefined; });
    await actor.refreshing;
  }
  const auth = role === 'invalid' ? 'invalid.jwt.token' : actors[role]?.token;
  const start = Date.now();
  const response = await fetch(requestOrigin + path, { method, redirect: 'manual', signal: AbortSignal.timeout(path.includes('/workers/') ? 240_000 : 90_000),
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(role === 'worker' ? { 'X-Worker-Secret': workerSecret } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await response.text(); let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  calls.push({ case: activeCase, method, path, role,api_origin:requestOrigin, status: response.status, expected: statuses,
    error_code: data?.error_code || data?.error?.code || null, elapsed_ms: Date.now() - start });
  // Collection traces are template-only: credentials and response bodies never leave memory.
  const template = (typeof body === 'string' ? body : JSON.stringify(body ?? {})).replace(/wf-[a-f0-9-]+/g, '{{idempotency_key}}');
  const safeBody = method === 'POST' && path.includes('/webhooks/') ? '{{signed_webhook_json}}' :
    path.includes('/devices') ? '{{device_json}}' : template;
  postman.push({ name: `${activeCase} ${method} ${path}`, request: { method,
    header: [{ key: 'Authorization', value: `Bearer {{${role}_token}}` }, { key: 'Content-Type', value: 'application/json' },
      ...(role === 'worker' ? [{ key: 'X-Worker-Secret', value: '{{worker_secret}}' }] : []),
      ...(headers['X-Idempotency-Key'] ? [{ key: 'X-Idempotency-Key', value: '{{idempotency_key}}' }] : [])],
    url: `${requestOrigin===origin?'{{base_url}}':'{{secondary_base_url}}'}${path}`, ...(body !== undefined ? { body: { mode: 'raw', raw: safeBody, options: { raw: { language: 'json' } } } } : {}) },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: [`pm.test('HTTP contract',()=>pm.expect(${JSON.stringify(Array.isArray(statuses) ? statuses : [statuses])}).to.include(pm.response.code));`,
      ...((Array.isArray(statuses) ? statuses : [statuses]).some(x=>x>=500) ? [] : [`pm.test('No server error',()=>pm.expect(pm.response.code).to.be.below(500));`])] } }] });
  assert.ok(response.status === 204 || (response.headers.get('content-type')?.includes('application/json') && data !== null), `API response must be JSON; HTTP ${response.status}`);
  checkRedaction(data);
  if (response.status >= 400) assert.ok(typeof (data?.error_code || data?.error?.code) === 'string', 'Error envelope missing code');
  expectedStatus({ status: response.status, data }, statuses);
  return data;
}
const mutation = (method, path, role, body, expected, idempotency = key()) => http(method, path, role, body, expected, { 'X-Idempotency-Key': idempotency });
const worker = name => http('POST', `/api/v1/internal/workers/${name}`, 'worker', undefined, 202);
const inbox = async role => {
  const items = []; let cursor;
  do { const page = await http('GET', `/api/v1/notifications?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, role);
    assert.ok(Array.isArray(page.items)); items.push(...page.items); cursor = page.page?.next_cursor; } while (cursor);
  return items;
};
const item = (name, value) => { assert.ok(value?.id, `${name} missing id`); state[name] = value; return value; };
async function refreshMechanics() {
  for (const role of ['mechanic','mechanic2']) {
    await http('PUT', '/api/v1/mechanics/me/location', role, { latitude: 11.12345, longitude: 107.12345 }, 204);
  }
}
async function book({ service = 'periodic_maintenance', scheduled = now() + 20*60_000, rider = 'rider', bike = state.bike?.id, idempotency = key() } = {}) {
  assert.ok(bike, 'Fixture bike unavailable');
  return mutation('POST', '/api/v1/service-requests', rider, { motorcycle_id: bike, service_type: service,
    problem_description: 'Black-box workflow test', location: { latitude: 11.12345, longitude: 107.12345 },
    ...(scheduled ? { scheduled_start_at: new Date(scheduled).toISOString() } : {}) }, 201, idempotency);
}
async function assigned(options = {}) {
  const [occupied]=await scoped`select count(*)::int n from assignments where mechanic_id=${actors.mechanic.id}
    and status in ('accepted','en_route','on_site','diagnosis','quoted','awaiting_payment','in_progress') and (scheduled_start_at is null or activated_at is not null)`;
  if(occupied.n)block('Positive fixture mechanic occupied by an earlier unfinished case');
  await refreshMechanics(); const request = await book(options);
  // Positive fixtures use the documented explicit dispatch endpoint. Automatic
  // matching has its own case; it is never bypassed in that case.
  await http('POST', `/api/v1/service-requests/${request.id}/dispatch`, 'rider', undefined, 202);
  const offers = await http('GET', '/api/v1/dispatch/offers', 'mechanic');
  const candidate = offers.items.find(o => o.request_id === request.id); assert.ok(candidate, 'Matching must create a mechanic offer');
  const assignment = await http('POST', `/api/v1/dispatch/offers/${candidate.id}/accept`, 'mechanic',
    request.scheduled_start_at ? { estimated_duration_minutes: 15 } : {}, 201);
  return { request, candidate, assignment };
}
const laborLines = [{ line_type: 'labor', description: 'Công', quantity: 1, unit_amount: 10_000 },
  { line_type: 'other', description: 'Đi lại', quantity: 1, unit_amount: 2_000 }];
const parts = [{ line_type: 'part', description: 'Vật tư', quantity: 2, unit_amount: 3_000 }];
const checklist = { work_summary: 'Đã hoàn thành phạm vi khách duyệt', safety_checklist: {
  test_ride_completed: true, tools_removed: true, area_safe: true, rider_briefed: true, no_fluid_leak: true } };
const transition = (flow, status, expected = 200, role = 'mechanic') => http('POST', `/api/v1/assignments/${flow.assignment.id}/status`, role, { status }, expected);
const quote = (flow, purpose, lines, more = {}, role = 'mechanic', expected = 201) => http('POST', `/api/v1/service-requests/${flow.request.id}/quotes`, role,
  { assignment_id: flow.assignment.id, purpose, lines, expires_at: new Date(now()+24*60*60_000).toISOString(), ...more }, expected);
const decide = (value, action = 'approve', role = 'rider', expected = 200, body = {}) => http('POST', `/api/v1/quotes/${value.id}/${action}`, role, body, expected);
const summary = flow => http('GET', `/api/v1/service-requests/${flow.request.id}/payment-summary`, 'rider');
const order = (value, expected = 201, idempotency = key(), role = 'rider', extra = {}) => mutation('POST', '/api/v1/payments/orders', role, { quote_id: value.id, ...extra }, expected, idempotency);
async function atSite(flow) {
  const labor = await quote(flow, 'maintenance_labor', laborLines); await decide(labor);
  await transition(flow, 'en_route'); await transition(flow, 'on_site'); await transition(flow, 'diagnosis'); return labor;
}
async function ready({ lines = parts } = {}) {
  const flow = await assigned(); flow.labor = await atSite(flow);
  flow.work = await quote(flow, 'maintenance_work', lines); await decide(flow.work);
  await transition(flow, 'in_progress');
  await mutation('POST', `/api/v1/assignments/${flow.assignment.id}/completion-checklist`, 'mechanic', checklist, 201);
  await transition(flow, 'awaiting_payment'); return flow;
}
function providerOrder(value) {
  const match = [...provider.orders.values()].find(o => o.orderCode === Number(value.provider_order_code ?? value.order_code) ||
    o.id === value.provider_payment_link_id || value.checkout_url?.endsWith(o.id));
  assert.ok(match, 'Payment response must identify the provider link'); return match;
}
async function webhook(value, change = {}, options = {}) {
  const remote = providerOrder(value);
  const data = { orderCode: remote.orderCode, amount: remote.amount, description: remote.description,
    accountNumber: '00000000', reference: `TEST-${randomUUID()}`, transactionDateTime: new Date(now()).toISOString(),
    currency: 'VND', paymentLinkId: remote.id, code: '00', desc: 'success', ...change };
  const body = { code: '00', desc: 'success', success: true, data, signature: sign(data, checksum), ...options.body };
  if (options.badSignature) body.signature = '0'.repeat(64);
  if (options.tamper) body.data.amount += 1;
  return http('POST', '/api/v1/payments/webhooks/payos', 'anonymous', body, options.expected ?? 200);
}
const context = { assert, http, mutation, worker, inbox, key, state, actors, now, shift, wait, item, block,
  missingFcm,paymentCrash,pushCrash,fencing,legacy,testLegacyCase:name=>testLegacyCase(context,name),
  startSecondaryApi:()=>startApi(true),
  secondaryWorker:name=>{assert.ok(secondaryServer);return http('POST',`/api/v1/internal/workers/${name}`,'worker',undefined,202,{},secondaryOrigin);},
  pauseApi:()=>{
    assert.ok(fencing&&server&&!pausedWorker);pausedWorker=controlOwnedApi({apiPid:server.pid,runnerPid:process.pid,port,action:'pause'});
    faultEvents.push({case:activeCase,event:'owned-api-worker-paused',...pausedWorker,at:new Date().toISOString()});
  },
  resumeApi:()=>resumeApi(),
  crashApi:async()=>{
    assert.ok(!livePayment&&server,'Only the owned isolated test API may be stopped');const pid=server.pid;server.kill();await wait(1000);
    for(let i=0;i<20;i++){
      try{await fetch(origin+'/api/v1/internal/health/live',{signal:AbortSignal.timeout(1500)});}catch(error){
        if(error.name!=='TimeoutError'){faultEvents.push({case:activeCase,event:'owned-api-stopped',pid,at:new Date().toISOString(),health_unreachable:true});server=undefined;return;}
      }
      await wait(500);
    }
    block('Owned API remained reachable after stop; crash not proven');
  },
  restartApi:()=>startApi(),
  refreshMechanics, book, assigned, quote, decide, transition, atSite, ready, summary, order, webhook, providerOrder,
  laborLines, parts, checklist, provider: () => provider, sql: () => scoped,
  liveProviderGet: async value => {
    if(!livePayment) block('Live provider read requires explicit smoke mode');
    const identifier=value.provider_order_code ?? value.provider_payment_link_id ?? value.checkout_url?.split('/').at(-1);
    assert.ok(identifier,'Provider identifier missing');
    const response=await authRequest(`https://api-merchant.payos.vn/v2/payment-requests/${encodeURIComponent(identifier)}`, {
      headers:{'x-client-id':process.env.PAYOS_CLIENT_ID,'x-api-key':process.env.PAYOS_API_KEY}
    });
    assert.equal(response.status,200,'Real provider read');const result=await response.json();assert.equal(result.code,'00');
    if(result.signature)assert.equal(result.signature,sign(result.data,process.env.PAYOS_CHECKSUM_KEY));return result.data;
  } };
const allCases = [...buildCases(context), ...buildExtraCases(context), ...(livePayment ? [buildLivePaymentCase(context)] : [])];
const only = process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
const cases = livePayment ? allCases.filter(x=>x.group==='LIVE') : legacy ? ['PAY-044','MNT-095'].map(id=>allCases.find(x=>x.id===id)) : fencing ? allCases.filter(x=>x.id==='NTF-049') : paymentCrash ? allCases.filter(x=>x.id==='PAY-045') : pushCrash ? allCases.filter(x=>x.id==='NTF-048') : missingFcm ? allCases.filter(x=>x.name==='Missing FCM config must report failure not sent') : process.argv.includes('--extra-only') ? allCases.filter(x=>x.group==='EXT') : only ? only.map(id=>allCases.find(x=>x.id===id)).filter(Boolean) : allCases;
assert.ok(cases.length, 'No selected test cases');
const hashes = Object.fromEntries(['cases.mjs','extra-cases.mjs','live-payment.mjs','legacy-fixtures.mjs','run.mjs','providers.mjs','sandbox.cjs','capture-db-errors.cjs','control-owned-api.mjs'].map(file =>
  [file, createHash('sha256').update(readFileSync(join(directory, file))).digest('hex')]));
const application={git_head:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout?.trim(),
  workspace_kind:'unchanged-source-copy-with-own-next-output',
  ...(legacy?{legacy_origin_commit:legacyCommit}:{}),
  api_diff_sha256:createHash('sha256').update(spawnSync('git',['diff','--','apps/api/src'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout||'').digest('hex')};
const catalog = allCases.map(({ run, ...test }) => test);
writeFileSync(join(directory, 'test-cases.json'), JSON.stringify({ generated_at: new Date().toISOString(), sources: [
  'apps/api/MAINTENANCE-WORKFLOW.md','apps/api/MAINTENANCE-NOTIFICATIONS.md','apps/api/RESCUE-WORKFLOW.md',
  'specs/005-careonroad-payment/contracts/payment-api.yaml','specs/002-careonroad-backend-mvp/contracts/backend-api.yaml',
  'specs/009-push-device-token-lifecycle/contracts/push-token-api.md','specs/010-notification-provider-delivery/spec.md',
  'specs/011-notification-inbox-api/contracts/notification-inbox-api.md','https://payos.vn/docs/api/',
  'https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/','https://firebase.google.com/docs/cloud-messaging/error-codes'
], hashes, cases: catalog }, null, 2));
writeFileSync(join(output, 'catalog-before-run.json'), JSON.stringify({ hashes, application, cases: catalog, selected: cases.map(x=>x.id) }, null, 2));
for (const file of Object.keys(hashes)) writeFileSync(join(output, file), readFileSync(join(directory, file)));
if (process.argv.includes('--list')) { console.log(JSON.stringify({ cases: cases.length, catalogue: 'tests/workflows/test-cases.json' })); process.exit(0); }
for (const file of ['.env','.env.local','apps/api/.env','apps/api/.env.local']) if (existsSync(join(root, file))) process.loadEnvFile(join(root, file));
for (const [name, value] of Object.entries(process.env)) if (/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/.test(name) && value) secrets.add(value);

// Use IPv4 for hosted Auth on Windows; undici's connect timeout is shorter than
// the request deadline and can fail before Supabase returns an HTTP response.
function authRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { method: options.method || 'GET', headers: options.headers,
      family: 4, timeout: 30_000 }, response => {
      const chunks = []; response.on('data', data => chunks.push(data)); response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, json: async () => JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    request.on('error', reject); request.on('timeout', () => request.destroy(new Error('Auth network timeout')));
    request.end(options.body);
  });
}
function applyTokens(actor, auth) {
  assert.ok(auth.access_token && auth.refresh_token && auth.expires_in, 'Auth token response contract');
  secrets.add(auth.access_token); secrets.add(auth.refresh_token);
  actor.token = auth.access_token; actor.refreshToken = auth.refresh_token;
  actor.expiresAt = Date.now() + Number(auth.expires_in) * 1000; actor.ttlSeconds = Number(auth.expires_in);
}
if (process.argv.includes('--preflight')) {
  const response = await authRequest(`${process.env.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY } });
  console.log(JSON.stringify({ auth_health: response.status })); process.exit(response.status === 200 ? 0 : 1);
}

async function provision() {
  const stage = value => { phase = value; console.log(`SETUP ${value}`); };
  const postgres = requireApi('postgres');
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) block('Missing DB/Auth fixture configuration');
  if (livePayment && !['PAYOS_CLIENT_ID','PAYOS_API_KEY','PAYOS_CHECKSUM_KEY','PAYOS_RETURN_URL','PAYOS_CANCEL_URL'].every(k=>process.env[k])) block('Live payOS fixture configuration incomplete');
  stage('public-signing-keys');
  const keysResponse = await authRequest(process.env.SUPABASE_JWKS_URL || `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }
  });
  assert.equal(keysResponse.status,200,'Public JWKS download'); const jwks = await keysResponse.json();
  assert.ok(jwks.keys?.length && jwks.keys.every(k=>!k.d&&!k.k),'JWKS must contain public asymmetric signing keys only');
  const jwksFile = join(output,'public-jwks.json'); writeFileSync(jwksFile,JSON.stringify(jwks));
  database = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  stage('private-schema'); await database.unsafe(`create schema "${schema}"`);
  scoped = postgres(process.env.DATABASE_URL, { max: 3, prepare: false, connect_timeout: 15,
    connection: { search_path: `${schema},public,extensions` }, onnotice: () => {} });
  // A transaction pooler cannot preserve session locks between statements.
  // Commit each migration separately so enum additions are visible to the next.
  await migrate(legacy?33:Infinity);
  if(livePayment){
    // Reserve a fresh test-only provider namespace; the default sequence could
    // collide with an existing merchant order outside this isolated schema.
    const code=900_000_000_000+Number.parseInt(randomBytes(5).toString('hex'),16)%99_999_999_999;
    await scoped`select setval('payment_order_code_seq', ${code}, false)`;
  }
  stage('private-api');
  let apiDirectory=join(output,'apps/api');copyApi(apiDirectory,legacy);
  const scopedUrl = new URL(process.env.DATABASE_URL);
  scopedUrl.searchParams.set('search_path', `${schema},public,extensions`);
  const {privateKey,publicKey} = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  provider = await startProviders(checksum, { oauthPublicKey: publicKey, now });
  const cipherKey=randomBytes(32).toString('base64');secrets.add(cipherKey);secrets.add('isolated-fcm-access');secrets.add(privateKey);
  launchApi = (apiWorkspace=apiDirectory,apiPort=port)=>spawn(process.execPath, ['--require', join(directory, 'sandbox.cjs'),
    ...(process.argv.includes('--observe-db-errors')?['--require',join(directory,'capture-db-errors.cjs')]:[]),
    requireApi.resolve('next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', String(apiPort)], {
    cwd: apiWorkspace, windowsHide: true, stdio: ['ignore','pipe','pipe'], env: { ...process.env,
      WORKFLOW_TEST_SCHEMA: schema, WORKFLOW_TEST_CLOCK_FILE: clockFile, WORKFLOW_TEST_PROVIDER_ORIGIN: provider.origin,
      WORKFLOW_TEST_JWKS_FILE: jwksFile,
      WORKFLOW_TEST_LIVE_PAYOS: livePayment ? '1' : '',
      DATABASE_URL: scopedUrl.toString(),
      ...((paymentCrash||pushCrash||fencing||legacy)?{POSTGRES_MAX_CONNECTIONS:'2'}:{}),
      INTERNAL_WORKER_SECRET: workerSecret, PAYMENTS_ENABLED: 'true', PAYMENT_PROVIDER: 'payos',
      PAYOS_CLIENT_ID: livePayment ? process.env.PAYOS_CLIENT_ID : 'isolated-client', PAYOS_API_KEY: livePayment ? process.env.PAYOS_API_KEY : 'isolated-api-key', PAYOS_CHECKSUM_KEY: livePayment ? process.env.PAYOS_CHECKSUM_KEY : checksum,
      PAYOS_BASE_URL: 'https://api-merchant.payos.vn', PAYOS_RETURN_URL: livePayment ? process.env.PAYOS_RETURN_URL : `${origin}/api/v1/internal/health/live`, PAYOS_CANCEL_URL: livePayment ? process.env.PAYOS_CANCEL_URL : `${origin}/api/v1/internal/health/live`,
      PUSH_TOKEN_ENCRYPTION_KEY: cipherKey, FCM_PROJECT_ID: missingFcm ? '' : 'workflow-test', FCM_CLIENT_EMAIL: missingFcm ? '' : 'test@workflow-test.iam.gserviceaccount.com',
      FCM_PRIVATE_KEY: missingFcm ? '' : privateKey, FCM_TOKEN_URL: 'https://oauth2.googleapis.com/token', FCM_TIMEOUT_MS: fencing?'30000':'3000',
      GEMINI_API_KEY: '', OPENROUTER_API_KEY: '', CHATBOT_PERSISTENCE_MODE: 'memory', NEXT_TELEMETRY_DISABLED: '1' }
  });
  await startApi();
  const adminHeaders = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  for (const role of ['rider','rider2','mechanic','mechanic2','admin']) {
    stage(`auth-fixture-${role}`);
    const password = randomBytes(24).toString('base64url'); secrets.add(password);
    const email = `wf-${runId}-${role}@example.com`;
    const created = await authRequest(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, { method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { workflow_test_run: runId } }), signal: AbortSignal.timeout(30_000) });
    assert.ok([200,201].includes(created.status), `Auth fixture create ${role}: HTTP ${created.status}`); const user = await created.json();
    actors[role] = { id: user.id };
    const login = await authRequest(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST',
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(30_000) });
    assert.equal(login.status, 200, 'Fixture login'); applyTokens(actors[role], await login.json()); stage(`profile-${role}`);
    await http('POST', '/api/v1/auth/profile', role, { account_type: role.startsWith('mechanic') ? 'mechanic' : 'rider' }, 200);
    const [local] = await scoped`select id from app_users where id = ${user.id}`;
    const [outside] = await database`select id from public.app_users where id = ${user.id}`;
    assert.ok(local && !outside, 'Isolation failed: fixture API must write only its private schema');
  }
  // One private administrator fixture. Commands under test always use real user JWT.
  stage('isolated-role-setup'); await scoped`insert into user_roles (user_id, role) values (${actors.admin.id}, 'admin')`;
  for (const role of ['mechanic','mechanic2']) {
    await mutation('POST', `/api/v1/admin/mechanics/${actors[role].id}/approve`, 'admin', { reason: 'Initialize isolated HTTP test mechanic' }, 200);
    await http('PATCH', '/api/v1/mechanics/me/profile', role, { service_types: ['periodic_maintenance','emergency_rescue','mobile_repair'], service_radius_km: 12 });
    await http('PUT', '/api/v1/mechanics/me/availability', role, { is_available: true });
  }
  await refreshMechanics();
  item('bike', await http('POST', '/api/v1/motorcycles', 'rider', { brand_text: 'Honda', model_text: 'Wave', notes: 'Isolated workflow test' }, 201));
  item('foreignBike', await http('POST', '/api/v1/motorcycles', 'rider2', { brand_text: 'Honda', model_text: 'Wave' }, 201));
  if(legacy){
    stage('legacy-http-fixtures');await prepareLegacyFixtures(context);await context.crashApi();
    await migrate(Infinity,34);apiDirectory=join(output,'current/apps/api');copyApi(apiDirectory);
    stage('upgraded-api');await startApi();faultEvents.push({case:activeCase,event:'legacy-upgraded-to-current-api',legacy_origin_commit:legacyCommit,at:new Date().toISOString()});
  }
}
async function migrate(maximum,minimum=1){
  for(const file of readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
    const number=Number(file.match(/^\d{8}(\d{4})_/)[1]);if(number<minimum||number>maximum)continue;
    phase=`private-schema/${file}`;
    await scoped.begin(async transaction=>{
      await transaction`select pg_advisory_xact_lock(hashtextextended('CareOnRoad.workflow-fixture-migration-transaction',0))`;
      await transaction.unsafe(readFileSync(join(root,'supabase/migrations',file),'utf8'));
    });
  }
}
function copyApi(destination,historical=false){
  mkdirSync(destination,{recursive:true});
  if(historical){
    const inventory=spawnSync('git',['ls-tree','-r','--name-only',legacyCommit,'--','apps/api/app','apps/api/src','apps/api/package.json','apps/api/next.config.ts','apps/api/next-env.d.ts','apps/api/tsconfig.json'],{cwd:root,encoding:'utf8',windowsHide:true});
    assert.equal(inventory.status,0,'Legacy Git inventory unavailable');
    for(const file of inventory.stdout.trim().split(/\r?\n/)){
      const relative=file.slice('apps/api/'.length);assert.ok(!relative.split('/').includes('..'));
      const target=join(destination,relative);mkdirSync(dirname(target),{recursive:true});
      const snapshot=spawnSync('git',['show',`${legacyCommit}:${file}`],{cwd:root,windowsHide:true,maxBuffer:8*1024*1024});
      assert.equal(snapshot.status,0,'Legacy source snapshot unavailable');writeFileSync(target,snapshot.stdout);
    }
  }else for(const name of ['app','src','package.json','next.config.ts','next-env.d.ts','tsconfig.json'])cpSync(join(root,'apps/api',name),join(destination,name),{recursive:true});
  symlinkSync(join(root,'apps/api/node_modules'),join(destination,'node_modules'),'junction');
}
async function startApi(secondary=false){
  assert.ok(launchApi&&!(secondary?secondaryServer:server),'Owned API launch state invalid');
  let activeServer;
  if(secondary){
    assert.ok(fencing);const directory=join(output,'secondary/apps/api');mkdirSync(directory,{recursive:true});
    for(const name of ['app','src','package.json','next.config.ts','next-env.d.ts','tsconfig.json'])cpSync(join(output,'apps/api',name),join(directory,name),{recursive:true});
    symlinkSync(join(root,'apps/api/node_modules'),join(directory,'node_modules'),'junction');secondaryServer=activeServer=launchApi(directory,port+100);
  }else server=activeServer=launchApi();
  const apiOrigin=secondary?secondaryOrigin:origin;let startupHint='';
  activeServer.stdout.on('data',()=>{});activeServer.stderr.on('data',data=>{
    startupHint=clean(String(data)).slice(-400);diagnostics.push({case:activeCase,message:clean(String(data))});if(diagnostics.length>30)diagnostics.shift();
  });
  for(let i=0;i<90;i++){
    try{const response=await fetch(apiOrigin+'/api/v1/internal/health/live',{signal:AbortSignal.timeout(1500)});if(response.status===200){
      faultEvents.push({case:activeCase,event:secondary?'owned-secondary-api-started':'owned-api-started',pid:activeServer.pid,at:new Date().toISOString()});return;
    }}catch{}
    if(activeServer.exitCode!==null)block(`API could not start (${activeServer.exitCode}): ${startupHint}`);
    if(i===89)block('Isolated API startup timeout');await wait(1000);
  }
}
function resumeApi(){
  if(!pausedWorker)return;assert.ok(server);const info=controlOwnedApi({apiPid:server.pid,runnerPid:process.pid,port,action:'resume',workerPid:pausedWorker.worker_pid});
  faultEvents.push({case:activeCase,event:'owned-api-worker-resumed',...info,at:new Date().toISOString()});pausedWorker=undefined;
}
async function execute(test) {
  activeCase = test.id; const started = Date.now();
  try { await test.run(); results.push({ ...test, run: undefined, status: 'PASS', elapsed_ms: Date.now() - started }); }
  catch (error) { results.push({ ...test, run: undefined, status: error instanceof Blocked || ['TimeoutError','AbortError'].includes(error.name) ? 'BLOCKED' : 'FAIL', reason: clean(error.message), elapsed_ms: Date.now() - started }); }
  const last = results.at(-1);
  console.log(`${test.id} ${last.status}${last.reason ? `: ${last.reason}` : ''}`);
  writeFileSync(join(output, 'progress.json'), JSON.stringify({ completed: results.length, total: cases.length, last, results, calls }, null, 2));
}
function report() {
  const counts = Object.fromEntries(['PASS','FAIL','BLOCKED'].map(s => [s, results.filter(r => r.status === s).length]));
  const data = { run_id: runId, generated_at: new Date().toISOString(), mode: livePayment ? 'real-payos-create-read-cancel-no-bank-transfer' : 'real-http-real-auth-isolated-postgres-simulated-external-providers',
    schema, hashes_before_run: hashes, application_before_run:application, counts, results, calls, fixture_users: Object.fromEntries(Object.entries(actors).map(([role,a]) => [role, a.id])), cleanup,
    fixture_auth_ttl_seconds: Object.fromEntries(Object.entries(actors).map(([role,a])=>[role,a.ttlSeconds])),
    diagnostics,fault_events:faultEvents, provider_counts: provider ? { payment_requests: provider.calls.length, push_attempts: provider.sends.length } : null,
    limitations: ['External provider results/time controlled; no real bank transfer or device receipt proof', 'Public dev schema untouched; migrations run only in a fresh test schema', 'No application/service/route code read to construct test expectations'] };
  writeFileSync(join(output, 'results.json'), JSON.stringify(data, null, 2));
  const markdown = ['# Kiểm thử HTTP ba workflow', '', `Run: ${runId}`, '', `**${counts.PASS} PASS · ${counts.FAIL} FAIL · ${counts.BLOCKED} BLOCKED / ${cases.length} case.**`, '',
    livePayment ? 'API/HTTP, JWT Supabase và PostgreSQL thật. payOS thật: tạo/đọc/hủy link; không chuyển tiền. Oracle chốt trước audit/sửa backend; Git/API-diff hash trước chạy được lưu riêng.' :
      'API/HTTP, JWT Supabase và PostgreSQL thật. payOS/FCM mô phỏng ở biên mạng; không phải bằng chứng chuyển tiền/nhận push thật. Oracle chốt trước audit/sửa backend; hiệu chỉnh harness theo contract có ghi nhận trong ORACLE-REVISIONS.md. Git/API-diff hash trước chạy được lưu riêng.', '',
    'Migrations được chạy trong schema test riêng; không áp dụng vào public. SQL chỉ chuẩn bị admin fixture và đọc kiểm chứng, không ghi paid/assignment/request để vượt workflow.', '',
    '## Case chưa đạt', '', '| ID | Case | Kết quả | Lý do |','|---|---|---|---|',
    ...results.filter(r => r.status !== 'PASS').map(r => `| ${r.id} | ${r.name} | ${r.status} | ${r.reason} |`), '',
    'Trace HTTP theo case và SHA-256 của oracle trước lần chạy ở results.json/catalog-before-run.json. BLOCKED không phải PASS.', '',
    'Nguồn provider: [payOS API](https://payos.vn/docs/api/), [FCM errors](https://firebase.google.com/docs/cloud-messaging/error-codes).', ''].join('\n');
  writeFileSync(join(output, 'REPORT.md'), markdown); writeFileSync(join(directory, 'LATEST.md'), markdown);
  const collection=JSON.stringify({ info: {
    name: 'CareOnRoad payment + maintenance + notification HTTP workflows', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: 'Frozen expected statuses from business contracts. Runtime trace request examples. Use fresh fixtures; race/time/provider faults require the Node runner. Fill secrets locally; never import credentials into git.' },
    variable: ['base_url','secondary_base_url','rider_token','rider2_token','mechanic_token','mechanic2_token','admin_token','worker_secret','idempotency_key','device_json','signed_webhook_json'].map(k => ({ key: k, value: k === 'base_url' ? origin : k==='secondary_base_url'?secondaryOrigin:'' })), item: postman }, null, 2);
  writeFileSync(join(directory, 'careonroad-workflows.postman_collection.json'),collection);
  writeFileSync(join(output, 'postman_collection.json'),collection);
  console.log(JSON.stringify({ run_id: runId, ...counts, report: join('tests/workflows/reports', runId, 'REPORT.md') }));
  process.exitCode = counts.FAIL || counts.BLOCKED ? 1 : 0;
}
try {
  await provision();
  for (const test of cases) await execute(test);
} catch (error) {
  const reason = clean(`${phase}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`); console.log(`SETUP BLOCKED: ${reason}`);
  for (const test of cases.filter(t => !results.some(r => r.id === t.id))) results.push({ ...test, run: undefined, status: 'BLOCKED', reason: `Setup: ${reason}` });
} finally {
  try{resumeApi();}catch{cleanup.push({action:'resume-owned-api-worker',status:'FAILED'});}
  if(secondaryServer)secondaryServer.kill();
  if (server) { server.kill(); await wait(1000); }
  if (provider) await provider.close();
  for (const [role, actor] of Object.entries(actors)) try {
    const r = await authRequest(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${actor.id}`, { method: 'PUT', signal: AbortSignal.timeout(15_000),
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ban_duration: '87600h' }) }); cleanup.push({ role, action: 'ban-owned-auth-fixture', status: r.status });
  } catch { cleanup.push({ role, action: 'ban-owned-auth-fixture', status: 'FAILED' }); }
  if (scoped) await scoped.end({ timeout: 5 });
  if (database) await database.end({ timeout: 5 });
  // Retain the isolated schema as evidence; no deletion or mutation of public records.
  report();
}
