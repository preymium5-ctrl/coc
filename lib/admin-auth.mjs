const encoder=new TextEncoder();
export const SESSION_COOKIE='raidroom_admin';
export const SESSION_SECONDS=8*60*60;

export async function hashSecret(value){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function randomSecret(){
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export async function verifySecret(secret,expectedHash){
  if(typeof secret!=='string'||secret.length<24||secret.length>256||!/^[a-f0-9]{64}$/.test(expectedHash||''))return false;
  // The generated password has 256 bits of entropy. Use Web Crypto verification
  // so comparisons of its SHA-256 verifier do not depend on string timing.
  const message=encoder.encode('Raidroom local administrator');
  const key=async hex=>crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const signature=await crypto.subtle.sign('HMAC',await key(await hashSecret(secret)),message);
  return crypto.subtle.verify('HMAC',await key(expectedHash),signature,message);
}
export function sessionToken(request){
  const value=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(value||'')?value:null;
}
export function localLoginEnabled(request,environment){
  return ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname)&&environment.RAIDROOM_LOCAL_ADMIN==='1'&&/^[a-f0-9]{64}$/.test(environment.RAIDROOM_LOCAL_ADMIN_HASH||'');
}
export function hostedAdmin(request,environment){
  // Local HTTP callers may supply arbitrary headers. Trust Sites identity only
  // on the retained HTTPS Site hostname, where Dispatch supplies the identity.
  if(environment.VERCEL==='1')return false;
  const url=new URL(request.url),host=environment.RAIDROOM_AUTH_HOST;
  if(!host||url.protocol!=='https:'||url.hostname!==host)return false;
  const id=request.headers.get('oai-authenticated-user-id');
  return !!id&&(environment.RAIDROOM_ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(id);
}
export function passwordVerifier(request,environment){
  if(localLoginEnabled(request,environment))return environment.RAIDROOM_LOCAL_ADMIN_HASH;
  if(new URL(request.url).protocol==='https:'&&/^[a-f0-9]{64}$/.test(environment.RAIDROOM_ADMIN_PASSWORD_HASH||''))return environment.RAIDROOM_ADMIN_PASSWORD_HASH;
  return null;
}
export function passwordLoginEnabled(request,environment){return !!passwordVerifier(request,environment);}
