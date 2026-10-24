import {apiResponse,errorResponse,ApiError} from '../../../../lib/coc-service.mjs';
import {scheduledAccess,runScheduledSync} from '../../../../lib/scheduled-sync.mjs';
import {beginActivitySync,collectActivityBatch} from '../../../../lib/activity-sync';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
  try{
    if(!await scheduledAccess(request,process.env))throw new ApiError(401,'scheduler_required','A valid scheduler credential is required.');
    return apiResponse({activitySync:await runScheduledSync(beginActivitySync,collectActivityBatch)});
  }catch(error){return errorResponse(error);}
}
