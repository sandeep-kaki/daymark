import {esc,button} from './ui.js';

// Keep the face, ears and scarf independently movable, with both feet anchored.
export function pip(pose='rest') {
  return `<button type="button" class="pip rabbit" data-pose="${pose}" data-action="greet-pip" aria-label="Greet Pip the rabbit">
    <svg viewBox="0 0 100 108" aria-hidden="true" stroke="#51434a" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" fill="#fff1dc">
      <ellipse cx="50" cy="101" rx="29" ry="3" fill="currentColor" opacity=".13" stroke="none"/>
      <g class="pip-body"><path class="pip-tail" d="M69 83c3-16 18-14 18-5 8 8-1 18-15 15z"/>
      <path d="M32 69c-11 17-9 30 8 30h21c18-1 18-19 4-31z" fill="#e9d4bb"/>
      <path d="M45 97c-8-14-20-8-18-1 2 4 11 4 18 1zm12 0c4-13 19-10 17-1-2 4-12 4-17 1z"/>
      <g class="pip-head">
        <g class="pip-ear"><path d="M33 46C21 32 18 9 24 5c8-6 20 20 20 38z"/><path d="M34 36C26 23 24 12 26 11c3-1 10 12 12 25z" fill="#dc9995" stroke="none"/></g>
        <g class="pip-ear far"><path d="M52 42C53 25 62 1 70 3c10 3 0 32-9 42z"/><path d="M57 36c2-14 9-25 12-26 3 4-3 18-9 27z" fill="#dc9995" stroke="none"/></g>
        <path d="M23 51c3-11 13-17 25-16 16-1 25 6 28 17 8 18-7 31-28 31-23 0-36-12-25-32z"/>
        <g class="pip-eyes" fill="#51434a" stroke="none"><ellipse cx="36" cy="58" rx="3" ry="3.7"/><ellipse cx="59" cy="58" rx="3" ry="3.7"/><g fill="#fff8e8"><circle cx="35.4" cy="56.8" r=".9"/><circle cx="58.4" cy="56.8" r=".9"/></g></g>
        <g fill="#edb7aa" stroke="none"><ellipse cx="29" cy="65" rx="5" ry="2"/><ellipse cx="66" cy="65" rx="5" ry="2"/></g>
        <path d="M44 64q4-3 8 0l-4 4z" fill="#c37e77" stroke="none"/><path d="M48 68q0 4-4 3m4-3q1 4 5 2" fill="none" stroke-width="1.2"/>
        <path d="m28 66-9-1m9 4-8 2m47-5 9-1m-9 4 8 2" stroke="#a48a83" stroke-width="1.2"/>
      </g>
      <path d="M33 79q17 9 32-1-3 7-12 9l-7 8-5-9q-6-2-8-7z" fill="var(--brand)"/></g>
    </svg></button>`;
}

export function pipAction(page){
 const options={
  Today:['Capture another thought','new'], Plan:['Plan a task for this day','dated'],
  Goals:['Start a goal','goal'], Journal:['Write down a moment','note'],
  Review:['Record what to try next','experiment']
 };
 const [label,action]=options[page];
 return '<div class="pip-help" hidden>'+button(label,action,'','quiet','chevron')+'</div>';
}
export function pipLine(show, pose, message, page) {
  return '<div class="pip-line">'+(show ? pip(pose) : '')+'<span class="pip-message">'+esc(message)+'</span>'+(show&&page?pipAction(page):'')+'</div>';
}
