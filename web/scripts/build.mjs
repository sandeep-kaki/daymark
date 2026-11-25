import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
await mkdir('vendor',{recursive:true});
await build({entryPoints:['cloud/firebase-entry.js'],outfile:'vendor/firebase.js',bundle:true,format:'esm',minify:true,legalComments:'inline',target:'es2022'});
const files=['index.html','styles.css','icon.svg','appearance.css','src/appearance.js','src/pip.js','src/plan-calendar.js','fonts/dm-sans.ttf','fonts/OFL.txt','manifest.webmanifest','src/app.js','src/cloud.js','src/domain.js','src/store.js','src/views.js','src/ui.js','src/sync-model.js','vendor/firebase.js'];
const output=new URL('../dist/',import.meta.url);
await mkdir(output,{recursive:true});
for(const f of files){const dest=new URL(f,output);await mkdir(new URL('./',dest),{recursive:true});await cp(f,dest);}
const config=JSON.parse(process.env.DAYMARK_FIREBASE_CONFIG||await readFile('firebase-config.json','utf8'));
if(process.env.REQUIRE_CLOUD==='1'||Object.keys(config).length){
  for(const key of ['apiKey','authDomain','projectId','appId'])if(typeof config[key]!=='string'||!config[key].trim())throw Error('Missing public Firebase setting: '+key);
  for(const key of Object.keys(config))if(!['apiKey','authDomain','projectId','appId','messagingSenderId','storageBucket','measurementId','databaseURL'].includes(key))throw Error('Only public Firebase web configuration is accepted.');
}
await writeFile(new URL('firebase-config.json',output),JSON.stringify(config));
const hash=createHash('sha256').update(JSON.stringify(config));
for(const f of [...files,'sw.js'])hash.update(await readFile(f));
await writeFile(new URL('sw.js',output),(await readFile('sw.js','utf8')).replace("'v2.0.0'",JSON.stringify(hash.digest('hex').slice(0,20))));
console.log('Built static site in web/dist ('+(config.projectId?'Google sync enabled':'local-only')+').');
