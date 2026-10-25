import {env} from '#raidroom-runtime';
import {ApiError} from './coc-service.mjs';
import {publishedClans} from './published-clan';
import {getClan,syncClanMembers} from './clan-service';
import {invalidateClanViews} from './clan-store';
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
export async function requestActivitySync(tag?:string|null){
  const configs=await publishedClans(),config=tag?configs.find(c=>c.tag===tag):configs[0];if(!config)throw new ApiError(409,'no_public_clan','Choose a published clan first.');
  await queueJob(database(),config.tag);return activityStatus(config.tag);
}
export async function beginActivitySync(tag?:string){
  const configs=(await publishedClans()).filter(c=>!tag||c.tag===tag);if(!configs.length)return {job:null,status:publicJob(null)};
  const db=database(),jobs=[];
  for(const config of configs){await touchCollector(db,config.tag);jobs.push({config,row:await readJob(db,config.tag)});}
  jobs.sort((a,b)=>(a.row?.next_at||0)-(b.row?.next_at||0));
  for(const {config} of jobs){
  const runId=crypto.randomUUID(),claimed=await claimJob(db,config.tag,runId);
  if(!claimed)continue;
  try{
    const clan=await getClan(config.tag),tags:string[]=clan.memberList.map((member:{tag:string})=>member.tag);
    await setJobRoster(db,config.tag,runId,tags);
    if(!tags.length)await completeMembers(db,config.tag,runId,[]);
    return {job:tags.length?{runId,memberTags:tags,clanTag:config.tag}:null,status:publicJob(await readJob(db,config.tag))};
  }catch{await failJob(db,config.tag,runId);return {job:null,status:publicJob(await readJob(db,config.tag))};}
  }
  return {job:null,status:publicJob(await readJob(db,configs[0].tag))};
}
export async function collectActivityBatch(input:{runId?:unknown;memberTags?:unknown}){
  if(typeof input.runId!=='string'||!Array.isArray(input.memberTags)||input.memberTags.length<1||input.memberTags.length>2||input.memberTags.some(tag=>typeof tag!=='string'))throw new ApiError(400,'invalid_sync_batch','Choose one or two members from this sync run.');
  const configs=await publishedClans();if(!configs.length)return {cancelled:true};
  const db=database(),jobTag=await db.prepare('SELECT clan_tag FROM clan_auto_sync WHERE run_id=?').bind(input.runId).first<{clan_tag:string}>();
  const config=configs.find(c=>c.tag===jobTag?.clan_tag);if(!config)return {cancelled:true};
  const row=await readJob(db,config.tag);
  if(!row||row.run_id!==input.runId||row.status!=='running'||row.lease_until<=Date.now())return {cancelled:true};
  const roster:string[]=JSON.parse(row.roster_tags),done:string[]=JSON.parse(row.completed_tags);
  const tags:string[]=[...new Set(input.memberTags as string[])];
  if(tags.some(tag=>!roster.includes(tag)))throw new ApiError(400,'invalid_sync_member','This player is not in the active sync roster.');
  const pending=tags.filter(tag=>!done.includes(tag));
  if(!pending.length)return {status:publicJob(row)};
  let members:{tag:string;failed:boolean}[];
  try{const result=await syncClanMembers(config.tag,pending,config.timeZone);members=result.members.map((member:{tag:string;error?:string;coverage?:{available?:boolean}})=>({tag:member.tag,failed:!!member.error||!member.coverage?.available}));}
  catch{members=pending.map(tag=>({tag,failed:true}));}
  const completed=await completeMembers(db,config.tag,input.runId,members);
  if(completed?.status==='complete'||completed?.status==='partial')await invalidateClanViews(config.tag);
  return {status:publicJob(completed)};
}
