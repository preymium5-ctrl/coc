import {authorizeClan} from '../../../../../lib/site-access';
import {apiResponse,errorResponse} from '../../../../../lib/coc-service.mjs';
import {getCapitalRaids} from '../../../../../lib/clan-service';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{tag:string}>}){try{return apiResponse(await getCapitalRaids(await authorizeClan(request,(await params).tag)));}catch(error){return errorResponse(error);}}
