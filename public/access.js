'use strict';

const siteAccess=window.RaidroomAccess={ready:false,admin:false,adminPage:location.pathname.replace(/\/$/,'')==='/admin',clanTag:null,clan:null,localLogin:false,nativeLogin:true,activitySync:null};
const privateWorkspaceRender=render;
let siteBootError='',siteFormError='',siteBusy=false,siteDraftTag=null,sitePolling=false;
VIEWS.war='Current war';
function siteEmpty(message='The administrator is getting the clan ready. Come back soon.'){
  return `<section class="panel public-empty"><span class="clan-start-icon">${icon('shield')}</span><span class="eyebrow">ONE CLAN. EVERY CONTRIBUTION.</span><h1>Your clan’s next chapter.</h1><p>${message}</p>${siteBootError?'<button class="button button-outline" data-site-reload>Try again</button>':''}</section>`;
}
function adminLogin(){
  return `<div class="admin-login-wrap"><section class="panel admin-login"><span class="clan-start-icon">${icon('shield')}</span><span class="eyebrow">RAIDROOM ADMIN</span><h1>Your clan starts here.</h1><p>Sign in to choose the clan shown on your public dashboard.</p>${siteAccess.localLogin?`<form id="admin-login-form"><div class="form-field"><label for="admin-password">Administrator password</label><input id="admin-password" type="password" autocomplete="current-password" required maxlength="256"></div><p class="form-error" role="alert">${esc(siteFormError)}</p><button class="button button-lime" ${siteBusy?'disabled':''}>${siteBusy?'Signing in…':'Sign in'}${icon('arrow-right')}</button></form>`:siteAccess.nativeLogin?`<a class="button button-lime" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">Sign in with ChatGPT ${icon('arrow-right')}</a><p class="admin-access-note">Access is limited to the administrator accounts configured by the site owner.</p>`:`<p class="admin-access-note">The site owner needs to configure the administrator password in the hosting settings.</p>`}<a class="text-link" href="/">${icon('chevron-left')}Back to public dashboard</a></section></div>`;
}
function renderAutoSyncStatus(){
  if(!siteAccess.clan)return '';
  const sync=siteAccess.activitySync;
  const running=sync?.online&&sync.state==='running';
  const label=running?'Syncing activity':sync?.online?'Auto-sync on':'Auto-sync reconnecting';
  const progress=running?` · ${sync.completed} / ${sync.total} members`:'';
  const last=sync?.lastSyncedAt?`Last ${sync.state==='failed'?'attempt':'sync'} ${relativeDate(sync.lastSyncedAt)}`:'Waiting for the first automatic sync';
  const note=sync?.failed?` · ${sync.failed} feeds unavailable; retrying automatically`:'';
  return `<div class="auto-sync-status ${sync?.online?'online':'waiting'}" role="status"><span>${icon(running?'download':'zap')}<strong>${label}</strong>${progress}</span><span>${sync?.intervalSeconds>=86400?'Every day':sync?.intervalSeconds>=120?'Every '+Math.round(sync.intervalSeconds/60)+' minutes':'Every minute'} · ${last}${note}</span></div>`;
}
function publishedClanCard(){
  const clan=clanData||siteAccess.clan;
  if(!clan)return '';
  return `<section class="panel published-clan-card">${badge(clan.badgeUrls?.large,clan.name,'large')}<div><span class="eyebrow">${siteAccess.adminPage?'YOUR PUBLIC CLAN':'THE CLAN WE CALL HOME'}</span><h2>${esc(clan.name)}</h2><p>${esc(clan.tag)} · Clan level ${number(clan.clanLevel)}${clanData?' · '+number(clan.members)+' members':''}</p></div><span class="public-status">${icon('shield')}${siteAccess.adminPage?'Visible to visitors':'Public clan'}</span></section>`;
}
function adminOverview(){
  return pageHeading('ADMIN OVERVIEW','One clan. Your community.','Choose the clan your visitors can explore. Its public game details are detected from the tag.',`<a class="button button-outline" href="/" target="_blank" rel="noopener noreferrer">${icon('arrow-up-right')}View public site</a>`)+renderAutoSyncStatus()+publishedClanCard()+`<div class="admin-overview-grid"><section class="panel clan-publish-panel"><div class="section-topline"><h2>${siteAccess.clan?'Manage your public clan':'Create your clan dashboard'}</h2><span class="admin-only-badge">Admin only</span></div><p>Paste the tag from the clan’s in-game profile. Visitors will see this clan’s members, loot rankings, and current war.</p>${siteAccess.clan?'<button class="text-link unpublish-link" data-unpublish-clan>Unpublish clan</button>':''}<form id="published-clan-form"><div class="form-field"><label for="published-clan-tag">Clan tag</label><input id="published-clan-tag" name="tag" placeholder="#YOURCLANTAG" value="${esc(siteDraftTag??siteAccess.clan?.tag??'')}" maxlength="16" autocomplete="off" spellcheck="false" required><small>The clan name and badge will be loaded automatically.</small></div><p class="form-error" role="alert">${esc(siteFormError)}</p><div class="publish-form-actions"><span>${icon('calendar')}Periods use ${esc(clanTimeZone)}</span><button class="button button-lime" ${siteBusy?'disabled':''}>${siteBusy?'Detecting clan…':siteAccess.clan?'Save clan':'Create clan'}${icon('arrow-right')}</button></div></form></section><section class="panel public-access-explainer"><span class="clan-start-icon">${icon('users')}</span><h2>A place for your whole clan.</h2><p>Everyone gets the same clan dashboard. Visitors can open member profiles, change ranking periods, and follow the war.</p><ul><li>${icon('check')}Clan selection is controlled by you.</li><li>${icon('check')}Public visitors have read-only access.</li><li>${icon('check')}Activity records are shared across browsers.</li></ul></section></div>${siteAccess.clan?`<section class="panel admin-clan-shortcut"><div><h2>Explore ${esc(siteAccess.clan.name)}</h2><p>${clanSyncing?'Collecting activity · '+clanSyncDone+' / '+(clanData?.memberList.length||0)+' members':'Activity is collected automatically, even when the admin dashboard is closed.'}</p></div><a class="button button-outline" href="#clan">Open clan workspace ${icon('arrow-right')}</a></section>`:''}`;
}
function publicOverview(){
  if(!siteAccess.clan)return siteEmpty();
  const clan=clanData||siteAccess.clan,rows=clanTodayBoard?.members||[],known=rows.filter(row=>isKnown(row.loot)),attacks=rows.filter(row=>isKnown(row.attacks));
  const top=[...known].filter(row=>row.loot>0).sort((a,b)=>b.loot-a.loot).slice(0,3);
  return `<section class="public-feature"><img src="./assets/clash-official-banner.jpg" alt="Clash of Clans Electro Dragon and troops" fetchpriority="high"><div><p class="eyebrow">ONE CLAN. EVERY CONTRIBUTION.</p><h1>${esc(clan.name)}.<br><em>Every victory.</em></h1><p>Meet the people behind the shield.<br>Follow the raids. Celebrate the climb.</p><a class="button button-lime" href="#clan">Meet the clan ${icon('arrow-up-right')}</a></div><span class="public-art-credit">ART © SUPERCELL</span></section>${publishedClanCard()}${renderAutoSyncStatus()}${clanError?`<p class="sync-notice" role="alert">${esc(clanError)}</p>`:''}<div class="clan-stat-grid">${clanSummaryCard('Members',clanData?number(clanData.members):'—','users')}${clanSummaryCard('Reported loot today',known.length?compact(known.reduce((sum,row)=>sum+row.loot,0)):'—','coins')}${clanSummaryCard('Recorded attacks today',attacks.length?number(attacks.reduce((sum,row)=>sum+row.attacks,0)):'—','swords')}</div><div class="public-destinations">${[['clan','users','The people behind the shield.','Names, Town Halls, and the progress in every village.'],['leaderboard','trophy','Every haul counts.','See who leads the clan by loot earned or attacks made.'],['war','swords','Follow the war.','The current opponent, score, destruction, and war roster.']].map(([id,ico,title,description])=>`<a class="panel public-destination" href="#${id}"><span>${icon(ico)}</span><h2>${title}</h2><p>${description}</p>${icon('arrow-right')}</a>`).join('')}</div>${top.length?`<div class="section-topline public-top-heading"><h2>Today’s biggest contributors.</h2><a class="text-link" href="#leaderboard">View rankings ${icon('arrow-right')}</a></div><div class="clan-podium">${top.map(row=>`<button class="panel clan-podium-card" data-clan-member="${esc(row.tag)}">${clanTownHallArt(row.townHallLevel)}<h3>${esc(row.name)}</h3><strong>${compact(row.loot)}</strong><small>reported gold + elixir today</small></button>`).join('')}</div>`:''}<p class="clan-coverage">${icon('info')}Totals reflect available recorded attacks in ${esc(clanTimeZone)}. Provider history may be incomplete. Select a member to see unit levels, recorded troop usage, and CWL averages.</p>`;
}
function syncAccessShell(){
  if(siteAccess.adminPage&&siteAccess.admin&&view==='overview')updateSidebar();
  document.body.classList.toggle('public-shell',!siteAccess.adminPage||!siteAccess.admin);
  document.body.classList.toggle('admin-shell',siteAccess.adminPage&&siteAccess.admin);
  document.body.classList.remove('access-loading');
  if(!siteAccess.adminPage){
    $('.sidebar-label').textContent='YOUR CLAN DASHBOARD';
    if(!$('.main-nav').hasAttribute('data-public-nav')){$('.main-nav').setAttribute('data-public-nav','');$('.main-nav').innerHTML=[['overview','grid','Overview'],['clan','users','Members'],['leaderboard','trophy','Clan rankings'],['war','swords','Current war']].map(([id,ico,label])=>`<a class="nav-link" data-public-view="${id}" href="#${id}">${icon(ico)}${label}</a>`).join('');}
    $$('[data-public-view]').forEach(a=>{a.classList.toggle('active',a.dataset.publicView===view);if(a.dataset.publicView===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }
  const label=siteAccess.adminPage?(siteAccess.admin?'Admin workspace':'Admin sign in'):{overview:'Overview',clan:'Members',leaderboard:'Clan rankings',war:'Current war'}[view]||'Overview';
  $('#breadcrumb-title').textContent=label;
  let context=$('#site-access-context');
  if(!context){context=document.createElement('div');context.id='site-access-context';$('.topbar-actions').prepend(context);}
  context.innerHTML=siteAccess.adminPage&&siteAccess.admin?`<span class="admin-only-badge">${icon('shield')}Administrator</span>${siteAccess.localLogin?'<button class="text-link" data-admin-signout>Sign out</button>':'<a class="text-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a>'}`:`<span class="public-view-label">${icon('shield')}Clan dashboard</span>`;
  let ownerLink=$('#site-admin-link');
  if(!ownerLink){ownerLink=document.createElement('a');ownerLink.id='site-admin-link';ownerLink.className='site-admin-link';$('.footer>span:first-child').append(ownerLink);}
  ownerLink.href=siteAccess.adminPage?'/':'/admin';ownerLink.textContent=siteAccess.adminPage?'Public dashboard':'Admin';
  document.title=label+' · Raidroom';
  syncNavigationAccessibility();
}
render=function(){
  if(!siteAccess.ready)return;
  if(siteAccess.adminPage&&siteAccess.admin&&view==='overview'&&!siteBusy&&document.activeElement?.id==='published-clan-tag')return;
  if(siteBootError){$('#main-content').innerHTML=siteEmpty(esc(siteBootError));syncAccessShell();return;}
  if(siteAccess.adminPage){
    if(!siteAccess.admin)$('#main-content').innerHTML=adminLogin();
    else if(view==='overview')$('#main-content').innerHTML=adminOverview();
    else privateWorkspaceRender();
  }else{
    if(!['overview','clan','leaderboard','war'].includes(view))view='overview';
    if(view!=='clan'){selectedMember=null;memberDetails=null;}
    if(view==='overview')$('#main-content').innerHTML=publicOverview();
    else{clanTab={clan:'roster',leaderboard:'leaderboard',war:'war'}[view];$('#main-content').innerHTML=siteAccess.clan?renderClan():siteEmpty();}
  }
  syncAccessShell();
};
async function refreshSiteState(force=false){
  if(sitePolling)return;sitePolling=true;
  try{
    const data=await clanJSON('/api/site'),previous=siteAccess.clanTag;
    siteAccess.admin=siteAccess.adminPage&&data.admin;siteAccess.localLogin=data.localLogin;siteAccess.nativeLogin=data.nativeLogin!==false;siteAccess.clan=data.clan;siteAccess.clanTag=data.clan?.tag||null;siteAccess.activitySync=data.activitySync||null;clanSyncing=data.activitySync?.state==='running'&&!!data.activitySync?.online;clanSyncDone=data.activitySync?.completed||0;clanSyncErrors=data.activitySync?.failed||0;siteAccess.ready=true;siteBootError='';
    clanTimeZone=data.clan?.timeZone||clanTimeZone;
    if(!siteAccess.adminPage||siteAccess.admin){
      if(siteAccess.clanTag&&(force||previous!==siteAccess.clanTag||!clanData)){siteDraftTag=null;render();await loadClan(siteAccess.clanTag);}
      else if(!siteAccess.clanTag){clanData=null;clanBoard=null;clanTodayBoard=null;clanWar=null;clanTag='';}
    }
    render();
  }catch(error){siteBootError=error.message;siteAccess.ready=true;render();}
  finally{sitePolling=false;}
}
document.addEventListener('input',event=>{if(event.target.id==='published-clan-tag')siteDraftTag=event.target.value;});
document.addEventListener('submit',async event=>{
  if(!['admin-login-form','published-clan-form'].includes(event.target.id))return;
  event.preventDefault();if(siteBusy)return;siteFormError='';siteBusy=true;
  if(event.target.id==='admin-login-form'){
    const password=$('#admin-password').value;render();
    try{await clanJSON('/api/admin/session',{method:'POST',body:JSON.stringify({password})});siteBusy=false;await refreshSiteState(true);}
    catch(error){siteFormError=error.message;siteBusy=false;render();}
  }else if(siteAccess.admin){
    siteDraftTag=$('#published-clan-tag').value.trim();render();
    try{const data=await clanJSON('/api/site/clan',{method:'POST',body:JSON.stringify({tag:siteDraftTag,timeZone:clanTimeZone})});siteAccess.clan=data.clan;siteAccess.clanTag=data.clan.tag;siteDraftTag=null;siteBusy=false;await loadClan(data.clan.tag);render();toast('Your clan is now visible on the public dashboard.');}
    catch(error){siteFormError=error.message;siteBusy=false;render();}
  }
});
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-site-reload]')){siteBootError='';await refreshSiteState(true);return;}
  if(event.target.closest('[data-admin-signout]')){await clanJSON('/api/admin/session',{method:'DELETE'});syncEpoch++;clanSyncing=false;siteAccess.admin=false;selectedMember=null;memberDetails=null;view='overview';location.hash='overview';render();}
  if(event.target.closest('[data-unpublish-clan]')&&siteAccess.admin){
    try{await clanJSON('/api/site/clan',{method:'DELETE'});syncEpoch++;memberEpoch++;clanSyncing=false;selectedMember=null;memberDetails=null;siteAccess.clan=null;siteAccess.clanTag=null;clanData=null;clanBoard=null;clanTodayBoard=null;clanWar=null;clanTag='';siteDraftTag=null;siteFormError='';render();toast('Clan unpublished. Saved activity records are preserved.');}
    catch(error){siteFormError=error.message;render();}
  }
},true);
document.addEventListener('click',event=>{
  if(siteAccess.adminPage&&siteAccess.admin)return;
  if(event.target.closest('[data-action],#add-player-side,#export-side,#start-tracking,#profile-button,#player-search,#top-profile,[data-open-clan],[data-clan-refresh],[data-clan-sync],[data-clan-stop],[data-clan-change]')){event.preventDefault();event.stopImmediatePropagation();}
  if(event.target.closest('#help-button')){event.preventDefault();event.stopImmediatePropagation();modal(`<div class="modal-content">${modalHeader('One clan. Every contribution.','A public, read-only view of the clan selected by the administrator.')}<p class="village-notice">Explore members, compare recorded loot and attacks, and follow the current war. Available game and history records are supplied by Supercell and ClashKing. Missing values remain unknown.</p><div class="form-actions"><button class="button button-lime" data-close>Done</button></div></div>`);}
},true);
document.addEventListener('keydown',event=>{if(!(siteAccess.adminPage&&siteAccess.admin)&&event.key==='/'){event.stopImmediatePropagation();}},true);
window.addEventListener('hashchange',()=>{if(siteAccess.ready){if(!siteAccess.adminPage&&view==='overview'){clanPeriod='day';loadClanBoard();}if(view!=='clan'){memberEpoch++;selectedMember=null;memberDetails=null;}render();}});
refreshSiteState(true);
let activityViewPolling=false;
async function refreshActivityView(){
  if(document.visibilityState!=='visible'||activityViewPolling)return;activityViewPolling=true;
  try{
    await refreshSiteState();
    if(siteAccess.clanTag&&clanData&&(!siteAccess.adminPage||siteAccess.admin)){
      if(selectedMember&&view==='clan'){
        const tag=selectedMember,epoch=memberEpoch;
        try{const details=await clanJSON('/api/players/'+encodeURIComponent(tag)+'/details?tz='+encodeURIComponent(clanTimeZone));if(tag===selectedMember&&epoch===memberEpoch){memberDetails=details;render();}}catch{}
      }else await refreshClanData();
    }
  }finally{activityViewPolling=false;}
}
setInterval(refreshActivityView,30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshActivityView();});
