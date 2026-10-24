'use strict';

const siteAccess=window.RaidroomAccess={ready:false,admin:false,adminPage:location.pathname.replace(/\/$/,'')==='/admin',clanTag:null,clan:null,clans:[],primaryClan:null,localLogin:false,nativeLogin:true,activitySync:null};
const privateWorkspaceRender=render;
let siteBootError='',siteFormError='',siteBusy=false,siteDraftTag=null,sitePolling=false;
let preferredClan=new URL(location.href).searchParams.get('clan');
try{preferredClan=preferredClan||localStorage.getItem('marine-durugista.clan');}catch{}
VIEWS.war='Current war';
if(location.hash==='#war')view='war';
function familyPicker(){
  if(siteAccess.clans.length<2)return '';
  return `<section class="family-picker" aria-label="Choose clan"><div><span class="eyebrow">TWO CLANS. ONE FAMILY.</span><h2>Choose your clan.</h2></div><div class="family-options">${siteAccess.clans.map((clan,index)=>`<button data-family-clan="${esc(clan.tag)}" class="family-option${clan.tag===siteAccess.clanTag?' selected':''}" aria-pressed="${clan.tag===siteAccess.clanTag}">${badge(clan.badgeUrls?.large,clan.name)}<span><strong>${index?'DURUGISTA':'MARINE CLAN'}</strong><small>${index?'Extension clan':'Main clan'} · ${esc(clan.tag)}</small></span><span class="family-choice-dot">${clan.tag===siteAccess.clanTag?icon('check'):''}</span></button>`).join('')}</div></section>`;
}
function siteEmpty(message='The administrator is getting the clan ready. Come back soon.'){
  return `<section class="panel public-empty"><span class="clan-start-icon">${icon('shield')}</span><span class="eyebrow">TWO CLANS. ONE FAMILY.</span><h1>Your clan’s next chapter.</h1><p>${message}</p>${siteBootError?'<button class="button button-outline" data-site-reload>Try again</button>':''}</section>`;
}
function adminLogin(){
  return `<div class="admin-login-wrap"><section class="panel admin-login"><span class="clan-start-icon">${icon('shield')}</span><span class="eyebrow">MARINE X DURUGISTA ADMIN</span><h1>Your clan starts here.</h1><p>Sign in to choose the clan shown on your public dashboard.</p>${siteAccess.localLogin?`<form id="admin-login-form"><div class="form-field"><label for="admin-password">Administrator password</label><input id="admin-password" type="password" autocomplete="current-password" required maxlength="256"></div><p class="form-error" role="alert">${esc(siteFormError)}</p><button class="button button-lime" ${siteBusy?'disabled':''}>${siteBusy?'Signing in…':'Sign in'}${icon('arrow-right')}</button></form>`:siteAccess.nativeLogin?`<a class="button button-lime" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">Sign in with ChatGPT ${icon('arrow-right')}</a><p class="admin-access-note">Access is limited to the administrator accounts configured by the site owner.</p>`:`<p class="admin-access-note">The site owner needs to configure the administrator password in the hosting settings.</p>`}<a class="text-link" href="/">${icon('chevron-left')}Back to public dashboard</a></section></div>`;
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
  return familyPicker()+pageHeading('ADMIN OVERVIEW','Your clans. Your community.','Manage your main clan. Durugista is available alongside it as your extension clan.',`<a class="button button-outline" href="/" target="_blank" rel="noopener noreferrer">${icon('arrow-up-right')}View public site</a>`)+renderAutoSyncStatus()+publishedClanCard()+`<div class="admin-overview-grid"><section class="panel clan-publish-panel"><div class="section-topline"><h2>${siteAccess.clan?'Manage your public clan':'Create your clan dashboard'}</h2><span class="admin-only-badge">Admin only</span></div><p>Paste your main clan’s in-game tag. Visitors can switch between this clan and Durugista (#2J028VPVY). Each has its own activity, rankings, raids, and Games.</p>${siteAccess.clan?'<button class="text-link unpublish-link" data-unpublish-clan>Unpublish clan</button>':''}<form id="published-clan-form"><div class="form-field"><label for="published-clan-tag">Clan tag</label><input id="published-clan-tag" name="tag" placeholder="#YOURCLANTAG" value="${esc(siteDraftTag??siteAccess.primaryClan?.tag??'')}" maxlength="16" autocomplete="off" spellcheck="false" required><small>The clan name and badge will be loaded automatically.</small></div><p class="form-error" role="alert">${esc(siteFormError)}</p><div class="publish-form-actions"><span>${icon('calendar')}Periods use ${esc(clanTimeZone)}</span><button class="button button-lime" ${siteBusy?'disabled':''}>${siteBusy?'Detecting clan…':siteAccess.clan?'Save clan':'Create clan'}${icon('arrow-right')}</button></div></form></section><section class="panel public-access-explainer"><span class="clan-start-icon">${icon('users')}</span><h2>A place for your whole clan.</h2><p>Visitors can choose Marine or Durugista, open member profiles, compare rankings, and follow both clans’ events.</p><ul><li>${icon('check')}The two published clans are controlled by you.</li><li>${icon('check')}Public visitors have read-only access.</li><li>${icon('check')}Activity records are shared across browsers.</li></ul></section></div>${siteAccess.clan?`<section class="panel admin-clan-shortcut"><div><h2>Explore ${esc(siteAccess.clan.name)}</h2><p>${clanSyncing?'Collecting activity · '+clanSyncDone+' / '+(clanData?.memberList.length||0)+' members':'Activity is collected automatically, even when the admin dashboard is closed.'}</p></div><a class="button button-outline" href="#clan">Open clan workspace ${icon('arrow-right')}</a></section>`:''}`;
}
function publicDestinations(){
  const destinations=[
    ['clan','heroes/barbarian_king/icon.webp','Member','Explore every village, Town Hall, hero, and troop level.'],
    ['leaderboard','interface/chest.webp','Highest loots','The clan’s top raiders, ranked by loot and attacks.'],
    ['war','interface/wood_swords.png','Current war','The opponent, live score, and every attack on the war map.'],
  ];
  return '<div class="public-destinations">'+destinations.map(([id,art,title,description])=>`<a class="panel public-destination" href="#${id}"><span class="destination-art" aria-hidden="true"><img src="./assets/game/${art}" alt="" width="104" height="104" decoding="async" loading="lazy"></span><h2>${title}</h2><p>${description}</p><span class="destination-link">Explore ${icon('arrow-right')}</span></a>`).join('')+'</div>';
}
function publicGiveaways(standalone=false){
  const heading=standalone?'h1':'h2';
  const rounds=[
    {title:'2 Cosmic Sceneries',art:'cosmic_scenery.webp',winners:[['Paengski','claimed'],['James Ruper','claimed']]},
    {title:'3 Gold Passes',art:'gold_pass.png',winners:[['Waks','waiting'],['Pending','pending'],['Pending','pending']]},
  ];
  const events=[
    {month:'NOV',days:'01',start:'2026-11-01',end:null,title:'2 Gold Pass giveaway',copy:'Two Gold Passes for the clan.',art:'gold_pass.png'},
    {month:'DEC',days:'22–23',start:'2026-12-22',end:'2026-12-23',title:'Tournament',copy:'Two days of clan competition.',art:'wood_swords.png'},
    {month:'DEC',days:'24–25',start:'2026-12-24',end:'2026-12-25',title:'Most loot in a day',copy:'The member with the most loot in a day wins a Gold Pass.',art:'gold_pass.png'},
  ];
  return `<section class="giveaway-section" aria-labelledby="giveaway-heading"><div class="giveaway-section-heading"><div><p class="eyebrow">FOR THE CLAN. FROM THE CLAN.</p><${heading} id="giveaway-heading">Giveaway winners</${heading}><p>Celebrating our winners, with more to look forward to.</p></div><span class="giveaway-season">CLAN REWARDS · 2026</span></div><div class="giveaway-layout"><div class="giveaway-rounds">${rounds.map(round=>`<section class="panel giveaway-round"><div class="giveaway-prize ${round.art==='cosmic_scenery.webp'?'scenery-prize':'pass-prize'}"><img src="./assets/game/interface/${round.art}" alt="${round.art==='cosmic_scenery.webp'?'Cosmic Scenery':'Gold Pass'}" loading="lazy"><div><span class="eyebrow">CURRENT WINNERS</span><h3>${round.title}</h3></div></div><ul class="giveaway-winners">${round.winners.map(([name,status],index)=>`<li><span class="giveaway-winner-number">${String(index+1).padStart(2,'0')}</span><div><strong>${name}</strong><small>${status==='pending'?'Winner to be announced':status==='claimed'?'Prize received':'Awaiting claim'}</small></div><span class="prize-status ${status}">${icon(status==='claimed'?'check':status==='waiting'?'clock':'compass')}${{claimed:'Claimed',waiting:'Waiting',pending:'Pending'}[status]}</span></li>`).join('')}</ul></section>`).join('')}</div><section class="panel giveaway-calendar"><div class="giveaway-calendar-heading"><span class="eyebrow">MARK YOUR CALENDAR</span><h3>Upcoming giveaways & events</h3></div><ol>${events.map(event=>`<li><div class="giveaway-date"><span>${event.month}</span><strong>${event.days}</strong></div><div class="giveaway-event"><h4>${event.title}</h4><p>${event.copy}</p><small><time datetime="${event.start}">${event.month==='NOV'?'November':'December'} ${event.days}</time> · 2026</small></div><img src="./assets/game/interface/${event.art}" alt="" width="36" height="36" loading="lazy"></li>`).join('')}</ol></section></div></section>`;
}
function publicOverview(){
  if(!siteAccess.clan)return siteEmpty();
  const clan=clanData||siteAccess.clan,rows=clanTodayBoard?.members||[],known=rows.filter(row=>isKnown(row.loot)),attacks=rows.filter(row=>isKnown(row.attacks));
  const top=[...known].filter(row=>row.loot>0).sort((a,b)=>b.loot-a.loot||a.name.localeCompare(b.name)).slice(0,3);
  return familyPicker()+`<section class="public-feature"><img src="./assets/clash-official-banner.jpg" alt="Clash of Clans Electro Dragon and troops" fetchpriority="high"><div><p class="eyebrow">TWO CLANS. ONE FAMILY.</p><h1>${esc(clan.name)}.<br><em>Every victory.</em></h1><p>Members, loots, war & Capital raids.<br>One place for the whole family.</p><a class="button button-lime" href="#clan">Meet the clan ${icon('arrow-up-right')}</a></div><span class="public-art-credit">ART © SUPERCELL</span></section>${publishedClanCard()}${renderAutoSyncStatus()}${clanError?`<p class="sync-notice" role="alert">${esc(clanError)}</p>`:''}<div class="clan-stat-grid">${clanSummaryCard('Members',clanData?number(clanData.members):'—','users')}${clanSummaryCard('Reported loot today',known.length?compact(known.reduce((sum,row)=>sum+row.loot,0)):'—','coins')}${clanSummaryCard('Recorded attacks today',attacks.length?number(attacks.reduce((sum,row)=>sum+row.attacks,0)):'—','swords')}</div>${publicDestinations()}${familyActivityOverview()}${publicGiveaways()}${top.length?`<div class="section-topline public-top-heading"><h2>Today’s biggest contributors.</h2><a class="text-link" href="#leaderboard">View rankings ${icon('arrow-right')}</a></div><div class="clan-podium">${top.map((row,index)=>`<button class="panel clan-podium-card" data-clan-member="${esc(row.tag)}">${podiumMedal(index+1)}${clanTownHallArt(row.townHallLevel)}<h3>${esc(row.name)}</h3><strong>${compact(row.loot)}</strong><small>reported gold + elixir today</small></button>`).join('')}</div>`:''}<p class="clan-coverage">${icon('info')}Totals reflect available recorded attacks in ${esc(clanTimeZone)}. Provider history may be incomplete. Select a member to see unit levels, recorded troop usage, and CWL averages.</p>`;
}
function syncAccessShell(){
  if(siteAccess.adminPage&&siteAccess.admin&&view==='overview')updateSidebar();
  document.body.classList.toggle('public-shell',!siteAccess.adminPage||!siteAccess.admin);
  document.body.classList.toggle('admin-shell',siteAccess.adminPage&&siteAccess.admin);
  document.body.classList.remove('access-loading');
  if(!siteAccess.adminPage){
    $('.sidebar-label').textContent='YOUR FAMILY DASHBOARD';
    if(!$('.main-nav').hasAttribute('data-public-nav')){$('.main-nav').setAttribute('data-public-nav','');$('.main-nav').innerHTML=[['overview','grid','Overview'],['clan','users','Members'],['leaderboard','trophy','Clan rankings'],['war','swords','Current war'],['capital','castle','Capital raids'],['games','gift','Clan Games'],['giveaways','gift','Giveaways']].map(([id,ico,label])=>`<a class="nav-link" data-public-view="${id}" href="#${id}" aria-label="${label}" title="${label}">${gameIcon(ico)}${label}</a>`).join('');}
    $$('[data-public-view]').forEach(a=>{a.classList.toggle('active',a.dataset.publicView===view);if(a.dataset.publicView===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }
  const label=siteAccess.adminPage?(siteAccess.admin?'Admin workspace':'Admin sign in'):{overview:'Overview',clan:'Members',leaderboard:'Clan rankings',war:'Current war',capital:'Capital raids',games:'Clan Games',giveaways:'Giveaways'}[view]||'Overview';
  $('#breadcrumb-title').textContent=label;
  let context=$('#site-access-context');
  if(!context){context=document.createElement('div');context.id='site-access-context';$('.topbar-actions').prepend(context);}
  context.innerHTML=siteAccess.adminPage&&siteAccess.admin?`<span class="admin-only-badge">${icon('shield')}Administrator</span>${siteAccess.localLogin?'<button class="text-link" data-admin-signout>Sign out</button>':'<a class="text-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a>'}`:`<span class="public-view-label">${icon('shield')}${esc(siteAccess.clan?.name||'Clan dashboard')}</span>`;
  let ownerLink=$('#site-admin-link');
  if(!ownerLink){ownerLink=document.createElement('a');ownerLink.id='site-admin-link';ownerLink.className='site-admin-link';$('.footer>span:first-child').append(ownerLink);}
  ownerLink.href=siteAccess.adminPage?'/':'/admin';ownerLink.textContent=siteAccess.adminPage?'Public dashboard':'Admin';
  document.title=label+' · MARINE X DURUGISTA';
  syncNavigationAccessibility();
}
render=function(){
  if(!siteAccess.ready)return;
  if(siteAccess.adminPage&&siteAccess.admin&&!siteBusy&&((view==='overview'&&document.activeElement?.id==='published-clan-tag')||(view==='games'&&document.activeElement?.closest('#games-score-form'))))return;
  if(siteBootError){$('#main-content').innerHTML=siteEmpty(esc(siteBootError));syncAccessShell();return;}
  if(siteAccess.adminPage){
    if(!siteAccess.admin)$('#main-content').innerHTML=adminLogin();
    else if(view==='overview')$('#main-content').innerHTML=adminOverview();
    else if(view==='giveaways')$('#main-content').innerHTML=publicGiveaways(true);
    else if(view==='capital')$('#main-content').innerHTML=renderCapital();
    else if(view==='games')$('#main-content').innerHTML=renderGames();
    else privateWorkspaceRender();
  }else{
    if(!['overview','clan','leaderboard','war','capital','games','giveaways'].includes(view))view='overview';
    if(view!=='clan'){selectedMember=null;memberDetails=null;}
    if(view==='overview')$('#main-content').innerHTML=publicOverview();
    else if(view==='giveaways')$('#main-content').innerHTML=publicGiveaways(true);
    else if(view==='capital')$('#main-content').innerHTML=renderCapital();
    else if(view==='games')$('#main-content').innerHTML=renderGames();
    else{clanTab={clan:'roster',leaderboard:'leaderboard',war:'war'}[view];$('#main-content').innerHTML=siteAccess.clan?renderClan():siteEmpty();}
  }
  syncAccessShell();
};
async function refreshSiteState(force=false){
  if(sitePolling)return;sitePolling=true;const requested=preferredClan;
  try{
    const data=await clanJSON('/api/site'+(requested?'?clan='+encodeURIComponent(requested):'')),previous=siteAccess.clanTag;
    if(preferredClan!==requested)return;
    siteAccess.admin=siteAccess.adminPage&&data.admin;siteAccess.localLogin=data.localLogin;siteAccess.nativeLogin=data.nativeLogin!==false;siteAccess.clan=data.clan;siteAccess.clans=data.clans||[];siteAccess.primaryClan=data.primaryClan;siteAccess.clanTag=data.clan?.tag||null;siteAccess.activitySync=data.activitySync||null;clanSyncing=data.activitySync?.state==='running'&&!!data.activitySync?.online;clanSyncDone=data.activitySync?.completed||0;clanSyncErrors=data.activitySync?.failed||0;siteAccess.ready=true;siteBootError='';
    if(previous!==siteAccess.clanTag){clanEpoch++;boardEpoch++;memberEpoch++;selectedMember=null;memberDetails=null;clanData=null;clanBoard=null;clanTodayBoard=null;clanWar=null;clanSearch='';resetClanEvents();}
    clanTimeZone=data.clan?.timeZone||clanTimeZone;
    if(!siteAccess.adminPage||siteAccess.admin){
      if(siteAccess.clanTag&&(force||previous!==siteAccess.clanTag||!clanData)){siteDraftTag=null;render();await loadClan(siteAccess.clanTag);}
      else if(!siteAccess.clanTag){clanData=null;clanBoard=null;clanTodayBoard=null;clanWar=null;clanTag='';}
    }
    render();
  }catch(error){siteBootError=error.message;siteAccess.ready=true;render();}
  finally{sitePolling=false;if(preferredClan!==requested)refreshSiteState(true);}
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
    try{const data=await clanJSON('/api/site/clan',{method:'POST',body:JSON.stringify({tag:siteDraftTag,timeZone:clanTimeZone})});siteAccess.clan=data.clan;siteAccess.clanTag=data.clan.tag;siteDraftTag=null;siteBusy=false;preferredClan=data.clan.tag;await refreshSiteState(true);toast('Your clan is now visible on the public dashboard.');}
    catch(error){siteFormError=error.message;siteBusy=false;render();}
  }
});
document.addEventListener('click',async event=>{
  const family=event.target.closest('[data-family-clan]');
  if(family&&(family.dataset.familyClan!==siteAccess.clanTag||family.dataset.familyClan!==preferredClan)){
    preferredClan=family.dataset.familyClan;try{localStorage.setItem('marine-durugista.clan',preferredClan);}catch{}
    const url=new URL(location.href);url.searchParams.set('clan',preferredClan);history.replaceState(null,'',url);await refreshSiteState(true);return;
  }
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
  if(event.target.closest('#help-button')){event.preventDefault();event.stopImmediatePropagation();modal(`<div class="modal-content">${modalHeader('One clan. Every contribution.','A public, read-only view of Marine and its extension clan, Durugista.')}<p class="village-notice">Choose a clan to explore members, compare recorded loot and attacks, and follow wars, Capital Raids, and Clan Games. Available game and history records are supplied by Supercell and ClashKing. Missing values remain unknown.</p><div class="form-actions"><button class="button button-lime" data-close>Done</button></div></div>`);}
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
