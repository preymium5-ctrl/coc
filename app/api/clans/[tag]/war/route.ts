import {authorizeClan} from '../../../../../lib/site-access';
import {apiResponse,errorResponse} from '../../../../../lib/coc-service.mjs';
import {getCurrentClanWar} from '../../../../../lib/clan-service';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{tag:string}>}){try{const tag=await authorizeClan(request,(await params).tag);return apiResponse(await getCurrentClanWar(tag));}catch(error){return errorResponse(error);}}
