// Keep real saved profiles usable during a transient provider outage.
export async function profileSnapshot(tag,load,previous,now=new Date()){
  try{return {...await load(),profileFreshness:{stale:false,fetchedAt:now.toISOString()}};}
  catch(error){
    if(![429,500,502,503,504,520,521,522,523,524,525,526].includes(error?.status)||['setup_required','invalid_configuration'].includes(error?.code))throw error;
    const saved=await previous();
    if(saved?.tag!==tag||typeof saved.name!=='string'||!Number.isInteger(saved.townHallLevel))throw error;
    return {...saved,profileFreshness:{stale:true,fetchedAt:saved.profileFreshness?.fetchedAt||null}};
  }
}
