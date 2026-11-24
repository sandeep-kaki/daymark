import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyCommand,parseBackup} from '../src/domain.js';
const fixture=()=>parseBackup(readFileSync(new URL('./fixtures/course-lesson-v1.json',import.meta.url),'utf8'));
test('course fixture preserves the planned priority and the separate editing session',()=>{const s=fixture();assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].status,'partial');assert.equal(s.activities.find(a=>a.kind==='unexpected work').minutes,15);assert.equal(s.goals[0].milestones[0].done,false);});
test('retrospective time range supplies actual elapsed minutes',()=>{const s=applyCommand(fixture(),{type:'work.log',title:'Edit',day:'2026-11-24',start:'10:15',end:'10:35'});assert.equal(s.activities.at(-1).minutes,20);});
test('invalid time range retains previous records',()=>{const s=fixture();assert.throws(()=>applyCommand(s,{type:'work.log',title:'Edit',day:'2026-11-24',start:'12:00',end:'10:00'}));assert.equal(s.activities.length,2);});
test('stale reminder intention cannot post after changing start',()=>{let s=fixture();s=applyCommand(s,{...s.tasks[0],type:'task.save',time:'09:00',remind:true});const key=s.tasks[0].reminderKey;s=applyCommand(s,{...s.tasks[0],type:'task.save',time:'10:00',remind:true});assert.equal(applyCommand(s,{type:'reminder.fire',id:'draft',key}),s);});
test('explicit rest clears selection while preserving tasks',()=>{const s=applyCommand(fixture(),{type:'day.save',day:'2026-11-24',rest:true});assert.equal(s.tasks[0].priority,false);assert.equal(s.tasks[0].date,'2026-11-24');assert.equal(s.days['2026-11-24'].rest,true);});
test('scope changes keep the old finish condition',()=>{const s=fixture();const updated=applyCommand(s,{...s.tasks[0],type:'task.save',definition:'One bullet'});assert.equal(updated.activities.at(-1).previousDefinition,s.tasks[0].definition);assert.equal(updated.tasks[0].status,'partial');});

