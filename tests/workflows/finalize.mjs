import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const directory=dirname(fileURLToPath(import.meta.url));
const ids=process.argv.slice(2);
assert.ok(ids.length,'Supply completed run IDs in chronological review order');
const latest=new Map();const catalogueMap=new Map();const runs=[];const collections=[];const variables=new Map();
for(const id of ids){
  assert.match(id,/^\d{4}-\d{2}-\d{2}T[\d.-]+Z-[a-f0-9]{8}$/);
  const folder=join(directory,'reports',id);
  const report=JSON.parse(readFileSync(join(folder,'results.json')));
  const frozen=JSON.parse(readFileSync(join(folder,'catalog-before-run.json')));
  for(const [file,hash] of Object.entries(frozen.hashes))assert.equal(createHash('sha256').update(readFileSync(join(folder,file))).digest('hex'),hash,`${id}: frozen oracle changed`);
  assert.equal(report.results.length,frozen.selected.length,`${id}: incomplete run`);
  for(const role of Object.keys(report.fixture_users))assert.ok(report.cleanup.some(x=>x.role===role&&x.action==='ban-owned-auth-fixture'&&x.status===200),`${id}: Auth fixture cleanup incomplete`);
  for(const test of frozen.cases)catalogueMap.set(test.id,test);
  for(const result of report.results)latest.set(result.id,{...result,run_id:id});
  const changeFile=join(folder,'application-changes.json');
  runs.push({id,mode:report.mode,counts:report.counts,schema:report.schema,cleanup:report.cleanup,application:report.application_before_run,
    application_changes:existsSync(changeFile)?JSON.parse(readFileSync(changeFile)):[]});
  const collection=JSON.parse(readFileSync(join(folder,'postman_collection.json')));
  for(const variable of collection.variable||[])if(!variables.has(variable.key))variables.set(variable.key,variable);
  collections.push({name:id,item:collection.item});
}
const catalogue=[...catalogueMap.values()].map(test=>{const result=latest.get(test.id);return result?{id:result.id,group:result.group,name:result.name,expectation:result.expectation}:test;});
const results=catalogue.map(test=>latest.get(test.id)||{...test,status:'BLOCKED',reason:'No executed evidence',run_id:null});
const counts=Object.fromEntries(['PASS','FAIL','BLOCKED'].map(s=>[s,results.filter(x=>x.status===s).length]));
const groups=[...new Set(catalogue.map(x=>x.group))].map(group=>({group,total:results.filter(x=>x.group===group).length,
  ...Object.fromEntries(['PASS','FAIL','BLOCKED'].map(s=>[s,results.filter(x=>x.group===group&&x.status===s).length]))}));
const data={generated_at:new Date().toISOString(),counts,groups,runs,results};
writeFileSync(join(directory,'final-results.json'),JSON.stringify(data,null,2));
const metadata=JSON.parse(readFileSync(join(directory,'test-cases.json')));
writeFileSync(join(directory,'test-cases.json'),JSON.stringify({generated_at:data.generated_at,sources:metadata.sources,
  catalogues_by_run:runs.map(({id,application})=>({id,application})),cases:catalogue},null,2));
const cell=value=>String(value||'').replaceAll('|','/').replaceAll('\n',' ');
const md=['# Kết quả kiểm thử HTTP ba workflow','',`**${counts.PASS} PASS · ${counts.FAIL} FAIL · ${counts.BLOCKED} BLOCKED / ${results.length} ca riêng biệt.**`,'',
  'Oracle được xây từ tài liệu nghiệp vụ, API contract và giao thức provider công khai trước khi đọc mã triển khai backend. Sau baseline, audit/sửa backend dùng các kỳ vọng đã chốt; kết quả trước sửa được giữ riêng. Mỗi lần chạy lưu mã test/oracle/hash trước khi gửi HTTP. Hiệu chỉnh harness theo contract có chứng cứ trong [ORACLE-REVISIONS.md](ORACLE-REVISIONS.md). Kết quả tổng hợp dùng lần chạy lại được liệt kê bên dưới cho cùng ID, không cộng trùng case.','',
  'Đây là tổng hợp baseline và các lượt kiểm tra lại có provenance theo từng ID, không phải một full run trên một snapshot code cuối. Các ca bị ảnh hưởng bởi bốn bản sửa đã chạy lại; unit regression/build dùng code hiện tại.','',
  'Kiểm tra workspace cuối:169 file/578 unit-static-route test PASS; typecheck, lint và build API/web PASS. Bản kiểm tra này bao gồm thay đổi health/schema xuất hiện đồng thời trong workspace, ngoài bốn lỗi sửa của lượt này.','',
  'JWT Supabase, API HTTP và PostgreSQL thật, migrations001–035 trong schema riêng. SQL chuẩn bị admin và đọc bằng chứng, không ép trạng thái nghiệp vụ. Các ca webhook, đối soát và lỗi FCM dùng provider mô phỏng ở biên mạng. LIVE-001 gọi payOS thật để tạo/đọc/hủy link, không chuyển tiền.','',
  'Chế độ legacy tạo fixtures qua API tại commit5307fcc với migrations001–033, rồi dừng process, nâng schema riêng qua034/035 và chạy API hiện tại. Bao gồm quote standard chưa trả, order đã trả trước migration và request thiếu tọa độ; không giả lịch sử bằng SQL.','',
  'Backend đã sửa race cùng khóa idempotency ở PostgreSQL, lọc reservation trùng trước dispatch, chuyển webhook sai currency có chữ ký hợp lệ sang needs_review và trả503 cho provider gián đoạn/quota/network. [Bản sửa và bằng chứng](IMPLEMENTATION-FINDINGS.md).','',
  '| Nhóm | Tổng | PASS | FAIL | BLOCKED |','|---|---:|---:|---:|---:|',
  ...groups.map(x=>`| ${x.group} | ${x.total} | ${x.PASS} | ${x.FAIL} | ${x.BLOCKED} |`),'',
  '## Ca chưa đạt','', '| ID | Case | Kết quả | Bằng chứng/lý do |','|---|---|---|---|',
  ...results.filter(x=>x.status!=='PASS').map(x=>`| ${x.id} | ${cell(x.name)} | ${x.status} | ${cell(x.reason)} [run](reports/${x.run_id}/REPORT.md) |`),'',
  '## Các lần chạy dùng trong kết luận','',
  ...runs.map(x=>`- [${x.id}](reports/${x.id}/REPORT.md): ${x.counts.PASS} PASS, ${x.counts.FAIL} FAIL, ${x.counts.BLOCKED} BLOCKED; schema ${x.schema}.`),'',
  ...runs.filter(x=>x.application_changes.length).map(x=>`- Lượt ${x.id} có cập nhật backend giữa lượt ở ${x.application_changes.map(change=>change.applied_at).join(', ')}; xem application-changes.json và report tái hiện trước sửa. Oracle không đổi.`),'',
  '## Giới hạn và cách chạy lại','',
  'Không có bằng chứng chuyển tiền ngân hàng thật hoặc notice hiển thị trên điện thoại từ các lượt này. Các ca thiết bị/ngân hàng cần observer trong [MANUAL-CASES.md](MANUAL-CASES.md); xem trạng thái từng ID ở bảng trên. Crash/fencing dùng process thật và provider mô phỏng, không chứng minh thanh toán hoặc nhận push vật lý. Ma trận bao phủ các nhánh nghiệp vụ/rủi ro đã liệt kê; không khẳng định đã vét hết mọi input, lịch chạy đồng thời hay hệ điều hành.','',
  'Migration035 chưa được áp dụng vào public trong quá trình test. Các schema test được giữ làm bằng chứng; tài khoản Auth fixture được khóa theo cleanup trong từng results.json.','',
  'Chạy tự động: `node tests/workflows/run.mjs`. Chạy ID độc lập: `node tests/workflows/run.mjs --only=PAY-017`. Smoke payOS thật: `node tests/workflows/run.mjs --live-payment-smoke`. Các ca phụ thuộc cần fixture trước đó. [Catalogue](TEST-CASES.md), [README](README.md), [Postman HTTP examples](careonroad-workflows.postman_collection.json). Collection lưu ví dụ HTTP; runner thực hiện assertion nghiệp vụ, race, thời gian và lỗi provider.',''].join('\n');
writeFileSync(join(directory,'FINAL-REPORT.md'),md);
writeFileSync(join(directory,'LATEST.md'),md);
writeFileSync(join(directory,'TEST-CASES.md'),['# Workflow API test cases','',
  'Oracle theo tài liệu/API và giao thức provider; kết quả là bằng chứng của các lần chạy trong FINAL-REPORT.md. BLOCKED không tính PASS. Trace từng HTTP và mã/hash test được giữ trong report của case.','',
  '| ID | Nhóm | Trường hợp | Kỳ vọng | Kết quả |','|---|---|---|---|---|',
  ...results.map(x=>`| ${x.id} | ${x.group} | ${cell(x.name)} | ${cell(x.expectation)} | ${x.status} |`),''].join('\n'));
const base=JSON.parse(readFileSync(join(directory,'reports',ids[0],'postman_collection.json')));
writeFileSync(join(directory,'careonroad-workflows.postman_collection.json'),JSON.stringify({...base,variable:[...variables.values()],item:collections},null,2));
console.log(JSON.stringify({cases:results.length,...counts,report:'tests/workflows/FINAL-REPORT.md'}));
