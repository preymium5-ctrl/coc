import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const source='https://raw.githubusercontent.com/ClashKingInc/ClashKingAssets/main/assets/static_data/';
const items=[];
for(const kind of ['heroes','troops','pets','spells']){
  const response=await fetch(source+kind+'.json',{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Could not load game catalogue '+kind);
  const data=await response.json();
  for(const unit of data.items){
    const maxByHall={};
    for(let hall=1;hall<=18;hall++){
      const levels=unit.levels.filter(level=>Number.isFinite(level.required_townhall)&&level.required_townhall<=hall).map(level=>level.level);
      if(levels.length)maxByHall[hall]=Math.max(...levels);
    }
    items.push({id:unit._id,armyId:unit._id%1000000,name:unit.name,kind,village:unit.village||'home',maxByHall});
    if(kind==='pets'){
      const slug=unit.name.toLowerCase().replace(/[^a-z0-9 ]/g,'').replaceAll(' ','_');
      const asset=await fetch('https://assets.clashk.ing/pets/'+slug+'/icon.webp',{signal:AbortSignal.timeout(15000)});
      if(!asset.ok)throw new Error('Missing pet asset '+unit.name);
      const directory=path.join(root,'public/assets/game/pets',slug);
      await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'icon.webp'),Buffer.from(await asset.arrayBuffer()));
    }
  }
}
await fs.writeFile(path.join(root,'public/game-catalog.json'),JSON.stringify({source,updatedAt:new Date().toISOString(),items}));
console.log('Game catalogue and '+items.filter(x=>x.kind==='pets').length+' authentic pet icons updated.');
