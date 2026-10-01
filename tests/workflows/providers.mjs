import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

// Independent payOS/FCM wire contracts; no application imports.
export const sign = (data, key) => createHmac('sha256', key).update(Object.keys(data).filter(k => data[k] !== undefined).sort().map(k => {
  const value = data[k];
  const wire = Array.isArray(value) ? JSON.stringify(value.map(item => Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))))) :
    [null,'undefined','null'].includes(value) ? '' : value;
  return `${k}=${wire}`;
}).join('&')).digest('hex');
export async function startProviders(checksum) {
  const orders = new Map(); const sends = []; const calls = [];
  let createMode = 'success';
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { body = {}; }
    const reply = (status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(data)); };
    try {
      if (req.url.startsWith('/oauth')) return reply(200, { access_token: 'isolated-fcm-access', token_type: 'Bearer', expires_in: 3600 });
      if (req.url.startsWith('/fcm')) {
        const token = body.message?.token; const id = body.message?.data?.notification_id;
        const count = sends.filter(s => s.token === token && s.id === id).length;
        sends.push({ token, id, data: body.message?.data, title: body.message?.notification?.title });
        if (token?.includes('invalid')) return reply(404, { error: { status: 'NOT_FOUND', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'UNREGISTERED' }] } });
        if (token?.includes('mismatch')) return reply(403, { error: { status: 'PERMISSION_DENIED', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'SENDER_ID_MISMATCH' }] } });
        if (token?.includes('quota') && count === 0) return reply(429, { error: { status: 'RESOURCE_EXHAUSTED' } }, { 'Retry-After': '120' });
        if (token?.includes('temporary') && count === 0) return reply(503, { error: { status: 'UNAVAILABLE' } }, { 'Retry-After': '2' });
        if (token?.includes('permanent')) return reply(400, { error: { status: 'INVALID_ARGUMENT' } });
        if (token?.includes('alwaysfail')) return reply(503, { error: { status: 'UNAVAILABLE' } });
        if (token?.includes('slow')) await new Promise(resolve => setTimeout(resolve, 1500));
        return reply(200, { name: `projects/workflow-test/messages/${randomUUID()}` });
      }
      const match = req.url.match(/^\/payos\/v2\/payment-requests(?:\/([^/?]+))?(\/cancel)?$/);
      if (!match) return reply(404, { code: '404', desc: 'unknown test provider endpoint' });
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
    createMode: value => { createMode = value; }, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
