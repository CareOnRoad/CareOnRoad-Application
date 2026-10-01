import { randomUUID } from 'node:crypto';

export function buildExtraCases(c) {
  const {assert:a,http,mutation,worker,now,shift,key}=c; const tests=[]; let n=0;
  const add=(name,expectation,run)=>tests.push({id:`EXT-${String(++n).padStart(3,'0')}`,group:'EXT',name,expectation,run});
  const cancel=req=>http('POST',`/api/v1/service-requests/${req.id}/cancel`,'rider',{reason:'End isolated fixture'});
  const recover=async(flow,role='mechanic')=>{
    await mutation('POST',`/api/v1/assignments/${flow.assignment.id}/recover`,role,{reason_code:'cannot_continue'},200);
    await cancel(flow.request);
  };
  const offered=async(options={})=>{
    await c.refreshMechanics(); const request=await c.book(options);
    await http('POST',`/api/v1/service-requests/${request.id}/dispatch`,'rider',undefined,202);
    const offers={};for(const role of ['mechanic','mechanic2']) offers[role]=(await http('GET','/api/v1/dispatch/offers',role)).items.find(x=>x.request_id===request.id);
    return {request,offers};
  };
  const paid=async(flow,value)=>{
    const remote=c.providerOrder(value);remote.status='PAID';remote.amountPaid=remote.amount;remote.amountRemaining=0;await c.webhook(value);
    a.equal((await c.summary(flow)).remaining_amount,0);await c.transition(flow,'completed');
  };
  for(const raw of ['{','[]','null','true']) add(`Malformed/incorrect JSON booking: ${raw}`,'400/422, no request creation',()=>
    mutation('POST','/api/v1/service-requests','rider',raw,[400,422]));
  for(const [latitude,longitude] of [[90,180],[-90,-180],[0,0]]) add(`Legal coordinate boundary ${latitude},${longitude}`,'Request accepted with legal coordinates then canceled; no out-of-range coercion',async()=>{
    const req=await mutation('POST','/api/v1/service-requests','rider',{motorcycle_id:c.state.bike.id,service_type:'periodic_maintenance',problem_description:'Coordinate boundary',
      scheduled_start_at:new Date(now()+60_000).toISOString(),location:{latitude,longitude}},201);await cancel(req);
  });
  add('Booking accepts ISO time with +07:00 offset','Stored appointment denotes the same instant, not a shifted timezone',async()=>{
    const date=now()+60*60_000;const local=new Date(date+7*60*60_000).toISOString().replace('Z','+07:00');
    const req=await mutation('POST','/api/v1/service-requests','rider',{motorcycle_id:c.state.bike.id,service_type:'periodic_maintenance',problem_description:'Timezone boundary',
      scheduled_start_at:local,location:{latitude:11.12345,longitude:107.12345}},201);a.equal(Date.parse(req.scheduled_start_at),date);await cancel(req);
  });
  add('Archived motorcycle cannot book maintenance','404; archived owner vehicle unusable',async()=>{
    const bike=await http('POST','/api/v1/motorcycles','rider',{brand_text:'Honda',model_text:'Archived booking'},201);
    await http('DELETE',`/api/v1/motorcycles/${bike.id}`,'rider',undefined,204);
    await mutation('POST','/api/v1/service-requests','rider',{motorcycle_id:bike.id,service_type:'periodic_maintenance',problem_description:'Archived booking',
      scheduled_start_at:new Date(now()+60_000).toISOString(),location:{latitude:11.12345,longitude:107.12345}},404);
  });
  for(const mode of ['missing skill','outside radius','stale location','unavailable','suspended']) add(`Dispatch excludes mechanic: ${mode}`,'Ineligible mechanic receives no live maintenance offer; other eligible mechanic unaffected',async()=>{
    await c.refreshMechanics();const req=await c.book();
    try {
      if(mode==='missing skill')await http('PATCH','/api/v1/mechanics/me/profile','mechanic',{service_types:['emergency_rescue']});
      if(mode==='outside radius')await http('PUT','/api/v1/mechanics/me/location','mechanic',{latitude:12.5,longitude:108.5},204);
      if(mode==='stale location'){shift(301_000);await http('PUT','/api/v1/mechanics/me/location','mechanic2',{latitude:11.12345,longitude:107.12345},204);}
      if(mode==='unavailable')await http('PUT','/api/v1/mechanics/me/availability','mechanic',{is_available:false});
      if(mode==='suspended')await mutation('POST',`/api/v1/admin/mechanics/${c.actors.mechanic.id}/suspend`,'admin',{reason:'Test suspended dispatch eligibility'},200);
      await http('POST',`/api/v1/service-requests/${req.id}/dispatch`,'rider',undefined,202);
      if(mode!=='suspended')a.ok(!(await http('GET','/api/v1/dispatch/offers','mechanic')).items.some(x=>x.request_id===req.id));
      else {const rows=await c.sql()`select count(*)::int n from dispatch_candidates where request_id=${req.id} and mechanic_id=${c.actors.mechanic.id}`;a.equal(rows[0].n,0);}
      a.ok((await http('GET','/api/v1/dispatch/offers','mechanic2')).items.some(x=>x.request_id===req.id));
    } finally {
      if(mode==='suspended')await mutation('POST',`/api/v1/admin/mechanics/${c.actors.mechanic.id}/reactivate`,'admin',{reason:'Restore own isolated mechanic fixture'},200);
      await http('PATCH','/api/v1/mechanics/me/profile','mechanic',{service_types:['periodic_maintenance','emergency_rescue','mobile_repair']});
      await http('PUT','/api/v1/mechanics/me/availability','mechanic',{is_available:true});await c.refreshMechanics();await cancel(req);
    }
  });
  add('Expired offer cannot assign a mechanic','409; no assignment committed',async()=>{
    const flow=await offered();a.ok(flow.offers.mechanic);shift(10*60_000);
    await http('POST',`/api/v1/dispatch/offers/${flow.offers.mechanic.id}/accept`,'mechanic',{estimated_duration_minutes:15},409);
    a.ok(!(await http('GET','/api/v1/assignments','mechanic')).items.some(x=>x.request_id===flow.request.id));await cancel(flow.request);
  });
  add('Two mechanics concurrently accept one request','Exactly one assignment, losing mechanic rejected; cleanup through recovery API',async()=>{
    const flow=await offered();a.ok(flow.offers.mechanic&&flow.offers.mechanic2);
    const roles=['mechanic','mechanic2'];const results=await Promise.all(roles.map(role=>http('POST',`/api/v1/dispatch/offers/${flow.offers[role].id}/accept`,role,{estimated_duration_minutes:15},[201,409])));
    a.equal(results.filter(x=>x?.id).length,1);const index=results.findIndex(x=>x?.id);await recover({...flow,assignment:results[index]},roles[index]);
  });
  add('Same mechanic concurrently retries same offer','Same logical assignment; no duplicate reservation',async()=>{
    const flow=await offered();const results=await Promise.all([1,2].map(()=>http('POST',`/api/v1/dispatch/offers/${flow.offers.mechanic.id}/accept`,'mechanic',{estimated_duration_minutes:15},[201,409])));
    const accepted=results.filter(x=>x?.id);a.ok(accepted.length);a.equal(new Set(accepted.map(x=>x.id)).size,1);
    const rows=await c.sql()`select count(*)::int n from assignments where request_id=${flow.request.id}`;a.equal(rows[0].n,1);await recover({...flow,assignment:accepted[0]});
  });
  add('One mechanic concurrently accepts overlapping requests','One succeeds; no two active overlapping reservations',async()=>{
    const first=await offered({scheduled:now()+3*60*60_000});const second=await offered({scheduled:Date.parse(first.request.scheduled_start_at)});
    const flows=[first,second];const result=await Promise.all(flows.map(flow=>http('POST',`/api/v1/dispatch/offers/${flow.offers.mechanic.id}/accept`,'mechanic',{estimated_duration_minutes:15},[201,409])));
    a.equal(result.filter(x=>x?.id).length,1);
    for(let i=0;i<2;i++)if(result[i]?.id)await recover({...flows[i],assignment:result[i]});else await cancel(flows[i].request);
  });
  add('Cancel versus accept race preserves state consistency','Canceled request never has an active assignment; accepted winner recoverable',async()=>{
    const flow=await offered();const [canceled,accepted]=await Promise.all([
      http('POST',`/api/v1/service-requests/${flow.request.id}/cancel`,'rider',{reason:'Concurrent cancel test'},[200,409]),
      http('POST',`/api/v1/dispatch/offers/${flow.offers.mechanic.id}/accept`,'mechanic',{estimated_duration_minutes:15},[201,409])]);
    const req=await http('GET',`/api/v1/service-requests/${flow.request.id}`);if(req.status==='canceled')a.ok(!accepted.id,'Canceled request has a successful assignment');
    else {a.ok(accepted.id);a.ok(!canceled.id);await recover({...flow,assignment:accepted});}
  });
  add('480 minute maximum and adjacent buffered boundary','480 accepted; exactly adjacent reservation allowed; one minute overlap excluded',async()=>{
    const first=await offered({scheduled:now()+3*60*60_000});const assignment=await http('POST',`/api/v1/dispatch/offers/${first.offers.mechanic.id}/accept`,'mechanic',{estimated_duration_minutes:480},201);
    a.equal(Date.parse(assignment.reservation_end_at),Date.parse(first.request.scheduled_start_at)+510*60_000);
    const adjacent=await offered({scheduled:Date.parse(first.request.scheduled_start_at)+540*60_000});a.ok(adjacent.offers.mechanic,'Exactly adjacent intervals must be allowed');
    const overlap=await offered({scheduled:Date.parse(first.request.scheduled_start_at)+539*60_000});a.ok(!overlap.offers.mechanic,'One-minute overlap must be excluded');
    await cancel(adjacent.request);await cancel(overlap.request);await recover({...first,assignment});
  });
  add('Appointment preparation notification once for both parties','Dispatch worker emits owner and assigned mechanic preparation notices once at -30 minute boundary',async()=>{
    const flow=await c.assigned({scheduled:now()+60*60_000});shift(30*60_000);await worker('dispatch/run');
    const ids={};for(const role of ['rider','mechanic']){const notices=(await c.inbox(role)).filter(x=>x.data?.assignment_id===flow.assignment.id&&/chuẩn bị|prepar/i.test(x.type+' '+x.title+' '+x.body));a.equal(notices.length,1);ids[role]=notices[0].id;}
    await worker('dispatch/run');for(const role of ['rider','mechanic'])a.equal((await c.inbox(role)).filter(x=>x.id===ids[role]).length,1);await recover(flow);
  });
  add('Failed provider event cannot credit an approved maintenance order','Signed outer/inner failure acknowledgments never imply payment; valid later payment completes',async()=>{
    const flow=await c.ready();const value=await c.order(flow.work);
    await c.webhook(value,{}, {body:{success:false,code:'99'},expected:[200,400,422]});a.equal((await c.summary(flow)).paid_amount,0);
    await c.webhook(value,{code:'99',desc:'failure'},{body:{success:false,code:'99'},expected:[200,400,422]});a.equal((await c.summary(flow)).paid_amount,0);await paid(flow,value);
  });
  add('Forged order amount/status/provider fields cannot alter server charge','Extra fields rejected or ignored; never 1 dong/cash/succeeded from rider input',async()=>{
    const flow=await c.ready();const result=await c.order(flow.work,[201,400,422],key(),'rider',{amount:1,status:'succeeded',provider:'cash'});
    if(result.id){a.equal(result.amount,18000);a.equal(result.status,'pending');await paid(flow,result);}else await paid(flow,await c.order(flow.work));
  });
  add('Reconciliation mismatch requires review, no automatic closing','Provider PAID but amountPaid under expected -> needs_review; full independently verified proof required',async()=>{
    const flow=await c.ready();const value=await c.order(flow.work);const remote=c.providerOrder(value);remote.status='PAID';remote.amountPaid=remote.amount-1;remote.amountRemaining=1;
    shift(60*60_000);await worker('payments/reconcile');a.equal((await http('GET',`/api/v1/payments/orders/${value.id}`)).status,'needs_review');a.equal((await c.summary(flow)).paid_amount,0);
    await c.transition(flow,'completed',409);remote.amountPaid=remote.amount;remote.amountRemaining=0;
    await mutation('POST',`/api/v1/admin/payments/orders/${value.id}/resolve`,'admin',{action:'confirm_received',reason:'Provider independently verifies exact full amount'},200);await c.transition(flow,'completed');
  });
  add('Admin close_unpaid requires provider termination and zero received','Cannot confirm unreceived money; canceled/zero order can be closed unpaid and replaced',async()=>{
    const flow=await c.ready();const value=await c.order(flow.work);await http('POST',`/api/v1/payments/orders/${value.id}/cancel`,'rider',{});
    await c.webhook(value,{amount:1});a.equal((await http('GET',`/api/v1/payments/orders/${value.id}`)).status,'needs_review');
    const input={action:'close_unpaid',reason:'Provider canceled and confirms no money received'};await mutation('POST',`/api/v1/admin/payments/orders/${value.id}/resolve`,'admin',input,200);
    a.equal((await c.summary(flow)).paid_amount,0);await paid(flow,await c.order(flow.work));
  });
  return tests;
}
