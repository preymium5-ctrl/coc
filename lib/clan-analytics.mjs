import catalog from '../public/game-catalog.json' with {type:'json'};

export function hallMaximum(unit,kind,townHall,builderHall){
  const village=unit.village||'home';
  const entry=catalog.items.find(item=>item.kind===kind&&item.name===unit.name&&(item.village===village||kind==='pets'));
  const hall=village==='builderBase'?builderHall:townHall;
  return entry?.maxByHall?.[hall]??null;
}

export function decorateProfile(profile){
  const withCaps=(units,kind)=>(units||[]).map(unit=>({...unit,category:kind,townHallMaxLevel:hallMaximum(unit,kind,profile.townHallLevel,profile.builderHallLevel)}));
  const pets=new Set(catalog.items.filter(item=>item.kind==='pets').map(item=>item.name));
  return {...profile,heroes:withCaps(profile.heroes,'heroes'),spells:withCaps(profile.spells,'spells'),troops:(profile.troops||[]).map(unit=>{
    const kind=pets.has(unit.name)?'pets':'troops';return {...unit,category:kind,townHallMaxLevel:hallMaximum(unit,kind,profile.townHallLevel,profile.builderHallLevel)};
  }),catalogUpdatedAt:catalog.updatedAt};
}

function localParts(date,timeZone){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
  return p;
}
function civilMidnight(date,timeZone){
  let guess=date.getTime();
  for(let i=0;i<3;i++){
    const p=localParts(new Date(guess),timeZone);
    const shown=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    guess=date.getTime()-(shown-guess);
  }
  return guess;
}
export function periodBounds(period='day',timeZone='Asia/Singapore',now=new Date()){
  if(!['day','week','month'].includes(period))throw new Error('Choose day, week, or month.');
  try{new Intl.DateTimeFormat('en',{timeZone}).format(now);}catch{throw new Error('Choose a valid time zone.');}
  const p=localParts(now,timeZone),civil=new Date(Date.UTC(p.year,p.month-1,p.day));
  if(period==='week')civil.setUTCDate(civil.getUTCDate()-(civil.getUTCDay()+6)%7);
  if(period==='month')civil.setUTCDate(1);
  return {period,timeZone,start:new Date(civilMidnight(civil,timeZone)).toISOString(),end:now.toISOString(),label:{day:'Today',week:'This week',month:'This month'}[period]};
}
export function collectionStart(timeZone='Asia/Singapore',now=new Date()){
  return new Date(Math.min(new Date(periodBounds('month',timeZone,now).start),new Date(periodBounds('week',timeZone,now).start))).toISOString();
}
export function summarizeBattles(battles,bounds){
  const start=new Date(bounds.start).getTime(),end=new Date(bounds.end).getTime();
  const attacks=battles.filter(b=>b.type!=='Defense'&&new Date(b.date).getTime()>=start&&new Date(b.date).getTime()<=end);
  const known=attacks.filter(b=>Number.isFinite(b.gold)&&Number.isFinite(b.elixir));
  const dark=attacks.filter(b=>Number.isFinite(b.dark));
  return {attacks:attacks.length,loot:known.length?known.reduce((n,b)=>n+b.gold+b.elixir,0):attacks.length?null:0,gold:known.reduce((n,b)=>n+b.gold,0),elixir:known.reduce((n,b)=>n+b.elixir,0),dark:dark.length?dark.reduce((n,b)=>n+b.dark,0):attacks.length?null:0,lootReported:known.length};
}
export function parseArmy(code){
  if(typeof code!=='string'||code.length>8192)return [];
  let text=code;
  if(text.startsWith('https://')){try{const u=new URL(text);if(u.hostname!=='link.clashofclans.com')return [];text=u.searchParams.get('army')||'';}catch{return [];}}
  const section=text.match(/u([0-9x-]+)(?=[hids]|$)/)?.[1];if(!section)return [];
  const quantities=new Map();
  for(const part of section.split('-')){const match=part.match(/^(\d+)x(\d+)$/);if(!match)continue;const quantity=Number(match[1]),id=Number(match[2]);if(quantity<1||quantity>65535)continue;
    const unit=catalog.items.find(item=>item.kind==='troops'&&item.village==='home'&&item.armyId===id);if(unit)quantities.set(unit.name,(quantities.get(unit.name)||0)+quantity);
  }
  return [...quantities].map(([name,quantity])=>({name,quantity}));
}
export function troopUsage(battles,kind){
  const candidates=battles.filter(b=>b.type!=='Defense'&&(kind==='war'?['war','cwl'].includes(b.mode):['farming','ranked','legend'].includes(b.mode)));
  let armies=0;const totals=new Map();
  for(const battle of candidates){const army=parseArmy(battle.armyShareCode);if(!army.length)continue;armies++;for(const unit of army){const value=totals.get(unit.name)||{name:unit.name,armies:0,quantity:0};value.armies++;value.quantity+=unit.quantity;totals.set(unit.name,value);}}
  return {recordedAttacks:candidates.length,armies,units:[...totals.values()].sort((a,b)=>b.armies-a.armies||b.quantity-a.quantity||a.name.localeCompare(b.name)).slice(0,8).map(unit=>({...unit,percent:Math.round(unit.armies/armies*100)}))};
}
export function cwlAverages(payload){
  const items=Array.isArray(payload?.items)?payload.items:[];
  return items.slice(0,12).map(season=>{
    const attacks=(season.attacks||[]).filter(a=>Number.isInteger(a.stars)&&a.stars>=0&&a.stars<=3);
    const totalStars=attacks.reduce((sum,a)=>sum+a.stars,0);
    return {season:season.season,clan:season.clan?.name||'',clanTag:season.clan?.tag||null,attacks:attacks.length,totalStars,averageStars:attacks.length?totalStars/attacks.length:null,missedAttacks:Number.isFinite(season.missedAttacks)?season.missedAttacks:null,threeStars:attacks.filter(a=>a.stars===3).length};
  }).sort((a,b)=>String(b.season).localeCompare(String(a.season)));
}
export function orientWar(war,tag){
  if(!war||war.state==='notInWar')return war||null;
  if(war.clan?.tag===tag)return war;
  if(war.opponent?.tag===tag)return {...war,clan:war.opponent,opponent:war.clan};
  return null;
}
