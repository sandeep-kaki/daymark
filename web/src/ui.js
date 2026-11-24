export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  menu:'<path d="M3 6h18M3 12h14M3 18h18"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  plan:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 4h2m3 0h2"/>',
  goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  journal:'<path d="M5 3h12a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V5a2 2 0 0 1 1-2Zm-1 15a3 3 0 0 1 3-3h12M8 7h7m-7 4h5"/>',
  review:'<path d="M5 20v-5m7 5V9m7 11V4M3 20h18"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L19 6"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',pause:'<path d="M8 5v14M16 5v14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  moon:'<path d="M20 13a8.5 8.5 0 0 1-9-9 8.5 8.5 0 1 0 9 9Z"/>',
  inbox:'<path d="m5 5-3 9v6h20v-6l-3-9ZM2 14h6l2 3h4l2-3h6"/>',
  leaf:'<path d="M20 3C5 2 1 10 7 16s14 1 13-13ZM4 21l12-12"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',back:'<path d="m15 5-7 7 7 7"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  undo:'<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  edit:'<path d="m16 3 5 5L9 20l-6 1 1-6ZM13 6l5 5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  heart:'<path d="M12 21 3 12C-3 4 7-1 12 6 17-1 27 4 21 12Z"/>'
};
export const icon=(name,cls='')=>`<svg class="icon ${esc(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.spark}</svg>`;
export function button(label,action,id='',classes='button secondary',symbol='') {return `<button type="button" class="${esc(classes)}" data-action="${esc(action)}" ${id?`data-id="${esc(id)}"`:''}>${symbol?icon(symbol):''}${esc(label)}</button>`;}
export function iconButton(label,action,id,symbol,extra='') {return `<button type="button" class="icon-button ${extra}" aria-label="${esc(label)}" title="${esc(label)}" data-action="${esc(action)}" data-id="${esc(id)}">${icon(symbol)}</button>`;}
export function displayDate(day, options={month:'short',day:'numeric'}) {return day?new Date(day+'T12:00:00').toLocaleDateString(undefined,options):'Inbox';}
export function minutes(n) {if(!n)return '0 min';return n>=60?`${Math.floor(n/60)}h${n%60?` ${Math.round(n%60)}m`:''}`:`${Math.round(n)} min`;}
export function empty(title,body,action='new-task',label='Add a task',symbol='leaf') {return `<div class="empty"><span class="empty-icon">${icon(symbol)}</span><h3>${esc(title)}</h3><p>${esc(body)}</p>${action?button(label,action):''}</div>`;}
export function field(label,name,value='',type='text',extra='') {return `<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
export function textarea(label,name,value='',extra='') {return `<label class="field"><span>${esc(label)}</span><textarea name="${esc(name)}" ${extra}>${esc(value)}</textarea></label>`;}
export function options(items,selected) {return items.map(([v,l])=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(l)}</option>`).join('');}
export function select(label,name,items,selected='',extra='') {return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}" ${extra}>${options(items,selected)}</select></label>`;}
export function goalSelect(s,value='') {return select('Goal · optional','goalId',[['','No goal linked'],...s.goals.filter(g=>!g.archived||g.id===value).map(g=>[g.id,g.title])],value);}
export function meter(value,target,cls='') {const percent=target?Math.min(100,Math.max(0,value/target*100)):0;return `<div class="meter ${cls}" role="meter" aria-label="Progress" aria-valuemin="0" aria-valuemax="${target||1}" aria-valuenow="${Math.min(value,target||1)}"><span style="width:${percent}%"></span></div>`;}
