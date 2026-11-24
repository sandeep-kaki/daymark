import {emptyState,validateState} from './domain.js';

const collections = new Set(['tasks','goals','routines','logs','notes','activities','sessions']);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function contents(state) { return {...state,revision:0}; }
export function equivalent(a,b) { return same(contents(a),contents(b)); }

export class SyncConflict extends Error {}
function choose(base,local,remote) {
  if(same(local,remote) || same(base,remote)) return local;
  if(same(base,local)) return remote;
  throw new SyncConflict('Both devices changed the same record.');
}
function mergeKeys(base,local,remote) {
  const result={};
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
    const value=choose(base[key],local[key],remote[key]);
    if(value!==undefined) Object.defineProperty(result,key,{value,enumerable:true,configurable:true,writable:true});
  }
  return result;
}
function records(base,local,remote) {
  const index=items=>Object.fromEntries(items.map(item=>[item.id,item]));
  return Object.values(mergeKeys(index(base),index(local),index(remote)));
}
export function reconcile(base,local,remote) {
  if(equivalent(base,remote))return contents(local);
  if(equivalent(base,local)||equivalent(local,remote))return contents(remote);
  const merged={};
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
    if(key==='revision'){merged.revision=0;continue;}
    if(collections.has(key)) merged[key]=records(base[key],local[key],remote[key]);
    else if(key==='preferences'||key==='days') merged[key]=mergeKeys(base[key]||{},local[key]||{},remote[key]||{});
    else if(key==='commands') merged[key]=[...new Set([...(local.commands||[]),...(remote.commands||[])])];
    else merged[key]=choose(base[key],local[key],remote[key]);
  }
  try{return validateState(merged);}catch{throw new SyncConflict('These changes need a choice to keep the workspace consistent.');}
}

// Split by Unicode character, bounded below Firestore's per-document byte limit.
export function encodeParts(state) {
  const json=JSON.stringify(contents(validateState(state)));
  if(new TextEncoder().encode(json).length>8*1024*1024)throw Error('Cloud workspace exceeds the 8 MiB sync limit. Your changes remain on this device.');
  const parts=[];let part='';
  for(const character of json){part+=character;if(part.length>=120000){parts.push(part);part='';}}
  if(part)parts.push(part);
  return parts;
}
export function decodeParts(parts){return validateState(JSON.parse(parts.join('')));}
export const baseline=()=>contents(emptyState());
