import {emptyState, applyCommand, validateState, elapsedMs} from './domain.js';
const DB_NAME='daymark-web', STORE='workspace';
let database, current, channel;
let workspaceKey='main';
export const draftPrefix=()=>workspaceKey==='main'?'daymark-draft-':'daymark-account-draft:'+workspaceKey+':';
const listeners=new Set();
export const snapshot=()=>current;
export const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
function notify(state) { if(current&&state.revision<current.revision)return;current=state; listeners.forEach(fn=>fn(state)); }
function read(key=workspaceKey) {
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(key);
    req.onsuccess=()=>resolve(req.result||emptyState());req.onerror=()=>reject(req.error);
  });
}
export async function openStore(accountId=null) {
  workspaceKey=accountId?'account:'+accountId:'main';
  if(!globalThis.indexedDB) throw new Error('This browser cannot save your workspace. Please use a browser with local storage enabled.');
  database=await new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(new Error('Close other Daymark tabs, then try again.'));
  });
  database.onversionchange=()=>database.close();
  current=validateState(await read());
  // Fail visibly before accepting edits if the browser denies actual writes.
  await change(s=>s);
  if('BroadcastChannel' in globalThis) {channel=new BroadcastChannel('daymark-updates:'+workspaceKey);channel.onmessage=()=>read().then(notify).catch(()=>{});}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') read().then(notify).catch(()=>{});});
  return current;
}
function change(transform) {
  return new Promise((resolve,reject)=>{
    let next, failure;
    const tx=database.transaction(STORE,'readwrite'), store=tx.objectStore(STORE),req=store.get(workspaceKey);
    req.onsuccess=()=>{
      try {next=transform(req.result||emptyState());store.put(next,workspaceKey);}
      catch(error) {failure=error;tx.abort();}
    };
    tx.oncomplete=()=>{notify(next);channel?.postMessage(next.revision);resolve(next);};
    tx.onabort=()=>reject(failure||tx.error||new Error('Your change could not be saved. Your previous data is still intact.'));
    tx.onerror=()=>{failure=tx.error;};
  });
}
export const dispatch=command=>change(s=>applyCommand(s,command));
export const deviceWorkspace=()=>read('main');
export function readCheckpoint(){
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(STORE),store=tx.objectStore(STORE);
    const state=store.get(workspaceKey),meta=store.get('sync:'+workspaceKey);
    tx.oncomplete=()=>resolve({local:state.result||emptyState(),meta:meta.result||null});
    tx.onabort=()=>reject(tx.error);
  });
}
export function checkpoint(expected,remote,generation,changed){
  return new Promise((resolve,reject)=>{
    const tx=database.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    const state=store.get(workspaceKey),meta=store.get('sync:'+workspaceKey);
    let committed,updated;
    meta.onsuccess=()=>{
      if(state.result?.revision!==expected.local.revision || meta.result?.generation!==expected.meta?.generation)return;
      updated=changed?{...remote,revision:state.result.revision+1}:state.result;
      if(changed)store.put(updated,workspaceKey);
      store.put({generation,base:remote},'sync:'+workspaceKey);committed=true;
    };
    tx.oncomplete=()=>{if(committed&&changed){notify(updated);channel?.postMessage(updated.revision);}resolve(!!committed);};
    tx.onabort=()=>reject(tx.error);
  });
}
export function replaceWorkspace(data, expectedRevision) {
  validateState(data);
  return change(old=>{
    if(old.revision!==expectedRevision) throw new Error('Your workspace changed in another tab. Review it and try again.');
    const next=structuredClone(data);next.revision=old.revision+1;
    if(next.focus) {next.focus.running=false;next.focus.resumedAt=Date.now();}
    // Transfer a plan without activating alerts on the receiving device.
    next.preferences.prepTime='';next.preferences.morningTime='';next.preferences.reminderDays=[];
    next.tasks.forEach(task=>{if(task.remind){task.remind=false;task.reminderKey='';}});
    return next;
  });
}
export function exportWorkspace() {
  const copy=structuredClone(current);
  if(copy.focus) {copy.focus.elapsedMs=elapsedMs(copy.focus);copy.focus.running=false;}
  return JSON.stringify(copy,null,2);
}
