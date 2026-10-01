import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only HTTP verification. Never update or delete audit/history rows.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runId = process.argv[2];
assert.ok(runId && path.basename(runId) === runId, 'Run ID không hợp lệ');
const source = JSON.parse(readFileSync(path.join(root, 'tests/http/reports', runId, 'results.json')));
const fixtures = Object.entries(source.fixtures);
assert.equal(fixtures.length, 8, 'Chỉ kiểm tra tám fixture riêng');
assert.equal(new Set(fixtures.map(([, user]) => user.id)).size, 8, 'Fixture IDs phải khác nhau');
for (const file of ['.env', '.env.local', 'apps/api/.env', 'apps/api/.env.local']) if (existsSync(path.join(root, file))) process.loadEnvFile(path.join(root, file));
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const secretValues = Object.entries(process.env).filter(([key, value]) => /KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/.test(key) && value?.length >= 8).map(([, value]) => value);
const traces = [];
const results = [];
async function get(route) {
  const response = await fetch(process.env.SUPABASE_URL + route, { headers, signal: AbortSignal.timeout(30000) });
  traces.push({ method: 'GET', path: route, status: response.status });
  assert.ok(response.status === 200, `HTTP ${response.status} khi verify fixture`);
  return response.json();
}
async function check(id, name, run) {
  try { const counts = await run(); results.push({ id, name, status: 'PASS', counts }); }
  catch { results.push({ id, name, status: 'FAIL', reason: 'Assertion verification không đạt; không ghi response hoặc secrets' }); }
}
const ids = fixtures.map(([, user]) => user.id);
const ownerRun = source.fixture_source_run ?? source.run_id;
await check('VERIFY-OWN-FIXTURES', 'Metadata đúng run gốc và cả tám Auth accounts đã ban', async () => {
  const outcomes = await Promise.allSettled(fixtures.map(async ([role, { id }]) => {
    const response = await get(`/auth/v1/admin/users/${id}`); const user = response.user ?? response;
    assert.ok(user.user_metadata?.http_test_run === ownerRun);
    assert.ok(user.user_metadata?.full_name === `HTTP Test ${role}`);
    assert.ok(Date.parse(user.banned_until) > Date.now());
  }));
  assert.ok(outcomes.every(outcome => outcome.status === 'fulfilled'));
  return { fixture_accounts: 8, banned_auth_accounts: 8 };
});
// Stop if ownership verification failed, rather than inspecting other data.
if (results[0].status === 'PASS') {
  await check('VERIFY-UNAVAILABLE', 'Không mechanic fixture nào còn available', async () => {
    const rows = await get(`/rest/v1/mechanic_profiles?user_id=in.(${ids.join(',')})&select=user_id,is_available`);
    assert.ok(rows.length > 0 && rows.every(row => ids.includes(row.user_id) && row.is_available === false));
    return { mechanic_profiles: rows.length, available: 0 };
  });
  const sanitized = rows => {
    assert.ok(rows.length > 0, 'Không được pass nếu không có row để kiểm tra');
    const text = JSON.stringify(rows);
    assert.ok(secretValues.every(value => !text.includes(value)));
    assert.ok(!text.includes('private-value') && !text.includes('Kiểm tra bổ sung hệ thống điện.') && !text.includes('Review privacy marker'));
    assert.ok(!/"(?:access_token|refresh_token|raw_audio|push_token_ciphertext|service_role_key)"\s*:/.test(text));
  };
  await check('VERIFY-AUDIT', 'Audit của fixture không lưu credentials/raw audio/full diagnosis', async () => {
    const rows = await get(`/rest/v1/audit_logs?actor_id=in.(${ids.join(',')})&select=metadata`); sanitized(rows);
    return { audit_rows_checked: rows.length };
  });
  await check('VERIFY-OUTBOX', 'Outbox aggregate của fixture đã sanitized', async () => {
    const [requests, assignments] = await Promise.all([
      get(`/rest/v1/service_requests?rider_id=in.(${ids.join(',')})&select=id`),
      get(`/rest/v1/assignments?mechanic_id=in.(${ids.join(',')})&select=id`),
    ]);
    const aggregates = [...new Set([...ids, ...requests.map(row => row.id), ...assignments.map(row => row.id)])];
    const rows = await get(`/rest/v1/outbox_events?aggregate_id=in.(${aggregates.join(',')})&select=payload`); sanitized(rows);
    return { outbox_rows_checked: rows.length };
  });
}
const output = path.join(root, 'tests/http/reports', runId); mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'fixture-verification.json'), JSON.stringify({ run_id: runId, owner_run: ownerRun, mode: 'read-only', results, calls: traces }, null, 2));
console.log(JSON.stringify({ verification: results.map(result => ({ id: result.id, status: result.status, counts: result.counts })) }));
process.exitCode = results.some(result => result.status !== 'PASS') ? 1 : 0;
