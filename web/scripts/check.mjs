import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js'));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', new URL('../src/' + file, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], {encoding:'utf8'});
  if (result.status !== 0) { console.error(result.error || result.stderr); process.exit(1); }
}
JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const base=new URL('../',import.meta.url);
const refs=async(file,pattern)=>{const source=await readFile(new URL(file,base),'utf8');for(const m of source.matchAll(pattern))await readFile(new URL(m[1],new URL(file,base)));};
await refs('index.html',/(?:href|src)="(\.\/[^"]+)"/g);
for(const file of files)await refs('src/'+file,/from ['"](\.\/[^'"]+)['"]/g);
await readFile(new URL('sw.js',base));
console.log(`Checked ${files.length} modules, imports, entry assets and manifest.`);
