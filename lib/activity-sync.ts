import {env} from '#raidroom-runtime';
import {ApiError} from './coc-service.mjs';
import {publishedClan} from './published-clan';
import {getClan,syncClanMembers} from './clan-service';
import {hashSecret,verifySecret} from './admin-auth.mjs';
import {readJob,touchCollector,claimJob,setJobRoster,completeMembers,failJob,queueJob,publicJob} from './activity-store.mjs';

function database(){if(!env.DB)throw new ApiError(503,'storage_unavailable','Activity storage is not configured.');return env.DB;}
export async function requireCollector(request:Request){
  const key=process.env.RAIDROOM_ACTIVITY_SYNC_KEY;
  const local=['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!local||!key||!/^[A-Za-z0-9_-]{43}$/.test(key)||!await verifySecret(supplied,await hashSecret(key)))throw new ApiError(401,'collector_required','This endpoint is reserved for the activity collector.');
}
export async function activityStatus(tag:string|null){return tag?publicJob(await readJob(database(),tag)):publicJob(null);}
export async function requestActivitySync(){
  const config=await publishedClan();if(!config)throw new ApiError(409,'no_public_clan','Create a public clan first.');
  await queueJob(database(),config.tag);return activityStatus(config.tag);
}
export async function beginActivitySync(){
  const config=await publishedClan();if(!config)return {job:null,status:publicJob(null)};
  const db=database();await touchCollector(db,config.tag);
  const runId=crypto.randomUUID(),claimed=await claimJob(db,config.tag,runId);
  if(!claimed)return {job:null,status:publicJob(await readJob(db,config.tag))};
  try{
    const clan=await getClan(config.tag),tags:string[]=clan.memberList.map((member:{tag:string})=>member.tag);
    await setJobRoster(db,config.tag,runId,tags);
    if(!tags.length)await completeMembers(db,config.tag,runId,[]);
    return {job:tags.length?{runId,memberTags:tags}:null,status:publicJob(await readJob(db,config.tag))};
  }catch{await failJob(db,config.tag,runId);return {job:null,status:publicJob(await readJob(db,config.tag))};}
}
export async function collectActivityBatch(input:{runId?:unknown;memberTags?:unknown}){
  if(typeof input.runId!=='string'||!Array.isArray(input.memberTags)||input.memberTags.length<1||input.memberTags.length>2||input.memberTags.some(tag=>typeof tag!=='string'))throw new ApiError(400,'invalid_sync_batch','Choose one or two members from this sync run.');
  const config=await publishedClan();if(!config)return {cancelled:true};
  const db=database(),row=await readJob(db,config.tag);
  if(!row||row.run_id!==input.runId||row.status!=='running'||row.lease_until<=Date.now())return {cancelled:true};
  const roster:string[]=JSON.parse(row.roster_tags),done:string[]=JSON.parse(row.completed_tags);
  const tags:string[]=[...new Set(input.memberTags as string[])];
  if(tags.some(tag=>!roster.includes(tag)))throw new ApiError(400,'invalid_sync_member','This player is not in the active sync roster.');
  const pending=tags.filter(tag=>!done.includes(tag));
  if(!pending.length)return {status:publicJob(row)};
  let members:{tag:string;failed:boolean}[];
  try{const result=await syncClanMembers(config.tag,pending,config.timeZone);members=result.members.map((member:{tag:string;error?:string;coverage?:{available?:boolean}})=>({tag:member.tag,failed:!!member.error||!member.coverage?.available}));}
  catch{members=pending.map(tag=>({tag,failed:true}));}
  return {status:publicJob(await completeMembers(db,config.tag,input.runId,members))};
}
