import {authorizeClan} from '../../../../../lib/site-access';
import {apiResponse,errorResponse} from '../../../../../lib/coc-service.mjs';
import {getClanLeaderboard} from '../../../../../lib/clan-service';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{tag:string}>}){try{const tag=await authorizeClan(request,(await params).tag);const q=new URL(request.url).searchParams;return apiResponse(await getClanLeaderboard(tag,q.get('period')||'day',q.get('tz')||'Asia/Singapore'));}catch(error){return errorResponse(error);}}
