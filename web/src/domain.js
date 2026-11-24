// Pure domain rules. The same commands run in the browser and in Node tests.
export const VERSION = 1;
export const uid = () => crypto.randomUUID();
export function dayKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function addDays(day, count) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate()+count); return dayKey(d); }
export function weekStart(day) { const d = new Date(day+'T12:00:00'); return addDays(day, -(d.getDay()+6)%7); }
export function isDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+'T12:00:00')) && dayKey(s+'T12:00:00') === s; }
export function emptyState() { return {version:VERSION, revision:0, tasks:[], goals:[], routines:[], logs:[], notes:[], activities:[], sessions:[], focus:null, preferences:{theme:'system',showRoutines:true,showTomorrow:true}, sample:false}; }
function fail(message) { throw new Error(message); }
function title(s) { if (typeof s !== 'string' || !s.trim() || s.trim().length>180) fail('Add a title of 1–180 characters.'); return s.trim(); }
function text(s = '', max = 20000) { if (typeof s !== 'string' || s.length > max) fail(`Keep this text under ${max.toLocaleString()} characters.`); return s.trim(); }
function amount(value, max = 100000) { const n = Number(value); if (!Number.isFinite(n) || n <= 0 || n > max) fail(`Enter a number greater than 0 and no more than ${max}.`); return n; }
function get(items, id) { const item = items.find(x => x.id === id); if (!item) fail('This item is no longer available. Please reopen it.'); return item; }
function validDate(d, optional = true) { if (!(optional && d === '') && !isDay(d)) fail('Choose a valid date.'); return d; }
function goalLink(s, id) { if (id) get(s.goals, id); return id || ''; }
export function elapsedMs(focus, now = Date.now()) { return focus ? focus.elapsedMs + (focus.running ? Math.max(0, now - focus.resumedAt) : 0) : 0; }
export function applyCommand(input, command, now = new Date()) {
  const s = structuredClone(input), c = command, at = now.toISOString(), today = dayKey(now);
  if(c.commandId && s.commands?.includes(c.commandId)) return input;
  if(c.expectedRevision != null && s.revision !== c.expectedRevision) fail('This workspace changed. Reopen the form to review the latest version.');
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const activity = (kind, entityId, label, extra = {}) => s.activities.push({id:uid(),kind,entityId,label,at,day:today,zone,...(c.commandId?{commandId:c.commandId}:{}),...extra});
  const primary = task => {
    if(!task.date || task.archived || task.status==='done') fail('Choose an unfinished dated task.');
    s.tasks.filter(t=>t.date===task.date).forEach(t=>t.priority=false);
    task.priority=true;
    activity('priority chosen',task.id,task.title,{plannedDay:task.date,definition:task.definition||'',goalId:task.goalId});
    (s.days??={})[task.date]={...s.days[task.date],rest:false,zone};
  };
  switch (c.type) {
    case 'task.save': {
      const old = c.id ? get(s.tasks,c.id) : null;
      const date = validDate(c.date || '');
      const time = c.time || '';
      if (time && (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) fail('A time block needs a valid date and start time.');
      const estimate = c.estimate === '' || c.estimate == null ? null : amount(c.estimate,1440);
      if (time && !estimate) fail('Add a duration for your time block.');
      const task = {...old, id:old?.id || uid(), title:title(c.title), date, time, estimate, firstStep:text(c.firstStep || '',500), goalId:goalLink(s,c.goalId), status:old?.status || 'open', completedAt:old?.completedAt || null, completedDay:old?.completedDay || '', createdAt:old?.createdAt || at, updatedAt:at, priority:old?.priority || false, moves:old?.moves || 0, unplanned:old?.unplanned || !!c.unplanned, archived:false};
      if (old && old.date !== date) { task.moves++; task.priority=false; activity('rescheduled',task.id,task.title,{from:old.date,to:date}); }
      for(const key of ['definition','cue','fallback','preparation','notes']) task[key]=text(c[key]??old?.[key]??'',2000);
      task.milestoneId=c.milestoneId??old?.milestoneId??'';
      if(task.milestoneId&&!s.goals.find(g=>g.id===task.goalId)?.milestones.some(m=>m.id===task.milestoneId))fail('Choose a milestone from the linked goal.');
      task.remind=c.remind===undefined?!!old?.remind:!!c.remind;
      if(task.remind&&!time)fail('Choose a start time for the reminder.');
      task.reminderKey=task.remind?date+'T'+time:'';
      task.deadline=validDate(c.deadline??old?.deadline??'');
      if(old && (old.title!==task.title || old.definition!==task.definition)) activity('scope changed',task.id,task.title,{original:old.title,previousDefinition:old.definition||'',definition:task.definition});
      if (old) Object.assign(old,task); else { s.tasks.push(task); activity('captured',task.id,task.title); }
      if(c.primary) primary(old||task);
      if (c.unplanned && !old) { task.status='done'; task.completedAt=at; task.completedDay=today; activity('completed',task.id,task.title); }
      break;
    }
    case 'task.toggle': {
      const task=get(s.tasks,c.id); if (task.archived) fail('This task is archived.');
      // Set a desired state, so duplicate events cannot complete then reopen a task.
      if (!['open','done','partial'].includes(c.status)) fail('Unknown task status.');
      if (task.status === c.status) return input;
      const previous={status:task.status,priority:task.priority};
      task.status=c.status; task.completedAt=c.status==='done'?at:null; task.completedDay=c.status==='done'?today:''; task.updatedAt=at;
      if(c.status==='done') task.priority=false;
      activity(c.status==='done'?'completed':c.status==='partial'?'partial':'reopened',task.id,task.title,{previous,goalId:task.goalId});
      break;
    }
    case 'task.priority': {
      const task=get(s.tasks,c.id); if (!task.date || task.archived) fail('Plan this task for a day first.');
      primary(task); break;
    }
    case 'task.archive': { const t=get(s.tasks,c.id); t.archived=!t.archived; t.priority=false; activity(t.archived?'archived':'restored',t.id,t.title); break; }
    case 'task.undo': {
      const event=get(s.activities,c.eventId),t=get(s.tasks,event.entityId);
      if(event.kind!=='completed'||t.status!=='done'||event.at!==t.updatedAt||s.activities.filter(a=>a.entityId===t.id&&(a.kind==='completed'||a.kind==='reopened'||a.kind==='undone')).at(-1)?.id!==event.id) fail('This completion has changed.');
      t.status=event.previous?.status||'open'; t.completedAt=null;t.completedDay='';t.updatedAt=at;
      t.priority=!!event.previous?.priority&&!s.tasks.some(x=>x.date===t.date&&x.priority);
      activity('undone',t.id,t.title,{reverses:event.id});break;
    }
    case 'task.delete': {
      get(s.tasks,c.id); s.tasks=s.tasks.filter(t=>t.id!==c.id);s.activities=s.activities.filter(a=>a.entityId!==c.id);s.activities.filter(a=>a.taskId===c.id).forEach(a=>a.taskId='');
      s.notes.filter(n=>n.convertedTaskId===c.id).forEach(n=>n.convertedTaskId='');
      s.sessions=s.sessions.filter(x=>x.taskId!==c.id);if(s.focus?.taskId===c.id)s.focus=null;break;
    }
    case 'day.save': {
      const day=validDate(c.day,false);s.days??={};s.days[day]={zone,rest:!!c.rest,budget:c.budget?amount(c.budget,1440):null};
      if(c.rest) s.tasks.filter(t=>t.date===day).forEach(t=>t.priority=false);
      activity(c.rest?'rest day':'day planned',day,day,{day});break;
    }
    case 'reminder.fire': {const t=get(s.tasks,c.id);if(!t.remind||t.archived||t.status==='done'||t.reminderKey!==c.key||t.deliveredKey===c.key)return input;t.deliveredKey=c.key;break;}
    case 'task.start': case 'task.progress': {
      const t=get(s.tasks,c.id);if(t.archived||t.status==='done')fail('Choose an unfinished task.');
      if(c.type==='task.progress')t.status='partial';
      activity(c.type==='task.start'?'started':'partial',t.id,t.title,{detail:text(c.detail||'',2000),goalId:t.goalId});break;
    }
    case 'work.log': {
      const start=c.start||'',end=c.end||'';
      if(start||end){if(![start,end].every(t=>/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t))||end<=start)fail('Choose an end time after the start time.');}
      const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
      if(c.taskId)get(s.tasks,c.taskId);
      activity('unexpected work',uid(),title(c.title),{day:validDate(c.day,false),minutes:start?minutes(end)-minutes(start):c.minutes?amount(c.minutes,1440):null,start,end,taskId:c.taskId||'',detail:text(c.detail||'',2000),goalId:goalLink(s,c.goalId)});break;
    }
    case 'goal.state': {const g=get(s.goals,c.id);if(!['active','paused','achieved'].includes(c.state))fail('Invalid goal state.');g.state=c.state;activity(c.state,g.id,g.title,{detail:text(c.detail||'',2000)});break;}
    case 'goal.save': {
      const old=c.id?get(s.goals,c.id):null;
      const goal={...old,id:old?.id||uid(),title:title(c.title),why:text(c.why||'',2000),date:validDate(c.date||''),milestones:old?.milestones||[],archived:old?.archived||false,createdAt:old?.createdAt||at};
      if (old) Object.assign(old,goal); else s.goals.push(goal); break;
    }
    case 'goal.archive': { const g=get(s.goals,c.id); g.archived=!g.archived; break; }
    case 'milestone.add': { const g=get(s.goals,c.goalId); g.milestones.push({id:uid(),week:weekStart(validDate(c.week||today,false)),title:title(c.title),done:false,completedAt:null,completedDay:''}); break; }
    case 'milestone.edit': {const m=get(get(s.goals,c.goalId).milestones,c.id);(m.revisions??=[]).push({at,title:m.title,week:m.week||''});m.title=title(c.title);m.week=weekStart(validDate(c.week,false));break;}
    case 'milestone.toggle': {
      const g=get(s.goals,c.goalId), m=get(g.milestones,c.id); m.done=!m.done; m.completedAt=m.done?at:null; m.completedDay=m.done?today:'';
      activity(m.done?'milestone':'milestone-reopened',g.id,m.title); break;
    }
    case 'routine.save': {
      const old=c.id?get(s.routines,c.id):null;
      if (!['check','count','minutes'].includes(c.kind) || !['daily','weekly'].includes(c.period)) fail('Choose a routine type and frequency.');
      if (old && (old.kind!==c.kind || old.period!==c.period)) fail('Create a new routine to change its measurement. This keeps old logs meaningful.');
      const routine={id:old?.id||uid(),title:title(c.title),kind:c.kind,period:c.period,target:c.kind==='check'&&c.period==='daily'?1:amount(c.target),step:c.kind==='check'?1:amount(c.step),unit:c.kind==='minutes'?'minutes':c.kind==='check'?'sessions':title(c.unit||'times'),goalId:goalLink(s,c.goalId),paused:old?.paused||false,createdAt:old?.createdAt||at};
      routine.weekdays=Array.isArray(c.weekdays)?c.weekdays.filter(n=>Number.isInteger(n)&&n>=0&&n<=6):[];
      routine.minimum=text(c.minimum||'',180);routine.cue=text(c.cue||'',500);
      routine.revisions=[...(old?.revisions||[]),{day:today,target:routine.target,unit:routine.unit,weekdays:routine.weekdays}];
      if (old) Object.assign(old,routine); else s.routines.push(routine); break;
    }
    case 'routine.pause': { const r=get(s.routines,c.id); r.paused=!r.paused; break; }
    case 'routine.log': {
      const r=get(s.routines,c.id); if(r.paused) fail('Resume this routine to log it.');
      const day=validDate(c.day||today,false), value=r.kind==='check'?1:amount(c.value??r.step);
      if (r.kind==='check' && r.period==='daily' && s.logs.some(l=>l.routineId===r.id&&l.day===day)) return input;
      s.logs.push({id:uid(),routineId:r.id,day,value,at,unit:r.unit}); break;
    }
    case 'routine.undo': { const index=s.logs.findIndex(l=>l.id===c.id); if(index>=0) s.logs.splice(index,1); break; }
    case 'routine.correct': {const l=get(s.logs,c.id),r=get(s.routines,l.routineId);l.value=r.kind==='check'?1:amount(c.value);l.correctedAt=at;break;}
    case 'routine.rest': {const r=get(s.routines,c.id),day=validDate(c.day,false);if(!(r.restDays??=[]).includes(day))r.restDays.push(day);activity('routine rest',r.id,r.title,{day});break;}
    case 'note.save': {
      if (!['entry','win','lesson','idea','review'].includes(c.kind)) fail('Choose a journal category.');
      const old=c.id?get(s.notes,c.id):null, body=text(c.body);
      if(!body) fail('Write a little something first.');
      const note={id:old?.id||uid(),kind:c.kind,body,day:validDate(c.day||today,false),goalId:goalLink(s,c.goalId),createdAt:old?.createdAt||at,updatedAt:at,convertedTaskId:old?.convertedTaskId||''};
      note.revision=(old?.revision||0)+1;if(old) Object.assign(old,note); else s.notes.push(note); break;
    }
    case 'note.delete': { get(s.notes,c.id); s.notes=s.notes.filter(n=>n.id!==c.id); break; }
    case 'note.to-task': {
      const note=get(s.notes,c.id); if(note.convertedTaskId) return input;
      const taskId=uid(); s.tasks.push({id:taskId,title:title(c.title||note.body.slice(0,180)),date:'',time:'',estimate:null,firstStep:'',goalId:note.goalId,status:'open',completedAt:null,completedDay:'',createdAt:at,updatedAt:at,priority:false,moves:0,unplanned:false,archived:false});
      note.convertedTaskId=taskId; activity('captured',taskId,'Created follow-up task'); break;
    }
    case 'focus.start': {
      if(s.focus) fail('Finish your current focus session first.');
      const t=get(s.tasks,c.id); if(t.archived||t.status==='done') fail('Choose an unfinished task.');
      s.focus={id:uid(),taskId:t.id,startedAt:at,resumedAt:now.getTime(),elapsedMs:0,running:true,targetMinutes:c.minutes?amount(c.minutes,1440):25};break;
    }
    case 'focus.pause': { if(s.focus?.running) { s.focus.elapsedMs=elapsedMs(s.focus,now.getTime()); s.focus.running=false; } break; }
    case 'focus.resume': { if(s.focus&&!s.focus.running) { s.focus.resumedAt=now.getTime(); s.focus.running=true; } break; }
    case 'focus.finish': {
      if(!s.focus) return input;
      const duration=c.minutes==null?elapsedMs(s.focus,now.getTime())/60000:amount(c.minutes,1440);
      if(duration>1440) fail('This timer ran for more than a day. Enter the minutes you actually worked.');
      if(duration>=0.1) s.sessions.push({id:s.focus.id,taskId:s.focus.taskId,day:today,minutes:Math.round(duration*10)/10,startedAt:s.focus.startedAt,endedAt:at});
      s.focus=null; break;
    }
    case 'focus.discard': s.focus=null; break;
    case 'focus.extend': if(s.focus)s.focus.targetMinutes=(s.focus.targetMinutes||25)+5;break;
    case 'preferences': {
      if(c.theme&&!['light','dark','system'].includes(c.theme)) fail('Unknown theme.');
      for(const key of ['theme','showRoutines','showTomorrow','coach','dismissedDay','prepTime','morningTime','quietStart','quietEnd','reminderDays']) if(c[key]!==undefined) s.preferences[key]=c[key]; break;
    }
    default: fail('Unknown action.');
  }
  if(c.commandId)(s.commands??=[]).push(c.commandId);
  s.revision++;
  return s;
}
export function routineProgress(s,r,day) {
  const from=r.period==='weekly'?weekStart(day):day, to=r.period==='weekly'?addDays(from,6):day;
  const logs=s.logs.filter(l=>l.routineId===r.id&&l.day>=from&&l.day<=to);
  return {value:logs.reduce((n,l)=>n+l.value,0),target:r.target,logs};
}
export function weekSummary(s,day) {
  const from=weekStart(day),to=addDays(from,6), inside=d=>d>=from&&d<=to;
  return {from,to,completed:s.tasks.filter(t=>t.status==='done'&&inside(t.completedDay)),planned:s.tasks.filter(t=>!t.archived&&!t.unplanned&&inside(t.date)),partial:s.tasks.filter(t=>!t.archived&&t.status==='partial'&&inside(t.date)),sessions:s.sessions.filter(x=>inside(x.day)),notes:s.notes.filter(n=>inside(n.day)),activities:s.activities.filter(a=>inside(a.day))};
}

// Validate imported data before a replacement transaction begins. Unknown fields
// are harmless data, never interpreted as markup or executable instructions.
export function validateState(s) {
  const error=()=>fail('This is not a valid Daymark v1 backup. Nothing was replaced.');
  if(!s||typeof s!=='object'||s.version!==VERSION||!Number.isInteger(s.revision)||s.revision<0) error();
  const str=(v,max=20000)=>typeof v==='string'&&v.length<=max;
  const id=v=>str(v,100)&&v.length>0;
  const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const date=v=>v===''||isDay(v);
  const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
  const bool=v=>typeof v==='boolean';
  const nullableStamp=v=>v===null||stamp(v);
  for(const key of ['tasks','goals','routines','logs','notes','activities','sessions']) {
    if(!Array.isArray(s[key])||s[key].length>100000) error();
    const ids=new Set(); for(const x of s[key]) { if(!x||!id(x.id)||ids.has(x.id)) error(); ids.add(x.id); }
  }
  const goalIds=new Set(s.goals.map(g=>g.id)),taskIds=new Set(s.tasks.map(t=>t.id)),routineIds=new Set(s.routines.map(r=>r.id));
  const link=g=>g===''||goalIds.has(g);
  for(const g of s.goals) {
    if(!str(g.title,180)||!g.title.trim()||!str(g.why,2000)||!date(g.date)||!bool(g.archived)||!stamp(g.createdAt)||!Array.isArray(g.milestones)||g.milestones.length>1000) error();
    const ids=new Set();
    for(const m of g.milestones) { if(!id(m.id)||ids.has(m.id)||!str(m.title,180)||!m.title.trim()||!bool(m.done)||!nullableStamp(m.completedAt)||!date(m.completedDay)||(m.done&&(!m.completedAt||!m.completedDay))) error(); ids.add(m.id); }
  }
  for(const t of s.tasks) if(!str(t.title,180)||!t.title.trim()||!date(t.date)||!str(t.time,5)||(t.time&&(!t.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)))||!(t.estimate===null||(num(t.estimate)&&t.estimate>0&&t.estimate<=1440))||(t.time&&!t.estimate)||!str(t.firstStep,500)||!link(t.goalId)||!['open','partial','done'].includes(t.status)||!nullableStamp(t.completedAt)||!date(t.completedDay)||(t.status==='done'&&(!t.completedAt||!t.completedDay))||!stamp(t.createdAt)||!stamp(t.updatedAt)||!bool(t.priority)||!bool(t.unplanned)||!bool(t.archived)||!Number.isInteger(t.moves)||t.moves<0) error();
  for(const r of s.routines) if(!str(r.title,180)||!r.title.trim()||!['check','count','minutes'].includes(r.kind)||!['daily','weekly'].includes(r.period)||!num(r.target)||r.target<=0||r.target>100000||!num(r.step)||r.step<=0||r.step>100000||!str(r.unit,180)||!link(r.goalId)||!bool(r.paused)||!stamp(r.createdAt)) error();
  const dailyChecks=new Set();
  for(const l of s.logs) {
    if(!routineIds.has(l.routineId)||!isDay(l.day)||!num(l.value)||l.value<=0||l.value>100000||!stamp(l.at)) error();
    const r=s.routines.find(r=>r.id===l.routineId);
    if(r.kind==='check') { if(l.value!==1) error(); if(r.period==='daily') { const key=r.id+l.day; if(dailyChecks.has(key)) error(); dailyChecks.add(key); } }
  }
  for(const n of s.notes) if(!['entry','win','lesson','idea','review'].includes(n.kind)||!str(n.body)||!n.body.trim()||!isDay(n.day)||!link(n.goalId)||!stamp(n.createdAt)||!stamp(n.updatedAt)||!(n.convertedTaskId===''||taskIds.has(n.convertedTaskId))) error();
  for(const a of s.activities) if(!str(a.kind,50)||!id(a.entityId)||!str(a.label,500)||!stamp(a.at)||!isDay(a.day)) error();
  for(const x of s.sessions) if(!taskIds.has(x.taskId)||!isDay(x.day)||!num(x.minutes)||x.minutes>1440||!stamp(x.startedAt)||!stamp(x.endedAt)) error();
  if(s.focus!==null&&(!s.focus||!id(s.focus.id)||!taskIds.has(s.focus.taskId)||!stamp(s.focus.startedAt)||!num(s.focus.resumedAt)||!num(s.focus.elapsedMs)||!bool(s.focus.running))) error();
  if(!s.preferences||!['light','dark','system'].includes(s.preferences.theme)||!bool(s.preferences.showRoutines)||!bool(s.preferences.showTomorrow)||!bool(s.sample)) error();
  const primaries=new Set();
  for(const t of s.tasks){for(const k of ['definition','cue','fallback','preparation','notes'])if(t[k]!==undefined&&!str(t[k],2000))error();if(t.deadline&&!isDay(t.deadline))error();if(t.remind!==undefined&&!bool(t.remind))error();if(t.milestoneId&&!s.goals.find(g=>g.id===t.goalId)?.milestones.some(m=>m.id===t.milestoneId))error();}
  for(const r of s.routines){if(r.restDays!==undefined&&(!Array.isArray(r.restDays)||!r.restDays.every(isDay)))error();}
  const states=['active','paused','achieved'];for(const g of s.goals)if(g.state&&!states.includes(g.state))error();
  for(const a of s.activities)if((a.goalId&&!goalIds.has(a.goalId))||(a.taskId&&!taskIds.has(a.taskId)))error();
  for(const t of s.tasks)if(t.priority){if(!t.date||primaries.has(t.date))error();primaries.add(t.date);}
  if(s.days!==undefined){if(!s.days||Array.isArray(s.days)||typeof s.days!=='object')error();
    for(const [day,d] of Object.entries(s.days))if(!isDay(day)||!d||!bool(d.rest)||!str(d.zone,100)||(d.budget!=null&&(!num(d.budget)||d.budget>1440)))error();}
  if(s.commands!==undefined&&(!Array.isArray(s.commands)||!s.commands.every(id)||new Set(s.commands).size!==s.commands.length))error();
  if(s.preferences.reminderDays!==undefined&&(!Array.isArray(s.preferences.reminderDays)||!s.preferences.reminderDays.every(num)))error();
  for(const r of s.routines)if(r.weekdays!==undefined&&(!Array.isArray(r.weekdays)||!r.weekdays.every(n=>Number.isInteger(n)&&n>=0&&n<=6)))error();
  return s;
}
export function parseBackup(raw) {
  if(typeof raw!=='string'||raw.length>10*1024*1024) fail('Choose a Daymark JSON backup smaller than 10 MB.');
  let data; try {data=JSON.parse(raw);} catch {fail('This file is not valid JSON. Nothing was replaced.');}
  if(data?.format==='daymark-workspace'){if(data.schemaVersion!==1)fail('Unsupported backup version.');data=data.payload;}
  return validateState(data);
}
export function sampleState(day=dayKey()) {
  let s=emptyState(); const now=new Date(day+'T10:00:00');
  const run=c=>{s=applyCommand(s,c,now);};
  run({type:'goal.save',title:'Build a portfolio I’m proud of',why:'Turn learning into work I can share.',date:addDays(day,60)});
  const goal=s.goals[0].id;
  run({type:'milestone.add',goalId:goal,title:'Choose a project that solves a real problem'});
  run({type:'milestone.add',goalId:goal,title:'Share a working first version'});
  run({type:'milestone.toggle',goalId:goal,id:s.goals[0].milestones[0].id});
  run({type:'task.save',title:'Sketch the first screen of my project',date:day,time:'',estimate:45,firstStep:'Open a blank page and draw the main action.',goalId:goal});
  run({type:'task.priority',id:s.tasks[0].id});
  run({type:'task.save',title:'Practise a few interview questions',date:day,time:'16:00',estimate:30});
  run({type:'task.save',title:'Take a walk without my phone',date:day,time:'',estimate:20});
  run({type:'task.save',title:'Send a thank-you note',date:day});run({type:'task.toggle',id:s.tasks[3].id,status:'done'});
  run({type:'task.save',title:'Build the first small interaction',date:addDays(day,1),estimate:45,goalId:goal});
  run({type:'task.save',title:'Explore ideas for a weekend project'});
  run({type:'routine.save',title:'Read a little',kind:'count',period:'daily',target:10,step:5,unit:'pages'});
  run({type:'routine.save',title:'Make time to move',kind:'check',period:'weekly',target:3});
  run({type:'routine.save',title:'Practise with intention',kind:'minutes',period:'daily',target:25,step:10,goalId:goal});
  run({type:'routine.log',id:s.routines[0].id,value:5});
  run({type:'note.save',kind:'lesson',body:'Starting with a small sketch made the project feel less overwhelming.',day,goalId:goal});
  s.sample=true; return s;
}
