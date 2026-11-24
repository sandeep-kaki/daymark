import {dayKey,addDays,weekStart,routineProgress,elapsedMs} from './domain.js';
import {esc as e,button as b,icon,displayDate,empty} from './ui.js';
export const screens=['Today','Plan','Goals','Journal','Review'];
const symbols=['sun','plan','goal','journal','review'];
export function shell(page,body){
 const links=screens.map((p,i)=>`<a href="#${p}" ${p===page?'aria-current="page"':''}>${icon(symbols[i])}${p}</a>`).join('');
 return `<aside><div class="brand"><span>◒</span> Daymark</div><nav aria-label="Workspace">${links}</nav><small>Personal workspace</small></aside><main><header><span>${e(page)}</span><div><small data-cloud-status></small>${b('Inbox','inbox','','quiet','inbox')}${b('Settings','settings','','quiet','settings')}</div></header><article>${body}</article></main><nav class="mobile" aria-label="Destinations">${links}</nav>`;
}
const title=(label,heading,actions='')=>`<section class="heading"><div><small>${e(label)}</small><h1>${e(heading)}</h1></div><div class="actions">${actions}</div></section>`;
const section=(name,body,action='')=>`<section class="panel"><div class="line"><h2>${e(name)}</h2>${action}</div>${body}</section>`;
const muted=s=>`<p class="muted">${e(s)}</p>`;
export function taskRow(t){return `<div class="row"><button class="circle" data-action="${t.archived?'edit':t.status==='done'?'reopen':'complete'}" data-id="${e(t.id)}" aria-label="${e((t.status==='done'?'Reopen ':'Complete ')+t.title)}">${t.status==='done'?icon('check'):'○'}</button><button class="item" data-action="edit" data-id="${e(t.id)}"><strong>${e(t.title)}</strong><small>${e([t.archived?'Archived':t.status==='partial'?'Partial progress':t.status==='done'?'Completed':t.date?displayDate(t.date):'Inbox',t.time,t.estimate?t.estimate+' min estimated':'Effort unknown'].filter(Boolean).join(' · '))}</small></button></div>`;}
function routines(s,day,manage){
 return s.routines.filter(r=>manage||!r.paused&&(!r.weekdays?.length||r.weekdays.includes(new Date(day+'T12:00').getDay()))).map(r=>{
 const p=routineProgress(s,r,day);return `<div class="row"><div class="grow"><strong>${e(r.title)}</strong><small>${r.paused?'Paused · ':r.restDays?.includes(day)?'Rest · ':''}${p.value} / ${r.target} ${e(r.unit)} · ${r.period}${r.minimum?' · Minimum '+e(r.minimum):''}</small></div>${!r.paused?b('Log','log-routine',r.id):''}${manage?b('Edit','routine',r.id):''}</div>`;}).join('')||muted('No routines scheduled.');
}
export function daily(s,day,plan){
 const today=dayKey(), tasks=s.tasks.filter(t=>t.date===day&&!t.archived), p=tasks.find(t=>t.priority&&t.status!=='done'),d=s.days?.[day]||{};
 const open=tasks.filter(t=>t.status!=='done'),known=open.reduce((n,t)=>n+(t.estimate||0),0),unknown=open.filter(t=>!t.estimate).length;
 const blocks=open.filter(t=>t.time).sort((a,b)=>a.time.localeCompare(b.time));const start=t=>+t.time.slice(0,2)*60 + +t.time.slice(3);
 const overlap=blocks.some((t,i)=>blocks.slice(0,i).some(a=>start(a)+a.estimate>start(t)));
 const planActions=plan?b('Add task','dated')+b('Day settings','day-settings'):b('Capture task','new')+b('Log work','work');
 let body=title(displayDate(day,{weekday:'long',month:'long',day:'numeric'}),plan?'Plan your day':day===today?'Today':'Tomorrow',planActions);
 body+=plan?`<label class="date">Plan for <input type="date" data-date="plan" value="${day}"></label>`:`<div class="switch">${b('Today','today','',day===today?'selected':'quiet')}${s.preferences.showTomorrow?b('Tomorrow','tomorrow','',day===today?'quiet':'selected'):''}</div>`;
 body+=`<section class="priority"><small>${icon('star')} DAILY PRIORITY</small><h2>${e(p?p.title:d.rest?'Rest day':plan?'What would make this day meaningful?':'Choose one thing that matters.')}</h2>${p?`${p.definition?muted('Done when · '+p.definition):''}${p.firstStep?`<div class="first"><small>First step</small>${e(p.firstStep)}</div>`:''}<div class="actions">${b('Complete','complete',p.id,'primary','check')}${b('Start','start',p.id)}${b("I’m stuck",'stuck',p.id)}${b('Edit','edit',p.id)}</div>`:`<div class="actions">${b('Choose one thing','choose','','primary','plus')}${!d.rest?b('Rest day','rest'):''}</div>`}</section>`;
 if(!d.rest&&s.preferences.coach!=='off'&&s.preferences.dismissedDay!==today){
 const deferrals=p?s.activities.filter(a=>a.kind==='rescheduled'&&a.entityId===p.id&&a.day>=addDays(today,-6)&&a.day<=today).length:0;
 const prompt=d.budget&&known>d.budget?'Your plan exceeds your time budget.':deferrals>=2?'You moved this priority twice this week. Would a smaller commitment fit?':p&&!p.firstStep?(s.preferences.coach==='direct'?'Choose your first action.':'A first step could make this easier to start.'):null;
 if(prompt)body+=`<div class="coach">${icon('spark')}<span>${prompt}</span>${b(p?'Adjust task':'Adjust budget',p?'edit':'day-settings',p?.id)}${b('Dismiss','dismiss')}</div>`;}
 if(overlap)body+=muted('Two planned time blocks overlap. Edit a task to adjust its start.');
 body+=section('Day checklist',muted(`${known} min estimated${d.budget?' / '+d.budget+' available':''}${unknown?' · '+unknown+' without estimates':''}`)+(tasks.filter(t=>t!==p).map(taskRow).join('')||muted('No supporting tasks for this day.')),b('Add task','dated'));
 if(s.focus){const f=s.focus;body+=section('Focus',`<strong>${e(s.tasks.find(t=>t.id===f.taskId)?.title)}</strong><p>${e(s.tasks.find(t=>t.id===f.taskId)?.firstStep)}</p><p><time id="elapsed">${Math.floor(elapsedMs(f)/60000)} min elapsed</time> · ${f.running?'Running':'Paused'}</p>${b(f.running?'Pause':'Resume',f.running?'focus.pause':'focus.resume')}${b('Extend 5 min','focus.extend')}${b('Finish session','focus.finish')}${b('Complete','complete',f.taskId)}`);}
 if(plan||s.preferences.showRoutines)body+=section('Routines',routines(s,day,plan),plan?b('New routine','routine'):'');
 return body+section('Your tasks',`<div class="actions">${b('Inbox','inbox')}${b('All tasks','all')}${b('Unfinished from earlier','missed')}</div>`);
}
export function goals(s){
 return title('Longer-term direction','Goals',b('New goal','goal','','primary','plus'))+(s.goals.map(g=>section(g.title,muted(g.why)+muted([g.state||'active',g.date].filter(Boolean).join(' · '))+g.milestones.map(m=>`<div class="row"><span class="grow">${e(m.title)}${m.week?muted("Week of "+displayDate(m.week)):""}</span>${b("Revise","milestone-edit",m.id)}${b(m.done?'Achieved':'Mark achieved','milestone-toggle',m.id)}</div>`).join('')+`<div class="actions">${b('Add milestone','milestone',g.id)}${b('Edit goal','goal',g.id)}${b('Update status','goal-state',g.id)}</div>`+evidence(s,g.id))).join('')||empty('What would you like to work toward?','Choose an outcome you’ll recognize when it happens.','goal','Create a goal','goal'));
}
function evidence(s,id){const facts=s.activities.filter(a=>a.goalId===id||s.tasks.some(t=>t.id===a.entityId&&t.goalId===id));return facts.length?'<details><summary>Linked activity ('+facts.length+')</summary>'+facts.map(fact).join('')+'</details>':'';}
function fact(a){return `<div class="record"><small>${e(displayDate(a.day))} · ${e(a.kind)}</small><strong>${e(a.label)}</strong>${a.detail?muted(a.detail):''}${a.from!==undefined?muted((a.from||'Inbox')+' → '+(a.to||'Inbox')):''}${a.original?muted('Previous scope · '+a.original+' '+(a.previousDefinition||'')):''}${a.minutes?muted(a.minutes+' min worked'):''}</div>`;}
function note(n){return `<div class="record"><small>${e(displayDate(n.day))} · ${e(n.kind)}</small><p>${e(n.body)}</p><div class="actions">${b('Edit','note',n.id)}${!n.convertedTaskId?b('Create follow-up','follow',n.id):''}</div></div>`;}
export function journal(s){return title('Activity and reflection','Journal',b('Log work','work')+b('Write an entry','note','','primary','plus'))+section('Your writing',[...s.notes].sort((a,b)=>b.day.localeCompare(a.day)).map(note).join('')||muted('Write down a moment, achievement or lesson.'))+section('Activity',[...s.activities].reverse().map(fact).join('')||muted('Your task activity and logged work appear here.'));}
export function review(s,day,period){
 const from=period==='week'?weekStart(day):period==='month'?day.slice(0,7)+'-01':day,to=period==='week'?addDays(from,6):period==='month'?dayKey(new Date(+day.slice(0,4),+day.slice(5,7),0)):day;
 const within=x=>x.day>=from&&x.day<=to;
 return title('Look back','Review',b(period==='month'?'Reassess a goal':'Record an experiment','experiment'))+`<div class="switch"><select aria-label="Review period" data-period>${['day','week','month'].map(x=>`<option ${period===x?'selected':''}>${x}</option>`).join('')}</select><input aria-label="Review date" type="date" data-date="review" value="${day}"></div>`+
 section('Goals and milestones',s.goals.map(g=>`<div class="record"><strong>${e(g.title)}</strong>${muted(g.milestones.map(m=>(m.done?'✓ ':'○ ')+m.title).join(' · ')||'No milestones yet')}${evidence({...s,activities:s.activities.filter(within)},g.id)}</div>`).join('')||muted('No goals yet.'))+
 section('Activity · '+displayDate(from)+' – '+displayDate(to),[...s.activities].filter(within).reverse().map(fact).join('')||muted('No recorded activity for this period.'))+
 section('Routine and focus logs',s.logs.filter(within).map(l=>{const r=s.routines.find(x=>x.id===l.routineId);return muted(displayDate(l.day)+' · '+r.title+' · '+l.value+' '+(l.unit||r.unit));}).concat(s.sessions.filter(within).map(x=>muted(displayDate(x.day)+' · Focus · '+x.minutes+' min'))).join('')||muted('No logs for this period.'))+
 section('Reflections',s.notes.filter(within).map(note).join('')||muted('No entries for this period.'));
}
