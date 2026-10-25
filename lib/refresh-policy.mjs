export const REFRESH_SECONDS=3600;
export const REFRESH_MS=REFRESH_SECONDS*1000;

export const nextRefreshAt=(now=Date.now(),interval=REFRESH_MS)=>(Math.floor(now/interval)+1)*interval;
export function currentRefresh(timestamp,now=Date.now()){
  return Number.isFinite(timestamp)&&timestamp<=now&&Math.floor(timestamp/REFRESH_MS)===Math.floor(now/REFRESH_MS);
}
export function syncInterval(value){
  const seconds=Number(value);
  return Number.isInteger(seconds)&&seconds>=REFRESH_SECONDS&&seconds<=86400?seconds*1000:REFRESH_MS;
}
