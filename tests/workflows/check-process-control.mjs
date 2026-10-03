import assert from 'node:assert/strict';
import {controlOwnedApi} from './control-owned-api.mjs';
const input={apiPid:process.pid,runnerPid:process.pid,port:3211,action:'pause'};
assert.throws(()=>controlOwnedApi({...input,apiPid:-1}),{name:'AssertionError'});
assert.throws(()=>controlOwnedApi({...input,action:'kill'}),{name:'AssertionError'});
// This process is not its own child Next CLI. Identity verification must fail
// before invoking any native pause/resume operation.
assert.throws(()=>controlOwnedApi(input),{name:'AssertionError'});
console.log('Owned process control: PASS (invalid input/action and unowned/self PID rejected)');
