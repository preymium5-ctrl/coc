import {authorizeClan} from '../../../../lib/site-access';
import {apiResponse,errorResponse} from '../../../../lib/coc-service.mjs';
import {getClan} from '../../../../lib/clan-service';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{tag:string}>}){try{const tag=await authorizeClan(request,(await params).tag);return apiResponse(await getClan(tag));}catch(error){return errorResponse(error);}}
