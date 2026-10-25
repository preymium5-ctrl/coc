import test from 'node:test';
import assert from 'node:assert/strict';
import {profileSnapshot} from '../lib/profile-cache.mjs';
import {ApiError} from '../lib/coc-service.mjs';

const profile={tag:'#P0Y',name:'Saved player',townHallLevel:17},now=new Date('2026-10-25T14:00:00Z');
test('successful profile snapshots carry their observation time without reading old data',async()=>{
  const result=await profileSnapshot(profile.tag,async()=>profile,async()=>{throw new Error('Unexpected cache read');},now);
  assert.deepEqual(result,{...profile,profileFreshness:{stale:false,fetchedAt:now.toISOString()}});
});
test('transient provider outages retain only real matching profiles and preserve the last observation time',async()=>{
  const outage=new ApiError(504,'provider_timeout','Timed out'),load=async()=>{throw outage;};
  const old={...profile,profileFreshness:{stale:false,fetchedAt:'2026-10-25T13:00:00Z'}};
  const result=await profileSnapshot(profile.tag,load,async()=>old,now);
  assert.equal(result.name,profile.name);assert.equal(result.profileFreshness.stale,true);
  assert.equal(result.profileFreshness.fetchedAt,old.profileFreshness.fetchedAt);
  assert.equal((await profileSnapshot(profile.tag,load,async()=>profile,now)).profileFreshness.fetchedAt,null,'older caches do not invent observation dates');
  await assert.rejects(profileSnapshot(profile.tag,load,async()=>null,now),error=>error===outage);
  await assert.rejects(profileSnapshot(profile.tag,load,async()=>({...profile,tag:'#OTHER'}),now),error=>error===outage);
});
test('not-found and credential errors remain visible instead of falling back to saved data',async()=>{
  for(const [status,code] of [[404,'not_found'],[401,'invalid_key'],[503,'setup_required']]){
    const error=new ApiError(status,code,'Failed');
    await assert.rejects(profileSnapshot(profile.tag,async()=>{throw error;},async()=>profile,now),value=>value===error);
  }
});
