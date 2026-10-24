import {hashSecret,verifySecret} from './admin-auth.mjs';

export async function scheduledAccess(request,environment){
  const secret=environment.CRON_SECRET;
  if(typeof secret!=='string'||secret.length<24||secret.length>256)return false;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'');
  return verifySecret(supplied,await hashSecret(secret));
}

// Await every batch inside the function invocation. No detached serverless work.
export async function runScheduledSync(begin,batch){
  const started=await begin();
  if(!started.job)return started.status;
  const {runId,memberTags}=started.job;
  let cursor=0;
  const workers=Array.from({length:2},async()=>{
    let latest=started.status;
    while(cursor<memberTags.length){
      const tags=memberTags.slice(cursor,cursor+2);cursor+=2;
      const result=await batch({runId,memberTags:tags});
      if(result.cancelled)break;
      if(result.status)latest=result.status;
    }
    return latest;
  });
  const results=await Promise.all(workers);
  return results.sort((a,b)=>(b.completed||0)-(a.completed||0))[0];
}
