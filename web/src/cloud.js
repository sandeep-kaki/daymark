import {snapshot,subscribe,readCheckpoint,checkpoint,deviceWorkspace} from './store.js';
import {baseline,contents,equivalent,reconcile,SyncConflict,encodeParts,decodeParts} from './sync-model.js';

const modeKey='daymark-sync-account';
let config={},sdk,auth,db,active=null,copyOnFirstUse=false;
let timer,running=false,again=false,retry=2000,unsubscribe,removeStoreListener;
let status='Saved on this device', conflict=null,override=null;
const eventName='daymark-sync-status';
export const account=()=>active;
export const configured=()=>!!(config.apiKey&&config.authDomain&&config.projectId&&config.appId);
export const syncStatus=()=>status;
export const hasConflict=()=>!!conflict;
function setStatus(value){if(status!==value){status=value;window.dispatchEvent(new Event(eventName));}}
function schedule(delay=350){clearTimeout(timer);timer=setTimeout(sync,delay);}
async function loadSdk(){
  if(!sdk){
    sdk=await import('../vendor/firebase.js');
    const app=sdk.initializeApp(config);
    auth=sdk.getAuth(app);
    db=sdk.getFirestore(app);
  }
}
export async function initializeAccount(){
  const chosen=localStorage.getItem(modeKey);
  try{
    const response=await fetch(new URL('../firebase-config.json',import.meta.url));
    if(response.ok)config=await response.json();
  }catch{if(chosen)throw Error('Unable to load your account configuration. Reopen Daymark when connected.');}
  window.addEventListener('storage',event=>{if(event.key===modeKey)location.reload();});
  if(!chosen)return null;
  if(!configured())throw Error('Cloud configuration is missing. Reopen this installation with its original Firebase settings.');
  await loadSdk();
  await auth.authStateReady();
  if(chosen!==auth.currentUser?.uid){localStorage.removeItem(modeKey);return null;}
  active=auth.currentUser;
  copyOnFirstUse=sessionStorage.getItem('daymark-seed-account')===active.uid;
  sdk.onAuthStateChanged(auth,user=>{if(user?.uid!==active?.uid)location.reload();});
  return config.projectId+':'+active.uid;
}
export async function connect(copy){
  if(!configured())throw Error('Google sign-in is awaiting Firebase setup.');
  await loadSdk();
  const provider=new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  const result=await sdk.signInWithPopup(auth,provider);
  if(copy)sessionStorage.setItem('daymark-seed-account',result.user.uid);
  else sessionStorage.removeItem('daymark-seed-account');
  localStorage.setItem(modeKey,result.user.uid);
  location.reload();
  return 'workspace-switch';
}
export async function disconnect(){
  clearTimeout(timer);unsubscribe?.();removeStoreListener?.();
  await sdk.signOut(auth);
  localStorage.removeItem(modeKey);sessionStorage.removeItem('daymark-seed-account');
  location.reload();
  return 'workspace-switch';
}
const head=()=>sdk.doc(db,'users',active.uid,'daymark','workspace');
const piece=i=>sdk.doc(head(),'parts',String(i));
function header(snap){
  if(!snap.exists())return {generation:null,count:0};
  const h=snap.data();
  if(h.version!==1||typeof h.generation!=='string'||!Number.isInteger(h.count)||h.count<1||h.count>80)
    throw Error('Unrecognized cloud workspace format. Sync paused.');
  return h;
}
export function startSync(){
  if(!active)return;
  setStatus('Checking saved workspace…');
  removeStoreListener=subscribe(()=>{setStatus('Saved on device · syncing…');schedule();});
  unsubscribe=sdk.onSnapshot(head(),snap=>{if(!snap.metadata.fromCache)schedule();},()=>schedule());
  window.addEventListener('online',()=>schedule(0));
  window.addEventListener('offline',()=>setStatus('Offline · changes saved on this device'));
  window.addEventListener('focus',()=>schedule(0));schedule(0);
}
async function sync(){
  if(!active||auth.currentUser?.uid!==active.uid)return;
  if(running){again=true;return;}
  if(!navigator.onLine){setStatus('Offline · changes saved on this device');return;}
  running=true;
  try{
    const expected=await readCheckpoint();
    const base=expected.meta?.base||baseline();
    const seed=copyOnFirstUse&&!expected.meta?await deviceWorkspace():null;
    const result=await sdk.runTransaction(db,async tx=>{
      const h=header(await tx.get(head()));
      const remote=h.generation===expected.meta?.generation?base:h.count?
        decodeParts(await Promise.all(Array.from({length:h.count},async(_,i)=>{
          const snap=await tx.get(piece(i));
          if(!snap.exists()||snap.data().generation!==h.generation)throw Error('Cloud workspace is incomplete. Sync paused.');
          return snap.data().text;
        }))):baseline();
      let next;
      try{
        if(override&&override.revision===expected.local.revision&&override.generation===h.generation)
          next=contents(override.choice==='cloud'?remote:expected.local);
        else {
          const local=seed&&!h.count?reconcile(baseline(),seed,expected.local):expected.local;
          next=reconcile(base,local,remote);
        }
      }catch(err){
        if(err instanceof SyncConflict)conflict={revision:expected.local.revision,generation:h.generation};
        throw err;
      }
      if(h.count&&equivalent(remote,next))return {state:remote,generation:h.generation};
      const parts=encodeParts(next),generation=crypto.randomUUID();
      tx.set(head(),{version:1,generation,count:parts.length});
      parts.forEach((text,i)=>tx.set(piece(i),{generation,text}));
      for(let i=parts.length;i<h.count;i++)tx.delete(piece(i));
      return {state:next,generation};
    });
    const changed=!equivalent(expected.local,result.state);
    if(!await checkpoint(expected,result.state,result.generation,changed)){again=true;return;}
    copyOnFirstUse=false;sessionStorage.removeItem('daymark-seed-account');
    conflict=null;override=null;retry=2000;setStatus('Synced with Google');
  }catch(err){
    if(err instanceof SyncConflict){setStatus('Sync paused · review conflicting changes in Settings');}
    else if(err.code==='permission-denied'){setStatus('Sync paused · Firebase access was denied');}
    else if(!err.code && err.message?.includes('workspace')){setStatus(err.message);}
    else{setStatus('Saved on device · waiting to sync');schedule(retry);retry=Math.min(60000,retry*2);}
  }finally{running=false;if(again){again=false;schedule();}}
}
export function resolveConflict(choice){
  if(!conflict||snapshot().revision!==conflict.revision){schedule(0);throw Error('The workspace changed. Review the latest sync status.');}
  override={...conflict,choice};schedule(0);
}
