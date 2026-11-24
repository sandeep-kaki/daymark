import {spawn} from 'node:child_process';
const address='http://127.0.0.1:4174';
async function ready(){
 try{const response=await fetch(address+'/manifest.webmanifest',{signal:AbortSignal.timeout(1000)});return response.ok&&(await response.json()).id==='./'&&(await (await fetch(address+'/index.html')).text()).includes('Daymark');}catch{return false;}
}
if(!await ready()){
 process.env.PORT='4174';
 await import('./serve.mjs');
 for(let attempt=0;attempt<15&&!await ready();attempt++)await new Promise(resolve=>setTimeout(resolve,200));
}
if(!await ready())throw new Error('Could not open Daymark on 127.0.0.1:4174. Check whether another app is using the port.');
console.log('Open '+address+' in your browser. Keep the server window open while using Daymark.');
spawn('explorer.exe',[address],{detached:true,stdio:'ignore',windowsHide:true}).unref();

