import { randomUUID } from 'node:crypto';

// Oracle: published business workflows and HTTP contracts, not application code.
// Each case includes its own assertions; dependency failures are BLOCKED, never PASS.
export function buildCases(c) {
  const { assert: a, http, mutation, worker, inbox, state: s, key, now, shift, block } = c;
  const tests = []; const sequence = {};
  const add = (group, name, expectation, run) => {
    sequence[group] = (sequence[group] || 0) + 1;
    tests.push({ id: `${group}-${String(sequence[group]).padStart(3, '0')}`, group, name, expectation, run });
  };
  const need = name => s[name] || block(`Prerequisite ${name} did not succeed`);
  const invalid = [400, 422]; const forbidden = [403, 404];
  const body = more => ({ motorcycle_id: need('bike').id, service_type: 'periodic_maintenance',
    problem_description: 'Bảo dưỡng kiểm thử hộp đen', location: { latitude: 11.12345, longitude: 107.12345 },
    scheduled_start_at: new Date(now() + 20*60_000).toISOString(), ...more });
  const request = flow => http('GET', `/api/v1/service-requests/${flow.request.id}`);
  const status = async (flow, assignmentStatus, requestStatus) => {
    const jobs = await http('GET', '/api/v1/assignments?limit=100', 'mechanic');
    a.equal(jobs.items.find(x => x.id === flow.assignment.id)?.status, assignmentStatus);
    a.equal((await request(flow)).status, requestStatus);
  };
  const cancel = flow => http('POST', `/api/v1/service-requests/${flow.request?.id || flow.id}/cancel`, 'rider', { reason: 'End isolated test fixture' });
  const notificationsFor = async (role, reference, id) => (await inbox(role)).filter(x => x.data?.[reference] === id);
  const notice = async (role, reference, id) => {
    const items = await notificationsFor(role, reference, id); a.ok(items.length, `${role} must receive ${reference} notice`);
    for (const item of items) { a.match(item.id, /^[a-f0-9-]{36}$/i); a.ok(item.title?.trim()); a.ok(item.body?.trim()); }
    return items;
  };
  const pay = async flow => {
    const value = await c.order(flow.work); const remote = c.providerOrder(value);
    remote.status = 'PAID'; remote.amountPaid = remote.amount; remote.amountRemaining = 0;
    await c.webhook(value);
    a.equal((await http('GET', `/api/v1/payments/orders/${value.id}`)).status, 'succeeded');
    a.equal((await c.summary(flow)).remaining_amount, 0);
    await status(flow, 'awaiting_payment', 'awaiting_payment');
    await c.transition(flow, 'completed'); await status(flow, 'completed', 'completed'); return value;
  };
  const checklist = flow => mutation('POST', `/api/v1/assignments/${flow.assignment.id}/completion-checklist`, 'mechanic', c.checklist, 201);
  const finish = async flow => { await checklist(flow); await c.transition(flow, 'awaiting_payment'); return pay(flow); };
  const work = async (flow, lines = c.parts) => {
    flow.labor = await c.atSite(flow); flow.work = await c.quote(flow, 'maintenance_work', lines);
    await c.decide(flow.work); await c.transition(flow, 'in_progress'); return flow;
  };
  const reminder = (more = {}, role = 'rider') => http('POST', '/api/v1/reminders', role,
    { motorcycle_id: role === 'rider2' ? need('foreignBike').id : need('bike').id,
      title: `HTTP reminder ${randomUUID()}`, next_due_at: new Date(now() + 1000).toISOString(), enabled: true, ...more }, 201);
  const due = async more => { const value = await reminder(more); shift(2000); await worker('reminders/run'); return value; };
  const reminderInput=(value,more={})=>({motorcycle_id:value.motorcycle_id,title:value.title,next_due_at:value.next_due_at,enabled:value.enabled,
    ...(value.interval_days?{interval_days:value.interval_days}:{}),...more});
  const dispatchQueued = async requestId => {
    for(let i=0;i<40;i++){
      await worker('outbox/run');
      const [event]=await c.sql()`select status from outbox_events where topic='maintenance.dispatch.requested' and aggregate_id=${requestId}`;
      a.ok(event,'Booking must persist an automatic dispatch event');
      if(event.status==='processed')return;
      a.notEqual(event.status,'dead_letter','Automatic dispatch event cannot be dead-lettered');
    }
    block('Automatic dispatch event not reached within bounded worker batches');
  };

  const endpoints = [
    ['GET','/api/v1/service-requests'], ['POST','/api/v1/service-requests'],
    ['GET',`/api/v1/service-requests/${randomUUID()}`], ['PATCH',`/api/v1/service-requests/${randomUUID()}`],
    ['POST',`/api/v1/service-requests/${randomUUID()}/cancel`], ['POST',`/api/v1/service-requests/${randomUUID()}/dispatch`],
    ['GET','/api/v1/dispatch/offers'], ['POST',`/api/v1/dispatch/offers/${randomUUID()}/accept`],
    ['POST',`/api/v1/dispatch/offers/${randomUUID()}/decline`], ['GET','/api/v1/assignments'],
    ['POST',`/api/v1/assignments/${randomUUID()}/status`], ['GET',`/api/v1/assignments/${randomUUID()}/completion-checklist`],
    ['POST',`/api/v1/assignments/${randomUUID()}/completion-checklist`],
    ['GET',`/api/v1/service-requests/${randomUUID()}/quotes`], ['POST',`/api/v1/service-requests/${randomUUID()}/quotes`],
    ['POST',`/api/v1/quotes/${randomUUID()}/approve`], ['POST',`/api/v1/quotes/${randomUUID()}/reject`],
    ['GET',`/api/v1/service-requests/${randomUUID()}/payment-summary`], ['POST','/api/v1/payments/orders'],
    ['GET',`/api/v1/payments/orders/${randomUUID()}`], ['POST',`/api/v1/payments/orders/${randomUUID()}/cancel`],
    ['GET','/api/v1/reminders'], ['POST','/api/v1/reminders'], ['PATCH',`/api/v1/reminders/${randomUUID()}`],
    ['POST',`/api/v1/reminders/${randomUUID()}/snooze`], ['GET','/api/v1/notifications'],
    ['GET','/api/v1/notifications/unread-count'], ['POST',`/api/v1/notifications/${randomUUID()}/read`],
    ['POST','/api/v1/notifications/read-all'], ['POST','/api/v1/auth/devices'],
    ['PUT',`/api/v1/auth/devices/${randomUUID()}/push-token`], ['DELETE',`/api/v1/auth/devices/${randomUUID()}/push-token`],
    ['GET','/api/v1/admin/operations/payments-needs-review'], ['POST',`/api/v1/admin/payments/orders/${randomUUID()}/resolve`]
  ];
  for (const [method, path] of endpoints) for (const role of ['anonymous','invalid']) {
    add('SEC', `${method} ${path.replace(/[a-f0-9-]{36}/g, ':id')} / ${role}`, '401; no side effect or secret leakage',
      () => http(method, path, role, ['GET','DELETE'].includes(method) ? undefined : {}, 401));
  }
  for (const route of ['outbox/run','reminders/run','dispatch/run','payments/reconcile']) {
    for (const role of ['anonymous','rider','mechanic','admin']) add('SEC', `Worker ${route} rejects ${role}`, 'User JWT cannot replace worker authority',
      () => http('POST', `/api/v1/internal/workers/${route}`, role, undefined, [401,403]));
    add('SEC', `Worker ${route} wrong secret`, 'Reject wrong worker secret',
      () => http('POST', `/api/v1/internal/workers/${route}`, 'anonymous', undefined, [401,403], { 'X-Worker-Secret': 'wrong-worker-secret' }));
  }
  for (const [field, value] of [
    ['motorcycle_id','bad'], ['service_type','unknown'], ['problem_description',''], ['problem_description','  '],
    ['problem_description',2], ['problem_description','x'.repeat(3001)], ['scheduled_start_at','bad'],
    ['scheduled_start_at','2020-01-01T00:00:00Z'], ['scheduled_start_at',null],
    ['location',null], ['location',{}], ['location',{ latitude:91,longitude:107 }], ['location',{ latitude:11,longitude:-181 }],
    ['location',{ latitude:'11',longitude:107 }], ['location',{ latitude:11 }],
    ['address_text','x'.repeat(501)], ['rider_id',randomUUID()], ['status','completed'], ['paid_amount',1],
    ['reminder_id',randomUUID()], ['reminder_context_id',randomUUID()]
  ]) add('MNT', `Booking rejects invalid ${field}: ${JSON.stringify(value).slice(0,50)}`, '400/422; no invalid request persisted',
    () => mutation('POST', '/api/v1/service-requests', 'rider', body({ [field]: value }), invalid));
  add('MNT','Coordinates required even with address', 'Missing coordinates rejected', async () => {
    const input = body({ address_text: 'Test address' }); delete input.location;
    await mutation('POST','/api/v1/service-requests','rider',input,invalid);
  });
  add('MNT','Schedule required without reminder references', 'Missing appointment rejected', async () => {
    const input = body(); delete input.scheduled_start_at; await mutation('POST','/api/v1/service-requests','rider',input,invalid);
  });
  add('MNT','Foreign motorcycle booking', '403; ownership enforced', () => mutation('POST','/api/v1/service-requests','rider',body({ motorcycle_id:need('foreignBike').id }),403));
  add('MNT','Missing booking idempotency key', '400/422', () => http('POST','/api/v1/service-requests','rider',body(),invalid));
  for (const value of ['short','x'.repeat(201)]) add('MNT','Booking key length boundary', 'Invalid key rejected', () => mutation('POST','/api/v1/service-requests','rider',body(),invalid,value));
  add('MNT','Booking retry and conflicting payload', 'Same ID on replay; changed payload 409; cancel successful', async () => {
    const input = body(); const id = key(); const first = await mutation('POST','/api/v1/service-requests','rider',input,201,id);
    const replay = await mutation('POST','/api/v1/service-requests','rider',input,201,id); a.equal(replay.id,first.id);
    await mutation('POST','/api/v1/service-requests','rider',{ ...input,problem_description:'Changed retry payload' },409,id); await cancel(first);
  });
  add('MNT','Concurrent booking retry', 'Exactly one request and one logical dispatch event', async () => {
    const input = body(); const id = key(); const results = await Promise.allSettled([1,2].map(() => mutation('POST','/api/v1/service-requests','rider',input,201,id)));
    try {
      for(const result of results)a.equal(result.status,'fulfilled',result.reason?.message);
      const [x,y]=results.map(x=>x.value);a.equal(x.id,y.id);
      const rows = await c.sql()`select count(*)::int n from outbox_events where topic = 'maintenance.dispatch.requested' and aggregate_id = ${x.id}`;a.equal(rows[0].n,1);
    }finally{for(const value of new Map(results.filter(x=>x.status==='fulfilled').map(x=>[x.value.id,x.value])).values())await cancel(value);}
  });
  add('MNT','Owner edits coordinates before dispatch', 'Idempotent PATCH, changed replay conflicts, foreign owner rejected', async () => {
    const req = await c.book(); const input = { location:{latitude:11.12345,longitude:107.12345} }; const id = key();
    const x = await mutation('PATCH',`/api/v1/service-requests/${req.id}`,'rider',input,200,id);
    a.equal((await mutation('PATCH',`/api/v1/service-requests/${req.id}`,'rider',input,200,id)).id,x.id);
    await mutation('PATCH',`/api/v1/service-requests/${req.id}`,'rider',{location:{latitude:11.2,longitude:107.2}},409,id);
    await mutation('PATCH',`/api/v1/service-requests/${req.id}`,'rider2',input,403); await cancel(req);
  });
  add('MNT','Cancel before matching then replay worker', 'Canceled request never generates a live offer', async () => {
    const req = await c.book(); await cancel(req); await worker('outbox/run');
    a.equal((await request({request:req})).status,'canceled');
    for (const role of ['mechanic','mechanic2']) a.ok(!(await http('GET','/api/v1/dispatch/offers',role)).items.some(x=>x.request_id===req.id));
  });
  add('MNT','Automatic matching immediately after booking', 'Outbox generates offers without client dispatch; not confirmed yet', async () => {
    await c.refreshMechanics(); const flow={request:await c.book()};
    try {
      await dispatchQueued(flow.request.id); const offers=await http('GET','/api/v1/dispatch/offers','mechanic');
      const offer=offers.items.find(x=>x.request_id===flow.request.id); a.ok(offer,'Immediate matching missing');
      a.equal((await request(flow)).status,'offered'); a.equal(offer.service_type,'periodic_maintenance'); a.equal(offer.scheduled_start_at,flow.request.scheduled_start_at);
    } finally { await cancel(flow); }
  });
  add('MNT','Explicit documented dispatch prepares independent main workflow','Offered request and live mechanic offer; independent of automatic-worker failure',async()=>{
    await c.refreshMechanics(); s.flow={request:await c.book()};
    await http('POST',`/api/v1/service-requests/${s.flow.request.id}/dispatch`,'rider',undefined,202);
    s.offer=(await http('GET','/api/v1/dispatch/offers','mechanic')).items.find(x=>x.request_id===s.flow.request.id); a.ok(s.offer,'Explicit dispatch offer missing');
  });
  for (const value of [undefined,14,481,15.5,'90',null]) add('MNT',`Scheduled accept duration ${String(value)} invalid`,'400/422; offer remains available',async()=>{
    await http('POST',`/api/v1/dispatch/offers/${need('offer').id}/accept`,'mechanic', value===undefined?{}:{estimated_duration_minutes:value},invalid);
  });
  add('MNT','Foreign mechanic cannot accept offer','403/404',()=>http('POST',`/api/v1/dispatch/offers/${need('offer').id}/accept`,'mechanic2',{estimated_duration_minutes:15},forbidden));
  add('MNT','Accept confirms buffered reservation','Confirmed; start -30 minutes; end duration +30 minutes; retry same assignment',async()=>{
    const flow=need('flow'); const candidate=need('offer');
    flow.assignment=await http('POST',`/api/v1/dispatch/offers/${candidate.id}/accept`,'mechanic',{estimated_duration_minutes:15},201);
    const v=flow.assignment; a.equal(v.appointment_status,'confirmed');
    a.equal(Date.parse(v.reservation_start_at),Date.parse(v.scheduled_start_at)-30*60_000);
    a.equal(Date.parse(v.reservation_end_at),Date.parse(v.scheduled_start_at)+45*60_000);
    a.equal((await http('POST',`/api/v1/dispatch/offers/${candidate.id}/accept`,'mechanic',{estimated_duration_minutes:15},201)).id,v.id);
    await status(flow,'accepted','assigned'); s.accepted=flow;
  });
  for (const next of ['en_route','in_progress','awaiting_payment','completed']) add('MNT',`Skip labor approval to ${next}`,'409; no state advance',()=>c.transition(need('accepted'),next,409));
  for (const role of ['rider2','mechanic2']) add('MNT',`Unassigned ${role} progresses assignment`,'403/404',()=>c.transition(need('accepted'),'en_route',forbidden,role));
  const laborBad = [
    ['no labor',c.parts], ['zero labor',[{...c.laborLines[0],unit_amount:0}]], ['part mixed',[...c.laborLines,...c.parts]],
    ['negative',[{...c.laborLines[0],unit_amount:-1}]], ['fraction money',[{...c.laborLines[0],unit_amount:1.2}]],
    ['zero quantity',[{...c.laborLines[0],quantity:0}]], ['empty description',[{...c.laborLines[0],description:''}]],
    ['overflow',[{...c.laborLines[0],quantity:1e15,unit_amount:1e15}]]
  ];
  for (const [name,lines] of laborBad) add('MNT',`Labor quote rejects ${name}`,'400/422/409; no invalid immutable quote',()=>c.quote(need('accepted'),'maintenance_labor',lines,{},'mechanic',[...invalid,409]));
  for (const more of [{discount_amount:1},{diagnosis_id:randomUUID()},{labor_pricing:{base_amount:1}},{total_amount:1}]) add('MNT',`Labor quote rejects ${Object.keys(more)[0]}`,'400/422/409; server owns pricing',()=>c.quote(need('accepted'),'maintenance_labor',c.laborLines,more,'mechanic',[...invalid,409]));
  add('MNT','Work quote before approved labor','409',()=>c.quote(need('accepted'),'maintenance_work',c.parts,{},'mechanic',409));
  add('MNT','New maintenance rejects legacy standard purpose','Invalid purpose rejected; no quote or payment',()=>c.quote(need('accepted'),'standard',c.laborLines,{},'mechanic',[...invalid,409]));
  add('MNT','Labor rejection retains mechanic; replacement immutable','Rejected cannot travel; replacement supersedes prior pending; latest only',async()=>{
    const flow=need('accepted'); const first=await c.quote(flow,'maintenance_labor',c.laborLines); await c.decide(first,'reject');
    await status(flow,'quoted','awaiting_quote_approval'); await c.transition(flow,'en_route',409);
    await c.order(first,409); const stale=await c.quote(flow,'maintenance_labor',c.laborLines);
    flow.labor=await c.quote(flow,'maintenance_labor',c.laborLines); await c.decide(stale,'approve','rider',409);
    const list=await http('GET',`/api/v1/service-requests/${flow.request.id}/quotes`); a.ok(list.items.some(x=>x.id===stale.id&&x.status==='superseded'));
    s.labor=flow.labor;
  });
  for (const role of ['rider2','mechanic']) add('MNT',`Labor quote decision by ${role}`,'403/404',()=>c.decide(need('labor'),'approve',role,forbidden));
  add('PAY','Pending labor cannot be paid','409; payment is after service',()=>c.order(need('labor'),409));
  add('MNT','Maintenance rejects rescue payment timing','400/422/409',()=>c.decide(need('labor'),'approve','rider',[...invalid,409],{payment_timing:'labor_upfront'}));
  add('MNT','Approve fixed labor','Accepted/assigned; total 12000; no payment or automatic travel',async()=>{
    const flow=need('accepted'); const value=await c.decide(need('labor')); a.equal(value.total_amount,12000);
    await status(flow,'accepted','assigned'); s.laborApproved=flow;
  });
  add('PAY','Approved labor still cannot create a payment','409; no upfront payment for new maintenance',()=>c.order(need('labor'),409));
  add('MNT','No second labor after fixed approval','409',()=>c.quote(need('laborApproved'),'maintenance_labor',c.laborLines,{},'mechanic',409));
  add('MNT','Travel and arrival synchronize request; cannot skip diagnosis','Active reservation; en_route / on_site / diagnosis',async()=>{
    const flow=need('laborApproved'); await c.transition(flow,'en_route'); await status(flow,'en_route','mechanic_en_route');
    await c.transition(flow,'in_progress',409); await c.transition(flow,'on_site'); await status(flow,'on_site','in_service');
    await c.transition(flow,'diagnosis'); await status(flow,'diagnosis','in_service'); s.onSite=flow;
  });
  add('MNT','Initial work cannot add duplicate labor','409/400/422',()=>c.quote(need('onSite'),'maintenance_work',c.laborLines,{},'mechanic',[...invalid,409]));
  add('MNT','Materials rejected then revised','Rejected work blocks start; revised work has fixed labor plus approved parts',async()=>{
    const flow=need('onSite'); const rejected=await c.quote(flow,'maintenance_work',c.parts); await c.decide(rejected,'reject');
    await c.transition(flow,'in_progress',409); await c.order(rejected,409); flow.work=await c.quote(flow,'maintenance_work',c.parts);
    a.equal(flow.work.total_amount,18000); s.workQuote=flow.work;
  });
  add('PAY','Unapproved material quote cannot be paid','409',()=>c.order(need('workQuote'),409));
  add('MNT','Approve scope then start work','Approval returns diagnosis; manual in_progress; no implicit payment',async()=>{
    const flow=need('onSite'); await c.decide(need('workQuote')); await status(flow,'diagnosis','in_service');
    await c.transition(flow,'in_progress'); await status(flow,'in_progress','in_service'); s.inProgress=flow;
  });
  add('PAY','Cannot charge during work','409',()=>c.order(need('workQuote'),409));
  add('MNT','Cannot collect without checklist','409',()=>c.transition(need('inProgress'),'awaiting_payment',409));
  add('MNT','Cannot complete without verified payment','409',()=>c.transition(need('inProgress'),'completed',409));
  for (const more of [{},{basis_quote_id:randomUUID()},{basis_quote_id:randomUUID(),discount_amount:1}]) add('MNT','Addition needs latest approved basis','409 or invalid; no scope changes',()=>c.quote(need('inProgress'),'maintenance_work',c.parts,more,'mechanic',[...invalid,409]));
  add('MNT','Pending addition blocks collection; rejection preserves scope','No payment for rejected amount; still assigned to same mechanic',async()=>{
    const flow=need('inProgress'); const addition=await c.quote(flow,'maintenance_work',[{...c.parts[0],quantity:1}],{basis_quote_id:flow.work.id});
    a.equal(addition.total_amount,21000); await c.transition(flow,'awaiting_payment',409); await c.decide(addition,'reject');
    const sum=await c.summary(flow); a.equal(sum.quote_id,flow.work.id); a.equal(sum.total_amount,18000);
    await status(flow,'in_progress','in_service'); s.rejectedAddition=addition;
  });
  add('PAY','Rejected addition cannot be charged','409',()=>c.order(need('rejectedAddition'),409));
  add('MNT','Approved addition cumulative, prior labor fixed','21000 total; original labor preserved; no automatic completion',async()=>{
    const flow=need('inProgress'); flow.previous=flow.work;
    flow.work=await c.quote(flow,'maintenance_work',[{...c.parts[0],quantity:1}],{basis_quote_id:flow.work.id});
    await c.decide(flow.work); const sum=await c.summary(flow); a.equal(sum.total_amount,21000); a.equal(sum.labor_amount,10000); a.equal(sum.other_amount,2000);
    await status(flow,'in_progress','in_service'); s.added=flow;
  });
  add('MNT','Old approved basis cannot create another addition','409',()=>c.quote(need('added'),'maintenance_work',c.parts,{basis_quote_id:need('added').previous.id},'mechanic',409));
  for (const input of [{}, {...c.checklist,work_summary:''}, {...c.checklist,status:'completed'}, {...c.checklist,approved_quote_id:randomUUID()},
    {...c.checklist,safety_checklist:{area_safe:'true'}}]) add('MNT','Checklist invalid or price/state mass assignment','400/422; cannot bypass approval',()=>mutation('POST',`/api/v1/assignments/${need('added').assignment.id}/completion-checklist`,'mechanic',input,invalid));
  add('MNT','Checklist version, ownership and idempotency','Quote binding server-owned; replay same; changed payload conflict; read does not complete',async()=>{
    const flow=need('added'); const path=`/api/v1/assignments/${flow.assignment.id}/completion-checklist`; const id=key();
    await http('POST',path,'mechanic',c.checklist,invalid); const x=await mutation('POST',path,'mechanic',c.checklist,201,id);
    a.equal(x.approved_quote_id,flow.work.id); a.equal((await mutation('POST',path,'mechanic',c.checklist,201,id)).id,x.id);
    await mutation('POST',path,'mechanic',{...c.checklist,work_summary:'Changed retry'},409,id);
    for (const role of ['rider','mechanic','admin']) a.equal((await http('GET',path,role)).id,x.id);
    await http('GET',path,'rider2',undefined,forbidden); await mutation('POST',path,'mechanic2',c.checklist,forbidden);
    await status(flow,'in_progress','in_service'); s.checked=flow;
  });
  add('MNT','Approval after checklist makes checklist stale','Old checklist cannot unlock payment; new revision binds latest quote',async()=>{
    const flow=need('checked'); const extra=await c.quote(flow,'maintenance_work',[{...c.parts[0],quantity:1}],{basis_quote_id:flow.work.id});
    await c.decide(extra); flow.work=extra; await c.transition(flow,'awaiting_payment',409);
    await checklist(flow); await c.transition(flow,'awaiting_payment'); await status(flow,'awaiting_payment','awaiting_payment'); s.payable=flow; s.payQuote=flow.work;
  });
  add('PAY','Payment summary computed from approved work','24000; unpaid 0; remaining full; timing after_service',async()=>{
    const sum=await c.summary(need('payable')); a.equal(sum.total_amount,24000); a.equal(sum.paid_amount,0); a.equal(sum.remaining_amount,24000); a.equal(sum.payment_timing,'after_service');
  });
  for (const input of [{},{quote_id:'bad'},{quote_id:null},{quote_id:randomUUID()},{quote_id:randomUUID(),amount:1},
    {quote_id:randomUUID(),status:'succeeded'},{quote_id:randomUUID(),provider:'cash'}]) add('PAY','Payment input malformed/unknown/mass assignment','Invalid input or nonexistent quote; no provider request',()=>mutation('POST','/api/v1/payments/orders','rider',input,input.quote_id?.length===36?[...invalid,404]:invalid));
  for (const role of ['rider2','mechanic']) add('PAY',`Foreign payment creation by ${role}`,'403/404',()=>c.order(need('payQuote'),forbidden,key(),role));
  add('PAY','Payment missing idempotency','400/422',()=>http('POST','/api/v1/payments/orders','rider',{quote_id:need('payQuote').id},invalid));
  add('PAY','Client cannot reduce charge amount','Extra amount rejected or ignored; approved server charge unchanged',async()=>{
    const independent=!s.payQuote;const flow=independent?await c.ready():need('payable');const quote=independent?flow.work:need('payQuote');
    const value=await c.order(quote,[201,...invalid],key(),'rider',{amount:1});
    if(value.id){a.equal(value.amount,independent?18000:24000);a.equal(value.status,'pending');}
    if(independent){const payment=value.id?value:await c.order(quote);const remote=c.providerOrder(payment);remote.status='PAID';remote.amountPaid=remote.amount;remote.amountRemaining=0;
      await c.webhook(payment);a.equal((await c.summary(flow)).remaining_amount,0);await c.transition(flow,'completed');}
  });
  add('PAY','Payment create and replay','201 same ID; amount equals remaining; provider called once for logical link',async()=>{
    const id=key(); const q=need('payQuote'); const x=await c.order(q,201,id); const y=await c.order(q,201,id); a.equal(x.id,y.id); a.equal(x.amount,24000);
    a.ok(x.checkout_url?.startsWith('https://')); s.payment=x; s.paymentKey=id;
    await mutation('POST','/api/v1/payments/orders','rider',{quote_id:need('labor').id},409,id);
  });
  add('PAY','Concurrent different keys never create two active links','At most one active provider link and one active payment order',async()=>{
    const x=await Promise.all([1,2].map(()=>c.order(need('payQuote'),[200,201,409])));
    const ids=x.filter(v=>v?.id).map(v=>v.id); a.ok(ids.every(id=>id===need('payment').id));
    const rows=await c.sql()`select count(*)::int n from payment_orders where quote_id=${need('payQuote').id} and status in ('created','pending')`; a.equal(rows[0].n,1);
  });
  for (const role of ['rider','mechanic','admin']) add('PAY',`Read order as ${role}`,'Visible to owner/assigned mechanic/admin',()=>http('GET',`/api/v1/payments/orders/${need('payment').id}`,role));
  for (const role of ['rider2','mechanic2']) add('PAY',`Foreign ${role} cannot read order`,'403/404',()=>http('GET',`/api/v1/payments/orders/${need('payment').id}`,role,undefined,forbidden));
  add('PAY','Return URL query cannot mark paid','Only verified webhook/provider reconciliation is evidence',async()=>{
    await http('GET','/api/v1/internal/health/live?status=PAID&code=00&cancel=false','anonymous'); a.equal((await c.summary(need('payable'))).paid_amount,0);
  });
  for (const mode of ['missing','badSignature','tamper']) add('PAY',`Webhook ${mode} rejected`,'400/401/422; no credit and no state advance',async()=>{
    if(mode==='missing') await http('POST','/api/v1/payments/webhooks/payos','anonymous',{},[400,401,422]);
    else await c.webhook(need('payment'),{}, {[mode]:true,expected:[400,401,422]});
    a.equal((await c.summary(need('payable'))).paid_amount,0);
  });
  add('PAY','Signed unknown order is safely ignored','200 controlled acknowledgment; no fixture credit',async()=>{
    await c.webhook(need('payment'),{orderCode:999999999999,paymentLinkId:randomUUID()}); a.equal((await c.summary(need('payable'))).paid_amount,0);
  });
  add('PAY','Pending order cannot complete work','409',()=>c.transition(need('payable'),'completed',409));
  add('PAY','Verified webhook credits exact money once','Succeeded, remaining zero, still awaiting_payment',async()=>{
    const remote=c.providerOrder(need('payment')); remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0;
    s.reference=`TEST-${randomUUID()}`; await c.webhook(need('payment'),{reference:s.reference});
    a.equal((await http('GET',`/api/v1/payments/orders/${need('payment').id}`)).status,'succeeded');
    const sum=await c.summary(need('payable')); a.equal(sum.paid_amount,24000); a.equal(sum.remaining_amount,0); await status(need('payable'),'awaiting_payment','awaiting_payment'); s.paid=need('payable');
  });
  add('PAY','Concurrent/replayed webhook cannot double-credit','Paid amount unchanged; one logical success notification',async()=>{
    await Promise.all([1,2,3].map(()=>c.webhook(need('payment'),{reference:need('reference')})));
    await c.webhook(need('payment')); a.equal((await c.summary(need('paid'))).paid_amount,24000);
    const items=await notificationsFor('rider','payment_order_id',need('payment').id); a.equal(items.length,1);
  });
  add('PAY','Already paid cannot create another charge','409; no zero or double payment',()=>c.order(need('payQuote'),409));
  add('PAY','Succeeded order cannot be canceled','409; paid evidence preserved',()=>http('POST',`/api/v1/payments/orders/${need('payment').id}/cancel`,'rider',{},409));
  add('MNT','Paid maintenance manually completes','Both request/assignment completed; no backward transition',async()=>{
    await c.transition(need('paid'),'completed'); await status(need('paid'),'completed','completed');
    await c.transition(need('paid'),'in_progress',409); s.completed=need('paid');
  });
  add('MNT','Completed assignment allows one immutable owner review','201; duplicate blocked; foreign forbidden',async()=>{
    const path=`/api/v1/assignments/${need('completed').assignment.id}/review`;
    await mutation('POST',path,'rider2',{rating:5},forbidden); await mutation('POST',path,'rider',{rating:5,comment:'Workflow black-box test'},201);
    await mutation('POST',path,'rider',{rating:4},409);
  });
  add('NTF','Maintenance lifecycle notices and navigation','Owner receives assignment, quote, verified payment, completion; unrelated user never receives IDs',async()=>{
    const flow=need('completed'); await worker('outbox/run');
    await notice('rider','assignment_id',flow.assignment.id); await notice('rider','quote_id',flow.work.id); await notice('rider','payment_order_id',need('payment').id);
    a.equal((await notificationsFor('rider2','request_id',flow.request.id)).length,0);
    a.ok((await inbox('rider')).some(x=>x.data?.request_id===flow.request.id&&/hoàn|complete/i.test(x.type+' '+x.title+' '+x.body)),'Completion notice missing');
  });

  // Independent complete workflow variants; expected totals fixed before execution.
  for (const [name,lines,total] of [['no parts',[],12000],['parts quantity 2',c.parts,18000],
    ['fractional part quantity',[{...c.parts[0],quantity:0.5}],13500]]) add('MNT',`E2E ${name}`,'Booking → labor → materials approval → checklist → verified payment → completed',async()=>{
      const flow=await work(await c.assigned(),lines); a.equal((await c.summary(flow)).total_amount,total); await finish(flow);
    });
  add('MNT','Expired labor cannot be approved; revised quote succeeds','Expired quote cannot travel/charge; replacement allows whole workflow',async()=>{
    const flow=await c.assigned(); const expired=await c.quote(flow,'maintenance_labor',c.laborLines,{expires_at:new Date(now()+60_000).toISOString()});
    shift(61_000); await c.decide(expired,'approve','rider',409); await c.transition(flow,'en_route',409);
    flow.labor=await c.quote(flow,'maintenance_labor',c.laborLines); await c.decide(flow.labor); await c.transition(flow,'en_route'); await c.transition(flow,'on_site'); await c.transition(flow,'diagnosis');
    flow.work=await c.quote(flow,'maintenance_work',[]); await c.decide(flow.work); await c.transition(flow,'in_progress'); await finish(flow);
  });
  add('PAY','Cancel pending, replay cancel, new payment then complete','Old link canceled; replacement unique; only replacement credit',async()=>{
    const flow=await c.ready(); const first=await c.order(flow.work); const path=`/api/v1/payments/orders/${first.id}/cancel`;
    await http('POST',path,'rider2',{},forbidden); a.equal((await http('POST',path,'rider',{})).status,'canceled');
    await http('POST',path,'rider',{},[200,409]);a.equal((await http('GET',`/api/v1/payments/orders/${first.id}`)).status,'canceled');
    a.equal((await c.summary(flow)).paid_amount,0);const next=await c.order(flow.work); a.notEqual(next.id,first.id);
    const remote=c.providerOrder(next); remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0;
    await c.webhook(next); a.equal((await c.summary(flow)).paid_amount,18000); await c.transition(flow,'completed');
  });
  for (const [name,change] of [['underpaid',{amount:17000}],['overpaid',{amount:19000}],['currency',{currency:'USD'}],['wrong link',{paymentLinkId:randomUUID()}]]) {
    add('PAY',`Signed webhook ${name} needs intervention`,'No credit/close; review or controlled rejection; admin must independently verify provider',async()=>{
      const flow=await c.ready(); const value=await c.order(flow.work); await c.webhook(value,change,{expected:[200,400,409,422]});
      a.equal((await c.summary(flow)).paid_amount,0); await c.transition(flow,'completed',409);
      const current=await http('GET',`/api/v1/payments/orders/${value.id}`); a.equal(current.status,'needs_review');
      if(current.status==='needs_review') {
        await mutation('POST',`/api/v1/admin/payments/orders/${value.id}/resolve`,'admin',{action:'confirm_received',reason:'Independent provider still has no paid amount'},409);
        const remote=c.providerOrder(value); remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0;
        await mutation('POST',`/api/v1/admin/payments/orders/${value.id}/resolve`,'admin',{action:'confirm_received',reason:'Independent provider verifies full amount received'},200);
      } else { const remote=c.providerOrder(value); remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0; await c.webhook(value); }
      a.equal((await c.summary(flow)).remaining_amount,0); await c.transition(flow,'completed');
    });
  }
  add('PAY','Late success after canceled link requires review','No automatic credit; admin proof and ownership/idempotency required',async()=>{
    const flow=await c.ready(); const value=await c.order(flow.work); await http('POST',`/api/v1/payments/orders/${value.id}/cancel`,'rider',{});
    const remote=c.providerOrder(value); remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0; await c.webhook(value);
    a.equal((await http('GET',`/api/v1/payments/orders/${value.id}`)).status,'needs_review'); a.equal((await c.summary(flow)).paid_amount,0);
    const path=`/api/v1/admin/payments/orders/${value.id}/resolve`; const input={action:'confirm_received',reason:'Provider verified late payment after cancellation'};
    for(const role of ['rider','mechanic']) await mutation('POST',path,role,input,403);
    await http('POST',path,'admin',input,invalid); await mutation('POST',path,'admin',{...input,reason:'short'},invalid);
    const id=key(); await mutation('POST',path,'admin',input,200,id); await mutation('POST',path,'admin',input,200,id);
    await mutation('POST',path,'admin',{...input,action:'close_unpaid'},409,id); a.equal((await c.summary(flow)).remaining_amount,0); await c.transition(flow,'completed');
  });
  add('PAY','Reconcile recovers missed webhook','Stale provider PAID credits once, remains awaiting_payment until mechanic closes',async()=>{
    const flow=await c.ready(); const value=await c.order(flow.work); const remote=c.providerOrder(value);
    remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0;
    shift(60*60_000); await worker('payments/reconcile');
    a.equal((await http('GET',`/api/v1/payments/orders/${value.id}`)).status,'succeeded'); a.equal((await c.summary(flow)).remaining_amount,0);
    await worker('payments/reconcile'); a.equal((await c.summary(flow)).paid_amount,18000); await c.transition(flow,'completed');
  });
  add('PAY','Provider create outage cannot mark paid; recovery retry','Controlled 502/503; same key recovers link; no duplicate credit',async()=>{
    const flow=await c.ready(); const id=key(); c.provider().createMode('unavailable');
    try { await c.order(flow.work,[502,503],id); a.equal((await c.summary(flow)).paid_amount,0); } finally { c.provider().createMode('success'); }
    const value=await c.order(flow.work,[200,201],id); const remote=c.providerOrder(value); remote.status='PAID'; remote.amountPaid=remote.amount; remote.amountRemaining=0;
    await c.webhook(value); await c.transition(flow,'completed');
  });

  add('MNT','Future reservation blocks overlap but allows unrelated immediate job','Future confirmed does not occupy current job; early travel blocked; active job blocks later activation',async()=>{
    await c.refreshMechanics(); const flow=await c.assigned({scheduled:now()+4*60*60_000}); flow.labor=await c.quote(flow,'maintenance_labor',c.laborLines); await c.decide(flow.labor);
    await c.transition(flow,'en_route',409);
    const overlap=await c.book({scheduled:Date.parse(flow.request.scheduled_start_at)+15*60_000}); await dispatchQueued(overlap.id);
    const offers=await http('GET','/api/v1/dispatch/offers','mechanic'); a.ok(!offers.items.some(x=>x.request_id===overlap.id),'Overlapping reservation must not invite same mechanic'); await cancel(overlap);
    const rescue=await c.assigned({service:'emergency_rescue',scheduled:0});
    shift(Date.parse(flow.request.scheduled_start_at)-30*60_000-now()); await c.transition(flow,'en_route',409);
    await mutation('POST',`/api/v1/assignments/${rescue.assignment.id}/recover`,'mechanic',{reason_code:'cannot_continue'},200); await cancel(rescue);
    await c.refreshMechanics(); await worker('dispatch/run');
    await c.transition(flow,'en_route'); await c.transition(flow,'on_site'); await c.transition(flow,'diagnosis');
    flow.work=await c.quote(flow,'maintenance_work',[]); await c.decide(flow.work); await c.transition(flow,'in_progress'); await finish(flow);
  });
  add('MNT','No available mechanic never confirms appointment','Bounded rounds -> manual_escalation + rider notice; no assignment; direct cancel remains409 by existing policy',async()=>{
    for(const role of ['mechanic','mechanic2']) await http('PUT','/api/v1/mechanics/me/availability',role,{is_available:false});
    const req=await c.book();
    try { await dispatchQueued(req.id); for(let i=0;i<6;i++){shift(10*60_000);await worker('dispatch/run');}
      a.equal((await request({request:req})).status,'manual_escalation'); await notice('rider','request_id',req.id);
      const [row]=await c.sql()`select count(*)::int n from assignments where request_id=${req.id}`;a.equal(row.n,0);
      await http('POST',`/api/v1/service-requests/${req.id}/cancel`,'rider',{reason:'Escalated fixture cancellation guard'},409);
      a.equal((await request({request:req})).status,'manual_escalation');
    } finally { for(const role of ['mechanic','mechanic2']) await http('PUT','/api/v1/mechanics/me/availability',role,{is_available:true}); await c.refreshMechanics(); }
  });

  for (const more of [{title:''},{title:'x'.repeat(201)},{interval_days:0},{interval_days:3651},{interval_days:1.5},
    {enabled:'true'},{next_due_at:'bad'},{odometer_km:1000},{rider_id:randomUUID()}]) add('NTF',`Reminder invalid ${Object.keys(more)[0]}`,'400/422; no invalid reminder persisted',()=>http('POST','/api/v1/reminders','rider',{
      motorcycle_id:need('bike').id,title:'Reminder',next_due_at:new Date(now()+1000).toISOString(),enabled:true,...more},invalid));
  add('NTF','Reminder motorcycle ownership','403',()=>http('POST','/api/v1/reminders','rider',{motorcycle_id:need('foreignBike').id,title:'Reminder',next_due_at:new Date(now()+1000).toISOString(),enabled:true},403));
  add('NTF','Due reminder atomic inbox and repeated workers','One occurrence/inbox; queued truthfully; worker sent counter zero',async()=>{
    const value=await reminder(); shift(2000); const runs=await Promise.all([1,2].map(()=>worker('reminders/run')));
    for(const run of runs) a.equal(run.sent,0); const notices=await notice('rider','reminder_id',value.id); a.equal(notices.length,1);
    a.match(notices[0].data.reminder_context_id,/^[a-f0-9-]{36}$/i); a.equal(notices[0].data.motorcycle_id,need('bike').id);
    await worker('reminders/run'); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,1); s.reminder=value; s.reminderNotice=notices[0];
  });
  add('NTF','Reminder snooze and schedule edit clears snooze','Effective due moves; not early; PATCH removes old snooze',async()=>{
    const value=await reminder({next_due_at:new Date(now()+10*60_000).toISOString()}); s.snooze=value;
    await http('POST',`/api/v1/reminders/${value.id}/snooze`,'rider',{until:new Date(now()+60_000).toISOString()},invalid);
    await http('POST',`/api/v1/reminders/${value.id}/snooze`,'rider',{until:new Date(now()+20*60_000).toISOString()});
    shift(11*60_000);await worker('reminders/run');a.equal((await notificationsFor('rider','reminder_id',value.id)).length,0,'Snooze must postpone the original due time');
    const patched=await http('PATCH',`/api/v1/reminders/${value.id}`,'rider',reminderInput(value,{next_due_at:new Date(now()+1000).toISOString()})); a.equal(patched.snoozed_until??null,null);
    const [stored]=await c.sql()`select snoozed_until from reminder_rules where id=${value.id}`;a.equal(stored.snoozed_until,null,'Schedule edit must actually clear the stored snooze');
    shift(2000); await worker('reminders/run'); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,1);
  });
  for(const suffix of ['', '/snooze']) add('NTF',`Foreign reminder mutation ${suffix || 'PATCH'}`,'403',()=>http(suffix?'POST':'PATCH',`/api/v1/reminders/${need('reminder').id}${suffix}`,'rider2',suffix?{until:new Date(now()+60_000).toISOString()}:reminderInput(need('reminder'),{enabled:false,next_due_at:new Date(now()+60_000).toISOString()}),403));
  add('NTF','Disabled reminder does not notify','No occurrence inbox after due',async()=>{
    const value=await reminder({enabled:false}); shift(2000); await worker('reminders/run'); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,0);
  });
  add('NTF','Archived motorcycle disables reminders','Worker never sends due reminder for archived vehicle',async()=>{
    const bike=await http('POST','/api/v1/motorcycles','rider',{brand_text:'Honda',model_text:'Archive reminder test'},201);
    const value=await reminder({motorcycle_id:bike.id}); await http('DELETE',`/api/v1/motorcycles/${bike.id}`,'rider',undefined,204);
    shift(2000); await worker('reminders/run'); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,0);
    const list=await http('GET','/api/v1/reminders'); a.equal(list.items.find(x=>x.id===value.id)?.enabled,false);
  });
  add('NTF','Recurring date reminder advances once without drift duplication','Next due + interval; no duplicate on worker repeat; next cycle gets new context',async()=>{
    const value=await due({interval_days:1}); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,1);
    const list=await http('GET','/api/v1/reminders'); const updated=list.items.find(x=>x.id===value.id); a.ok(Date.parse(updated.next_due_at)>now());
    shift(24*60*60_000); await worker('reminders/run'); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,2);
    const current=(await http('GET','/api/v1/reminders')).items.find(x=>x.id===value.id);
    await http('PATCH',`/api/v1/reminders/${value.id}`,'rider',reminderInput(current,{enabled:false}));
  });
  add('NTF','Reminder creates immediate maintenance once; completion leaves recurrence intact','References owned/due/vehicle-bound; occurrence consumed only after successful request',async()=>{
    const value=await due({interval_days:2}); const n=(await notificationsFor('rider','reminder_id',value.id))[0];
    const input=body({reminder_id:value.id,reminder_context_id:n.data.reminder_context_id}); delete input.scheduled_start_at;
    await mutation('POST','/api/v1/service-requests','rider2',input,403);
    const req=await mutation('POST','/api/v1/service-requests','rider',input,201); await mutation('POST','/api/v1/service-requests','rider',input,409);
    await c.refreshMechanics(); await dispatchQueued(req.id); const offers=await http('GET','/api/v1/dispatch/offers','mechanic'); const offer=offers.items.find(x=>x.request_id===req.id); a.ok(offer);
    const assignment=await http('POST',`/api/v1/dispatch/offers/${offer.id}/accept`,'mechanic',{},201); const flow=await work({request:req,assignment}); await finish(flow);
    const current=(await http('GET','/api/v1/reminders')).items.find(x=>x.id===value.id); a.equal(current.enabled,true); a.equal(current.interval_days,2); a.ok(Date.parse(current.next_due_at)>now());
    await http('PATCH',`/api/v1/reminders/${value.id}`,'rider',reminderInput(current,{enabled:false}));
  });

  for(const query of ['limit=0','limit=101','limit=abc','cursor=invalid','unread_only=wrong']) add('NTF',`Inbox invalid filter ${query}`,'400/422',()=>http('GET',`/api/v1/notifications?${query}`,'rider',undefined,invalid));
  add('NTF','Inbox opaque cursor pagination','No duplicates/missing across pages; limit respected; owner data only',async()=>{
    const all=await inbox('rider'); a.ok(all.length>=3); const seen=[]; let cursor;
    do { const page=await http('GET',`/api/v1/notifications?limit=2${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`); a.ok(page.items.length<=2);
      seen.push(...page.items.map(x=>x.id)); cursor=page.page?.next_cursor; a.ok(seen.length<=all.length,'Pagination loop'); } while(cursor);
    a.equal(new Set(seen).size,seen.length); a.deepEqual(new Set(seen),new Set(all.map(x=>x.id)));
    s.notification=all[0];
  });
  add('NTF','Unread → read idempotent independent of delivery','Unread decrements once; first read timestamp preserved; foreign owner 404',async()=>{
    const n=need('notification'); const before=await http('GET','/api/v1/notifications/unread-count');
    await http('POST',`/api/v1/notifications/${n.id}/read`,'rider2',undefined,404);
    const first=await http('POST',`/api/v1/notifications/${n.id}/read`); const again=await http('POST',`/api/v1/notifications/${n.id}/read`);
    a.equal(first.read_at,again.read_at); a.equal((await http('GET','/api/v1/notifications/unread-count')).unread_count,before.unread_count-1);
    a.ok(!(await http('GET','/api/v1/notifications?unread_only=true')).items.some(x=>x.id===n.id));
  });
  add('NTF','Read-all idempotent and owner-scoped','Owner unread zero; unrelated user count unchanged',async()=>{
    const other=await http('GET','/api/v1/notifications/unread-count','rider2'); await http('POST','/api/v1/notifications/read-all');
    a.equal((await http('GET','/api/v1/notifications/unread-count')).unread_count,0); a.equal((await http('POST','/api/v1/notifications/read-all')).marked_read,0);
    a.equal((await http('GET','/api/v1/notifications/unread-count','rider2')).unread_count,other.unread_count);
  });

  const devices=[];
  const device = async token => {
    const value=await http('POST','/api/v1/auth/devices','rider',{device_key:`workflow-${randomUUID()}`,platform:'android',push_provider:'fcm',push_token:token});
    a.equal(value.push_token_registered,true); a.ok(!JSON.stringify(value).includes(token)); devices.push(value); return value;
  };
  const revoke = async () => { for(const value of devices.splice(0)) await http('DELETE',`/api/v1/auth/devices/${value.id}/push-token`); };
  // A worker processes a bounded batch. Drain older fixtures before registering
  // a destination so it cannot be invalidated by an unrelated older notice.
  const drain = async () => {
    for(let i=0;i<40;i++){
      const [row]=await c.sql()`select count(*)::int n from outbox_events where status in ('pending','processing') and next_attempt_at<=${new Date(now())}`;
      if(!row.n)return;
      await Promise.all([1,2,3].map(()=>worker('outbox/run')));
    }
    block('Earlier outbox fixtures did not drain within 40 batches');
  };
  const deliver = async id => {
    for(let i=0;i<40;i++){
      await worker('outbox/run');
      const rows=await c.sql()`select status,attempt_count from outbox_events where topic='notification.created' and aggregate_id=${id}`;
      if(rows[0]?.attempt_count>0||rows[0]?.status==='processed')return;
    }
    block('Target notification was not attempted within 40 batches');
  };
  for(const more of [{push_token:'x'.repeat(40)},{push_provider:'fcm'},{push_provider:'unsupported',push_token:'x'.repeat(40)}]) add('NTF','Device token fields paired/provider controlled','400/422',()=>http('POST','/api/v1/auth/devices','rider',{device_key:`workflow-${randomUUID()}`,platform:'android',...more},invalid));
  add('NTF','Push token ownership, rotation and revoke','Token never returned; foreign cannot rotate; revoke replay safe',async()=>{
    const value=await device(`test-success-${randomUUID()}`); const path=`/api/v1/auth/devices/${value.id}/push-token`;
    await http('PUT',path,'rider2',{push_token:`test-success-${randomUUID()}`,push_provider:'fcm'},forbidden);
    a.equal((await http('PUT',path,'rider',{push_token:`test-success-${randomUUID()}`,push_provider:'fcm'})).push_token_registered,true);
    a.equal((await http('DELETE',path)).push_token_registered,false); a.equal((await http('DELETE',path)).push_token_registered,false); devices.splice(0);
  });
  add('NTF','No active device retains inbox; no provider call','No raw-device destination; inbox usable even when no push',async()=>{
    await worker('outbox/run'); const start=c.provider().sends.length; const value=await due(); const notices=await notice('rider','reminder_id',value.id);
    await worker('outbox/run'); a.ok(!c.provider().sends.slice(start).some(x=>x.id===notices[0].id)); a.equal((await notificationsFor('rider','reminder_id',value.id)).length,1);
  });
  for(const mode of ['success','invalid','mismatch','permanent','temporary','quota']) add('NTF',`FCM ${mode} wire response`,'Inbox persists; typed failure classified; successful devices not resent; Retry-After honored',async()=>{
    await revoke(); await drain(); const token=`test-${mode}-${randomUUID()}`; const value=await device(token);
    const rule=await due(); const n=(await notificationsFor('rider','reminder_id',rule.id))[0]; await deliver(n.id);
    const sends=()=>c.provider().sends.filter(x=>x.id===n.id&&x.token===token); a.equal(sends().length,1);
    const rows=await c.sql()`select * from notification_delivery_receipts where notification_id=${n.id}`; a.equal(rows.length,1);
    if(mode==='success') { a.equal(rows[0].status,'sent'); await worker('outbox/run'); a.equal(sends().length,1); }
    if(['invalid','mismatch'].includes(mode)) {
      const metadata=await http('POST','/api/v1/auth/devices','rider',{device_key:'metadata-probe-new-device',platform:'android'});
      const credentials=await c.sql()`select exists(select 1 from device_delivery_credentials where device_id=${value.id} and enabled=true) as push_token_registered`;
      a.equal(credentials[0].push_token_registered,false); a.ok(metadata.id);
    }
    if(mode==='permanent') { await worker('outbox/run'); a.equal(sends().length,1); a.notEqual(rows[0].status,'sent'); }
    if(['temporary','quota'].includes(mode)) {
      const [event]=await c.sql()`select next_attempt_at from outbox_events where topic='notification.created' and aggregate_id=${n.id}`;
      a.ok(Date.parse(event.next_attempt_at)-Date.parse(rows[0].last_attempted_at)>=(mode==='quota'?120:60)*1000,'Provider Retry-After minimum');
      await worker('outbox/run'); a.equal(sends().length,1); if(mode==='quota'){shift(30_000);await worker('outbox/run');a.equal(sends().length,1);shift(120_000);}else shift(10*60_000);
      await worker('outbox/run'); a.equal(sends().length,2);
    }
    a.equal((await notificationsFor('rider','reminder_id',rule.id)).length,1); await revoke();
  });
  add('NTF','Mixed devices retry only unresolved device','One success, one invalid, one temporary; terminal destinations sent once',async()=>{
    await revoke(); await drain(); const tokens=['success','invalid','temporary'].map(x=>`test-${x}-${randomUUID()}`);
    for(const token of tokens) await device(token); const rule=await due(); const n=(await notificationsFor('rider','reminder_id',rule.id))[0]; await deliver(n.id);
    shift(10*60_000); await worker('outbox/run'); const counts=tokens.map(token=>c.provider().sends.filter(x=>x.id===n.id&&x.token===token).length);
    a.deepEqual(counts,[1,1,2]); await revoke();
  });
  add('NTF','Concurrent outbox workers deduplicate slow provider sends','One successful send per notification/device version; no duplicate inbox',async()=>{
    await revoke(); await drain(); const token=`test-slow-${randomUUID()}`; await device(token); const rule=await due(); const n=(await notificationsFor('rider','reminder_id',rule.id))[0];
    await Promise.all([1,2,3].map(()=>worker('outbox/run'))); a.equal(c.provider().sends.filter(x=>x.id===n.id&&x.token===token).length,1); await revoke();
  });
  add('NTF','Permanent temporary-failure exhaustion dead letters','Bounded retries; not falsely sent; inbox remains; operational queue visible',async()=>{
    await revoke(); await drain(); const token=`test-alwaysfail-${randomUUID()}`; await device(token); const rule=await due(); const n=(await notificationsFor('rider','reminder_id',rule.id))[0];
    for(let i=0;i<12;i++){
      await worker('outbox/run');
      const [event]=await c.sql()`select status from outbox_events where topic='notification.created' and aggregate_id=${n.id}`;
      if(event?.status==='dead_letter')break;
      shift(24*60*60_000);
    }
    const rows=await c.sql()`select status from outbox_events where topic='notification.created' and aggregate_id=${n.id}`;
    a.equal(rows.length,1); a.equal(rows[0].status,'dead_letter'); a.equal((await notificationsFor('rider','reminder_id',rule.id)).length,1);
    await http('GET','/api/v1/admin/operations/outbox-dead-letters','admin'); await revoke();
  });

  for(const timing of ['labor_upfront','after_repair']) add('NTF',`Rescue E2E notifications ${timing}`,'Offer → assignment → labor → travel → parts → payment → completion notices owner-only',async()=>{
    const flow=await c.assigned({service:'emergency_rescue',scheduled:0});
    const labor=await http('POST',`/api/v1/service-requests/${flow.request.id}/quotes`,'mechanic',{assignment_id:flow.assignment.id,purpose:'rescue_labor',labor_pricing:{base_amount:10000,distance_amount:0,weather_amount:0,time_amount:0,weather:'sunny'}},201);
    await c.decide(labor,'approve','rider',200,{payment_timing:timing});
    if(timing==='labor_upfront'){const value=await c.order(labor);const remote=c.providerOrder(value);remote.status='PAID';remote.amountPaid=remote.amount;remote.amountRemaining=0;await c.webhook(value);}
    await c.transition(flow,'en_route'); await c.transition(flow,'on_site'); await c.transition(flow,'diagnosis');
    flow.work=await c.quote(flow,'rescue_final',c.parts); await c.decide(flow.work); await c.transition(flow,'in_progress'); await c.transition(flow,'awaiting_payment');
    const value=await c.order(flow.work); a.equal(value.amount,timing==='labor_upfront'?6000:16000); const remote=c.providerOrder(value);remote.status='PAID';remote.amountPaid=remote.amount;remote.amountRemaining=0;await c.webhook(value);await c.transition(flow,'completed');
    await notice('rider','request_id',flow.request.id); await notice('rider','quote_id',labor.id); await notice('rider','payment_order_id',value.id);
    a.equal((await notificationsFor('rider2','request_id',flow.request.id)).length,0);
  });

  const manual = [
    ['PAY','Real bank transfer + signed external payOS webhook','Approved test bank account and explicit money-transfer execution; stub cannot prove settlement'],
    ['PAY','Legacy standard maintenance prepayment compatibility','Pre-migration approved legacy fixture; cannot fabricate workflow state through SQL'],
    ['PAY','Provider timeout after link creation and process crash before response','Dedicated crash/restart fault injection with durable provider state'],
    ['MNT','Repair legacy request missing location','Existing legacy request fixture created before migration035; current API rejects malformed new data'],
    ['NTF','Android physical receipt foreground/background/app terminated','FCM service credentials + registered real-device token + physical receipt observer'],
    ['NTF','iOS physical receipt foreground/background/app terminated','APNs/FCM setup + registered iOS device + physical receipt observer'],
    ['NTF','Permission denied/offline/device reconnect/notification tap','Physical client/device automation and authenticated navigation observer'],
    ['NTF','Logout/account switch does not send previous user notices','Mobile client session/token lifecycle on physical device'],
    ['NTF','Crash after provider success before receipt commit','Process-kill injection; possible duplicate must share notification_id for client dedupe'],
    ['NTF','Rotate token during invalidation and expired lease owner fencing','Provider barrier and two independently controlled worker processes'],
    ['NTF','Missing FCM config must report failure not sent','Separate restart variant with FCM config intentionally removed']
  ];
  for(const [group,name,required] of manual) add(group,name,'Explicit evidence required; never inferred from simulated provider success',async()=>{
    if(c.legacy&&['Legacy standard maintenance prepayment compatibility','Repair legacy request missing location'].includes(name))return c.testLegacyCase(name);
    if(name==='Provider timeout after link creation and process crash before response'&&c.paymentCrash){
      const flow=await c.ready();const id=key();const entered=Promise.withResolvers(),resume=Promise.withResolvers();
      c.provider().onPaymentCreated(async()=>{entered.resolve();await resume.promise;});
      try{
        const pending=c.order(flow.work,[200,201],id).then(value=>({value}),error=>({error}));
        await Promise.race([entered.promise,pending.then(({error})=>{throw error||new Error('Payment barrier not reached');})]);
        a.equal(c.provider().orders.size,1);await c.crashApi();
        const rows=await c.sql()`select id,status from payment_orders where quote_id=${flow.work.id}`;
        a.equal(rows.length,1);a.equal(rows[0].status,'created','Crash must precede provider-result persistence');
        resume.resolve();c.provider().onPaymentCreated(undefined);const interrupted=await pending;
        a.ok(['TypeError','AbortError','TimeoutError'].includes(interrupted.error?.name),'Stopped request must disconnect');
        await c.restartApi();const value=await c.order(flow.work,[200,201],id);a.equal(value.id,rows[0].id);a.equal(value.status,'pending');
        const replay=await c.order(flow.work,[200,201],id);a.equal(replay.id,value.id);a.equal(c.provider().orders.size,1);
        const [count]=await c.sql()`select count(*)::int n from payment_orders where quote_id=${flow.work.id}`;a.equal(count.n,1);
        a.equal((await c.summary(flow)).paid_amount,0);await c.transition(flow,'completed',409);
        await http('POST',`/api/v1/payments/orders/${value.id}/cancel`,'rider',{});a.equal((await c.summary(flow)).remaining_amount,18000);
      }finally{resume.resolve();c.provider().onPaymentCreated(undefined);}
      return;
    }
    if(name==='Crash after provider success before receipt commit'&&c.pushCrash){
      await drain();await device(`test-success-${randomUUID()}`);const rule=await due();const n=(await notificationsFor('rider','reminder_id',rule.id))[0];
      const entered=Promise.withResolvers(),resume=Promise.withResolvers();
      c.provider().onPushAccepted(async value=>{if(value.notificationId===n.id){entered.resolve();await resume.promise;}});
      try{
        const pending=worker('outbox/run').then(value=>({value}),error=>({error}));
        await Promise.race([entered.promise,pending.then(({error})=>{throw error||new Error('Push barrier not reached');})]);
        a.equal(c.provider().sends.filter(x=>x.id===n.id).length,1);await c.crashApi();
        const [receipt]=await c.sql()`select status,completed_at is null as incomplete,
          lease_token is not null and lease_expires_at is not null as leased from notification_delivery_receipts where notification_id=${n.id}`;
        a.equal(receipt.status,'pending');a.equal(receipt.incomplete,true);a.equal(receipt.leased,true,'Crash must precede receipt completion while the receipt lease is held');
        resume.resolve();c.provider().onPushAccepted(undefined);const interrupted=await pending;
        a.ok(['TypeError','AbortError','TimeoutError'].includes(interrupted.error?.name),'Stopped worker request must disconnect');
        shift(10*60_000);await c.restartApi();await deliver(n.id);
        const [finished]=await c.sql()`select status from notification_delivery_receipts where notification_id=${n.id}`;a.equal(finished.status,'sent');
        const [event]=await c.sql()`select status from outbox_events where topic='notification.created' and aggregate_id=${n.id}`;a.equal(event.status,'processed');
        a.equal(c.provider().sends.filter(x=>x.id===n.id).length,2,'Accepted transport may repeat across the crash gap with the same notification_id');
        a.equal((await notificationsFor('rider','reminder_id',rule.id)).length,1);await revoke();
      }finally{resume.resolve();c.provider().onPushAccepted(undefined);}
      return;
    }
    if(name==='Rotate token during invalidation and expired lease owner fencing'&&c.fencing){
      await drain();await c.startSecondaryApi();await c.secondaryWorker('outbox/run');await device(`test-success-${randomUUID()}`);const firstRule=await due();const firstNotice=(await notificationsFor('rider','reminder_id',firstRule.id))[0];
      let entered=Promise.withResolvers(),resume=Promise.withResolvers();
      c.provider().onPushAccepted(async value=>{if(value.notificationId===firstNotice.id){entered.resolve();await resume.promise;}});
      const oldWorker=worker('outbox/run').then(value=>({value}),error=>({error}));
      try{
        await Promise.race([entered.promise,oldWorker.then(({error})=>{throw error||new Error('Old worker barrier not reached');})]);
        const barrierAt=Date.now();
        c.pauseApi();
        const [held]=await c.sql()`select status,completed_at is null as incomplete,
          lease_token is not null and lease_expires_at is not null as leased from notification_delivery_receipts where notification_id=${firstNotice.id}`;
        a.equal(held.status,'pending');a.equal(held.incomplete,true);a.equal(held.leased,true);
        a.equal(c.provider().sends.filter(x=>x.id===firstNotice.id).length,1);
        shift(10*60_000);c.provider().onPushAccepted(undefined);resume.resolve();
        const takeover=c.secondaryWorker('outbox/run').then(value=>({value}),error=>({error}));let completed=false;
        for(let i=0;i<80;i++){
          const [row]=await c.sql()`select r.status='sent' and e.status='processed' as completed from notification_delivery_receipts r
            join outbox_events e on e.aggregate_id=r.notification_id and e.topic='notification.created' where r.notification_id=${firstNotice.id}`;
          if(row?.completed){completed=true;break;}if(Date.now()-barrierAt>23_000)break;await c.wait(100);
        }
        if(!completed||Date.now()-barrierAt>23_000)block('Lease takeover did not finish inside the old FCM response deadline; stale success is unproven');
        const [terminal]=await c.sql()`select status,completed_at,attempt_count,lease_token is null as released from notification_delivery_receipts where notification_id=${firstNotice.id}`;
        a.equal(terminal.status,'sent');a.equal(terminal.released,true);a.ok(terminal.attempt_count>=1);
        a.equal(c.provider().sends.filter(x=>x.id===firstNotice.id).length,2,'New process must send after reclaiming the paused execution lease');
        const [eventBefore]=await c.sql()`select status,processed_at,attempt_count from outbox_events where topic='notification.created' and aggregate_id=${firstNotice.id}`;
        a.equal(eventBefore.status,'processed');a.ok(eventBefore.attempt_count>=2);
        if(Date.now()-barrierAt>25_000)block('Snapshot exceeded the old FCM response deadline; stale success is unproven');
        c.resumeApi();const oldResult=await oldWorker;a.ok(oldResult.value,'Old execution must exit with controlled worker response');a.ok((await takeover).value);
        const [after]=await c.sql()`select status,completed_at,attempt_count,lease_token is null as released from notification_delivery_receipts where notification_id=${firstNotice.id}`;
        a.deepEqual(after,terminal,'Old process cannot overwrite terminal receipt');
        const [eventAfter]=await c.sql()`select status,processed_at,attempt_count from outbox_events where topic='notification.created' and aggregate_id=${firstNotice.id}`;
        a.deepEqual(eventAfter,eventBefore,'Old process cannot overwrite terminal outbox');
        a.equal((await notificationsFor('rider','reminder_id',firstRule.id)).length,1);await revoke();
      }finally{resume.resolve();c.provider().onPushAccepted(undefined);c.resumeApi();}

      await drain();const deviceKey=`workflow-${randomUUID()}`,oldToken=`test-invalid-${randomUUID()}`,newToken=`test-success-${randomUUID()}`;
      const registered=await http('POST','/api/v1/auth/devices','rider',{device_key:deviceKey,platform:'android',push_provider:'fcm',push_token:oldToken});devices.push(registered);
      const [before]=await c.sql()`select credential_version,enabled from device_delivery_credentials where device_id=${registered.id} and enabled=true`;
      const nextRule=await due();const nextNotice=(await notificationsFor('rider','reminder_id',nextRule.id))[0];entered=Promise.withResolvers();resume=Promise.withResolvers();
      c.provider().onPushRequest(async value=>{if(value.notificationId===nextNotice.id){entered.resolve();await resume.promise;}});
      const invalidating=worker('outbox/run').then(value=>({value}),error=>({error}));
      try{
        await Promise.race([entered.promise,invalidating.then(({error})=>{throw error||new Error('Old-token barrier not reached');})]);
        const rotated=await http('POST','/api/v1/auth/devices','rider',{device_key:deviceKey,platform:'android',push_provider:'fcm',push_token:newToken});a.equal(rotated.id,registered.id);a.equal(rotated.push_token_registered,true);
        c.provider().onPushRequest(undefined);resume.resolve();a.ok((await invalidating).value);
        const active=await c.sql()`select credential_version,enabled from device_delivery_credentials where device_id=${registered.id} and enabled=true`;
        a.equal(active.length,1,'Rotation must leave exactly one active credential');const current=active[0];
        a.ok(current.credential_version>before.credential_version);a.equal(current.enabled,true,'Old UNREGISTERED cannot disable new credential version');
        const proofRule=await due();const proofNotice=(await notificationsFor('rider','reminder_id',proofRule.id))[0];await deliver(proofNotice.id);
        a.ok(c.provider().sends.some(x=>x.id===proofNotice.id&&x.token===newToken),'New token must receive a later notice');
        a.equal((await notificationsFor('rider','reminder_id',nextRule.id)).length,1);await revoke();
      }finally{resume.resolve();c.provider().onPushRequest(undefined);}
      return;
    }
    if(name==='Missing FCM config must report failure not sent'&&c.missingFcm){
      await drain();await device(`test-success-${randomUUID()}`);const rule=await due();const n=(await notificationsFor('rider','reminder_id',rule.id))[0];await deliver(n.id);
      a.equal(c.provider().sends.length,0);const [notice]=await c.sql()`select status from notifications where id=${n.id}`;a.notEqual(notice.status,'sent');
      const [event]=await c.sql()`select status,last_error_code from outbox_events where topic='notification.created' and aggregate_id=${n.id}`;
      a.ok(['pending','dead_letter'].includes(event.status),'Missing configuration must remain retryable or dead-lettered');
      a.ok(typeof event.last_error_code==='string'&&event.last_error_code.length,'Controlled failure code required');a.notEqual(event.last_error_code,'NO_ACTIVE_DEVICE');
      a.equal((await notificationsFor('rider','reminder_id',rule.id)).length,1);await revoke();return;
    }
    block(required);
  });
  return tests;
}
