// Diagnostic wire observer only: never alter a query, response or application.
const {Socket}=require('node:net');
const port=Number(new URL(process.env.DATABASE_URL).port||5432);
const emit=Socket.prototype.emit;const pending=new WeakMap();
Socket.prototype.emit=function(event,...args){
  if(event==='data'&&this.remotePort===port&&Buffer.isBuffer(args[0])){
    let data=Buffer.concat([pending.get(this)||Buffer.alloc(0),args[0]]);
    while(data.length>=5){
      const length=data.readUInt32BE(1)+1;
      if(length<5||length>2_000_000){data=Buffer.alloc(0);break;}
      if(data.length<length)break;
      if(data[0]===69){
        const fields={};for(const field of data.subarray(5,length-1).toString('utf8').split('\0'))fields[field[0]]=field.slice(1);
        const message=fields.M||'';
        const category=/max.*connections|too many connections/i.test(message)?'connection_capacity':/does not exist/i.test(message)?'missing_object':/timeout/i.test(message)?'timeout':/cached plan/i.test(message)?'cached_plan':'other';
        console.error('WORKFLOW_DB_ERROR '+JSON.stringify({code:fields.C,routine:fields.R,constraint:fields.n,category}));
      }
      data=data.subarray(length);
    }
    pending.set(this,data);
  }
  return Reflect.apply(emit,this,[event,...args]);
};
