import {initializeAccount,startSync,account,configured,syncStatus,connect,disconnect,hasConflict,resolveConflict} from './cloud.js';
import {openStore,draftPrefix,snapshot,dispatch,subscribe,replaceWorkspace,exportWorkspace} from './store.js';
import {dayKey,addDays,emptyState,parseBackup,elapsedMs,uid} from './domain.js';
import {field,textarea,select,button as b,esc as e,goalSelect} from './ui.js';
import {shell,screens,daily,goals,journal,review,taskRow,navigationLinks} from './views.js';
const root=document.querySelector('#app'), dialog=document.querySelector('dialog'), toast=document.querySelector('#toast');
let offset=0, planDay=addDays(dayKey(),1), reviewDay=dayKey(),period='week',saving=false,submit,revision,timeout,previousFocus,lastDay=dayKey();
const page=()=>screens.includes(location.hash.slice(1))?location.hash.slice(1):'Today';
const drawer=document.querySelector('#navigation');
drawer.addEventListener('click',ev=>{
 if(ev.target===drawer || ev.target.closest('button,a'))drawer.close();
});
drawer.addEventListener('close',()=>root.querySelector('[data-action="menu"]')?.focus());
matchMedia('(max-width:720px)').addEventListener('change',()=>{if(drawer.open)drawer.close();});
const day=()=>page()==='Plan'?planDay:addDays(dayKey(),offset);
const s=()=>snapshot(), task=id=>s().tasks.find(t=>t.id===id);
const cmd=(type,fields={})=>dispatch({type,...fields,commandId:uid()});
function render(){const p=page(),state=s();document.documentElement.dataset.theme=state.preferences.theme;
 root.innerHTML=shell(p,p==='Today'||p==='Plan'?daily(state,day(),p==='Plan'):p==='Goals'?goals(state):p==='Journal'?journal(state):review(state,reviewDay,period));showSyncStatus();}
function showSyncStatus(){
 const label=root.querySelector('[data-cloud-status]');
 if(label)label.textContent=account()?syncStatus():'Device only';
 const panel=dialog.querySelector('[data-sync-panel]');
 if(panel)panel.innerHTML=storagePanel();
}
window.addEventListener('daymark-sync-status',showSyncStatus);
function storagePanel(){
 if(account())return '<h3>Google sync</h3><p>'+e(account().email||'Signed in')+' · '+e(syncStatus())+'</p>'+
 (hasConflict()?b('Review conflict','cloud-conflict'):'')+b('Switch to device only','device-only');
 return '<h3>Storage</h3><p>Changes save automatically on this device. Sign in to sync your saved tasks and journal across devices.</p>'+
 (configured()?b('Continue with Google','cloud-connect'):'<p>Google sync will be available when Firebase is connected.</p>');
}
function flash(msg,action=''){clearTimeout(timeout);toast.innerHTML=e(msg)+action;toast.classList.add('visible');timeout=setTimeout(()=>toast.classList.remove('visible'),6500);}
let formDirty=false;
function close(discard=false){if(formDirty&&!discard&&!confirm('Discard the changes in this form?'))return;formDirty=false;if(dialog.open){dialog.close();if(history.state?.sheet)history.back();}}
function form(name,fields,handler,label='Save',extras=''){
 if(!dialog.open){previousFocus=document.activeElement;history.pushState({sheet:true},'',location.href);}
 revision=s().revision;submit=handler;formDirty=false;
 dialog.innerHTML=`<div class="line"><h2 id="dialog-title">${e(name)}</h2>${b('Close','close','','quiet')}</div><form>${fields}<p role="alert"></p>${handler?`<button class="primary" type="submit">${e(label)}</button>`:''}</form>${extras}`;
 if(!dialog.open)dialog.showModal();dialog.querySelector('input:not([type=hidden]),textarea,select,button[type=submit]')?.focus();}
dialog.addEventListener('close',()=>previousFocus?.focus());
dialog.addEventListener('input',ev=>{formDirty=!ev.target.closest('form')?.oninput;});
window.addEventListener('beforeunload',ev=>{if(formDirty){ev.preventDefault();ev.returnValue='';}});
dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
window.addEventListener('popstate',()=>{if(dialog.open){if(formDirty&&!confirm('Discard the changes in this form?')){history.pushState({sheet:true},'',location.href);return;}formDirty=false;dialog.close();}if(s())render();});
window.addEventListener('hashchange',()=>{if(s())render();window.scrollTo(0,0);});
dialog.addEventListener('submit',async ev=>{ev.preventDefault();if(!submit||saving)return;saving=true;
 try{const result=await submit(Object.fromEntries(new FormData(ev.target)));if(result==='workspace-switch'){formDirty=false;return;}close(true);flash('Saved');}catch(err){dialog.querySelector('[role=alert]').textContent=err.message;}finally{saving=false;}});
const required='required maxlength="180"',number='min="1" max="1440"', choices=arr=>arr.map(x=>[x,x]);
const guarded=(type,data)=>cmd(type,{...data,expectedRevision:revision});
function taskForm(id='',date='',primary=false){const t=task(id)||{};
 form(id?'Task details':primary?'Choose your priority':'New task',field('Title','title',t.title,'text',required)+field('Planned day','date',t.date??date,'date',primary?'required':'')+
 (primary?field('First action','firstStep',t.firstStep):'')+`<details ${id?'open':''}><summary>Planning details</summary>`+textarea('Definition of done','definition',t.definition)+(primary?'':field('First action','firstStep',t.firstStep))+field('Start cue','cue',t.cue)+field('Fallback','fallback',t.fallback)+field('Preparation','preparation',t.preparation)+field('Estimated minutes','estimate',t.estimate,'number',number)+field('Start time','time',t.time,'time')+select('Remind at start while open','remind',choices(['No','Yes']),t.remind?'Yes':'No')+field('Deadline','deadline',t.deadline,'date')+goalSelect(s(),t.goalId)+select('Milestone · optional','milestoneId',[['','No milestone'],...s().goals.flatMap(g=>g.milestones.map(m=>[m.id,g.title+' · '+m.title]))],t.milestoneId)+textarea('Notes','notes',t.notes)+'</details>',
 data=>guarded('task.save',{...data,id,primary,remind:data.remind==='Yes'}),primary?'Save priority':'Save task',id?`<div class="actions tools">${!t.archived&&t.status!=='done'?b('Start','start',id)+b('Focus','focus-start',id)+b('Make priority','promote',id)+b('I’m stuck','stuck',id):''}${b(t.archived?'Restore':'Archive','archive',id)}${b('Delete','delete-task',id)}</div>`:'');}
function noteForm(id,kind='entry'){const n=s().notes.find(x=>x.id===id)||{};const key=draftPrefix()+(id||kind);let draft={};
 try{draft=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
 form(id?'Edit entry':kind==='review'?'Record an adjustment':'Write an entry',textarea('Your entry','body',draft.body??n.body,'required maxlength="20000"')+field('Day','day',draft.day||n.day||(kind==='review'?reviewDay:dayKey()),'date','required')+select('Category','kind',choices(['entry','win','lesson','idea','review']),draft.kind||n.kind||kind)+goalSelect(s(),draft.goalId??n.goalId),
 async data=>{await guarded('note.save',{...data,id});localStorage.removeItem(key);},'Save entry',id?b('Delete entry','delete-note',id):'');
 dialog.querySelector('form').oninput=ev=>{try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(new FormData(ev.currentTarget))));}catch{dialog.querySelector('[role=alert]').textContent='Draft recovery unavailable. Save this entry before leaving.';}};}
function download(){const blob=new Blob([JSON.stringify({format:'daymark-workspace',schemaVersion:1,exportedAt:new Date().toISOString(),payload:JSON.parse(exportWorkspace())},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='daymark-'+dayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearDrafts(){for(const k of Object.keys(localStorage))if(k.startsWith(draftPrefix()))localStorage.removeItem(k);}
function settings(){const p=s().preferences;
 const themes=['System','Light','Dark'].map(name=>{
  const value=name.toLowerCase();
  return `<label><input type="radio" name="theme" value="${value}" ${(p.theme||'system')===value?'checked':''}><span class="theme-swatch swatch-${value}" aria-hidden="true"></span>${name}</label>`;
 }).join('');
 form('Settings','<fieldset class="theme-options"><legend>Appearance</legend>'+themes+'</fieldset>'+select('Coach','coach',choices(['off','gentle','direct']),p.coach||'gentle')+
 '<label class="companion-setting"><input type="checkbox" name="showCompanion" '+(p.showCompanion===false?'':'checked')+'> Show the rabbit companion</label>'+select('Show tomorrow shortcut','showTomorrow',choices(['Yes','No']),p.showTomorrow?'Yes':'No')+select('Show routines on Today','showRoutines',choices(['Yes','No']),p.showRoutines?'Yes':'No')+
 '<details><summary>In-app reminders</summary><p>Leave the time blank to turn a reminder off. Reminders appear while Daymark is open.</p>'+field('Preparation','prepTime',p.prepTime,'time')+field('Morning','morningTime',p.morningTime,'time')+field('Quiet hours start','quietStart',p.quietStart||'22:00','time')+field('Quiet hours end','quietEnd',p.quietEnd||'07:00','time')+'</details>',
 data=>guarded('preferences',{...data,showCompanion:data.showCompanion==='on',showTomorrow:data.showTomorrow==='Yes',showRoutines:data.showRoutines==='Yes'}),'Save settings',
 '<hr><section data-sync-panel>'+storagePanel()+'</section><details><summary>File transfer and deletion</summary>'+b('Download backup','export')+'<label class="field">Restore a backup<input type="file" id="restore-file" accept=".json,application/json"></label>'+b('Delete workspace','wipe')+'</details>');}
function routines(id){const r=s().routines.find(r=>r.id===id)||{};
 form(id?'Edit routine':'New routine',field('Routine','title',r.title,'text',required)+select('Measure','kind',choices(['count','minutes','check']),r.kind)+select('Frequency','period',choices(['daily','weekly']),r.period)+field('Target per period','target',r.target||1,'number','required min="1"')+field('Standard amount','step',r.step||1,'number','required min="1"')+field('Minimum version','minimum',r.minimum)+field('Unit','unit',r.unit||'times')+field('Cue','cue',r.cue)+`<fieldset><legend>Scheduled weekdays (optional)</legend>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<label><input type="checkbox" name="w${i}" ${r.weekdays?.includes(i)?'checked':''}>${d}</label>`).join('')}</fieldset>`+goalSelect(s(),r.goalId),data=>guarded('routine.save',{...data,id,weekdays:[0,1,2,3,4,5,6].filter(i=>data['w'+i])}),'Save routine',id?b(r.paused?'Resume routine':'Pause routine','routine-pause',id):'');}
async function act(action,id){
 switch(action){
 case 'menu':drawer.querySelector('nav').innerHTML=navigationLinks(page());drawer.showModal();return;
 case 'close':return close();case 'today':case 'tomorrow':offset=Number(action==='tomorrow');return render();
 case 'new':case 'dated':case 'edit':case 'new-primary':return taskForm(id,action==='dated'||action==='new-primary'?day():'',action==='new-primary');
 case 'choose':if(!s().tasks.some(t=>!t.archived&&t.status!=='done'))return taskForm('',day(),true);return form('Choose one thing',b('Create a new priority','new-primary')+s().tasks.filter(t=>!t.archived&&t.status!=='done').map(t=>b(t.title+' · '+(t.date||'Inbox'),'pick',t.id)).join(''),null);
 case 'pick':return taskFormForDay(id);
 case 'promote':await cmd('task.priority',{id});break;
 case 'all':case 'inbox':case 'missed':return form({all:'All tasks',inbox:'Inbox',missed:'Unfinished from earlier'}[action],b('Add task','new')+(s().tasks.filter(t=>action==='all'||!t.archived&&t.status!=='done'&&(action==='inbox'?!t.date:t.date&&t.date<dayKey())).map(taskRow).join('')||'<p>No tasks here.</p>'),null);
 case 'complete':{const commandId=uid();const state=await dispatch({type:'task.toggle',id,status:'done',commandId});const event=state.activities.find(a=>a.commandId===commandId);close();flash('Task completed',event?b('Undo','undo',event.id):'');return;}
 case 'undo':await cmd('task.undo',{eventId:id});break;
 case 'reopen':await cmd('task.toggle',{id,status:'open'});break;
 case 'archive':await cmd('task.archive',{id});break;
 case 'delete-task':return form('Delete this task?', '<p>Its activity and focus sessions will also be removed.</p>',()=>guarded('task.delete',{id}),'Delete task');
 case 'rest':case 'day-settings':return form('Day settings',field('Available minutes','budget',s().days?.[day()]?.budget,'number',number)+select('Day type','type',choices(['Work','Rest']),action==='rest'||s().days?.[day()]?.rest?'Rest':'Work'),data=>guarded('day.save',{day:day(),budget:data.budget,rest:data.type==='Rest'}));
 case 'start':await cmd('task.start',{id});return form('Started',`<h3>${e(task(id).title)}</h3><p>${e(task(id).firstStep||'Take your first step.')}</p>${b('Open focus timer','focus-start',id)}${b('Continue without timer','close')}`,null);
 case 'stuck':return form('What got in the way?',select('Obstacle','reason',choices(['Too big','Low energy','Blocked','Interrupted','No longer important','Skip']))+textarea('Progress or blocker','detail',task(id)?.fallback||''),
 data=>data.reason==='Skip'?Promise.resolve():guarded('task.progress',{id,detail:[data.reason,data.detail].filter(Boolean).join(' · ')}),'Record partial progress',b('Move or change scope','edit',id)+b('Drop commitment','drop',id));
 case 'drop':await guarded('task.save',{...task(id),date:'',time:'',remind:false});break;
 case 'focus-start':await cmd('focus.start',{id});break;
 case 'focus.finish':if(s().focus&&elapsedMs(s().focus)>86400000)return form('Finish interrupted session',field('Minutes actually worked','minutes','','number','required min="1" max="1440"'),data=>guarded('focus.finish',data),'Record session');await cmd(action);break;
 case 'focus.pause':case 'focus.resume':case 'focus.extend':await cmd(action);break;
 case 'dismiss':await cmd('preferences',{dismissedDay:dayKey()});break;
 case 'goal':{const g=s().goals.find(g=>g.id===id)||{};return form('Goal',field('Title','title',g.title,'text',required)+textarea('Observable outcome','why',g.why,'required')+field('Target date','date',g.date,'date'),data=>guarded('goal.save',{...data,id}));}
 case 'goal-state':return form('Update goal',select('Status','state',choices(['active','paused','achieved']),s().goals.find(g=>g.id===id)?.state)+textarea('Outcome evidence','detail'),data=>guarded('goal.state',{...data,id}));
 case 'milestone':return form('Weekly milestone',field('Milestone','title','','text',required)+field('Week containing','week',dayKey(),'date','required'),data=>guarded('milestone.add',{...data,goalId:id}));
 case 'milestone-edit':{const g=s().goals.find(g=>g.milestones.some(m=>m.id===id)),m=g.milestones.find(m=>m.id===id);return form('Edit milestone',field('Milestone','title',m.title,'text',required)+field('Week containing','week',m.week||dayKey(),'date','required'),data=>guarded('milestone.edit',{...data,id,goalId:g.id}));}
 case 'milestone-toggle':await cmd('milestone.toggle',{id,goalId:s().goals.find(g=>g.milestones.some(m=>m.id===id)).id});break;
 case 'work':return form('Log work',field('What did you do?','title','','text',required)+field('Day of the work','day',dayKey(),'date','required')+field('Actual minutes','minutes','','number',number)+'<details><summary>Time and related task</summary>'+field('Started at','start','','time')+field('Finished at','end','','time')+select('Related task','taskId',[['','No task'],...s().tasks.map(t=>[t.id,t.title])])+'</details>'+goalSelect(s())+textarea('Notes','detail'),data=>guarded('work.log',data));
 case 'routine':return routines(id);
 case 'routine-pause':await cmd('routine.pause',{id});break;
 case 'correct-log':{const l=s().logs.find(x=>x.id===id);return form('Correct an earlier log',field('Recorded amount','value',l.value,'number','required min="1"'),data=>guarded('routine.correct',{...data,id}));}
 case 'routine-rest':await cmd('routine.rest',{id,day:day()});break;
 case 'log-routine':{const r=s().routines.find(r=>r.id===id);return form(r.title,field('Day','day',day(),'date','required')+field('Add amount ('+r.unit+')','value',r.step,'number','required min="1"'),data=>guarded('routine.log',{...data,id}),'Add log',b('Rest this day','routine-rest',id)+s().logs.filter(l=>l.routineId===id).slice(-7).reverse().map(l=>b('Edit '+l.day+' · '+l.value+' '+(l.unit||r.unit),'correct-log',l.id)).join(''));}
 case 'note':case 'experiment':return noteForm(id,action==='experiment'?'review':'entry');
 case 'follow':await cmd('note.to-task',{id});break;
 case 'delete-note':return form('Delete this entry?','<p>This will remove the writing and its saved draft.</p>',async()=>{await guarded('note.delete',{id});localStorage.removeItem(draftPrefix()+id);},'Delete entry');
 case 'cloud-connect':return form('Use Google sync','<p>Your saved workspace will be private to your Google sign-in. Offline changes sync when Daymark reconnects. Unfinished journal drafts stay on this device.</p><label><input type="checkbox" name="copy"> Copy this device’s saved records if my Google workspace is new</label>',data=>connect(data.copy==='on'),'Sign in with Google');
 case 'device-only':return form('Switch to device only?','<p>Your separate device workspace will open. Cloud records remain in your account. Any pending changes stay on this browser until you sign back into the same account.</p>',disconnect,'Sign out');
 case 'cloud-conflict':return form('Choose a workspace version','<p>The same records changed on two devices. Both versions are still available. This choice applies to the whole workspace. You can download the device version first.</p>'+b('Download device version','export')+select('Version to keep','choice',[['cloud','Use the Google version'],['device','Use this device’s version']]),data=>resolveConflict(data.choice),'Use selected version');
 case 'settings':return settings();case 'export':return download();
 case 'wipe':return form('Permanently delete workspace?',(account()?'<p>Erase this account’s workspace on this device and sync the deletion to Google and your other devices. Downloaded copies remain yours.</p>':'<p>All records and drafts in this device workspace will be removed.</p>')+b('Download backup first','export'),async()=>{await replaceWorkspace(emptyState(),revision);clearDrafts();},'Delete all local data');
 default:return;
 }close();flash('Saved');
}
function taskFormForDay(id){taskForm(id,day(),true);dialog.querySelector('[name=date]').value=day();}
document.addEventListener('click',async ev=>{const target=ev.target.closest('[data-action]');if(!target||saving)return;if(dialog.open&&formDirty&&target.dataset.action!=='close'){if(!confirm('Discard unsaved changes before continuing?'))return;formDirty=false;}saving=true;try{await act(target.dataset.action,target.dataset.id||'');}catch(err){if(dialog.open)dialog.querySelector('[role=alert]').textContent=err.message;else flash(err.message);}finally{saving=false;}});
document.addEventListener('change',async ev=>{const el=ev.target;if(el.dataset.date&&el.value){if(el.dataset.date==='plan')planDay=el.value;else reviewDay=el.value;render();}if(el.hasAttribute('data-period')){period=el.value;render();}
 if(el.id==='restore-file'&&el.files[0]){try{if(el.files[0].size>10485760)throw Error('Choose a backup smaller than 10 MB.');const data=parseBackup(await el.files[0].text());form('Replace this workspace?',`<p>Incoming backup: ${data.tasks.length} tasks, ${data.goals.length} goals and ${data.notes.length} entries. Restored timers will be paused.</p>`+b('Download current workspace','export'),async()=>{await replaceWorkspace(data,revision);clearDrafts();},'Replace workspace');}catch(err){dialog.querySelector('[role=alert]').textContent=err.message;}}});
async function tick(){const today=dayKey();if(lastDay!==today){lastDay=today;if(!dialog.open)render();}const f=s()?.focus,clock=document.querySelector('#elapsed');if(clock&&f)clock.textContent=Math.floor(elapsedMs(f)/60000)+' min '+Math.floor(elapsedMs(f)/1000)%60+' sec elapsed · '+Math.max(0,Math.ceil((f.targetMinutes||25)-elapsedMs(f)/60000))+' min remaining';
 const due=s()?.tasks.find(t=>t.remind&&!t.archived&&t.status!=='done'&&t.deliveredKey!==t.reminderKey&&t.date===today&&Math.abs(Date.now()-new Date(t.date+'T'+t.time).getTime()-30000)<30000);
 if(due&&!document.hidden&&!dialog.open){try{await cmd('reminder.fire',{id:due.id,key:due.reminderKey,expectedRevision:s().revision});flash('Your scheduled task is ready.');}catch{}return;}
 const p=s()?.preferences;if(!p||p.coach==='off'||document.hidden||dialog.open)return;
 const now=new Date(),hm=now.toTimeString().slice(0,5);if(![p.prepTime,p.morningTime].includes(hm))return;
 const start=p.quietStart||'22:00',end=p.quietEnd||'07:00';if(start>end?hm>=start||hm<end:hm>=start&&hm<end)return;
 const logs=p.reminderDays||[],recent=logs.filter(n=>dayKey(new Date(n))===today);if(recent.length>=2||logs.some(n=>+now-n<14400000))return;
 try{await guardedReminder([...recent,+now]);flash(hm===p.prepTime?'Time to prepare tomorrow’s plan.':'Your daily plan is ready to review.');}catch{}}
function guardedReminder(reminderDays){return cmd('preferences',{reminderDays,expectedRevision:s().revision});}
try{await openStore(await initializeAccount());subscribe(render);render();startSync();setInterval(tick,1000);if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>flash('Offline loading is unavailable in this browser.'));}catch(err){root.innerHTML='<main><h1>Workspace unavailable</h1><p>'+e(err.message)+'</p><a href="">Try again</a></main>';}

