// Test-process infrastructure only. Never import or replace application services.
const { readFileSync } = require('node:fs');
const NativeDate = Date;
if (!/^cor_http_[a-f0-9]{16}$/.test(process.env.WORKFLOW_TEST_SCHEMA || '')) throw new Error('Invalid isolated schema');
function clockNow() {
  const offset = Number(readFileSync(process.env.WORKFLOW_TEST_CLOCK_FILE, 'utf8'));
  if (!offset) return NativeDate.now();
  // Inspect structured dependency frames without invoking Next's stack formatter.
  const previous = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, frames) => frames;
    for (const frame of new Error().stack) {
      const source = [frame.getFileName(), frame.getScriptNameOrSourceURL(), frame.getEvalOrigin()].join(' ').replaceAll('\\','/');
      if (source.includes('jose')) return NativeDate.now();
      if (/src\/(features|server)\//.test(source)) {
        if (/src\/features\//.test(source) && !/features\/auth\//.test(source) || source.includes('src/server/workers/')) return NativeDate.now() + offset;
        return NativeDate.now();
      }
    }
  } finally { Error.prepareStackTrace = previous; }
  return NativeDate.now();
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
  const target = url.hostname === 'api-merchant.payos.vn' && process.env.WORKFLOW_TEST_LIVE_PAYOS !== '1' ? 'payos' : url.hostname === 'fcm.googleapis.com' ? 'fcm' : url.hostname === 'oauth2.googleapis.com' ? 'oauth' : undefined;
  if (process.env.WORKFLOW_TEST_JWKS_FILE && url.pathname === '/auth/v1/.well-known/jwks.json') return Promise.resolve(new Response(
    readFileSync(process.env.WORKFLOW_TEST_JWKS_FILE), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  return target ? fetchOriginal(`${process.env.WORKFLOW_TEST_PROVIDER_ORIGIN}/${target}${url.pathname}${url.search}`, options) : fetchOriginal(input, options);
};
