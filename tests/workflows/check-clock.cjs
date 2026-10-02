const assert = require('node:assert/strict');
const { writeFileSync, unlinkSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const NativeDate = Date;
const file = join(__dirname, `clock-check-${randomUUID()}.txt`);
process.env.WORKFLOW_TEST_SCHEMA = 'cor_http_0000000000000000';
process.env.WORKFLOW_TEST_CLOCK_FILE = file;
writeFileSync(file, '600000');
try {
  require('./sandbox.cjs');
  const business = eval('Date.now()\n//# sourceURL=file:///fixture/src/features/reminders/test.js');
  const auth = eval('Date.now()\n//# sourceURL=file:///fixture/src/features/auth/test.js');
  const fcm = eval('Date.now()\n//# sourceURL=file:///fixture/src/features/notifications/fcm-test.js');
  const jose = eval('Date.now()\n//# sourceURL=file:///fixture/node_modules/jose/test.js');
  assert.ok(Math.abs(business-NativeDate.now()-600000)<1000);
  assert.ok(Math.abs(fcm-NativeDate.now()-600000)<1000);
  assert.ok(Math.abs(auth-NativeDate.now())<1000);assert.ok(Math.abs(jose-NativeDate.now())<1000);
  assert.equal(typeof Date(),'string');assert.ok(new Date() instanceof NativeDate);assert.ok(new NativeDate() instanceof Date);
  assert.equal(Date.parse('2026-01-01T00:00:00Z'),NativeDate.parse('2026-01-01T00:00:00Z'));
  console.log('Clock compatibility and auth separation: PASS');
} finally { global.Date=NativeDate;unlinkSync(file); }
