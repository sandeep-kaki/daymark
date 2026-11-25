import {initializeAccount,startSync,account,configured,syncStatus,connect,disconnect,hasConflict,resolveConflict} from './cloud.js';
import {openStore,draftPrefix,snapshot,dispatch,subscribe,replaceWorkspace,exportWorkspace} from './store.js';
import {dayKey,addDays,emptyState,parseBackup,elapsedMs,uid} from './domain.js';
import {field,textarea,select,button as b,icon,esc as e,goalSelect} from './ui.js';
import {applyAppearance,setAppearance,appearanceSettings,toggleMode} from './appearance.js';
import {pip,pipLine} from './pip.js';
import {installCalendar} from './plan-calendar.js';
import {shell,screens,daily,goals,journal,review,taskRow,navigationLinks} from './views.js';
const root=document.querySelector('#app'), dialog=document.querySelector('dialog'), toast=document.querySelector('#toast');
let offset=0, planDay=addDays(dayKey(),1), reviewDay=dayKey(),period='week',saving=false,submit,revision,timeout,previousFocus,lastDay=dayKey();
const page=()=>screens.includes(location.hash.slice(1))?location.hash.slice(1):'Today';
installCalendar((scope,date)=>{if(scope==='review')reviewDay=date;else planDay=date;render();});
const drawer=document.querySelector('#navigation');
const phoneNav=document.querySelector('.phone-tabs'),lens=phoneNav.querySelector('.tab-lens');
const phoneWidth=matchMedia('(max-width:720px)');
let lensTravel,lensLight;
function updatePhoneNav(destination){
 if(phoneNav.hidden){
  phoneNav.style.setProperty('--tab-count',screens.length);
  lens.after(document.createRange().createContextualFragment(navigationLinks(destination)));
  phoneNav.hidden=false;
 }
 const index=screens.indexOf(destination);
 const previous=phoneNav.dataset.page;
 if(previous===destination)return;
 const track=lens.parentElement;
 const start=lens.getBoundingClientRect();
 lensTravel?.cancel();lensLight?.cancel();
 phoneNav.dataset.page=destination;
 for(const link of phoneNav.querySelectorAll('a')){
  if(link.hash==='#'+destination)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 }
 lens.style.transform='translateX('+index*100+'%)';
 if(!previous||!phoneWidth.matches||!motion())return;
 const end=lens.getBoundingClientRect();
 if(!end.width)return;
 // Sample the visible lens so a second tap can redirect it mid-flight.
 const origin=start.left-track.getBoundingClientRect().left;
 const target=end.left-track.getBoundingClientRect().left;
 const distance=target-origin;
 const stretch=Math.min(.48,Math.abs(distance)/end.width*.2);
 const frame=(left,scale,height,offset)=>({transform:'translateX('+left+'px) scale('+scale+','+height+')',offset,easing:'cubic-bezier(.25,.7,.36,1)'});
 const middle=origin+distance*.57-end.width*stretch/2;
 const duration=360+Math.min(105,Math.abs(distance)*.46);
 const direction=Math.sign(distance);
 const recoil=Math.min(end.width*.055,Math.abs(distance)*.035);
 lensTravel=lens.animate([
  frame(origin,start.width/end.width,start.height/end.height,0),
  frame(middle,1+stretch,.90,.40),
  frame(target+direction*recoil,.965,1.035,.79),frame(target,1,1,1)
 ],{duration});
 lensLight=lens.firstElementChild.animate([
  {opacity:0,transform:'translateX('+(-20*direction)+'%)'},
  {opacity:.8,offset:.38},{opacity:0,transform:'translateX('+(20*direction)+'%)'}
 ],{duration});
}
let drawerTimer, lastPage;
const motion=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
function slideSelection(nav,from,to){
 const prior=nav.querySelector('a[href="#'+from+'"]'), selected=nav.querySelector('a[href="#'+to+'"]');
 if(!prior||!selected||from===to)return;
 prior.removeAttribute('aria-current');selected.setAttribute('aria-current','page');
 if(!motion())return;
 const a=prior.getBoundingClientRect(), b=selected.getBoundingClientRect();
 selected.style.setProperty('--slide-x',(a.left-b.left)+'px');
 selected.style.setProperty('--slide-y',(a.top-b.top)+'px');
 selected.classList.remove('sliding');void selected.offsetWidth;selected.classList.add('sliding');
}
drawer.addEventListener('click',ev=>{
 clearTimeout(drawerTimer);
 const link=ev.target.closest('nav a');
 if(link){
  const prior=drawer.querySelector('[aria-current]')?.hash.slice(1);
  slideSelection(drawer,prior,link.hash.slice(1));
  drawerTimer=setTimeout(()=>{if(drawer.open)drawer.close();},motion()&&prior!==link.hash.slice(1)?240:0);
 }else if(ev.target===drawer||ev.target.closest('button'))drawer.close();
});
const desktopNav=matchMedia('(min-width:64em)');
drawer.addEventListener('close',()=>{
 clearTimeout(drawerTimer);
 const selector=desktopNav.matches?'.desktop-nav a[aria-current]':phoneWidth.matches?'.phone-tabs a[aria-current]':'.menu-button';
 document.querySelector(selector)?.focus({preventScroll:true});
});
desktopNav.addEventListener('change',()=>{if(desktopNav.matches&&drawer.open)drawer.close();});
phoneWidth.addEventListener('change',()=>{lensTravel?.cancel();lensLight?.cancel();if(phoneWidth.matches&&drawer.open)drawer.close();});
const day=()=>page()==='Plan'?planDay:addDays(dayKey(),offset);
const s=()=>snapshot(), task=id=>s().tasks.find(t=>t.id===id);
const cmd=(type,fields={})=>dispatch({type,...fields,commandId:uid()});
let pipCue=null, welcomePlayed=false;
function gesture(pose,scope=root){
 const pet=scope.querySelector('.pip');
 if(!pet)return;
 pet.dataset.pose=pose;
 pet.getAnimations({subtree:true}).forEach(animation=>{animation.cancel();animation.play();});
}
const quickDrafts=new Map();
function readQuickDraft(key){
 try{return sessionStorage.getItem(key)??quickDrafts.get(key)??'';}catch{return quickDrafts.get(key)||'';}
}
function writeQuickDraft(key,value){
 if(value)quickDrafts.set(key,value);else quickDrafts.delete(key);
 try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{/* Keep drafts through navigation in this tab. */}
}
function rememberCue(id){
 pipCue={id,day:day(),workspace:draftPrefix()};
}
function render(){
 const p=page(),state=s();
 applyAppearance(state.preferences.theme);
 const scope=draftPrefix()+'quick-task:'+day();
 const existing=root.querySelector('.quick-task input');
 const draft=existing?.dataset.scope===scope?existing.value:readQuickDraft(scope);
 const editing=existing&&document.activeElement===existing;
 const cue=pipCue?.workspace===draftPrefix()?pipCue:null;
 const body=p==='Today'||p==='Plan'?daily(state,day(),p==='Plan',cue):p==='Goals'?goals(state):p==='Journal'?journal(state):review(state,reviewDay,period);
 const navHadFocus=!!document.activeElement?.closest('.desktop-nav');
 root.innerHTML=shell(p,body+(p==='Today'&&offset===0?guideInvitation():''));
 updatePhoneNav(p);
 if(lastPage&&lastPage!==p){
  if(desktopNav.matches)slideSelection(root.querySelector('.desktop-nav'),lastPage,p);
  root.querySelector('article').classList.add('arriving');
  gesture('arrive');
 }
 if(navHadFocus&&desktopNav.matches)root.querySelector('.desktop-nav a[aria-current]')?.focus({preventScroll:true});
 lastPage=p;
 const input=root.querySelector('.quick-task input');
 if(input){input.dataset.scope=scope;input.value=draft;if(editing)input.focus({preventScroll:true});}
 if(p==='Today'&&!welcomePlayed&&!state.focus){gesture('welcome');welcomePlayed=true;}
 showSyncStatus();
}
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
 dialog.innerHTML=`<div class="line dialog-heading"><h2 id="dialog-title">${e(name)}</h2><button type="button" class="dialog-close" data-action="close" aria-label="Close">${icon('close')}</button></div><form>${fields}<p role="alert"></p>${handler?`<button class="primary" type="submit">${e(label)}</button>`:''}</form>${extras}`;
 if(!dialog.open)dialog.showModal();dialog.scrollTop=0;const focus=dialog.querySelector('input:not([type=hidden]),textarea,select,button[type=submit]')||dialog.querySelector('.dialog-close');focus?.focus({preventScroll:true});}
dialog.addEventListener('close',()=>{
 if(previousFocus?.isConnected){previousFocus.focus();return;}
 const action=previousFocus?.dataset.action;
 const fallback=action&&root.querySelector(`[data-action="${CSS.escape(action)}"]`);
 (fallback||root.querySelector('.priority button,header button'))?.focus();
});
dialog.addEventListener('input',ev=>{if(!ev.target.hasAttribute('data-appearance'))formDirty=!ev.target.closest('form')?.oninput;});
window.addEventListener('beforeunload',ev=>{if(formDirty){ev.preventDefault();ev.returnValue='';}});
dialog.addEventListener('cancel',ev=>{ev.preventDefault();close();});
window.addEventListener('popstate',()=>{if(dialog.open){if(formDirty&&!confirm('Discard the changes in this form?')){history.pushState({sheet:true},'',location.href);return;}formDirty=false;dialog.close();}if(s()&&page()===lastPage)render();});
window.addEventListener('hashchange',()=>{if(s())render();window.scrollTo(0,0);});
dialog.addEventListener('submit',async ev=>{ev.preventDefault();if(!submit||saving)return;saving=true;
 try{const result=await submit(Object.fromEntries(new FormData(ev.target)));if(result==='workspace-switch'||result==='next-form'){formDirty=false;return;}close(true);flash('Saved');}catch(err){dialog.querySelector('[role=alert]').textContent=err.message;}finally{saving=false;}});
const required='required maxlength="180"',number='min="1" max="1440"', choices=arr=>arr.map(x=>[x,x]);
const guarded=(type,data)=>cmd(type,{...data,expectedRevision:revision});

const guideKey=()=>draftPrefix()+'first-day-guide-v1';
function guideState(){
 try{return JSON.parse(localStorage.getItem(guideKey()))||{};}catch{return {};}
}
function saveGuide(changes){
 localStorage.setItem(guideKey(),JSON.stringify({...guideState(),...changes}));
}
function guideInvitation(){
 const guide=guideState();
 if(guide.hidden||(!guide.started&&(s().revision>0||account())))return '';
 return `<div class="guide-invite">${b(guide.started?'Resume first-day guide':'First-day guide','guide-open','','quiet','journal')}${b('Dismiss guide','guide-hide','','quiet')}</div>`;
}
const starterIdeas={
 Work:['Draft the opening paragraph','Review one outstanding request','Outline my next meeting'],
 Learning:['Read a chapter','Practise one problem','Write down one thing I learned'],
 Personal:['Go for a short walk','Call someone I miss','Plan a meal for tonight']
};
function setupStarterChoices(form,planned,saved){
 const topics=form.querySelector('[data-topics]'),list=form.querySelector('[data-ideas]'),input=form.elements.title;
 const groups=planned.length?['My tasks',...Object.keys(starterIdeas)]:Object.keys(starterIdeas);
 let topic=planned.length?'My tasks':saved.topic;
 if(saved.started&&!saved.done&&groups.includes(saved.topic))topic=saved.topic;
 let ideas=[];
 function showIdeas(){
  ideas=topic==='My tasks'?planned.map(t=>({title:t.title,id:t.id})):(starterIdeas[topic]||[]).map(title=>({title}));
  topics.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.textContent===topic)));
  list.innerHTML=ideas.map((idea,i)=>'<button type="button" class="idea" data-choice="'+i+'" aria-pressed="'+(idea.title===input.value)+'">'+e(idea.title)+'</button>').join('');
 }
 topics.innerHTML=groups.map(name=>'<button type="button" class="topic">'+e(name)+'</button>').join('');
 topics.onclick=ev=>{const b=ev.target.closest('button');if(b){topic=b.textContent;saveGuide({topic});showIdeas();}};
 list.onclick=ev=>{
  const button=ev.target.closest('[data-choice]');if(!button)return;
  const idea=ideas[Number(button.dataset.choice)];input.value=idea.title;
  saveGuide({title:idea.title,starterId:idea.id||'',firstStep:'',goalId:''});
  list.querySelectorAll('button').forEach(chip=>chip.setAttribute('aria-pressed',String(chip===button)));
  gesture('listen',dialog);
 };
 form.oninput=()=>{saveGuide({title:input.value,starterId:'',firstStep:'',goalId:''});list.querySelectorAll('button').forEach(chip=>chip.setAttribute('aria-pressed','false'));};
 showIdeas();
}
function openGuide(step){
 const saved=guideState();
 step=Math.min(1,Math.max(0,step??(saved.done?0:saved.step||0)));
 saveGuide({step,started:true,hidden:false,done:false});
 const current=s().tasks.find(t=>t.priority&&t.date===dayKey()&&!t.archived&&t.status!=='done');
 const intro='<div class="guide-lead">'+(s().preferences.showCompanion===false?'':pip(step?'listen':'welcome'))+'<small>Pip’s first-day guide · '+(step+1)+' of 2</small></div>';
 if(step===0){
  const fields=current?'<p>Your priority for today</p><strong>'+e(current.title)+'</strong>':
    '<p>What would you like to make time for?</p><div class="starter-topics" data-topics role="group" aria-label="Starting point"></div><div class="starter-ideas" data-ideas aria-live="polite"></div>'+field('Priority','title',saved.title||'','text',required+' placeholder="e.g. Call Maya about Friday"');
  form('Pick a starting point',intro+fields,async data=>{
   if(!current){
    const draft=guideState();
    const existing=s().tasks.find(t=>t.id===draft.starterId&&t.title===data.title&&t.date===dayKey()&&!t.archived&&t.status!=='done');
    if(existing)await guarded('task.priority',{id:existing.id});
    else await guarded('task.save',{title:data.title,firstStep:draft.firstStep||'',goalId:draft.goalId||'',date:dayKey(),primary:true});
    saveGuide({title:'',starterId:'',firstStep:'',goalId:''});
   }
   openGuide(1);return 'next-form';
  },current?'Continue':'Set my priority',b('Skip for now','guide-skip','','quiet')+b('Pause guide','guide-pause','','quiet'));
  if(!current)setupStarterChoices(dialog.querySelector('form'),s().tasks.filter(t=>t.date===dayKey()&&!t.archived&&t.status!=='done').slice(0,3),saved);
 }else{
  const prompt=current?'<small>First step</small><strong>'+e(current.firstStep||current.title)+'</strong>':'<strong>Start with one small task when you’re ready.</strong>';
  form('Your day is ready',intro+'<div class="guide-example">'+prompt+'</div><p>You can add another task now, or head to Today.</p>'+field('Another task (optional)','extra',saved.extra||'','text','maxlength="180"'),async data=>{
   if(data.extra?.trim())await guarded('task.save',{title:data.extra.trim(),date:dayKey()});
   saveGuide({done:true,hidden:true,extra:''});render();
  },'Start my day',b('Back','guide-back','','quiet')+b('Pause guide','guide-pause','','quiet'));
  dialog.querySelector('form').oninput=ev=>saveGuide({extra:ev.currentTarget.elements.extra.value});
 }
 render();
}
function taskForm(id='',date='',primary=false){const t=task(id)||{};
 form(id?'Task details':primary?'Choose your priority':'New task',field('Title','title',t.title,'text',required)+field('Planned day','date',t.date??date,'date',primary?'required':'')+
 (primary?field('First action','firstStep',t.firstStep):'')+`<details ${id?'open':''}><summary>Planning details</summary>`+textarea('Definition of done','definition',t.definition)+(primary?'':field('First action','firstStep',t.firstStep))+field('Start cue','cue',t.cue)+field('Fallback','fallback',t.fallback)+field('Preparation','preparation',t.preparation)+field('Estimated minutes','estimate',t.estimate,'number',number)+field('Start time','time',t.time,'time')+select('Remind at start while open','remind',choices(['No','Yes']),t.remind?'Yes':'No')+field('Deadline','deadline',t.deadline,'date')+goalSelect(s(),t.goalId)+select('Milestone · optional','milestoneId',[['','No milestone'],...s().goals.flatMap(g=>g.milestones.map(m=>[m.id,g.title+' · '+m.title]))],t.milestoneId)+textarea('Notes','notes',t.notes)+'</details>',
 async data=>{
  const next=await guarded('task.save',{...data,id,primary,remind:data.remind==='Yes'});
  if(!id){rememberCue(next.tasks.at(-1).id);render();gesture('listen');}
 },primary?'Save priority':'Save task',id?`<div class="actions tools">${!t.archived&&t.status!=='done'?b('Start','start',id)+b('Focus','focus-start',id)+b('Make priority','promote',id)+b('I’m stuck','stuck',id):''}${b(t.archived?'Restore':'Archive','archive',id)}${b('Delete','delete-task',id)}</div>`:'');}
function noteForm(id,kind='entry'){const n=s().notes.find(x=>x.id===id)||{};const key=draftPrefix()+(id||kind);let draft={};
 try{draft=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
 form(id?'Edit entry':kind==='review'?'Record an adjustment':'Write an entry',textarea('Your entry','body',draft.body??n.body,'required maxlength="20000"')+field('Day','day',draft.day||n.day||(kind==='review'?reviewDay:dayKey()),'date','required')+select('Category','kind',choices(['entry','win','lesson','idea','review']),draft.kind||n.kind||kind)+goalSelect(s(),draft.goalId??n.goalId),
 async data=>{await guarded('note.save',{...data,id});localStorage.removeItem(key);},'Save entry',id?b('Delete entry','delete-note',id):'');
 dialog.querySelector('form').oninput=ev=>{try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(new FormData(ev.currentTarget))));}catch{dialog.querySelector('[role=alert]').textContent='Draft recovery unavailable. Save this entry before leaving.';}};}
function download(){const blob=new Blob([JSON.stringify({format:'daymark-workspace',schemaVersion:1,exportedAt:new Date().toISOString(),payload:JSON.parse(exportWorkspace())},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='daymark-'+dayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearDrafts(){for(const k of Object.keys(localStorage))if(k.startsWith(draftPrefix()))localStorage.removeItem(k);for(const key of new Set([...quickDrafts.keys(),...Object.keys(sessionStorage)]))if(key.startsWith(draftPrefix()+'quick-task:'))writeQuickDraft(key,'');}
function settings(){const p=s().preferences;
 const options=['off','gentle','direct'].map(value=>`<label><input type="radio" name="coach" value="${value}" ${(p.coach||'gentle')===value?'checked':''}>${value[0].toUpperCase()+value.slice(1)}</label>`).join('');
 const toggle=(name,label,checked)=>`<label class="preference-toggle">${label}<input type="checkbox" name="${name}" ${checked?'checked':''}></label>`;
 form('Settings',appearanceSettings()+'<fieldset class="appearance-group"><legend>Coach</legend>'+options+'</fieldset>'+
 toggle('showCompanion','Show the rabbit companion',p.showCompanion!==false)+toggle('showTomorrow','Show tomorrow shortcut',p.showTomorrow)+toggle('showRoutines','Show routines on Today',p.showRoutines)+
 '<details><summary>In-app reminders</summary><p>Leave the time blank to turn a reminder off. Reminders appear while Daymark is open.</p>'+field('Preparation','prepTime',p.prepTime,'time')+field('Morning','morningTime',p.morningTime,'time')+field('Quiet hours start','quietStart',p.quietStart||'22:00','time')+field('Quiet hours end','quietEnd',p.quietEnd||'07:00','time')+'</details>',
 data=>guarded('preferences',{...data,showCompanion:data.showCompanion==='on',showTomorrow:data.showTomorrow==='on',showRoutines:data.showRoutines==='on'}),'Save settings',
 '<hr>'+b('First-day guide','guide-open')+'<details><summary>File transfer and deletion</summary>'+b('Download backup','export')+'<label class="field">Restore a backup<input type="file" id="restore-file" accept=".json,application/json"></label>'+b('Delete workspace','wipe')+'</details>');}
function routines(id){const r=s().routines.find(r=>r.id===id)||{};
 form(id?'Edit routine':'New routine',field('Routine','title',r.title,'text',required)+select('Measure','kind',choices(['count','minutes','check']),r.kind)+select('Frequency','period',choices(['daily','weekly']),r.period)+field('Target per period','target',r.target||1,'number','required min="1"')+field('Standard amount','step',r.step||1,'number','required min="1"')+field('Minimum version','minimum',r.minimum)+field('Unit','unit',r.unit||'times')+field('Cue','cue',r.cue)+`<fieldset><legend>Scheduled weekdays (optional)</legend>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<label><input type="checkbox" name="w${i}" ${r.weekdays?.includes(i)?'checked':''}>${d}</label>`).join('')}</fieldset>`+goalSelect(s(),r.goalId),data=>guarded('routine.save',{...data,id,weekdays:[0,1,2,3,4,5,6].filter(i=>data['w'+i])}),'Save routine',id?b(r.paused?'Resume routine':'Pause routine','routine-pause',id):'');}
async function act(action,id){
 switch(action){
 case 'appearance-mode':return toggleMode(root.querySelector('.mode-toggle'));
 case 'appearance-reset':setAppearance('reset');return;
 case 'greet-pip':{
  const scope=dialog.open?dialog:root;
  gesture('greet',scope);
  const help=scope.querySelector('.pip-help');
  if(help){help.hidden=!help.hidden;scope.querySelector('.pip').setAttribute('aria-expanded',String(!help.hidden));}
  else if(dialog.open)dialog.querySelector('input:not([type=hidden]),textarea')?.focus({preventScroll:true});
  return;
 }
 case 'guide-open':return openGuide();
 case 'guide-back':return openGuide(guideState().step-1);
 case 'guide-skip':saveGuide({hidden:true,done:true});close(true);return render();
 case 'guide-pause':close(true);return render();
 case 'guide-hide':saveGuide({hidden:true});return render();
 case 'menu':drawer.querySelector('nav').innerHTML=navigationLinks(page());drawer.showModal();return;
 case 'close':return close();case 'today':case 'tomorrow':offset=Number(action==='tomorrow');return render();
 case 'new':case 'dated':case 'edit':case 'new-primary':return taskForm(id,action==='dated'||action==='new-primary'?day():'',action==='new-primary');
 case 'choose':if(!s().tasks.some(t=>!t.archived&&t.status!=='done'))return taskForm('',day(),true);return form('Choose one thing',b('Create a new priority','new-primary')+s().tasks.filter(t=>!t.archived&&t.status!=='done').map(t=>b(t.title+' · '+(t.date||'Inbox'),'pick',t.id)).join(''),null);
 case 'pick':return taskFormForDay(id);
 case 'promote':await cmd('task.priority',{id});break;
 case 'all':case 'inbox':case 'missed':return form({all:'All tasks',inbox:'Inbox',missed:'Unfinished from earlier'}[action],b('Add task','new')+(s().tasks.filter(t=>action==='all'||!t.archived&&t.status!=='done'&&(action==='inbox'?!t.date:t.date&&t.date<dayKey())).map(taskRow).join('')||'<p>No tasks here.</p>'),null);
 case 'complete':{const commandId=uid();const state=await dispatch({type:'task.toggle',id,status:'done',commandId});const event=state.activities.find(a=>a.commandId===commandId);rememberCue(id);render();gesture('nod');close();flash('Task completed',event?b('Undo','undo',event.id):'');return;}
 case 'undo':await cmd('task.undo',{eventId:id});pipCue=null;render();break;
 case 'reopen':await cmd('task.toggle',{id,status:'open'});break;
 case 'archive':await cmd('task.archive',{id});break;
 case 'delete-task':return form('Delete this task?', '<p>Its activity and focus sessions will also be removed.</p>',()=>guarded('task.delete',{id}),'Delete task');
 case 'rest':case 'day-settings':return form('Day settings',field('Available minutes','budget',s().days?.[day()]?.budget,'number',number)+select('Day type','type',choices(['Work','Rest']),action==='rest'||s().days?.[day()]?.rest?'Rest':'Work'),data=>guarded('day.save',{day:day(),budget:data.budget,rest:data.type==='Rest'}));
 case 'start':await cmd('task.start',{id});return form('Started',`<h3>${e(task(id).title)}</h3><p>${e(task(id).firstStep||'Take your first step.')}</p>${b('Open focus timer','focus-start',id)}${b('Continue without timer','close')}`,null);
 case 'stuck':return form('What got in the way?',pipLine(s().preferences.showCompanion!==false,'listen',task(id)?.firstStep||'What could you try for two minutes?')+select('Obstacle','reason',choices(['Too big','Low energy','Blocked','Interrupted','No longer important','Skip']))+textarea('Progress or blocker','detail',task(id)?.fallback||''),
 data=>data.reason==='Skip'?Promise.resolve():guarded('task.progress',{id,detail:[data.reason,data.detail].filter(Boolean).join(' · ')}),'Record partial progress',b('Move or change scope','edit',id)+b('Drop commitment','drop',id));
 case 'drop':await guarded('task.save',{...task(id),date:'',time:'',remind:false});break;
 case 'focus-start':await cmd('focus.start',{id});gesture('focus');break;
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
 case 'account':return form('Account','<section data-sync-panel>'+storagePanel()+'</section>',null);
 case 'settings':return settings();case 'export':return download();
 case 'wipe':return form('Permanently delete workspace?',(account()?'<p>Erase this account’s workspace on this device and sync the deletion to Google and your other devices. Downloaded copies remain yours.</p>':'<p>All records and drafts in this device workspace will be removed.</p>')+b('Download backup first','export'),async()=>{await replaceWorkspace(emptyState(),revision);clearDrafts();},'Delete all local data');
 default:return;
 }close();flash('Saved');
}
function taskFormForDay(id){taskForm(id,day(),true);dialog.querySelector('[name=date]').value=day();}
document.addEventListener('click',async ev=>{const target=ev.target.closest('[data-action]');if(!target||saving)return;if(dialog.open&&formDirty&&!['close','greet-pip','appearance-reset'].includes(target.dataset.action)){if(!confirm('Discard unsaved changes before continuing?'))return;formDirty=false;}saving=true;try{await act(target.dataset.action,target.dataset.id||'');}catch(err){if(dialog.open)dialog.querySelector('[role=alert]').textContent=err.message;else flash(err.message);}finally{saving=false;}});
root.addEventListener('input',ev=>{if(ev.target.matches('.quick-task input')){writeQuickDraft(ev.target.dataset.scope,ev.target.value);if(ev.target.value.length===1)gesture('listen');}});
root.addEventListener('submit',async ev=>{
 if(!ev.target.matches('.quick-task'))return;
 ev.preventDefault();if(saving)return;
 const input=ev.target.elements.title,title=input.value.trim();if(!title){input.focus();return;}
 saving=true;
 const submittedScope=input.dataset.scope,submittedValue=input.value;
 try{
  const next=await cmd('task.save',{title,date:day()});
  rememberCue(next.tasks.at(-1).id);render();const field=root.querySelector('.quick-task input');
  if(readQuickDraft(submittedScope)===submittedValue){writeQuickDraft(submittedScope,'');if(field?.dataset.scope===submittedScope){field.value='';field.focus({preventScroll:true});}}gesture('listen');flash('Task added');
 }catch(err){flash(err.message);}finally{saving=false;}
});
document.addEventListener('change',async ev=>{const el=ev.target;if(el.dataset.appearance){try{setAppearance(el.dataset.appearance,el.value);}catch{applyAppearance();flash('Could not save the appearance on this device.');}return;}if(el.name==='review-period'){period=el.value;render();root.querySelector('[name=review-period]:checked')?.focus({preventScroll:true});}
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
try{await openStore(await initializeAccount());subscribe(render);render();if(page()==='Today'&&!account()&&!s().revision&&!Object.keys(guideState()).length)openGuide(0);startSync();setInterval(tick,1000);if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>flash('Offline loading is unavailable in this browser.'));}catch(err){root.innerHTML='<main><h1>Workspace unavailable</h1><p>'+e(err.message)+'</p><a href="">Try again</a></main>';}

