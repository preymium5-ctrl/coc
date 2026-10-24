import {apiResponse,errorResponse} from '../../../lib/coc-service.mjs';
import {requireAdmin} from '../../../lib/site-access';
import {requireSameOrigin} from '../../../lib/request-json';
import {requestActivitySync} from '../../../lib/activity-sync';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{await requireAdmin(request);requireSameOrigin(request);return apiResponse({activitySync:await requestActivitySync(new URL(request.url).searchParams.get('clan'))});}catch(error){return errorResponse(error);}}
