import {apiResponse,errorResponse,ApiError} from '../../../../lib/coc-service.mjs';
import {scheduledAccess,runScheduledSync} from '../../../../lib/scheduled-sync.mjs';
import {beginActivitySync,collectActivityBatch} from '../../../../lib/activity-sync';
import {publishedClans} from '../../../../lib/published-clan';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
  try{
    if(!await scheduledAccess(request,process.env))throw new ApiError(401,'scheduler_required','A valid scheduler credential is required.');
    const clans=await publishedClans();
    const activitySync=await Promise.all(clans.map(async clan=>({clanTag:clan.tag,...await runScheduledSync(()=>beginActivitySync(clan.tag),collectActivityBatch)})));
    return apiResponse({activitySync});
  }catch(error){return errorResponse(error);}
}
