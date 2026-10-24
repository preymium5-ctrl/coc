import fs from 'node:fs/promises';
import {hashSecret,randomSecret} from '../lib/admin-auth.mjs';
const note=new URL('../.openai/local/vercel-access.txt',import.meta.url);
await fs.mkdir(new URL('.',note),{recursive:true});
const password=randomSecret(),cronSecret=randomSecret();
try{
  await fs.writeFile(note,`Raidroom Vercel administrator\n\nPassword for /admin: ${password}\n\nAdd these server-only environment variables in Vercel:\nRAIDROOM_ADMIN_PASSWORD_HASH=${await hashSecret(password)}\nCRON_SECRET=${cronSecret}\n\nKeep this note private. Do not commit it or paste it into chat.\n`,{mode:0o600,flag:'wx'});
  console.log('Vercel credentials generated. Open the private note at .openai/local/vercel-access.txt.');
}catch(error){if(error.code!=='EEXIST')throw error;console.log('Vercel credentials already exist in .openai/local/vercel-access.txt; keeping them.');}
