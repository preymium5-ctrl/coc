import {ApiError} from './coc-service.mjs';
export function requireSameOrigin(request:Request){
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'invalid_origin','Use this site to submit changes.');
}
export async function smallJSON(request:Request){
  requireSameOrigin(request);
  if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(415,'invalid_content_type','Send a JSON request.');
  if(Number(request.headers.get('content-length')||0)>2048||!request.body)throw new ApiError(413,'request_too_large','This request is too large.');
  const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new ApiError(413,'request_too_large','This request is too large.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
  try{const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}
  catch{throw new ApiError(400,'invalid_json','Could not read this request.');}
}
