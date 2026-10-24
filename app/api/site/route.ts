import {apiResponse,errorResponse} from '../../../lib/coc-service.mjs';
import {siteState} from '../../../lib/site-access';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return apiResponse(await siteState(request));}catch(error){return errorResponse(error);}}
