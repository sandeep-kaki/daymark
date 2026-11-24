const {chromium}=require(process.env.DAYMARK_PLAYWRIGHT || 'playwright');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
(async()=>{
 const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'4196'},windowsHide:true});let browser;
 try{await new Promise((ok,fail)=>{server.stdout.once('data',ok);server.once('error',fail);server.once('exit',()=>fail(Error('Server exited')));});
 browser=await chromium.launch({executablePath:process.env.DAYMARK_CHROMIUM || undefined,headless:true,args:['--no-proxy-server']});
 const context=await browser.newContext({viewport:{width:390,height:844}});const p=await context.newPage();const errors=[];p.on('pageerror',x=>errors.push(x.message));p.setDefaultTimeout(5000);
 const btn=name=>p.getByRole('button',{name,exact:true}).first();const fill=(label,value)=>p.getByLabel(label,{exact:true}).fill(value);
 const route=async name=>{await p.locator('nav:visible a').filter({hasText:name}).first().click();};
 const saved=async name=>{await p.locator('dialog button[type=submit]').filter({hasText:name}).click();await p.locator('dialog').waitFor({state:'hidden'});await p.waitForTimeout(100);};
 await p.goto('http://127.0.0.1:4196');await btn('Capture task').click();await fill('Title','Unrelated idea');await saved('Save task');
 await route('Goals');await btn('New goal').click();await fill('Title','Publish a useful course lesson');await fill('Observable outcome','A lesson ready to share');await saved('Save');
 await btn('Add milestone').click();await fill('Milestone','Finish the lesson outline');await saved('Save');
 await route('Today');await btn('Choose one thing').click();await btn('Create a new priority').click();await fill('Title','Draft three sections');await fill('Definition of done','Three headings with three bullets each');await fill('First action','Open the lesson document');await p.getByLabel('Goal · optional').selectOption({label:'Publish a useful course lesson'});await saved('Save priority');
 await btn('Start').click();await btn('Continue without timer').click();await btn('I’m stuck').click();await p.getByLabel('Obstacle').selectOption('Interrupted');await fill('Progress or blocker','One heading written');await saved('Record partial progress');
 await btn('Complete').click();await btn('Undo').click();await btn('Complete').waitFor();await route('Journal');await btn('Log work').click();await fill('What did you do?','Unexpected editing session');await fill('Actual minutes','15');await saved('Save');
 await btn('Write an entry').click();await fill('Your entry','Writing the outline helped');await p.reload();await btn('Write an entry').click();assert.equal(await p.getByLabel('Your entry').inputValue(),'Writing the outline helped');await saved('Save entry');
 await route('Review');assert.ok((await p.locator('article').innerText()).includes('Unexpected editing session'));
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();await p.locator('article').waitFor();
 for(const name of ['Today','Plan','Goals','Journal','Review']){await route(name);assert.equal(await p.locator('header span').innerText(),name);}
 const reopened=await context.newPage();await reopened.goto('http://127.0.0.1:4196/#Journal');await reopened.getByText('Writing the outline helped',{exact:true}).waitFor();await reopened.close();
 await context.setOffline(false);await btn('Settings').click();await p.getByText('File transfer and deletion',{exact:true}).click();const download=p.waitForEvent('download');await btn('Download backup').click();const path=await (await download).path();
 const clean=await browser.newContext();const other=await clean.newPage();await other.goto('http://127.0.0.1:4196');await other.getByRole('button',{name:'Settings',exact:true}).click();await other.getByText('File transfer and deletion',{exact:true}).click();await other.locator('#restore-file').setInputFiles(path);await other.getByRole('button',{name:'Replace workspace',exact:true}).click();await other.getByRole('heading',{name:'Draft three sections'}).waitFor();assert.equal(errors.length,0);
 await btn('Close').click();await p.locator('dialog').waitFor({state:'hidden'});await other.reload();await other.getByRole('heading',{name:'Draft three sections'}).waitFor();
 for(const width of [320,1280])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:850});await p.emulateMedia({colorScheme:theme});
  for(const name of ['Today','Plan','Goals','Journal','Review']){await route(name);const fits=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(fits,name+' overflows '+width+' '+theme);}
 }
 await route('Today');
 await p.setViewportSize({width:390,height:844});await p.emulateMedia({colorScheme:'light'});
 const tab=await context.newPage();await tab.goto('http://127.0.0.1:4196');
 await btn('Capture task').click();await fill('Title','Conflicting capture');
 await tab.getByRole('button',{name:'Capture task',exact:true}).first().click();await tab.getByLabel('Title',{exact:true}).fill('Capture from second tab');await tab.locator('dialog button[type=submit]').click();
 await p.locator('dialog button[type=submit]').click();await p.getByRole('alert').filter({hasText:'changed'}).waitFor();assert.equal(await p.getByLabel('Title',{exact:true}).inputValue(),'Conflicting capture');
 await tab.close();
 const unavailable=await browser.newContext();await unavailable.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined}));const unavailablePage=await unavailable.newPage();await unavailablePage.goto('http://127.0.0.1:4196');await unavailablePage.getByRole('heading',{name:'Workspace unavailable'}).waitFor();await unavailable.close();
 console.log('PASS responsive checks at 320 and 1280 px in both themes; stale cross-tab form retains input.');
 console.log('PASS Chromium '+browser.version()+': capture, goal, milestone, priority, start, partial, completion/undo, retrospective work, draft recovery, review, five offline destinations, portable restore into clean profile.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

