import {esc, button, icon} from './ui.js';

const palettes = {
'Garnet':[['#F7F5F3','#FFFFFF','#251F22','#675E63','#782944','#FFFFFF','#F1E8EB','#DAD3D5','#897D83'],['#191619','#252124','#EEE8EA','#BAADB4','#E3A0B5','#29141C','#32252B','#42383E','#8B7C84']],
  'Oat & Moss':[['#F8F5ED','#FFFDF8','#292F29','#5A6459','#456249','#FFFFFF','#E6ECDF','#D4D8CD','#788376'],['#191D19','#222822','#E9ECE4','#B1BAAD','#A6C69D','#17241A','#2D392C','#414B3E','#82917F']],
  'Mist & Indigo':[['#F8F7FA','#FFFDFF','#302D39','#655F70','#5B518C','#FFFFFF','#ECE9F3','#DAD7E1','#827D8F'],['#1A1922','#24232F','#EEEAF6','#BBB5C9','#BBB0EB','#221D31','#312E41','#484353','#938A9F']],
  'Apricot & Clay':[['#FCF6EF','#FFFDFA','#392D27','#6D5C51','#995536','#FFFFFF','#F6E5D7','#DECEC2','#917D70'],['#211B17','#2E2520','#F2E8DF','#C4B6A9','#E5A882','#2C1C12','#3E2F27','#534339','#9C8778']]
};
const roles = ['bg','paper','ink','dim','brand','on-brand','tint','line','control'];
const sizes = ['small','medium','large'];
const choices = {
  palette: Object.keys(palettes), theme: ['system','light','dark'],
  font: ['Daymark','Clean sans','Reading serif'], text: sizes, space: sizes
};
export const appearanceDefaults = {palette:'Garnet',theme:'system',font:'Daymark',text:'medium',space:'medium'};
export const appearanceKey = 'daymark-appearance-v1';
const systemDark = matchMedia('(prefers-color-scheme: dark)');
let current;

function read(legacyTheme) {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(appearanceKey)); } catch { /* Defaults work without storage. */ }
  const result = {...appearanceDefaults};
  for (const [key, values] of Object.entries(choices)) {
    const value = stored?.[key] ?? (key === 'theme' ? legacyTheme : undefined);
    if (values.includes(value)) result[key] = value;
  }
  return result;
}

export function applyAppearance(legacyTheme) {
  if (!current) {
    current = read(legacyTheme);
    if (current.theme !== 'system') {
      try { localStorage.setItem(appearanceKey, JSON.stringify(current)); } catch { /* Still applies in this tab. */ }
    }
  }
  const html = document.documentElement;
  const dark = current.theme === 'dark' || (current.theme === 'system' && systemDark.matches);
  const colors = palettes[current.palette][Number(dark)];
  roles.forEach((role,i) => html.style.setProperty('--'+role, colors[i]));
  html.style.colorScheme = dark ? 'dark' : 'light';
  html.dataset.theme = current.theme;
  const toggle=document.querySelector('.mode-toggle');
  if(toggle){
    const label=dark?'Switch to light mode':'Switch to dark mode';
    toggle.setAttribute('aria-label',label);
    toggle.title=label;
    toggle.innerHTML=icon(dark?'sun':'moon');
  }
  html.dataset.font = current.font;
  html.dataset.text = current.text;
  html.dataset.space = current.space;
  document.querySelector('meta[name="theme-color"]').content = colors[0];
  document.querySelectorAll('input[data-appearance]').forEach(radio => {
    radio.checked = current[radio.dataset.appearance] === radio.value;
  });
}

systemDark.addEventListener('change', () => { if (current) applyAppearance(); });
window.addEventListener('storage', event => {
  if (event.key === appearanceKey || event.key === null) { current = read(); applyAppearance(); }
});

export function setAppearance(key, value) {
  if (key !== 'reset' && !choices[key]?.includes(value)) return;
  const next = key === 'reset' ? {...appearanceDefaults} : {...read(current.theme),[key]:value};
  localStorage.setItem(appearanceKey, JSON.stringify(next));
  current = next;
  applyAppearance();
}

let activeReveal;
export async function toggleMode(button) {
  if(activeReveal)await activeReveal.updateCallbackDone;
  activeReveal?.skipTransition();
  const next=document.documentElement.style.colorScheme==='dark'?'light':'dark';
  const change=()=>setAppearance('theme',next);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){change();return;}
  const box=button.getBoundingClientRect(), x=box.left+box.width/2, y=box.top+box.height/2;
  if(!document.startViewTransition){
    change();
    button.animate([{boxShadow:'0 0 0 0 var(--brand)'},{boxShadow:'0 0 0 18px transparent'}],{duration:360,easing:'ease-out'});
    return;
  }
  const radius=Math.ceil(Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y)));
  const transition=document.startViewTransition(change);
  activeReveal=transition;
  try {
    await transition.ready;
    document.documentElement.animate(
      {clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
      {duration:470,easing:'cubic-bezier(.2,.8,.25,1)',pseudoElement:'::view-transition-new(root)'}
    );
  } catch { /* A second click or hidden tab can skip the reveal. */ }
  transition.finished.finally(()=>{if(activeReveal===transition)activeReveal=null;});
}
export function appearanceGroup(key, legend) {
  const radios = choices[key].map(value => {
    const name = value[0].toUpperCase()+value.slice(1);
    const dot = key === 'palette' ? '<i aria-hidden="true" style="--chip:'+palettes[value][0][4]+'"></i>' : '';
    return '<label><input type="radio" data-appearance="'+key+'" name="appearance-'+key+'" value="'+esc(value)+'" '+(current[key]===value?'checked':'')+'>'+dot+esc(name)+'</label>';
  }).join('');
  return '<fieldset class="appearance-group"><legend>'+legend+'</legend>'+radios+'</fieldset>';
}
export function appearanceSettings() {
  return '<section class="appearance-settings"><h3>Appearance</h3>'+appearanceGroup('palette','Palette')+
    appearanceGroup('theme','Color mode')+appearanceGroup('font','Font style')+appearanceGroup('text','Text size')+
    appearanceGroup('space','Display size')+
    '<div class="appearance-sample"><h3>Your morning.</h3><div class="sample-row">Draft the opening slide</div><p class="journal-text">I found the first sentence on my walk home.</p></div>'+
    button('Reset appearance','appearance-reset','','quiet')+'</section>';
}

