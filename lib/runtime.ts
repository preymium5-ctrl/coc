import {createClient} from '@libsql/client/web';
import {libsqlStorage} from './libsql-storage.mjs';
import {ApiError} from './coc-service.mjs';

let storage:D1Database|undefined;
export const env={get DB():D1Database{
  if(storage)return storage;
  const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
  if(!url||!authToken)throw new ApiError(503,'storage_unavailable','The site owner needs to configure the hosted database.');
  if(!/^(libsql|https):\/\//.test(url))throw new ApiError(503,'storage_unavailable','Hosted storage must use a remote libSQL database.');
  storage=libsqlStorage(createClient({url,authToken,intMode:'number'})) as unknown as D1Database;
  return storage;
}};
