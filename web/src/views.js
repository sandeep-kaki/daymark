import {pip,pipLine} from './pip.js';
import {dayKey,addDays,weekStart,routineProgress,elapsedMs} from './domain.js';
import {esc as e,button as b,icon,displayDate,empty} from './ui.js';
export const screens=['Today','Plan','Goals','Journal','Review'];
const symbols=['sun','plan','goal','journal','review'];
export function navigationLinks(page){
 return screens.map((p,i)=>`<a href="#${p}" ${p===page?'aria-current="page"':''}>${icon(symbols[i])}${p}</a>`).join('');
}
export function shell(page,body){
 return `<main><header><div class="masthead"><button type="button" class="menu-button quiet" data-action="menu" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="navigation">${icon('menu')}</button><a class="wordmark" href="#Today">Daymark</a><span class="current-page">${e(page)}</span></div><div class="account-tools"><small data-cloud-status></small><button class="quiet mode-toggle" type="button" data-action="appearance-mode" aria-label="Appearance mode" title="Appearance mode">${icon('sun')}</button>${b('Settings','settings','','quiet','settings')}</div></header><article>${body}</article></main><nav class="mobile" aria-label="Destinations">${navigationLinks(page)}</nav>`;
}
const title=(label,heading,actions='')=>`<section class="heading"><div><small>${e(label)}</small><h1>${e(heading)}</h1></div><div class="actions">${actions}</div></section>`;
const section=(name,body,action='')=>`<section class="panel"><div class="line"><h2>${e(name)}</h2>${action}</div>${body}</section>`;
const muted=s=>`<p class="muted">${e(s)}</p>`;
export function taskRow(t){return `<div class="row"><button class="circle" data-action="${t.archived?'edit':t.status==='done'?'reopen':'complete'}" data-id="${e(t.id)}" aria-label="${e((t.status==='done'?'Reopen ':'Complete ')+t.title)}">${t.status==='done'?icon('check'):'○'}</button><button class="item" data-action="edit" data-id="${e(t.id)}"><strong>${e(t.title)}</strong><small>${e([t.archived?'Archived':t.status==='partial'?'Partial progress':t.status==='done'?'Completed':t.date?displayDate(t.date):'Inbox',t.time,t.estimate?t.estimate+' min estimated':'Effort unknown'].filter(Boolean).join(' · '))}</small></button></div>`;}
function routines(s,day,manage){
 return s.routines.filter(r=>manage||!r.paused&&(!r.weekdays?.length||r.weekdays.includes(new Date(day+'T12:00').getDay()))).map(r=>{
 const p=routineProgress(s,r,day);return `<div class="row"><div class="grow"><strong>${e(r.title)}</strong><small>${r.paused?'Paused · ':r.restDays?.includes(day)?'Rest · ':''}${p.value} / ${r.target} ${e(r.unit)} · ${r.period}${r.minimum?' · Minimum '+e(r.minimum):''}</small></div>${!r.paused?b('Log','log-routine',r.id):''}${manage?b('Edit','routine',r.id):''}</div>`;}).join('')||muted('No routines scheduled.');
}
export function daily(s,day,plan,cue){
 const today=dayKey(), tasks=s.tasks.filter(t=>t.date===day&&!t.archived), p=tasks.find(t=>t.priority&&t.status!=='done'),d=s.days?.[day]||{};
 const open=tasks.filter(t=>t.status!=='done'),known=open.reduce((n,t)=>n+(t.estimate||0),0),unknown=open.filter(t=>!t.estimate).length;
 const blocks=open.filter(t=>t.time).sort((a,b)=>a.time.localeCompare(b.time));const start=t=>+t.time.slice(0,2)*60 + +t.time.slice(3);
 const overlap=blocks.some((t,i)=>blocks.slice(0,i).some(a=>start(a)+a.estimate>start(t)));
 const planActions=plan?b('Add task','dated')+b('Day settings','day-settings'):'';
 let body=(plan?'':'<section class="morning-panel">')+title(displayDate(day,{weekday:'long',month:'long',day:'numeric'}),plan?'Plan your day':day===today?'Your morning.':'Tomorrow',planActions);
 if(!plan)body+='<form class="quick-task"><input name="title" required maxlength="180" aria-label="New task for this day" placeholder="What matters today?"><button class="primary" type="submit">Add</button></form>';
 body+=plan?`<label class="date">Plan for <input type="date" data-date="plan" value="${day}"></label>`:`<div class="switch">${b('Today','today','',day===today?'selected':'quiet')}${s.preferences.showTomorrow?b('Tomorrow','tomorrow','',day===today?'quiet':'selected'):''}</div>`;
 const completedIds=new Set(tasks.filter(t=>t.status==='done').map(t=>t.id));
 const finished=!plan&&!p&&!d.rest&&s.activities.findLast(a=>a.kind==='completed'&&a.previous?.priority&&a.day===day&&completedIds.has(a.entityId));
 const captured=cue?.day===day?s.tasks.find(t=>t.id===cue.id&&!t.archived):null;
 const next=!plan&&!p&&!d.rest&&!finished ? open[0] : null;
 const heading=p?.title||next?.title||(d.rest?'Rest day':finished?finished.label:plan?'What would make this day meaningful?':'Choose one thing that matters.');
 const label=finished?'Priority completed':next?'Up next':'Daily priority';
 const companion=!plan&&s.preferences.showCompanion!==false;
 const message=captured?.status==='done'?'What helped you finish this one?':captured?.firstStep||p?.firstStep||next?.firstStep||(finished?'What helped you finish this one?':d.rest?'Leave room for a slower day.':'Add one thing you’d like to do today.');
 const showCue=!plan&&!s.focus&&(s.preferences.coach!=='off'||p?.firstStep||next?.firstStep);
 const caption=captured?.status==='done'?'Reflection':captured&&captured.id!==(p||next)?.id?'First step · '+captured.title:p||next?'First step':finished?'Reflection':'Pip';
 const guidance=showCue?`<div class="pip-guidance">${companion?pip('rest'):''}<div><small>${e(caption==='Pip'&&!companion?'Today':caption)}</small><p class="pip-message">${e(message)}</p>${captured&&!finished&&captured.status==='done'?b('Write a reflection','note'):''}</div></div>`:'';
 let actions;
 if(p){
  actions=b('Start','start',p.id,'primary','play')+b('Complete','complete',p.id,'secondary','check')+b('I’m stuck','stuck',p.id)+b('Edit','edit',p.id);
 }else if(next){
  actions=b('Start','start',next.id,'primary','play')+b('Choose one thing','choose','','quiet','star');
 }else if(finished){
  actions=b('Write a reflection','note','','primary','journal')+b('Choose another priority','choose');
 }else{
  actions=b('Choose one thing','choose','','primary','plus')+(d.rest?'':b('Rest day','rest'));
 }
 body+=`<section class="priority "><div class="priority-copy"><small>${icon(finished?'check':'star')} ${label}</small><h2>${e(heading)}</h2>${p?.definition?muted('Done when · '+p.definition):''}${plan&&p?.firstStep?`<div class="first"><small>First step</small>${e(p.firstStep)}</div>`:''}<div class="actions">${actions}</div></div>${guidance}</section>`;
 if(!d.rest&&s.preferences.coach!=='off'&&s.preferences.dismissedDay!==today){
 const deferrals=p?s.activities.filter(a=>a.kind==='rescheduled'&&a.entityId===p.id&&a.day>=addDays(today,-6)&&a.day<=today).length:0;
 const prompt=d.budget&&known>d.budget?'Your plan exceeds your time budget.':deferrals>=2?'You moved this priority twice this week. Would a smaller commitment fit?':p&&!p.firstStep?(s.preferences.coach==='direct'?'Choose your first action.':'A first step could make this easier to start.'):null;
 if(prompt)body+=`<div class="coach">${icon('spark')}<span>${prompt}</span>${b(p?'Adjust task':'Adjust budget',p?'edit':'day-settings',p?.id)}${b('Dismiss','dismiss')}</div>`;}
 if(overlap)body+=muted('Two planned time blocks overlap. Edit a task to adjust its start.');
 const supporting=tasks.filter(t=>t!==p);
 if(plan||supporting.length){
  const budget=plan?muted(`${known} min estimated${d.budget?' / '+d.budget+' available':''}${unknown?' · '+unknown+' without estimates':''}`):'';
  body+=section('Day checklist',budget+(supporting.map(taskRow).join('')||muted('No supporting tasks for this day.')));
 }
 if(!plan)body+='</section>';
 if(s.focus){const f=s.focus;body+=section('Focus',(plan?'':pipLine(companion,'focus',s.focus.running?'One task for this session.':'Take your time. Resume when you’re ready.'))+`<strong>${e(s.tasks.find(t=>t.id===f.taskId)?.title)}</strong><p>${e(s.tasks.find(t=>t.id===f.taskId)?.firstStep)}</p><p><time id="elapsed">${Math.floor(elapsedMs(f)/60000)} min elapsed</time> · ${f.running?'Running':'Paused'}</p>${b(f.running?'Pause':'Resume',f.running?'focus.pause':'focus.resume')}${b('Extend 5 min','focus.extend')}${b('Finish session','focus.finish')}${b('Complete','complete',f.taskId)}`);}
 const weekday=new Date(day+'T12:00').getDay();
 if(plan||(s.preferences.showRoutines&&s.routines.some(r=>!r.paused&&(!r.weekdays?.length||r.weekdays.includes(weekday)))))body+=section('Routines',routines(s,day,plan),plan?b('New routine','routine'):'');
 if(plan)return body+section('Your tasks',`<div class="actions">${b('Inbox','inbox')}${b('All tasks','all')}${b('Unfinished from earlier','missed')}</div>`);
 const entry=s.notes.filter(n=>n.day<=day).sort((a,b)=>b.day.localeCompare(a.day)||String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
 if(entry)body+=`<section class="journal-excerpt"><small>From your journal · ${e(displayDate(entry.day))}</small><p class="journal-text">${e(entry.body.slice(0,220))}${entry.body.length>220?'…':''}</p>${b('Open entry','note',entry.id,'quiet','journal')}</section>`;
 return body+`<footer class="today-footer">${b('Capture task','new','','quiet','inbox')}<a href="#Plan">${icon('plan')} Open plan</a><a href="#Journal">${icon('journal')} Open journal</a></footer>`;
}
export function goals(s){
 return title('Longer-term direction','Goals',b('New goal','goal','','primary','plus'))+(s.goals.map(g=>section(g.title,muted(g.why)+muted([g.state||'active',g.date].filter(Boolean).join(' · '))+g.milestones.map(m=>`<div class="row"><span class="grow">${e(m.title)}${m.week?muted("Week of "+displayDate(m.week)):""}</span>${b("Revise","milestone-edit",m.id)}${b(m.done?'Achieved':'Mark achieved','milestone-toggle',m.id)}</div>`).join('')+`<div class="actions">${b('Add milestone','milestone',g.id)}${b('Edit goal','goal',g.id)}${b('Update status','goal-state',g.id)}</div>`+evidence(s,g.id))).join('')||empty('What would you like to work toward?','Choose an outcome you’ll recognize when it happens.','goal','Create a goal','goal'));
}
function evidence(s,id){const facts=s.activities.filter(a=>a.goalId===id||s.tasks.some(t=>t.id===a.entityId&&t.goalId===id));return facts.length?'<details><summary>Linked activity ('+facts.length+')</summary>'+facts.map(fact).join('')+'</details>':'';}
function fact(a){return `<div class="record"><small>${e(displayDate(a.day))} · ${e(a.kind)}</small><strong>${e(a.label)}</strong>${a.detail?muted(a.detail):''}${a.from!==undefined?muted((a.from||'Inbox')+' → '+(a.to||'Inbox')):''}${a.original?muted('Previous scope · '+a.original+' '+(a.previousDefinition||'')):''}${a.minutes?muted(a.minutes+' min worked'):''}</div>`;}
function note(n){return `<div class="record"><small>${e(displayDate(n.day))} · ${e(n.kind)}</small><p>${e(n.body)}</p><div class="actions">${b('Edit','note',n.id)}${!n.convertedTaskId?b('Create follow-up','follow',n.id):''}</div></div>`;}
export function journal(s){return title('Activity and reflection','Journal',b('Log work','work')+b('Write an entry','note','','primary','plus'))+(s.preferences.showCompanion===false?'':pipLine(true,'rest','What would you like to remember about today?'))+section('Your writing',[...s.notes].sort((a,b)=>b.day.localeCompare(a.day)).map(note).join('')||muted('Write down a moment, achievement or lesson.'))+section('Activity',[...s.activities].reverse().map(fact).join('')||muted('Your task activity and logged work appear here.'));}
export function review(s,day,period){
 const from=period==='week'?weekStart(day):period==='month'?day.slice(0,7)+'-01':day,to=period==='week'?addDays(from,6):period==='month'?dayKey(new Date(+day.slice(0,4),+day.slice(5,7),0)):day;
 const within=x=>x.day>=from&&x.day<=to;
 return title('Look back','Review',b(period==='month'?'Reassess a goal':'Record an experiment','experiment'))+`<div class="switch"><select aria-label="Review period" data-period>${['day','week','month'].map(x=>`<option ${period===x?'selected':''}>${x}</option>`).join('')}</select><input aria-label="Review date" type="date" data-date="review" value="${day}"></div>`+
 (s.preferences.showCompanion!==false&&s.activities.some(a=>a.kind==='completed'&&within(a))?pipLine(true,'rest','Completed this period · '+s.activities.findLast(a=>a.kind==='completed'&&within(a)).label):'')+
 section('Goals and milestones',s.goals.map(g=>`<div class="record"><strong>${e(g.title)}</strong>${muted(g.milestones.map(m=>(m.done?'✓ ':'○ ')+m.title).join(' · ')||'No milestones yet')}${evidence({...s,activities:s.activities.filter(within)},g.id)}</div>`).join('')||muted('No goals yet.'))+
 section('Activity · '+displayDate(from)+' – '+displayDate(to),[...s.activities].filter(within).reverse().map(fact).join('')||muted('No recorded activity for this period.'))+
 section('Routine and focus logs',s.logs.filter(within).map(l=>{const r=s.routines.find(x=>x.id===l.routineId);return muted(displayDate(l.day)+' · '+r.title+' · '+l.value+' '+(l.unit||r.unit));}).concat(s.sessions.filter(within).map(x=>muted(displayDate(x.day)+' · Focus · '+x.minutes+' min'))).join('')||muted('No logs for this period.'))+
 section('Reflections',s.notes.filter(within).map(note).join('')||muted('No entries for this period.'));
}
