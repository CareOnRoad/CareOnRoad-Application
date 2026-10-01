// Test-process infrastructure only. Never import or replace application services.
const { readFileSync } = require('node:fs');
const { request: httpsRequest } = require('node:https');
const NativeDate = Date;
if (!/^cor_http_[a-f0-9]{16}$/.test(process.env.WORKFLOW_TEST_SCHEMA || '')) throw new Error('Invalid isolated schema');
function clockNow() {
  const offset = Number(readFileSync(process.env.WORKFLOW_TEST_CLOCK_FILE, 'utf8'));
  if (!offset) return NativeDate.now();
  // Inspect structured dependency frames without invoking Next's stack formatter.
  const previous = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, frames) => frames;
    if (new Error().stack.some(frame => frame.getFileName()?.includes('jose'))) return NativeDate.now();
  } finally { Error.prepareStackTrace = previous; }
  return NativeDate.now() + offset;
}
function ControlledDate(...args) {
  if (!new.target) return new NativeDate(clockNow()).toString();
  return new NativeDate(...(args.length ? args : [clockNow()]));
}
ControlledDate.prototype = NativeDate.prototype;
Object.setPrototypeOf(ControlledDate, NativeDate);
ControlledDate.now = clockNow;
global.Date = ControlledDate;
const fetchOriginal = global.fetch;
global.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const target = url.hostname === 'api-merchant.payos.vn' ? 'payos' : url.hostname === 'fcm.googleapis.com' ? 'fcm' : url.hostname === 'oauth2.googleapis.com' ? 'oauth' : undefined;
  if (url.pathname === '/auth/v1/.well-known/jwks.json') return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { family: 4, timeout: 30_000 }, response => {
      const chunks = []; response.on('data', data => chunks.push(data)); response.on('error', reject);
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
    });
    request.on('error', reject); request.on('timeout', () => request.destroy(new Error('JWKS timeout'))); request.end();
  });
  return target ? fetchOriginal(`${process.env.WORKFLOW_TEST_PROVIDER_ORIGIN}/${target}${url.pathname}${url.search}`, options) : fetchOriginal(input, options);
};
