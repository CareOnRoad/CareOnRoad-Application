const assert=require('node:assert/strict');const {Socket}=require('node:net');
process.env.DATABASE_URL='postgres://fixture@localhost:5432/fixture';
const logged=[];const original=console.error;console.error=message=>logged.push(message);
require('./capture-db-errors.cjs');
try{
  const socket=new Socket();Object.defineProperty(socket,'remotePort',{value:5432});const received=[];
  socket.on('data',data=>received.push(data));
  const payload=Buffer.from('SFATAL\0CXX000\0MMax client connections reached; private-sentinel\0Rconnection_pool\0\0');
  const packet=Buffer.alloc(payload.length+5);packet[0]=69;packet.writeUInt32BE(payload.length+4,1);payload.copy(packet,5);
  const first=packet.subarray(0,8),second=packet.subarray(8);
  assert.equal(socket.emit('data',first),true);assert.equal(logged.length,0);socket.emit('data',second);
  assert.deepEqual(received,[first,second]);assert.equal(logged.length,1);assert.ok(!logged[0].includes('private-sentinel'));
  assert.deepEqual(JSON.parse(logged[0].slice('WORKFLOW_DB_ERROR '.length)),{code:'XX000',routine:'connection_pool',category:'connection_capacity'});
}finally{console.error=original;}
console.log('Database wire observer: PASS (fragmented frame, metadata-only, unchanged data delivery)');
