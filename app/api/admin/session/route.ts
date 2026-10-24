import {apiResponse,errorResponse} from '../../../../lib/coc-service.mjs';
import {localSignIn,localSignOut} from '../../../../lib/site-access';
import {smallJSON,requireSameOrigin} from '../../../../lib/request-json';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const input=await smallJSON(request);const cookie=await localSignIn(request,input.password);const response=apiResponse({ok:true});response.headers.set('Set-Cookie',cookie);return response;}catch(error){return errorResponse(error);}}
export async function DELETE(request:Request){try{requireSameOrigin(request);const cookie=await localSignOut(request);const response=apiResponse({ok:true});response.headers.set('Set-Cookie',cookie);return response;}catch(error){return errorResponse(error);}}
