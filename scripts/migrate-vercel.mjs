import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createClient} from '@libsql/client/web';

export async function migrate(client,directory=new URL('../drizzle/',import.meta.url)){
  await client.execute('CREATE TABLE IF NOT EXISTS raidroom_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const files=(await fs.readdir(directory)).filter(name=>/^\d+_.*\.sql$/.test(name)).sort();
  for(const name of files){
    const source=await fs.readFile(new URL(name,directory),'utf8');
    const checksum=createHash('sha256').update(source.replaceAll('\r\n','\n')).digest('hex');
    const applied=await client.execute({sql:'SELECT checksum FROM raidroom_migrations WHERE name=?',args:[name]});
    if(applied.rows.length){if(applied.rows[0].checksum!==checksum)throw new Error('An applied migration changed: '+name);continue;}
    const statements=source.split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean).map(sql=>({sql,args:[]}));
    statements.push({sql:'INSERT INTO raidroom_migrations (name,checksum,applied_at) VALUES (?,?,?)',args:[name,checksum,Date.now()]});
    try{await client.batch(statements,'write');}
    catch(error){
      // Another deployment may have applied the same migration atomically.
      const raced=await client.execute({sql:'SELECT checksum FROM raidroom_migrations WHERE name=?',args:[name]});
      if(raced.rows[0]?.checksum!==checksum)throw error;
    }
  }
  return files.length;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const url=process.env.TURSO_DATABASE_URL,authToken=process.env.TURSO_AUTH_TOKEN;
  if(!url&&!authToken&&process.argv.includes('--if-configured'))console.log('Hosted database not configured; skipping migrations. Add Vercel environment variables before deploying the live dashboard.');
  else{
    if(!url||!authToken||!/^(libsql|https):\/\//.test(url))throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for a remote libSQL database.');
    const client=createClient({url,authToken});
    try{await migrate(client);console.log('Hosted database migrations are up to date.');}
    catch{console.error('Hosted database migration failed. Check database credentials and migration status. No credentials were logged.');process.exitCode=1;}
    finally{client.close();}
  }
}
