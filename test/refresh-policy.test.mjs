import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {REFRESH_MS,currentRefresh,nextRefreshAt,syncInterval} from '../lib/refresh-policy.mjs';

test('shared cache freshness expires at the hourly boundary, including a new day and ranked week',()=>{
  const start=Date.parse('2026-10-26T04:00:00Z');
  assert.equal(currentRefresh(start,start+REFRESH_MS-1),true);
  assert.equal(currentRefresh(start,start+REFRESH_MS),false);
  assert.equal(currentRefresh(start+1,start),false);
  assert.equal(currentRefresh(undefined,start),false);
  assert.equal(nextRefreshAt(start+45_000),start+REFRESH_MS);
  assert.equal(nextRefreshAt(Date.parse('2026-10-25T23:59:59Z')),Date.parse('2026-10-26T00:00:00Z'));
});

test('legacy minute settings and invalid values cannot restore frequent automatic sync',()=>{
  for(const value of [undefined,'bad','60','300','0','-1','3600.5','86401'])assert.equal(syncInterval(value),REFRESH_MS);
  assert.equal(syncInterval('3600'),REFRESH_MS);
  assert.equal(syncInterval('7200'),2*REFRESH_MS);
});

test('open dashboards refresh hourly and repeated visibility changes do not restart polling',async()=>{
  const source=await readFile(new URL('../public/access.js',import.meta.url),'utf8');
  let now=Date.parse('2026-10-25T14:00:00Z'),siteCalls=0,dataCalls=0,timer,visibility;
  const context={AUTO_REFRESH_MS:REFRESH_MS,Date:{now:()=>now},document:{visibilityState:'visible',addEventListener:(_,handler)=>{visibility=handler;}},
    siteAccess:{clanTag:'#V822RGUG',adminPage:false},clanData:{},selectedMember:null,view:'overview',
    refreshSiteState:async()=>{siteCalls++;},refreshClanData:async()=>{dataCalls++;},setInterval:(callback,interval)=>{timer={callback,interval};}};
  vm.createContext(context);vm.runInContext(source.slice(source.lastIndexOf('refreshSiteState(true);')),context);
  assert.equal(siteCalls,1);assert.equal(timer.interval,REFRESH_MS);
  for(let i=0;i<20;i++)visibility();
  await timer.callback();assert.equal(siteCalls,1);assert.equal(dataCalls,0);
  now+=REFRESH_MS;context.document.visibilityState='hidden';await timer.callback();assert.equal(siteCalls,1);
  context.document.visibilityState='visible';
  await Promise.all([context.refreshActivityView(),context.refreshActivityView()]);
  assert.equal(siteCalls,2);assert.equal(dataCalls,1,'a returning visible tab refreshes once, without overlapping work');
  visibility();await timer.callback();assert.equal(siteCalls,2);
});
