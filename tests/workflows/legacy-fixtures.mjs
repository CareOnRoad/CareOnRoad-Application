// Actual pre-034/035 API creates these fixtures. SQL only applies migrations.
export async function prepareLegacyFixtures(c){
  const {assert:a,http,state:s}=c;
  const oldFlow=async(rider,mechanic,bike)=>{
    await c.refreshMechanics();const request=await c.book({rider,bike});await http('POST',`/api/v1/service-requests/${request.id}/dispatch`,rider,undefined,202);
    const offers=await http('GET','/api/v1/dispatch/offers',mechanic);const offer=offers.items.find(x=>x.request_id===request.id);a.ok(offer);
    const assignment=await http('POST',`/api/v1/dispatch/offers/${offer.id}/accept`,mechanic,{},201);const flow={request,assignment,rider,mechanic};
    for(const status of ['en_route','on_site','diagnosis'])await c.transition(flow,status,200,mechanic);
    flow.work=await c.quote(flow,'standard',[...c.laborLines,...c.parts],{},mechanic);a.equal(flow.work.total_amount,18000);await c.decide(flow.work,'approve',rider);
    const quotes=await http('GET',`/api/v1/service-requests/${request.id}/quotes`,rider);a.equal(quotes.items.find(x=>x.id===flow.work.id).status,'approved');return flow;
  };
  s.legacyPayment=await oldFlow('rider','mechanic',s.bike.id);
  s.legacyPaid=await oldFlow('rider2','mechanic2',s.foreignBike.id);const value=await c.order(s.legacyPaid.work,201,c.key(),'rider2');
  const remote=c.providerOrder(value);remote.status='PAID';remote.amountPaid=remote.amount;remote.amountRemaining=0;await c.webhook(value);s.legacyPaid.payment=value;
  a.equal((await http('GET',`/api/v1/service-requests/${s.legacyPaid.request.id}/payment-summary`,'rider2')).paid_amount,18000);
  const bike=await http('POST','/api/v1/motorcycles','rider2',{brand_text:'Honda',model_text:'Legacy repair'},201);
  s.legacyMissing=await c.mutation('POST','/api/v1/service-requests','rider2',{motorcycle_id:bike.id,service_type:'periodic_maintenance',problem_description:'Authentic legacy missing location',scheduled_start_at:new Date(c.now()+4*60*60_000).toISOString()},201);
  a.equal(s.legacyMissing.status,'submitted');a.ok(!s.legacyMissing.location);
  const [row]=await c.sql()`select service_location is null as missing from service_requests where id=${s.legacyMissing.id}`;a.equal(row.missing,true);
}

export async function testLegacyCase(c,name){
  const {assert:a,http,mutation,state:s}=c;
  if(name==='Legacy standard maintenance prepayment compatibility'){
    const flow=s.legacyPayment;a.ok(flow);
    const quotes=await http('GET',`/api/v1/service-requests/${flow.request.id}/quotes`);const preserved=quotes.items.find(x=>x.id===flow.work.id);
    a.equal(preserved.purpose,'standard');a.equal(preserved.status,'approved');a.equal(preserved.total_amount,18000);
    a.equal((await http('GET',`/api/v1/service-requests/${flow.request.id}`)).status,'awaiting_payment');
    await c.transition(flow,'in_progress',409);const value=await c.order(flow.work);a.equal(value.amount,18000);
    const remote=c.providerOrder(value);remote.status='PAID';remote.amountPaid=remote.amount;remote.amountRemaining=0;await c.webhook(value);
    a.equal((await c.summary(flow)).paid_amount,18000);a.equal((await c.summary(flow)).remaining_amount,0);
    await c.transition(flow,'in_progress');await c.transition(flow,'completed');
    a.equal((await http('GET',`/api/v1/service-requests/${flow.request.id}`)).status,'completed');await c.order(flow.work,409);
    const paid=s.legacyPaid;a.ok(paid);const sum=await http('GET',`/api/v1/service-requests/${paid.request.id}/payment-summary`,'rider2');
    a.equal(sum.paid_amount,18000);a.equal(sum.remaining_amount,0);a.equal((await http('GET',`/api/v1/payments/orders/${paid.payment.id}`,'rider2')).status,'succeeded');
    await c.order(paid.work,409,c.key(),'rider2');await c.transition(paid,'in_progress',200,'mechanic2');await c.transition(paid,'completed',200,'mechanic2');return;
  }
  a.equal(name,'Repair legacy request missing location');const value=s.legacyMissing;a.ok(value);const path=`/api/v1/service-requests/${value.id}`;
  const before=await http('GET',path,'rider2');a.equal(before.status,'submitted');a.ok(!before.location);
  const body={location:{latitude:11.12345,longitude:107.12345}};
  await mutation('PATCH',path,'rider',body,403);const key=c.key();const changed=await mutation('PATCH',path,'rider2',body,200,key);
  a.equal(changed.id,value.id);a.equal(changed.location.latitude,body.location.latitude);a.equal(changed.location.longitude,body.location.longitude);
  const replay=await mutation('PATCH',path,'rider2',body,200,key);a.deepEqual(replay,changed);
  await mutation('PATCH',path,'rider2',{location:{latitude:11.2,longitude:107.2}},409,key);
  const [row]=await c.sql()`select count(*)::int n from outbox_events where topic='maintenance.dispatch.requested' and aggregate_id=${value.id}`;a.equal(row.n,1);
  await http('POST',path+'/cancel','rider2',{reason:'End migrated legacy fixture'});await mutation('PATCH',path,'rider2',body,409);
}
