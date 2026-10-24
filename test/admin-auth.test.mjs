import test from 'node:test';
import assert from 'node:assert/strict';
import {hashSecret,randomSecret,verifySecret,sessionToken,localLoginEnabled,passwordLoginEnabled,passwordVerifier,hostedAdmin} from '../lib/admin-auth.mjs';

test('generated local admin secrets are verified without retaining the password in a session',async()=>{
  const password=randomSecret(),verifier=await hashSecret(password);
  assert.match(password,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifySecret(password,verifier),true);
  assert.equal(await verifySecret(randomSecret(),verifier),false);
  assert.equal(await verifySecret('',verifier),false);
  assert.equal(await verifySecret(password,'not-a-verifier'),false);
  assert.notEqual(await hashSecret(randomSecret()),verifier);
});
test('local login is explicitly enabled only for loopback requests',()=>{
  const environment={RAIDROOM_LOCAL_ADMIN:'1',RAIDROOM_LOCAL_ADMIN_HASH:'a'.repeat(64)};
  assert.equal(localLoginEnabled(new Request('http://127.0.0.1:5173/admin'),environment),true);
  assert.equal(localLoginEnabled(new Request('https://raidroom.example/admin'),environment),false);
  assert.equal(localLoginEnabled(new Request('http://localhost/admin'),{}),false);
});
test('native admin identities require the configured HTTPS Site and an explicit user allowlist',()=>{
  const environment={RAIDROOM_AUTH_HOST:'raidroom.example',RAIDROOM_ADMIN_USER_IDS:'owner-id, another-admin'};
  const request=url=>new Request(url,{headers:{'oai-authenticated-user-id':'owner-id'}});
  assert.equal(hostedAdmin(request('https://raidroom.example/admin'),environment),true);
  assert.equal(hostedAdmin(request('http://127.0.0.1:5173/admin'),environment),false);
  assert.equal(hostedAdmin(request('https://untrusted.example/admin'),environment),false);
  assert.equal(hostedAdmin(request('http://raidroom.example/admin'),environment),false);
  assert.equal(hostedAdmin(request('https://raidroom.example/admin'),{}),false);
  assert.equal(hostedAdmin(new Request('https://raidroom.example/admin',{headers:{'oai-authenticated-user-id':'visitor-id'}}),environment),false);
});
test('malformed and lookalike cookies do not become administrator sessions',()=>{
  const token=randomSecret(),request=cookie=>new Request('http://localhost/',{headers:{cookie}});
  assert.equal(sessionToken(request('other=1; raidroom_admin='+token)),token);
  assert.equal(sessionToken(request('not_raidroom_admin='+token)),null);
  assert.equal(sessionToken(request('raidroom_admin=../../invalid')),null);
});
test('production password login needs HTTPS and its own verifier; Vercel ignores native identity headers',()=>{
  const environment={VERCEL:'1',RAIDROOM_AUTH_HOST:'raidroom.vercel.app',RAIDROOM_ADMIN_USER_IDS:'owner',RAIDROOM_ADMIN_PASSWORD_HASH:'b'.repeat(64),RAIDROOM_LOCAL_ADMIN:'1',RAIDROOM_LOCAL_ADMIN_HASH:'a'.repeat(64)};
  const request=url=>new Request(url,{headers:{'oai-authenticated-user-id':'owner'}});
  assert.equal(passwordLoginEnabled(request('https://raidroom.vercel.app/admin'),environment),true);
  assert.equal(passwordVerifier(request('https://raidroom.vercel.app/admin'),environment),'b'.repeat(64));
  assert.equal(passwordLoginEnabled(request('http://raidroom.vercel.app/admin'),environment),false);
  assert.equal(passwordLoginEnabled(request('https://raidroom.vercel.app/admin'),{RAIDROOM_LOCAL_ADMIN:'1',RAIDROOM_LOCAL_ADMIN_HASH:'a'.repeat(64)}),false);
  assert.equal(hostedAdmin(request('https://raidroom.vercel.app/admin'),environment),false);
});
