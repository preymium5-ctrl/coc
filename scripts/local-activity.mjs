import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomSecret} from '../lib/admin-auth.mjs';

export async function startLocalActivityCollector(root,baseUrl){
  const envPath=path.join(root,'.env');
  let source=await fs.readFile(envPath,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
  if(!/^RAIDROOM_ACTIVITY_SYNC_KEY=/m.test(source)){
    source=source.trimEnd()+`\nRAIDROOM_ACTIVITY_SYNC_KEY=${randomSecret()}\n`;
    await fs.writeFile(envPath,source,{mode:0o600});
  }
  const child=spawn(process.execPath,['--env-file='+envPath,path.join(root,'scripts/activity-collector.mjs'),'--parent='+process.pid,'--base='+baseUrl],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore','inherit','inherit']});
  const stop=()=>{if(!child.killed)child.kill();};
  process.once('exit',stop);process.once('SIGINT',stop);process.once('SIGTERM',stop);
  child.on('error',()=>process.stderr.write('Activity collector could not start. Restart the local server to retry.\n'));
  return child;
}
