import assert from 'node:assert/strict';
import { sign, startProviders } from './providers.mjs';

// Published payOS test vector, not a configured project secret.
const checksum='1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675';
const data={orderCode:123,amount:3000,description:'VQRIO123',accountNumber:'12345678',reference:'TF230204212323',
  transactionDateTime:'2023-02-04 18:25:00',currency:'VND',paymentLinkId:'124c33293c43417ab7879e14c8d9eb18',
  code:'00',desc:'Thành công',counterAccountBankId:'',counterAccountBankName:'',counterAccountName:'',
  counterAccountNumber:'',virtualAccountName:'',virtualAccountNumber:''};
assert.equal(sign(data,checksum),'412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03');
assert.equal(sign({x:[{z:2,a:1}]},checksum),sign({x:[{a:1,z:2}]},checksum));
const provider=await startProviders(checksum);
try {
  const body={orderCode:123,amount:3000,description:'TEST',returnUrl:'https://example.test/return',cancelUrl:'https://example.test/cancel'};
  body.signature=sign(body,checksum);
  const response=await fetch(`${provider.origin}/payos/v2/payment-requests`,{method:'POST',headers:{'Content-Type':'application/json','x-client-id':'isolated-client','x-api-key':'isolated-api-key'},body:JSON.stringify(body)});
  assert.equal(response.status,200); const result=await response.json(); assert.equal(result.data.status,'PENDING'); assert.equal(result.signature,sign(result.data,checksum));
  const push=await fetch(`${provider.origin}/fcm/v1/projects/workflow-test/messages:send`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer isolated-fcm-access'},
    body:JSON.stringify({message:{token:'test-invalid-token',notification:{title:'Test',body:'Test'},data:{notification_id:'test-id'}}})});
  assert.equal(push.status,404); assert.equal((await push.json()).error.details[0].errorCode,'UNREGISTERED');
  console.log('Provider wire contract checks: PASS (official signature vector, arrays, payment create, typed FCM error)');
} finally { await provider.close(); }
