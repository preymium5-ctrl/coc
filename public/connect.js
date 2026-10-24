'use strict';

// Account data is fetched from this Site's server. API credentials never enter this file.
let liveLookupTimer=null,liveLookupAbort=null,liveLookupSequence=0,livePreview=null,liveSyncing=false,liveSyncSequence=0;
let lastActivityError='';
const oldRender=render,oldRenderOverview=renderOverview,oldRenderBattles=renderBattles,oldSourceNote=sourceNote,oldSourceBadge=sourceBadge,oldReadBackup=readBackup;
const oldCleanPlayer=cleanPlayer,oldPlayerPanel=playerPanel,oldLeaderboardData=leaderboardData;
const oldRenderLeaderboard=renderLeaderboard,oldStatCard=statCard;
const isKnown=value=>typeof value==='number'&&Number.isFinite(value);
const maybeNumber=value=>isKnown(value)?number(value):'—';
const maybeCompact=value=>isKnown(value)?compact(value):'—';
const recordedLoot=b=>isKnown(b.gold)&&isKnown(b.elixir)?b.gold+b.elixir:null;
const rankedBattle=b=>b.mode==='ranked'||b.mode==='legend'||b.type==='Ranked'||b.type==='Legend';

VIEWS.ranked='Ranked battles';
for(const type of ['Ranked','Legend','Friendly','Other'])if(!TYPES.includes(type))TYPES.push(type);

async function siteJSON(path,{signal}={}){
  let response;
  try{response=await fetch(path,{signal:signal||AbortSignal.timeout(16000),credentials:'same-origin',cache:'no-store'});}
  catch(error){if(error.name==='AbortError')throw error;throw new Error('Could not reach the game-data connection. Please try again.');}
  let data;
  try{data=await response.json();}catch{throw new Error('The game-data connection is temporarily unavailable.');}
  if(!response.ok){const error=new Error(data.error||'Could not load this player.');error.code=data.code;throw error;}
  return data;
}

function sourceLabel(){return state.source==='live'?'Live profile':state.source==='api'?'Imported API profile':state.source==='import'?'Imported profile':'Personal records';}
sourceBadge=function(){return state.source==='live'?'<span class="live-badge">'+icon('zap')+'Connected village</span>':oldSourceBadge();};
sourceNote=function(){
  if(state.source!=='live')return oldSourceNote();
  const when=state.live?.profileUpdatedAt?relativeDate(state.live.profileUpdatedAt):'just now';
  return `<div class="live-status-line"><div>${sourceBadge()}<span>Profile updated ${esc(when)} · Supercell</span></div><button class="button button-ghost" data-live-refresh ${liveSyncing?'disabled':''}>${icon(liveSyncing?'clock':'download')}${liveSyncing?'Updating…':'Refresh village'}</button></div>${lastActivityError?`<div class="sync-notice">${icon('info')}<span>${esc(lastActivityError)} Your saved details are still available.</span></div>`:''}`;
};

cleanPlayer=function(raw){
  const p=oldCleanPlayer({...raw,league:raw.leagueTier||raw.league});
  p.leagueTier=raw.leagueTier||raw.league||null;
  p.builderHallLevel=isKnown(raw.builderHallLevel)?raw.builderHallLevel:null;
  p.builderBaseTrophies=isKnown(raw.builderBaseTrophies)?raw.builderBaseTrophies:null;
  p.currentLeagueGroupTag=typeof raw.currentLeagueGroupTag==='string'?raw.currentLeagueGroupTag:null;
  p.currentLeagueSeasonId=raw.currentLeagueSeasonId??null;
  p.legendStatistics=raw.legendStatistics||null;
  p.heroEquipment=cleanUnits(raw.heroEquipment);
  return p;
};

function rankInfo(){
  const rankings=state.source==='live'?state.live?.activity?.rankings:null;
  const officialRank=state.player.legendStatistics?.currentSeason?.rank;
  return{
    global:isKnown(rankings?.homeVillage?.globalRank)?rankings.homeVillage.globalRank:isKnown(officialRank)?officialRank:null,
    local:isKnown(rankings?.homeVillage?.localRank)?rankings.homeVillage.localRank:null,
    country:rankings?.location?.name||'Country rank',
    loaded:state.live?.activity?.coverage?.rankings?.status==='available'||isKnown(officialRank),
  };
}
function rankValue(value,loaded){return isKnown(value)&&value>0?'#'+number(value):loaded?'Not listed':'Unavailable';}
function rankSummary(){
  const rank=rankInfo(),tier=state.player.leagueTier?.name||state.player.league?.name||'Unranked';
  const group=state.source==='live'?state.live?.activity?.currentGroup:null;
  return `<section class="rank-summary"><div><span class="rank-summary-icon">${icon('trophy')}</span><span><small>Current league</small><strong>${esc(tier)}</strong>${isKnown(group?.position)?`<small class="group-position">#${group.position} in current group</small>`:''}</span></div><div><small>Global rank</small><strong>${rankValue(rank.global,rank.loaded)}</strong></div><div><small>${esc(rank.country)}</small><strong>${rankValue(rank.local,rank.loaded)}</strong></div><a class="text-link" href="#ranked">Ranked battles ${icon('arrow-up-right')}</a></section>`;
}
playerPanel=function(){return oldPlayerPanel().replace('<div class="xp-track">',`${state.source==='live'?`<div class="profile-rank-row"><span>Global rank</span><strong>${rankValue(rankInfo().global,rankInfo().loaded)}</strong></div>`:''}<div class="xp-track">`);};
const oldRenderVillage=renderVillage;
renderVillage=function(){const html=oldRenderVillage();return state.source==='live'?html.replace('Edit player','Find another player').replace('<div class="village-grid">',rankSummary()+'<div class="village-grid">').replace(/Profile updated [^<]+\. Import a fresh profile to record changes to your trophies and unit levels\./,'Automatically detected from your player tag. Use Refresh village for the latest account details.'):html;};
renderOverview=function(){return oldRenderOverview().replace('<div class="stats-grid">',`${state.source==='live'?rankSummary():''}<div class="stats-grid">`).replace('Manually logged results · saved on this device',state.source==='live'?'Synced results · saved on this device':'Manually logged results · saved on this device');};
renderBattles=function(){return oldRenderBattles()+(state.source==='live'?`<p class="village-notice">${esc(historyCoverage())} Missing values are shown as a dash.</p>`:'');};

totalLoot=function(battles){return battles.reduce((total,b)=>total+(recordedLoot(b)??0),0);};
leaderboardData=function(period=leaderPeriod){return oldLeaderboardData(period).filter(b=>recordedLoot(b)!==null);};
renderLeaderboard=function(){return oldRenderLeaderboard()+'<p class="village-notice">Loot totals include only attacks with reported gold and elixir. Battles whose loot is unavailable are excluded.</p>';};
statCard=function(label,value,ico,color,detail,spark){if(label==='Loot earned today'&&todayBattles().length&&!todayBattles().some(b=>recordedLoot(b)!==null)){value='—';detail='<span>Loot not reported for these attacks</span>';}return oldStatCard(label,value,ico,color,detail,spark);};

battleTabs=function(){return `<div class="table-tabs" role="tablist" aria-label="Battle types">${[['all','All battles'],['Ranked','Ranked'],['Multiplayer','Multiplayer'],['war','Clan wars']].map(([value,label])=>`<button role="tab" aria-selected="${battleFilter===value}" class="table-tab ${battleFilter===value?'active':''}" data-filter="${value}">${label}</button>`).join('')}</div>`;};
filteredBattles=function(overviewOnly=false){return [...state.battles].filter(b=>
  (battleFilter==='all'||battleFilter==='war'&&['Clan war','CWL'].includes(b.type)||battleFilter==='Ranked'&&rankedBattle(b)||b.type===battleFilter)
  &&(overviewOnly||!battleQuery||b.opponent.toLowerCase().includes(battleQuery.toLowerCase()))
  &&(overviewOnly||battlePeriod==='all'||Date.now()-new Date(b.date).getTime()<Number(battlePeriod)*86400000)
).sort((a,b)=>new Date(b.date)-new Date(a.date));};

battleTable=function(battles,full=false){return `<div class="table-scroll"><table class="battle-table ${full?'full-table':''}"><thead><tr><th>Opponent</th><th>Result</th><th>Loot earned</th><th class="hide-mid hide-small">Trophies</th><th class="hide-small">When</th><th><span class="visually-hidden">Details</span></th></tr></thead><tbody>${battles.map(b=>{
  const type=b.type==='Defense'&&rankedBattle(b)?`${b.mode==='legend'?'Legend':'Ranked'} defense`:b.type;
  const opponentArt=isKnown(b.townHall)&&b.townHall>0?townHallArt(b.townHall):`<span class="unknown-townhall" aria-label="Opponent Town Hall not reported">${icon('castle')}</span>`;
  return `<tr class="battle-row" data-battle="${esc(b.id)}" tabindex="0" aria-label="View ${esc(b.opponent)} battle details"><td><div class="opponent">${opponentArt}<div><div class="opponent-name">${esc(b.opponent)}</div><div class="battle-type">${esc(type)}${b.source?' · '+(b.source==='official'?'Game API':b.source==='clashking'?'ClashKing':'Journal'):''}</div></div></div></td><td>${isKnown(b.stars)?stars(b.stars):'<span class="missing-value">—</span>'}<div class="destruction">${isKnown(b.destruction)?number(b.destruction)+'% destruction':'Result not reported'}</div></td><td><div class="loot">${recordedLoot(b)!==null?resourceArt('gold'):''}${maybeCompact(recordedLoot(b))}</div><div class="loot-small">${isKnown(b.dark)?resourceArt('dark_elixir')+compact(b.dark)+' dark elixir':'Loot not reported'}</div></td><td class="hide-mid hide-small"><span class="trophy-change ${b.trophyChange<0?'negative':''}">${isKnown(b.trophyChange)?(b.trophyChange>0?'+':'')+number(b.trophyChange):'—'} ${icon('trophy')}</span></td><td class="hide-small"><span class="battle-time">${relativeDate(b.date)}</span></td><td>${icon('chevron-right','row-chevron')}</td></tr>`;
}).join('')||'<tr><td colspan="6" class="no-results">'+(liveSyncing?'Loading recent battle results…':'No battles available for these filters yet.')+'</td></tr>'}</tbody></table></div>`;};

openBattle=function(id){
  const b=state.battles.find(item=>item.id===id);if(!b)return;
  const source=b.source==='official'?'Supercell battle log':b.source==='clashking'?'History collected by ClashKing':'Your battle journal';
  const art=isKnown(b.townHall)&&b.townHall>0?townHallArt(b.townHall):'';
  modal(`<div class="modal-content">${modalHeader(`<span class="detail-title-tag">${art}${esc(b.opponent)}</span>`,`${esc(b.type)} · ${new Date(b.date).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}`)}<div class="detail-score">${isKnown(b.stars)?stars(b.stars):''}<strong>${isKnown(b.destruction)?b.destruction+'%':'—'}</strong><small>${esc(source)}</small></div><div class="detail-data">${[['gold','Gold',b.gold],['elixir','Elixir',b.elixir],['dark_elixir','Dark elixir',b.dark]].map(([key,label,value])=>`<div>${resourceArt(key)}<small>${label}</small><strong>${maybeNumber(value)}</strong></div>`).join('')}</div><dl class="battle-facts"><div><dt>Battle duration</dt><dd>${isKnown(b.duration)?Math.floor(b.duration/60)+'m '+Math.round(b.duration%60)+'s':'Not reported'}</dd></div><div><dt>Trophy change</dt><dd>${isKnown(b.trophyChange)?(b.trophyChange>0?'+':'')+number(b.trophyChange):'Not reported'}</dd></div>${b.opponentTag?`<div><dt>Opponent tag</dt><dd>${esc(b.opponentTag)}</dd></div>`:''}</dl>${b.opponentKnown===false?'<p class="detail-note">The provider did not record this opponent’s name or Town Hall.</p>':''}${b.notes?`<p class="detail-note">${esc(b.notes)}</p>`:''}<div class="form-info">${icon('info')}<span>A dash means this value was not supplied. Playable in-game replays are separate from these battle results.</span></div><div class="form-actions">${!b.source?`<button class="danger-link" data-remove-battle="${esc(b.id)}">Delete record</button>`:''}<button class="button button-outline" data-action="replay">${icon('play')}Add a recording</button><button class="button button-lime" data-close>Done</button></div></div>`);
};

function historyCoverage(){
  const coverage=state.live?.activity?.coverage;
  if(!coverage)return liveSyncing?'Recent results are loading.':'Connect your player tag to load recent game results.';
  const recent=coverage.recent;
  if(recent?.status==='available')return 'Recent results from the game API. Older results appear where ClashKing recorded them.';
  if(coverage.history?.status==='available')return 'Showing recorded ClashKing history. The recent game feed is temporarily unavailable.';
  if(recent?.status==='empty'||coverage.history?.status==='empty')return 'The providers have not returned any recent battles for this player yet.';
  return 'Battle history is currently unavailable from the providers. Your profile can still update normally.';
}

function renderRanked(){
  const battles=state.battles.filter(rankedBattle).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const attacks=battles.filter(b=>b.type!=='Defense');
  const threeStars=attacks.filter(b=>b.stars===3).length;
  const seasons=state.source==='live'?state.live?.activity?.leagueHistory||[]:[];
  return pageHeading('YOUR PLACE ON THE CLIMB','Your ranked story.','League, rankings, and the recent battles behind them.',`<button class="button button-lime" data-action="player">${icon('search')}${state.source==='live'?'Find another player':'Find my player'}</button>`)+sourceNote()+rankSummary()+`<div class="summary-grid"><div class="panel summary-card"><span class="stat-icon">${icon('swords')}</span><div><small>Recorded ranked attacks</small><strong>${attacks.length}</strong></div></div><div class="panel summary-card"><span class="stat-icon">${icon('star')}</span><div><small>Perfect attacks</small><strong>${threeStars}</strong></div></div><div class="panel summary-card"><span class="stat-icon">${icon('shield')}</span><div><small>Recorded defenses</small><strong>${battles.length-attacks.length}</strong></div></div></div><div class="callout-inline">${icon('info')}<span>${esc(historyCoverage())}</span></div><section class="panel"><div class="panel-header"><div class="section-topline"><h2>Recent ranked & Legend battles</h2><span class="reduced-meta">${battles.length} saved results</span></div></div>${battleTable(battles.slice(0,40),true)}<div class="panel-foot"><span>Results supplied by game and history providers.</span><button class="text-link" data-live-refresh ${liveSyncing?'disabled':''}>Refresh ${icon('download')}</button></div></section>${seasons.length?`<section class="panel season-panel"><div class="panel-header"><div class="section-topline"><h2>Ranked season history</h2><span class="reduced-meta">Reported by game & history providers</span></div></div><div class="table-scroll"><table><thead><tr><th>Season</th><th>League</th><th>Placement</th><th>Trophies</th><th>Attack stars</th></tr></thead><tbody>${seasons.slice(0,12).map(s=>`<tr><td>${esc(s.season||s.seasonId||s.leagueSeasonId||'—')}</td><td>${esc(s.league?.name||s.leagueTier?.name||'—')}</td><td>${maybeNumber(s.placement??s.rank)}</td><td>${maybeNumber(s.leagueTrophies??s.trophies)}</td><td>${maybeNumber(s.attackStars)}</td></tr>`).join('')}</tbody></table></div></section>`:''}`;
}

render=function(){
  if(view==='clan'){$('#main-content').innerHTML=renderClan();updateSidebar();document.title='Clan hub · MARINE X DURUGISTA';}
  else if(view==='ranked'&&hasPlayer()){$('#main-content').innerHTML=renderRanked();updateSidebar();document.title='Ranked battles · MARINE X DURUGISTA';}
  else oldRender();
  $('#sidebar-source').textContent=state.source==='live'?'Connected game profile':hasPlayer()?'Saved on this device':'No player connected';
  $('#add-player-side').innerHTML=icon('search')+'Find a player';
  $('#start-tracking').innerHTML=(state.source==='live'?'Find another player':'Connect my village')+icon('arrow-up-right');
  const sourceFooter=$('.footer>span:last-child');
  if(sourceFooter&&!sourceFooter.querySelector('[data-history-credit]'))sourceFooter.insertAdjacentHTML('afterbegin','<span data-history-credit>Game data from Supercell · history & rankings by <a href="https://clashk.ing/" target="_blank" rel="noopener noreferrer">ClashKing</a>. </span>');
};

function playerPreviewHTML(p){
  return `<div class="lookup-profile"><div class="lookup-identity">${townHallArt(p.townHallLevel)}<div><h3>${esc(p.name)}</h3><p>${esc(p.tag)} · ${esc(p.clan?.name||'No clan')}</p></div><span class="lookup-check">${icon('check')}</span></div><div class="lookup-stats"><div><small>Player level</small><strong>${number(p.expLevel)}</strong></div><div><small>Town Hall</small><strong>${number(p.townHallLevel)}</strong></div><div><small>Trophies</small><strong>${number(p.trophies)}</strong></div></div><div class="lookup-roster"><span>${icon('shield')}${p.troops?.length||0} troops</span><span>${icon('crown')}${p.heroes?.length||0} heroes</span><span>${icon('wand')}${p.spells?.length||0} spells</span></div><p class="lookup-next">Recent battles and rankings will load with your village.</p></div>`;
}

function resetLookup(){clearTimeout(liveLookupTimer);liveLookupAbort?.abort();liveLookupSequence++;livePreview=null;}
openPlayer=function(){
  resetLookup();
  modal(`<div class="modal-content">${modalHeader('Your player tag. Your whole village.','We’ll detect your name, level, Town Hall, troops, and heroes automatically.')}<form id="live-player-form"><div class="form-field"><label for="live-player-tag">Player tag</label><div class="live-tag-input">${icon('search')}<input id="live-player-tag" name="tag" placeholder="#2ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="16" required value="${esc(state.player.tag)}"></div><small>Find it beneath your name in your Clash of Clans profile.</small></div><div id="lookup-result" aria-live="polite"><div class="lookup-placeholder">${icon('castle')}<p>Enter your tag and your village will appear here.</p></div></div><p id="lookup-error" class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button button-ghost" data-close>Cancel</button><button type="submit" class="button button-lime" id="open-village">Find my village ${icon('arrow-right')}</button></div></form><div class="import-line">Have an exported profile? <button data-action="import-profile">Import JSON</button> · <button data-action="restore">Restore journal</button></div><p class="lookup-privacy">${icon('shield')}Public game data only. Your Supercell login is never requested.</p></div>`);
  const input=$('#live-player-tag');
  input.addEventListener('input',()=>{resetLookup();$('#lookup-error').textContent='';$('#open-village').innerHTML='Find my village '+icon('arrow-right');if(validTag(input.value)){const tag='#'+normalizedTag(input.value);liveLookupTimer=setTimeout(()=>lookupLivePreview(tag).catch(()=>{}),650);}else $('#lookup-result').innerHTML='<div class="lookup-placeholder">'+icon('castle')+'<p>Enter your tag and your village will appear here.</p></div>';});
  $('#live-player-form').addEventListener('submit',async event=>{event.preventDefault();if(!validTag(input.value)){$('#lookup-error').textContent='Enter a valid player tag copied from your in-game profile.';return;}const tag='#'+normalizedTag(input.value);let preview=livePreview?.tag===tag?livePreview:null;if(!preview)preview=await lookupLivePreview(tag);if(preview)confirmLivePlayer(preview);});
  modalCleanup=resetLookup;
  input.focus();
  if(hasPlayer())lookupLivePreview(state.player.tag).catch(()=>{});
};
actions.player=openPlayer;

async function lookupLivePreview(tag){
  if(livePreview?.tag===tag)return livePreview;
  clearTimeout(liveLookupTimer);liveLookupAbort?.abort();
  const sequence=++liveLookupSequence,controller=new AbortController();liveLookupAbort=controller;
  const result=$('#lookup-result'),error=$('#lookup-error'),button=$('#open-village');if(!result)return null;
  result.innerHTML='<div class="lookup-loading"><span class="lookup-spinner"></span><strong>Finding your village…</strong><small>Loading your public game profile.</small></div>';error.textContent='';button.disabled=true;
  try{
    const raw=await siteJSON('/api/players/'+encodeURIComponent(tag),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(16000)])});
    if(sequence!==liveLookupSequence||!$('#live-player-form'))return null;
    const player=cleanPlayer(raw);livePreview=player;result.innerHTML=playerPreviewHTML(player);button.disabled=false;button.innerHTML='Open my village '+icon('arrow-right');return player;
  }catch(e){
    if(sequence!==liveLookupSequence||e.name==='AbortError')return null;
    result.innerHTML='<div class="lookup-placeholder">'+icon('info')+'<p>We couldn’t load this village yet.</p></div>';
    error.textContent=e.message;button.disabled=false;button.innerHTML='Try again '+icon('arrow-right');return null;
  }
}

function confirmLivePlayer(player){
  if(hasPlayer()&&state.player.tag!==player.tag){
    modal(`<div class="modal-content">${modalHeader(`Open ${esc(player.name)}’s village?`,'This will switch the village shown in this browser. Export your current journal first if you want to keep a backup.')}<div class="lookup-profile">${playerPreviewHTML(player)}</div><div class="form-actions"><button class="button button-outline" data-action="export">Export current journal</button><button class="button button-lime" id="switch-live-player">Open village</button></div></div>`);
    $('#switch-live-player').addEventListener('click',()=>activateLivePlayer(player,true));
  }else activateLivePlayer(player,!hasPlayer());
}

async function activateLivePlayer(player,fresh=false){
  liveSyncSequence++;liveSyncing=false;
  const previous=state;
  state={...state,demo:false,source:'live',player,updatedAt:new Date().toISOString(),...(fresh?{battles:[],replays:hasPlayer()?[]:state.replays,snapshots:[],live:{}}:{}),live:{...(fresh?{}:state.live),profileUpdatedAt:new Date().toISOString()}};
  addProfileSnapshot();if(!saveState()){state=previous;return;}
  closeModal();battleFilter='all';battleQuery='';battlePage=0;lastActivityError='';navigate('village');render();toast('Village detected. Loading recent battles and rankings…');
  await syncActivity(player.tag);
}

function addProfileSnapshot(){
  const last=state.snapshots.at(-1);
  if(!last||last.trophies!==state.player.trophies||Date.now()-new Date(last.date).getTime()>300000){state.snapshots.push({date:new Date().toISOString(),trophies:state.player.trophies});state.snapshots=state.snapshots.slice(-2000);}
}

async function syncActivity(tag,sequence=++liveSyncSequence){
  if(state.player.tag!==tag||state.source!=='live')return;
  liveSyncing=true;render();
  try{
    const query=new URLSearchParams();
    if(state.player.currentLeagueGroupTag&&state.player.currentLeagueSeasonId){query.set('group',state.player.currentLeagueGroupTag);query.set('season',state.player.currentLeagueSeasonId);query.set('mode',/^Legend(?: League)?(?: I| 1)?$/i.test(state.player.leagueTier?.name||state.player.league?.name||'')?'legend':'ranked');}
    const activity=await siteJSON('/api/players/'+encodeURIComponent(tag)+'/activity'+(query.size?'?'+query:''));
    if(sequence!==liveSyncSequence||state.player.tag!==tag||state.source!=='live')return;
    const records=new Map(state.battles.map(b=>[b.id,b]));
    for(const battle of activity.battles||[])records.set(battle.id,{...records.get(battle.id),...battle});
    state.battles=[...records.values()].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,2000);
    state.live={...state.live,activity};lastActivityError='';saveState();
  }catch(error){if(sequence===liveSyncSequence&&state.player.tag===tag&&state.source==='live')lastActivityError=error.message;}
  finally{if(sequence===liveSyncSequence){liveSyncing=false;render();}}
}

async function refreshLivePlayer(){
  if(!hasPlayer()||state.source!=='live'){openPlayer();return;}
  if(liveSyncing)return;
  const tag=state.player.tag,sequence=++liveSyncSequence;liveSyncing=true;lastActivityError='';render();
  try{
    const raw=await siteJSON('/api/players/'+encodeURIComponent(tag));
    if(sequence!==liveSyncSequence||state.player.tag!==tag||state.source!=='live'){if(sequence===liveSyncSequence){liveSyncing=false;render();}return;}
    state.player=cleanPlayer(raw);state.updatedAt=new Date().toISOString();state.live={...state.live,profileUpdatedAt:state.updatedAt};addProfileSnapshot();saveState();
  }catch(error){if(sequence===liveSyncSequence){lastActivityError=error.message;liveSyncing=false;render();}return;}
  await syncActivity(tag,sequence);
}

document.addEventListener('click',event=>{if(event.target.closest('[data-live-refresh]'))refreshLivePlayer();});
readBackup=function(parsed){
  if(parsed.source!=='live')return oldReadBackup(parsed);
  if(parsed.version!==1||!Array.isArray(parsed.battles)||!Array.isArray(parsed.snapshots))throw new Error('Choose a MARINE X DURUGISTA JSON backup.');
  const player=cleanPlayer(parsed.player);
  const inRange=(value,min,max)=>value===null||isKnown(value)&&value>=min&&value<=max;
  const battles=parsed.battles.filter(b=>!RaidroomRecords.isSampleBattle(b)).slice(0,2000).map(b=>{
    if(!b||typeof b.opponent!=='string'||!TYPES.includes(b.type)||!inRange(b.stars,0,3)||!inRange(b.destruction,0,100)||!inRange(b.gold,0,1e8)||!inRange(b.elixir,0,1e8)||!inRange(b.dark,0,1e7)||!inRange(b.trophyChange,-1000,1000)||!inRange(b.townHall,1,100)||!Number.isFinite(new Date(b.date).getTime()))throw new Error('This backup contains an invalid battle record.');
    return{id:typeof b.id==='string'?b.id.slice(0,300):uid(),opponent:b.opponent.slice(0,80),opponentKnown:b.opponentKnown!==false,opponentTag:typeof b.opponentTag==='string'?b.opponentTag.slice(0,20):null,type:b.type,mode:['ranked','legend','farming','war','cwl','friendly','other'].includes(b.mode)?b.mode:'other',townHall:b.townHall,stars:b.stars,destruction:b.destruction,gold:b.gold,elixir:b.elixir,dark:b.dark,trophyChange:b.trophyChange,duration:isKnown(b.duration)?b.duration:null,date:new Date(b.date).toISOString(),source:['official','clashking'].includes(b.source)?b.source:undefined,notes:String(b.notes||'').slice(0,1000),demo:false};
  });
  const snapshots=parsed.snapshots.slice(0,2000).filter(s=>Number.isFinite(new Date(s.date).getTime())&&isKnown(s.trophies)).map(s=>({date:new Date(s.date).toISOString(),trophies:s.trophies}));
  const replays=Array.isArray(parsed.replays)?parsed.replays.filter(r=>r&&typeof r.title==='string'&&/^[A-Za-z0-9_-]{11}$/.test(r.youtube||'')).slice(0,500).map(r=>({id:uid(),title:r.title.slice(0,80),youtube:r.youtube,local:false,date:Number.isFinite(new Date(r.date).getTime())?new Date(r.date).toISOString():new Date().toISOString()})):[];
  return{version:1,demo:false,source:'live',player,battles,snapshots,replays,updatedAt:new Date().toISOString(),live:{profileUpdatedAt:parsed.updatedAt||new Date().toISOString()}};
};
const rankedLink=document.createElement('a');rankedLink.className='nav-link';rankedLink.href='#ranked';rankedLink.dataset.view='ranked';rankedLink.innerHTML=icon('trophy')+'Ranked battles';$('.main-nav').insertBefore(rankedLink,$('.main-nav [data-view="village"]'));

if(location.hash==='#ranked')view='ranked';
render();
siteJSON('/api/status').then(status=>{apiConnected=!!status.connected;if(apiConnected&&window.RaidroomAccess?.admin&&state.source==='live')refreshLivePlayer();}).catch(()=>{});
setInterval(()=>{if(window.RaidroomAccess?.admin&&document.visibilityState==='visible'&&state.source==='live'&&!liveSyncing&&!$('#modal').open)refreshLivePlayer();},300000);
