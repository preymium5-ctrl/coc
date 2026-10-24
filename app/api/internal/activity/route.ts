import {apiResponse,errorResponse,ApiError} from '../../../../lib/coc-service.mjs';
import {requireCollector,beginActivitySync,collectActivityBatch} from '../../../../lib/activity-sync';
import {smallJSON} from '../../../../lib/request-json';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  try{await requireCollector(request);const data=await smallJSON(request);if(data.action==='begin')return apiResponse(await beginActivitySync());if(data.action==='batch')return apiResponse(await collectActivityBatch(data));throw new ApiError(400,'invalid_sync_action','Choose a valid collector action.');}
  catch(error){return errorResponse(error);}
}
