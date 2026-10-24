import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startLocalActivityCollector} from './local-activity.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
await startLocalActivityCollector(root,'http://127.0.0.1:5173');
const server=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--env-file','.env','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','5173','--inspector-port','0'],{cwd:root,stdio:'inherit',windowsHide:true});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.kill());
server.once('exit',code=>process.exit(code??1));
