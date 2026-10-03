import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=dirname(fileURLToPath(import.meta.url)),root=resolve(directory,'../..');
for(const file of ['.env','.env.local','apps/api/.env','apps/api/.env.local'])if(existsSync(join(root,file)))process.loadEnvFile(join(root,file));
const secrets=Object.entries(process.env).filter(([key,value])=>/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL/.test(key)&&(!key.endsWith('_URL')||key.includes('DATABASE_URL'))&&value?.length>11).map(([,value])=>value);
const files=[];
const reports=join(directory,'reports');
for(const folder of [directory,reports,...readdirSync(reports,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>join(reports,x.name))]){
  for(const item of readdirSync(folder,{withFileTypes:true}))if(item.isFile()&&/\.(json|md|mjs|cjs)$/.test(item.name))files.push(join(folder,item.name));
}
for(const file of files){
  const content=readFileSync(file,'utf8');
  assert.ok(secrets.every(secret=>!content.includes(secret)),`Configured credential found in ${file}`);
  assert.ok(!/eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}/.test(content),`Raw JWT found in ${file}`);
}
console.log(JSON.stringify({artifact_files_checked:files.length,configured_secrets_found:0,raw_jwts_found:0}));
