export function buildLivePaymentCase(c) {
  return { id:'LIVE-001',group:'LIVE',name:'Real payOS create/read/cancel after maintenance work',
    expectation:'Real provider link pending then canceled; no funds credited or job completed; no bank transfer',
    run:async()=>{
      const flow=await c.ready();const value=await c.order(flow.work);c.assert.equal(value.amount,18000);
      c.assert.ok(value.checkout_url?.startsWith('https://'));c.assert.equal(value.status,'pending');
      const before=await c.liveProviderGet(value);c.assert.equal(before.status,'PENDING');c.assert.equal(before.amount,18000);c.assert.equal(before.amountPaid,0);
      c.assert.equal((await c.http('GET',`/api/v1/payments/orders/${value.id}`)).status,'pending');
      c.assert.equal((await c.summary(flow)).paid_amount,0);await c.transition(flow,'completed',409);
      c.assert.equal((await c.http('POST',`/api/v1/payments/orders/${value.id}/cancel`,'rider',{})).status,'canceled');
      const after=await c.liveProviderGet(value);c.assert.equal(after.status,'CANCELLED');c.assert.equal(after.amountPaid,0);
      c.assert.equal((await c.summary(flow)).remaining_amount,18000);await c.transition(flow,'completed',409);
    }};
}
