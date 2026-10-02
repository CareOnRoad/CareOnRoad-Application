import { createServer } from 'node:http';
import { createHmac, randomUUID, verify } from 'node:crypto';

// Independent payOS/FCM wire contracts; no application imports.
export const sign = (data, key) => createHmac('sha256', key).update(Object.keys(data).filter(k => data[k] !== undefined).sort().map(k => {
  const value = data[k];
  const wire = Array.isArray(value) ? JSON.stringify(value.map(item => Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))))) :
    [null,'undefined','null'].includes(value) ? '' : value;
  return `${k}=${wire}`;
}).join('&')).digest('hex');
export async function startProviders(checksum, { oauthPublicKey, now=Date.now } = {}) {
  const orders = new Map(); const sends = []; const calls = [];
  let createMode = 'success';
  let paymentCreated, pushAccepted, pushRequest;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString(); let body; try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
    const reply = (status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(data)); };
    try {
      if (req.url.startsWith('/oauth')) {
        const form = new URLSearchParams(raw); const assertion = form.get('assertion') || ''; const [header,payload,signature] = assertion.split('.');
        let jwt; try { jwt = JSON.parse(Buffer.from(payload || '', 'base64url')); } catch {}
        if (req.method !== 'POST' || form.get('grant_type') !== 'urn:ietf:params:oauth:grant-type:jwt-bearer' ||
          !jwt || jwt.iss !== 'test@workflow-test.iam.gserviceaccount.com' || jwt.aud !== 'https://oauth2.googleapis.com/token' ||
          jwt.scope !== 'https://www.googleapis.com/auth/firebase.messaging' || !oauthPublicKey ||
          !Number.isFinite(jwt.iat) || !Number.isFinite(jwt.exp) || jwt.exp<=Math.floor(now()/1000) || jwt.iat>Math.floor(now()/1000)+5 || jwt.exp-jwt.iat>3600 ||
          !verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), oauthPublicKey, Buffer.from(signature || '', 'base64url'))) {
          return reply(400, { error: 'invalid_grant' });
        }
        return reply(200, { access_token: 'isolated-fcm-access', token_type: 'Bearer', expires_in: 3600 });
      }
      if (req.url.startsWith('/fcm')) {
        if (req.headers.authorization !== 'Bearer isolated-fcm-access') return reply(401, { error: { status: 'UNAUTHENTICATED' } });
        if (req.method !== 'POST' || req.url !== '/fcm/v1/projects/workflow-test/messages:send') return reply(404, { error: { status: 'NOT_FOUND' } });
        if (!body.message?.token || !body.message?.notification?.title || !body.message?.notification?.body ||
          !Object.values(body.message?.data || {}).every(x=>typeof x === 'string')) return reply(400, { error: { status: 'INVALID_ARGUMENT' } });
        const token = body.message?.token; const id = body.message?.data?.notification_id;
        const count = sends.filter(s => s.token === token && s.id === id).length;
        sends.push({ token, id, data: body.message?.data, title: body.message?.notification?.title });
        if(pushRequest)await pushRequest({notificationId:id});
        if (token?.includes('invalid')) return reply(404, { error: { status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } });
        if (token?.includes('mismatch')) return reply(403, { error: { status: 'PERMISSION_DENIED', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'SENDER_ID_MISMATCH' }] } });
        if (token?.includes('quota') && count === 0) return reply(429, { error: { status: 'RESOURCE_EXHAUSTED' } }, { 'Retry-After': '120' });
        if (token?.includes('temporary') && count === 0) return reply(503, { error: { status: 'UNAVAILABLE' } }, { 'Retry-After': '60' });
        if (token?.includes('permanent')) return reply(400, { error: { status: 'INVALID_ARGUMENT' } });
        if (token?.includes('alwaysfail')) return reply(503, { error: { status: 'UNAVAILABLE' } });
        if (token?.includes('slow')) await new Promise(resolve => setTimeout(resolve, 1500));
        if(pushAccepted)await pushAccepted({notificationId:id});
        return reply(200, { name: `projects/workflow-test/messages/${randomUUID()}` });
      }
      const match = req.url.match(/^\/payos\/v2\/payment-requests(?:\/([^/?]+))?(\/cancel)?$/);
      if (!match) return reply(404, { code: '404', desc: 'unknown test provider endpoint' });
      if (req.headers['x-client-id'] !== 'isolated-client' || req.headers['x-api-key'] !== 'isolated-api-key') return reply(401, { code: '20', desc: 'provider authentication missing' });
      calls.push({ method: req.method, path: req.url, orderCode: body.orderCode });
      const [, identifier, cancel] = match;
      if (req.method === 'POST' && !identifier) {
        const signed = Object.fromEntries(['amount','cancelUrl','description','orderCode','returnUrl'].map(k => [k, body[k]]));
        if (sign(signed, checksum) !== body.signature) return reply(400, { code: '20', desc: 'signature invalid' });
        if (createMode === 'unavailable') return reply(503, { code: '99', desc: 'provider unavailable' });
        let order = orders.get(body.orderCode);
        if (!order) { order = { id: randomUUID().replaceAll('-', ''), orderCode: body.orderCode, amount: body.amount, amountPaid: 0,
          amountRemaining: body.amount, status: 'PENDING', createdAt: new Date().toISOString(), transactions: [], description: body.description }; orders.set(body.orderCode, order); }
        const data = { bin: '970422', accountNumber: '00000000', accountName: 'ISOLATED TEST', amount: order.amount,
          description: order.description, orderCode: order.orderCode, currency: 'VND', paymentLinkId: order.id,
          status: order.status, checkoutUrl: `https://pay.payos.vn/web/${order.id}`, qrCode: `TEST-ONLY-${order.id}` };
        if(paymentCreated)await paymentCreated({orderCode:order.orderCode});
        return reply(200, { code: '00', desc: 'success', data, signature: sign(data, checksum) });
      }
      const order = [...orders.values()].find(o => String(o.orderCode) === identifier || o.id === identifier);
      if (!order) return reply(404, { code: '20', desc: 'payment link not found' });
      if (cancel) { if (order.status !== 'PAID') order.status = 'CANCELLED'; }
      const data = { ...order };
      return reply(200, { code: '00', desc: 'success', data, signature: sign(data, checksum) });
    } catch { reply(500, { code: 'TEST_PROVIDER_FAILURE' }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, orders, sends, calls,
    onPaymentCreated:handler=>{paymentCreated=handler;},onPushAccepted:handler=>{pushAccepted=handler;},onPushRequest:handler=>{pushRequest=handler;},
    createMode: value => { createMode = value; }, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
