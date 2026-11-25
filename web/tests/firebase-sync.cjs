// Use only the demo-daymark-sync Auth and Firestore emulators.
const {chromium}=require(process.env.DAYMARK_PLAYWRIGHT||'playwright');
const {build}=require('esbuild');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const origin='http://127.0.0.1:4197';
const config={apiKey:'emulator-key',appId:'demo-app',projectId:'demo-daymark-sync',authDomain:'demo-daymark-sync.firebaseapp.com'};
const run=Date.now();
(async()=>{
 const bundle=await build({stdin:{contents:`
 export {initializeApp} from 'firebase/app';
 import * as auth from 'firebase/auth';
 import * as fs from 'firebase/firestore';
 export {GoogleAuthProvider,signOut,onAuthStateChanged} from 'firebase/auth';
 export {doc,onSnapshot,runTransaction} from 'firebase/firestore';
 export function getAuth(app){const a=auth.getAuth(app);auth.connectAuthEmulator(a,'http://127.0.0.1:9099',{disableWarnings:true});return a;}
 export function getFirestore(app){const db=fs.getFirestore(app);fs.connectFirestoreEmulator(db,'127.0.0.1',8787);return db;}
 export function signInWithPopup(a){if(window.cancelTestConsent)throw Error('Google sign-in cancelled');const sub=window.testIdentity;return auth.signInWithCredential(a,auth.GoogleAuthProvider.credential(JSON.stringify({sub,email:sub+'@example.test',email_verified:true})));}`,resolveDir:root},bundle:true,format:'esm',write:false});
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:4197},windowsHide:true});let browser;
 try{
 await once(server.stdout,'data');browser=await chromium.launch({executablePath:process.env.DAYMARK_CHROMIUM||undefined,headless:true,args:['--no-proxy-server']});
 async function device(user,seed=false){
  const c=await browser.newContext({serviceWorkers:'block'});await c.grantPermissions(['local-network-access'],{origin});await c.addInitScript(id=>window.testIdentity=id,user);
  await c.route('**/firebase-config.json',route=>route.fulfill({json:config}));
  await c.route('**/vendor/firebase.js',route=>route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text}));
  await c.route(origin+'/',async route=>{const res=await route.fetch();await route.fulfill({response:res,headers:{...res.headers(),'content-security-policy':"default-src 'self'; connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8787; style-src 'self' 'unsafe-inline'"}});});
  const p=await c.newPage();p.on('console', m=>{if(m.type()==='error') console.error('Emulator browser:',m.text().replace(/key=[^ '&]+/g,'key=demo').slice(0,900));});p.setDefaultTimeout(45000);p.on('requestfailed',r=>console.warn('Test request:',new URL(r.url()).origin,r.failure()?.errorText));await p.goto(origin);
  const press=name=>p.getByRole('button',{name,exact:true}).click();
  await press('Skip for now');
  if(seed){
   await capture(p,'Existing device task');
   await press('Account');await press('Continue with Google');
   await p.evaluate(()=>window.cancelTestConsent=true);await press('Sign in with Google');
   await p.getByRole('alert').filter({hasText:'Google sign-in cancelled'}).waitFor();
   await p.evaluate(()=>window.cancelTestConsent=false);await press('Close');
   await press('Account');await press('Continue with Google');
  }else{
   await press('Account');await press('Continue with Google');
  }
  if(seed)await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Sign in with Google'}).click();
  try { await p.locator('[data-cloud-status]').filter({hasText:'Synced with Google'}).waitFor(); }
  catch(error){console.error('Emulator status:',await p.locator('[data-cloud-status],dialog[open] [role=alert],.loading').allTextContents());throw error;}
  return p;
 }
 const a=await device('alice'+run,true), b=await device('alice'+run), outsider=await device('bob'+run);
 async function capture(p,title){await p.getByRole('button',{name:'Capture task'}).click();await p.getByLabel('Title',{exact:true}).fill(title);await p.locator('dialog button[type=submit]').click();await p.locator('#dialog').waitFor({state:'hidden'});}
 const has=(p,title)=>p.waitForFunction(async t=>(await import('./src/store.js')).snapshot().tasks.some(x=>x.title===t),title,{timeout:20000});
 await has(b,'Existing device task');await capture(a,'Synced task');await has(b,'Synced task');
 await a.goto(origin+'/#Journal');await a.getByRole('button',{name:'Write an entry'}).click();
 await a.getByLabel('Your entry').fill('A reflection from the first device');
 await a.getByRole('button',{name:'Save entry'}).click();
 await b.goto(origin+'/#Journal');
 await b.getByText('A reflection from the first device',{exact:true}).waitFor();
 await a.goto(origin+'/#Today');await b.goto(origin+'/#Today');
 await b.context().setOffline(true);await capture(b,'Offline edit');await capture(a,'Another device');await b.context().setOffline(false);await has(a,'Offline edit');await has(b,'Another device');
 assert.equal(await outsider.evaluate(async()=>(await import('./src/store.js')).snapshot().tasks.length),0);
 const [alice,bobToken]=await Promise.all([a.evaluate(()=>localStorage.getItem('daymark-sync-account')),outsider.evaluate(async()=>(await import('./src/cloud.js')).account().getIdToken())]);
 const url='http://127.0.0.1:8787/v1/projects/demo-daymark-sync/databases/(default)/documents/users/'+alice+'/daymark/workspace';
 for(const target of [url,url+'/parts/0']){
   assert.equal((await fetch(target,{headers:{Authorization:'Bearer '+bobToken}})).status,403);
   assert.equal((await fetch(target)).status,403);
   assert.equal((await fetch(target,{method:'DELETE',headers:{Authorization:'Bearer '+bobToken}})).status,403);
 }
 await a.getByRole('button',{name:'Account',exact:true}).click();await a.getByRole('button',{name:'Switch to device only'}).click();await a.getByRole('button',{name:'Sign out',exact:true}).click();await a.locator('[data-cloud-status]').filter({hasText:'Device only'}).waitFor();assert.deepEqual(await a.evaluate(async()=>(await import('./src/store.js')).snapshot().tasks.map(t=>t.title)),['Existing device task']);
 console.log('PASS: cross-device sync, offline reconciliation, account isolation, anonymous and other-account denials, and sign-out.');
 }finally{await browser?.close();server.kill();}
})().catch(err=>{console.error(err);process.exitCode=1;});
