import {apiResponse,errorResponse} from '../../../../lib/coc-service.mjs';
import {requireAdmin,savePublishedClan,unpublishClan} from '../../../../lib/site-access';
import {smallJSON,requireSameOrigin} from '../../../../lib/request-json';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{await requireAdmin(request);return apiResponse(await savePublishedClan(request,await smallJSON(request)));}catch(error){return errorResponse(error);}}
export async function DELETE(request:Request){try{requireSameOrigin(request);return apiResponse(await unpublishClan(request));}catch(error){return errorResponse(error);}}
