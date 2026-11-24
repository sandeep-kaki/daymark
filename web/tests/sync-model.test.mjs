import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,emptyState} from '../src/domain.js';
import {reconcile,equivalent,SyncConflict,encodeParts,decodeParts} from '../src/sync-model.js';
const base=applyCommand(emptyState(),{type:'task.save',title:'Original'});
const edit=title=>applyCommand(base,{...base.tasks[0],type:'task.save',title});
test('returning devices receive cloud records independent of local revision',()=>{
 const blank=emptyState();assert(equivalent(reconcile(blank,blank,base),base));assert(equivalent(base,{...base,revision:72}));
});
test('independent captures and their histories merge across devices',()=>{
 const task=title=>applyCommand(base,{type:'task.save',title});
 const merged=reconcile(base,task('Phone'),task('Desktop'));
 assert.deepEqual(new Set(merged.tasks.map(t=>t.title)),new Set(['Original','Phone','Desktop']));
 assert.equal(merged.activities.filter(a=>a.kind==='captured').length,3);
});
test('conflicting edits or delete versus edit require a choice',()=>{
 assert.throws(()=>reconcile(base,edit('Phone'),edit('Desktop')),SyncConflict);
 const removed=applyCommand(base,{type:'task.delete',id:base.tasks[0].id});
 assert.throws(()=>reconcile(base,removed,edit('Changed')),SyncConflict);
});
test('Unicode survives a multi-document round trip',()=>{
 let state=emptyState();
 for(let i=0;i<18;i++)state=applyCommand(state,{type:'note.save',kind:'entry',body:'🌅'.repeat(9000)});
 const parts=encodeParts(state);assert(parts.length>1);assert(equivalent(state,decodeParts(parts)));assert(parts.every(p=>Buffer.byteLength(p)<500000));
});
