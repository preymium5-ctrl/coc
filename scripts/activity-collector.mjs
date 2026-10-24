import {setTimeout as delay} from 'node:timers/promises';

const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const base=new URL(args.base||'http://127.0.0.1:5173');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.protocol!=='http:')throw new Error('The local activity collector requires a loopback HTTP server.');
const key=process.env.RAIDROOM_ACTIVITY_SYNC_KEY;
if(!/^[A-Za-z0-9_-]{43}$/.test(key||''))throw new Error('The local activity collector is not configured.');
const parent=Number(args.parent),abort=new AbortController();let unavailable=false;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>abort.abort());
function parentAlive(){if(!parent)return true;try{process.kill(parent,0);return true;}catch{return false;}}
async function call(body){
  const response=await fetch(new URL('/api/internal/activity',base),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(45000)])});
  if(!response.ok){await response.body?.cancel();throw new Error('Collector request failed ('+response.status+').');}
  return response.json();
}
async function collect(job){
  const batches=[];for(let i=0;i<job.memberTags.length;i+=2)batches.push(job.memberTags.slice(i,i+2));
  let cursor=0,cancelled=false;
  async function worker(){while(cursor<batches.length&&!cancelled&&!abort.signal.aborted&&parentAlive()){
    const memberTags=batches[cursor++];
    try{const result=await call({action:'batch',runId:job.runId,memberTags});cancelled=!!result.cancelled;}
    catch(error){if(abort.signal.aborted)throw error;/* The lease recovers unfinished batches after a lost connection. */}
  }}
  await Promise.all([worker(),worker()]);
}
console.log('Activity auto-sync started: checking the published clan every minute.');
while(!abort.signal.aborted&&parentAlive()){
  try{
    const result=await call({action:'begin'});
    if(unavailable){console.log('Activity auto-sync connected.');unavailable=false;}
    if(result.job){await collect(result.job);console.log('Activity sync cycle finished for '+result.job.memberTags.length+' members.');}
  }catch{
    if(!abort.signal.aborted&&!unavailable){console.log('Activity collector is waiting for the local server; it will retry automatically.');unavailable=true;}
  }
  if(!abort.signal.aborted&&parentAlive())await delay(5000,undefined,{signal:abort.signal}).catch(()=>{});
}
