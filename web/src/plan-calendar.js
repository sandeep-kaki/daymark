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

export function installPlanCalendar(onSelect){
 const panel=document.querySelector('#plan-calendar');
 const heading=panel.querySelector('h2'),grid=panel.querySelector('.calendar-days');
 let cursor,selected;
 const trigger=()=>document.querySelector('[data-plan-picker]');
 function draw(focusDay){
  heading.textContent=displayDate(cursor,{month:'long',year:'numeric'});
  const month=cursor.slice(0,7),first=month+'-01',start=weekStart(first),today=dayKey();
  const days=document.createDocumentFragment();
  const firstOfNext=shiftMonth(first,1);
  for(let i=0;i<42;i++){
   const date=addDays(start,i),inMonth=date.startsWith(month);
   if(i%7===0&&date>=firstOfNext)break;
   const button=document.createElement('button');
   button.type='button';button.dataset.day=date;button.textContent=String(Number(date.slice(-2)));
   button.tabIndex=date===cursor?0:-1;
   button.classList.toggle('outside-month',!inMonth);
   button.setAttribute('aria-label',displayDate(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'}));
   button.setAttribute('aria-pressed',String(date===selected));
   if(date===today)button.setAttribute('aria-current','date');
   days.append(button);
  }
  grid.replaceChildren(days);
  if(focusDay)grid.querySelector('[tabindex="0"]').focus({preventScroll:true});
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
  const anchor=event.target.closest('[data-plan-picker]');if(!anchor)return;
  selected=cursor=anchor.dataset.planPicker;
  draw(false);panel.showModal();position();grid.querySelector('[tabindex="0"]').focus({preventScroll:true});
 });
 function choose(date){
  panel.close();onSelect(date);trigger()?.focus({preventScroll:true});
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
  else if(button.hasAttribute('data-month')){cursor=shiftMonth(cursor,Number(button.dataset.month));draw(false);}
  else if(button.hasAttribute('data-dismiss'))panel.close();
 });
 grid.addEventListener('keydown',event=>{
  const day=event.target.dataset.day;if(!day)return;
  const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(Object.hasOwn(steps,event.key))cursor=addDays(day,steps[event.key]);
  else if(event.key==='Home')cursor=weekStart(day);
  else if(event.key==='End')cursor=addDays(weekStart(day),6);
  else if(event.key==='PageUp'||event.key==='PageDown')cursor=shiftMonth(day,(event.key==='PageUp'?-1:1)*(event.shiftKey?12:1));
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
