import {dayKey,addDays,weekStart} from './domain.js';
import {displayDate,icon} from './ui.js';

// A month change keeps the day number where possible (Jan 31 → Feb 28).
function shiftMonth(day,delta){
 const date=new Date(day+'T12:00:00'),number=date.getDate();
 date.setDate(1);
 date.setMonth(date.getMonth()+delta+1,0);
 date.setDate(Math.min(number,date.getDate()));
 return dayKey(date);
}

export function installCalendar(onSelect){
 const panel=document.querySelector('#daymark-calendar');
 const heading=panel.querySelector('h2'),grid=panel.querySelector('.calendar-days');
 let cursor,selected,scope,unit;
 const trigger=()=>document.querySelector('[data-calendar="'+scope+'"]');
 function monthChoices(){
  const year=cursor.slice(0,4),currentMonth=dayKey().slice(0,7);
  const buttons=document.createDocumentFragment();
  for(let number=1;number<=12;number++){
   const month=year+'-'+String(number).padStart(2,'0'),date=month+'-01';
   const button=document.createElement('button');
   button.type='button';button.dataset.day=date;
   button.textContent=displayDate(date,{month:'short'});
   button.setAttribute('aria-label',displayDate(date,{month:'long',year:'numeric'}));
   button.setAttribute('aria-pressed',String(selected.startsWith(month)));
   if(month===currentMonth)button.setAttribute('aria-current','date');
   button.tabIndex=cursor.startsWith(month)?0:-1;
   buttons.append(button);
  }
  return buttons;
 }
 function draw(focusDay){
  heading.textContent=displayDate(cursor,unit==='month'?{year:'numeric'}:{month:'long',year:'numeric'});
  grid.replaceChildren(unit==='month'?monthChoices():dayChoices());
  if(focusDay)grid.querySelector('[tabindex="0"]').focus({preventScroll:true});
 }
 function dayChoices(){
  const month=cursor.slice(0,7),first=month+'-01',start=weekStart(first),today=dayKey();
  const days=document.createDocumentFragment();
  const firstOfNext=shiftMonth(first,1);
  const week=unit==='week'?weekStart(selected):'',endOfWeek=week?addDays(week,6):'';
  for(let i=0;i<42;i++){
   const date=addDays(start,i),inMonth=date.startsWith(month);
   if(i%7===0&&date>=firstOfNext)break;
   const button=document.createElement('button');
   button.type='button';button.dataset.day=date;button.textContent=String(Number(date.slice(-2)));
   button.tabIndex=date===cursor?0:-1;
   button.classList.toggle('outside-month',!inMonth);
   if(week&&date>=week&&date<=endOfWeek)button.classList.add('in-week');
   button.setAttribute('aria-label',displayDate(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
   button.setAttribute('aria-pressed',String(date===selected));
   if(date===today)button.setAttribute('aria-current','date');
   days.append(button);
  }
  return days;
 }
 function position(){
  const anchor=trigger();if(!panel.open||!anchor)return;
  const box=anchor.getBoundingClientRect(),w=panel.offsetWidth,h=panel.offsetHeight;
  const narrow=innerWidth<540;
  const left=narrow?(innerWidth-w)/2:Math.max(8,Math.min(box.left,innerWidth-w-8));
  const top=narrow?(innerHeight-h)/2:(box.bottom+h+14<innerHeight?box.bottom+6:box.top-h-6);
  panel.style.left=left+'px';panel.style.top=Math.max(8,Math.min(top,innerHeight-h-8))+'px';
 }
 document.addEventListener('click',event=>{
  const anchor=event.target.closest('[data-calendar]');if(!anchor)return;
  scope=anchor.dataset.calendar;unit=anchor.dataset.unit;selected=cursor=anchor.dataset.dayValue;
  const months=unit==='month';
  panel.querySelector('#calendar-caption').textContent=scope==='plan'?'Plan for':'Choose a '+unit+' to review';
  panel.querySelector('.calendar-week').hidden=months;
  grid.classList.toggle('month-options',months);
  grid.setAttribute('aria-label',months?'Months of the year':'Days of the month');
  panel.querySelector('[data-month="-1"]').setAttribute('aria-label',months?'Previous year':'Previous month');
  panel.querySelector('[data-month="1"]').setAttribute('aria-label',months?'Next year':'Next month');
  panel.querySelector('[data-today]').textContent=unit==='day'?'Go to today':'Go to this '+unit;
  draw(false);panel.showModal();position();grid.querySelector('[tabindex="0"]').focus({preventScroll:true});
 });
 function choose(date){
  panel.close();onSelect(scope,date);trigger()?.focus({preventScroll:true});
 }
 panel.addEventListener('click',event=>{
  if(event.target===panel){
   const r=panel.getBoundingClientRect();
   if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();
   return;
  }
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.day)choose(button.dataset.day);
  else if(button.hasAttribute('data-today'))choose(dayKey());
  else if(button.hasAttribute('data-month')){cursor=shiftMonth(cursor,Number(button.dataset.month)*(unit==='month'?12:1));draw(false);}
  else if(button.hasAttribute('data-dismiss'))panel.close();
 });
 grid.addEventListener('keydown',event=>{
  const day=event.target.dataset.day;if(!day)return;
  const months=unit==='month',stride=months?3:7;
  const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-stride,ArrowDown:stride};
  if(Object.hasOwn(steps,event.key))cursor=months?shiftMonth(day,steps[event.key]):addDays(day,steps[event.key]);
  else if(event.key==='Home')cursor=months?day.slice(0,4)+'-01-01':weekStart(day);
  else if(event.key==='End')cursor=months?day.slice(0,4)+'-12-01':addDays(weekStart(day),6);
  else if(event.key==='PageUp'||event.key==='PageDown')cursor=shiftMonth(day,(event.key==='PageUp'?-1:1)*(months||event.shiftKey?12:1));
  else return;
  event.preventDefault();draw(true);
 });
 window.addEventListener('resize',position);
 panel.addEventListener('close',()=>{if(document.activeElement===document.body)trigger()?.focus({preventScroll:true});});
 window.addEventListener('hashchange',()=>{if(panel.open)panel.close();});
 panel.querySelector('[data-month="-1"]').innerHTML=icon('back');
 panel.querySelector('[data-month="1"]').innerHTML=icon('chevron');
 panel.querySelector('[data-dismiss]').innerHTML=icon('close');
}
