import {apiResponse,errorResponse} from '../../../../../lib/coc-service.mjs';
import {syncClanMembers} from '../../../../../lib/clan-service';
import {requireAdmin} from '../../../../../lib/site-access';
import {smallJSON} from '../../../../../lib/request-json';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{tag:string}>}){
  try{await requireAdmin(request);const data=await smallJSON(request);return apiResponse(await syncClanMembers((await params).tag,data.memberTags,data.timeZone||'Asia/Singapore'));}
  catch(error){return errorResponse(error);}
}
