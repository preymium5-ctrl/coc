import {authorizeClan,requireAdmin} from '../../../../../lib/site-access';
import {apiResponse,errorResponse} from '../../../../../lib/coc-service.mjs';
import {getClanGames,setClanGamesPoints} from '../../../../../lib/clan-service';
import {smallJSON,requireSameOrigin} from '../../../../../lib/request-json';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:Promise<{tag:string}>}){try{return apiResponse(await getClanGames(await authorizeClan(request,(await params).tag)));}catch(error){return errorResponse(error);}}
export async function POST(request:Request,{params}:{params:Promise<{tag:string}>}){try{await requireAdmin(request);requireSameOrigin(request);const data=await smallJSON(request);return apiResponse(await setClanGamesPoints((await params).tag,data.tag,data.points));}catch(error){return errorResponse(error);}}
