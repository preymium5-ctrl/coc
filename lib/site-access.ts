import {env} from '#raidroom-runtime';
import {ApiError,normalizeTag} from './coc-service.mjs';
import {hashSecret,randomSecret,verifySecret,sessionToken,passwordLoginEnabled,passwordVerifier,hostedAdmin,SESSION_COOKIE,SESSION_SECONDS} from './admin-auth.mjs';
import {getClan,getCurrentClanWar} from './clan-service';
import {publishedClan,type PublishedClan} from './published-clan';
import {activityStatus} from './activity-sync';
export {publishedClan} from './published-clan';

function database(){if(!env.DB)throw new ApiError(503,'storage_unavailable','The clan dashboard storage is not configured.');return env.DB;}
export async function isAdmin(request:Request){
  if(hostedAdmin(request,process.env))return true;
  if(!passwordLoginEnabled(request,process.env))return false;
  const token=sessionToken(request);if(!token)return false;
  const session=await database().prepare('SELECT expires_at FROM local_admin_sessions WHERE id=?').bind(await hashSecret(token)).first<{expires_at:number}>();
  return !!session&&session.expires_at>Date.now();
}
export async function requireAdmin(request:Request){if(!await isAdmin(request))throw new ApiError(401,'admin_required','Sign in as an administrator to make changes.');}
export async function siteState(request:Request){const clan=await publishedClan();return {clan,admin:await isAdmin(request),localLogin:passwordLoginEnabled(request,process.env),nativeLogin:process.env.VERCEL!=='1',activitySync:await activityStatus(clan?.tag||null)};}
export async function savePublishedClan(request:Request,input:{tag?:unknown;timeZone?:unknown}){
  await requireAdmin(request);
  const tag=normalizeTag(input.tag),timeZone=typeof input.timeZone==='string'?input.timeZone:'Asia/Singapore';
  try{new Intl.DateTimeFormat('en',{timeZone}).format();}catch{throw new ApiError(400,'invalid_timezone','Choose a valid clan time zone.');}
  const clan=await getClan(tag);
  const config:PublishedClan={tag:clan.tag,name:clan.name,clanLevel:clan.clanLevel,badgeUrls:clan.badgeUrls,timeZone,updatedAt:new Date().toISOString()};
  await database().prepare("INSERT INTO site_settings (key,data,updated_at) VALUES ('public_clan',?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind(JSON.stringify(config),Date.now()).run();
  return {clan:config};
}
export async function unpublishClan(request:Request){
  await requireAdmin(request);
  await database().prepare("DELETE FROM site_settings WHERE key='public_clan'").run();
  return {clan:null};
}
export async function authorizeClan(request:Request,input:string){
  const tag=normalizeTag(input);if(await isAdmin(request))return tag;
  const clan=await publishedClan();
  if(!clan||clan.tag!==tag)throw new ApiError(404,'clan_not_published','This clan is not available on this site.');
  return tag;
}
export async function authorizeMember(request:Request,input:string){
  const tag=normalizeTag(input);if(await isAdmin(request))return tag;
  const config=await publishedClan();
  if(config){
    const clan=await getClan(config.tag);
    if(clan.memberList.some((member:{tag:string})=>member.tag===tag))return tag;
    const war=await getCurrentClanWar(config.tag);
    if(war.data?.clan?.members?.some((member:{tag:string})=>member.tag===tag))return tag;
  }
  throw new ApiError(404,'member_not_published','This player is not part of the published clan.');
}
function cookie(request:Request,token:string,maxAge=SESSION_SECONDS){return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function localSignIn(request:Request,password:unknown){
  if(!passwordLoginEnabled(request,process.env))throw new ApiError(404,'login_disabled','Administrator sign-in has not been configured.');
  const now=Date.now();
  const attempt=await database().prepare("INSERT INTO local_login_attempts (id,attempts,reset_at) VALUES ('admin',1,?) ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING attempts,reset_at").bind(now+15*60000,now,now).first<{attempts:number;reset_at:number}>();
  if(attempt&&attempt.attempts>10)throw new ApiError(429,'too_many_attempts','Too many sign-in attempts. Try again in 15 minutes.');
  if(!await verifySecret(password,passwordVerifier(request,process.env)))throw new ApiError(401,'invalid_password','The administrator password is incorrect.');
  const token=randomSecret();
  await database().batch([
    database().prepare('DELETE FROM local_admin_sessions WHERE expires_at<=?').bind(now),
    database().prepare('INSERT INTO local_admin_sessions (id,expires_at) VALUES (?,?)').bind(await hashSecret(token),now+SESSION_SECONDS*1000),
    database().prepare("DELETE FROM local_login_attempts WHERE id='admin'"),
  ]);
  return cookie(request,token);
}
export async function localSignOut(request:Request){
  if(passwordLoginEnabled(request,process.env)){const token=sessionToken(request);if(token)await database().prepare('DELETE FROM local_admin_sessions WHERE id=?').bind(await hashSecret(token)).run();}
  return cookie(request,'',0);
}
