import fs from 'node:fs/promises';
import path from 'node:path';
import {hashSecret,randomSecret} from '../lib/admin-auth.mjs';
const root=path.resolve(import.meta.dirname,'..'),envPath=path.join(root,'.env');
const existing=await fs.readFile(envPath,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
if(/^RAIDROOM_LOCAL_ADMIN_HASH=/m.test(existing)){
  console.log('Local administrator is already configured. Your existing access note remains in .openai/local/admin-access.txt.');
  process.exit(0);
}
const secret=randomSecret(),hash=await hashSecret(secret);
await fs.mkdir(path.join(root,'.openai/local'),{recursive:true});
await fs.writeFile(path.join(root,'.openai/local/admin-access.txt'),`Raidroom local administrator\n\nAdmin: http://127.0.0.1:5173/admin\nPublic view: http://127.0.0.1:5173/\n\nPassword: ${secret}\n\nKeep this local access note private. The server stores only a verifier.\nThe browser session expires after 8 hours; sign in again with this password.\nThis credential works only on localhost and is not deployed to Sites.\n`,{mode:0o600});
await fs.writeFile(envPath,existing.trimEnd()+`\nRAIDROOM_LOCAL_ADMIN=1\nRAIDROOM_LOCAL_ADMIN_HASH=${hash}\n`,{mode:0o600});
console.log('Local administrator configured. Private access note: .openai/local/admin-access.txt. Restart the local server if needed.');
