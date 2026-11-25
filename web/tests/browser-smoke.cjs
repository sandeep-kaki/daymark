const {chromium}=require(process.env.DAYMARK_PLAYWRIGHT || 'playwright');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {spawn}=require('node:child_process');const assert=require('node:assert/strict');
(async()=>{
 const origin=process.env.DAYMARK_TEST_URL||'http://127.0.0.1:4196/';
 const server=process.env.DAYMARK_TEST_URL?null:spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'4196',DAYMARK_SERVE_DIST:'1'},windowsHide:true});let browser;
 try{if(server)await new Promise((ok,fail)=>{server.stdout.once('data',ok);server.once('error',fail);server.once('exit',()=>fail(Error('Server exited')));});
 browser=await chromium.launch({executablePath:process.env.DAYMARK_CHROMIUM || undefined,headless:true,args:['--no-proxy-server']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 context.setDefaultTimeout(20000);
 context.setDefaultNavigationTimeout(60000);
 const p=await context.newPage();const errors=[];p.on('pageerror',x=>errors.push(x.message));
 const btn=name=>p.getByRole('button',{name,exact:true}).first();const fill=(label,value)=>p.getByLabel(label,{exact:true}).fill(value);
 const route=async name=>{if(await btn('Open navigation').isVisible())await btn('Open navigation').click();await p.locator('nav:visible a').filter({hasText:name}).first().click();await p.waitForFunction(expected=>document.querySelector('.current-page')?.textContent===expected,name);await p.locator('#navigation').waitFor({state:'hidden'});};
 const saved=async name=>{await p.locator('dialog button[type=submit]').filter({hasText:name}).click();await p.locator('#dialog').waitFor({state:'hidden'});await p.waitForTimeout(100);};
 await p.goto(origin);await btn('Skip for now').click();await btn('Choose one thing').waitFor();
 if(process.env.DAYMARK_SCREENSHOTS){
  for(const width of [390,1280]){
   await p.setViewportSize({width,height:844});
   await p.waitForFunction(()=>document.querySelector('.pip svg')?.getBoundingClientRect().width>0);
   await p.screenshot({path:require('node:path').join(process.env.DAYMARK_SCREENSHOTS,'today-'+width+'.png')});
  }
  await p.setViewportSize({width:390,height:844});
 }
 await btn('Choose one thing').click();await p.getByLabel('First action',{exact:true}).waitFor();
 assert.equal(await p.getByLabel('Estimated minutes').isVisible(),false);await btn('Close').click();
 await btn('Capture task').click();await fill('Title','Unrelated idea');await saved('Save task');
 await p.getByRole('link',{name:'Open plan',exact:true}).click();
 const picker=p.locator('[data-calendar=plan]'),calendar=p.locator('#daymark-calendar');
 await picker.click();const initial=await picker.getAttribute('data-day-value');
 const nextMonth=btn('Next month'),previousMonth=btn('Previous month');
 const panelBox=await calendar.boundingBox(),monthRows=new Set();
 for(const arrow of [nextMonth,previousMonth]){
  const point=await arrow.boundingBox();
  const x=point.x+point.width/2,y=point.y+point.height/2;
  for(let turn=0;turn<12;turn++){
   const before=await calendar.locator('h2').textContent();
   await p.mouse.click(x,y);
   assert.notEqual(await calendar.locator('h2').textContent(),before);
   monthRows.add(await calendar.locator('[data-day]').count()/7);
   assert.deepEqual(await arrow.boundingBox(),point);
   assert.deepEqual(await calendar.boundingBox(),panelBox);
  }
 }
 assert(monthRows.has(5)&&monthRows.has(6));
 await p.keyboard.press('Escape');
 assert.equal(await picker.getAttribute('data-day-value'),initial);
 await picker.click();await p.keyboard.press('PageDown');await p.keyboard.press('ArrowRight');
 const chosen=await p.locator(':focus').getAttribute('data-day');assert(chosen&&chosen!==initial);
 await p.keyboard.press('Enter');await calendar.waitFor({state:'hidden'});
 assert.equal(await picker.getAttribute('data-day-value'),chosen);
 await btn('Add task').click();assert.equal(await p.locator('#dialog input[name=date]').inputValue(),chosen);await btn('Close').click();
 await route('Today');await p.getByRole('link',{name:'Open journal',exact:true}).click();await btn('Write an entry').waitFor();
 await route('Goals');await btn('New goal').click();await fill('Title','Publish a useful course lesson');await fill('Observable outcome','A lesson ready to share');await saved('Save');
 await btn('Add milestone').click();await fill('Milestone','Finish the lesson outline');await saved('Save');
 await route('Today');await btn('Choose one thing').click();await btn('Create a new priority').click();await fill('Title','Draft three sections');await p.getByText('Planning details',{exact:true}).click();await fill('Definition of done','Three headings with three bullets each');await fill('First action','Open the lesson document');await p.getByLabel('Goal · optional').selectOption({label:'Publish a useful course lesson'});await saved('Save priority');
 await btn('Start').click();await btn('Continue without timer').click();await btn('I’m stuck').click();await p.getByLabel('Obstacle').selectOption('Interrupted');await fill('Progress or blocker','One heading written');await saved('Record partial progress');
 await btn('Complete').click();await btn('Write a reflection').waitFor();await btn('Undo').click();await btn('Complete').waitFor();await route('Journal');await btn('Log work').click();await fill('What did you do?','Unexpected editing session');await fill('Actual minutes','15');await saved('Save');
 await btn('Write an entry').click();await fill('Your entry','Writing the outline helped');await p.reload();await btn('Write an entry').click();assert.equal(await p.getByLabel('Your entry').inputValue(),'Writing the outline helped');await saved('Save entry');
 await route('Review');assert.ok((await p.locator('article').innerText()).includes('Unexpected editing session'));
 await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await p.reload();await p.locator('article').waitFor();
 for(const name of ['Today','Plan','Goals','Journal','Review']){await route(name);assert.equal(await p.locator('header .current-page').innerText(),name);assert.equal(await p.locator('main .pip').count(),1);}
 const reviewPeriod=p.getByRole('group',{name:'Review period'}),reviewPicker=p.locator('[data-calendar=review]');
 assert(await reviewPeriod.getByRole('radio',{name:'Week'}).isChecked());
 await reviewPicker.click();assert.equal(await calendar.locator('.in-week').count(),7);await p.keyboard.press('Escape');
 await reviewPeriod.getByText('Month',{exact:true}).click();await reviewPicker.click();
 assert.equal(await calendar.locator('.month-options button').count(),12);
 const year=Number(await calendar.locator('h2').textContent());await btn('Previous year').click();
 await calendar.locator('[data-day="'+(year-1)+'-12-01"]').click();
 assert.equal(await reviewPicker.getAttribute('data-day-value'),(year-1)+'-12-01');
 await reviewPeriod.getByText('Day',{exact:true}).click();await reviewPicker.click();
 await calendar.locator('[data-day="'+(year-1)+'-12-31"]').click();
 await reviewPeriod.getByText('Week',{exact:true}).click();await reviewPicker.click();
 assert.equal(await calendar.locator('.in-week').count(),7);
 await btn('Go to this week').click();
 assert.ok((await p.locator('article').innerText()).includes('Unexpected editing session'));
 const reopened=await context.newPage();await reopened.goto(new URL('#Journal',origin).href);await reopened.getByText('Writing the outline helped',{exact:true}).waitFor();await reopened.close();
 await context.setOffline(false);await btn('Settings').click();await p.getByText('File transfer and deletion',{exact:true}).click();const download=p.waitForEvent('download');await btn('Download backup').click();const path=await (await download).path();
 const clean=await browser.newContext();const other=await clean.newPage();await other.goto(origin);await other.getByRole('button',{name:'Skip for now'}).click();await other.getByRole('button',{name:'Settings',exact:true}).click();await other.getByText('File transfer and deletion',{exact:true}).click();await other.locator('#restore-file').setInputFiles(path);await other.getByRole('button',{name:'Replace workspace',exact:true}).click();await other.getByRole('heading',{name:'Draft three sections'}).waitFor();assert.equal(errors.length,0);
 await btn('Close').click();await p.locator('#dialog').waitFor({state:'hidden'});await other.reload();await other.getByRole('heading',{name:'Draft three sections'}).waitFor();
 for(const width of [320,1280])for(const theme of ['light','dark']){
  await p.setViewportSize({width,height:850});await p.emulateMedia({colorScheme:theme});
  for(const name of ['Today','Plan','Goals','Journal','Review']){await route(name);const fits=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(fits,name+' overflows '+width+' '+theme);}
 }
 assert.equal(await p.locator('header nav:visible a').count(),5);
 assert.equal(await btn('Open navigation').isVisible(),false);
 await route('Goals');
 const wordmark=p.locator('.wordmark');
 assert.equal(await wordmark.evaluate(el=>el.closest('a,button,[tabindex]')),null);
 await wordmark.dblclick();
 assert.equal(await p.evaluate(()=>getSelection().toString()),'');
 assert.equal(new URL(p.url()).hash,'#Goals');
 const desktopToday=p.locator('.desktop-nav a[href="#Today"]');
 await desktopToday.focus();await p.keyboard.press('Enter');
 await p.waitForFunction(()=>document.activeElement?.matches('.desktop-nav [aria-current][href="#Today"]'));
 await p.setViewportSize({width:1023,height:850});await btn('Open navigation').click();
 await p.setViewportSize({width:1024,height:850});
 await p.locator('#navigation').waitFor({state:'hidden'});
 await p.waitForFunction(()=>document.activeElement?.matches('.desktop-nav [aria-current]'));
 await p.setViewportSize({width:768,height:850});
 await btn('Open navigation').click();await p.keyboard.press('Escape');
 await p.waitForFunction(()=>document.activeElement?.dataset.action==='menu');
 await btn('Settings').click();await p.getByRole('radio',{name:'Dark',exact:true}).check();
 await p.getByRole('radio',{name:'Direct',exact:true}).check();
 await p.getByLabel('Show the rabbit companion').uncheck();await saved('Save settings');
 await p.reload();await btn('Capture task').waitFor();assert.equal(await p.locator('.rabbit').count(),0);
 assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
 await btn('Settings').click();assert(await p.getByRole('radio',{name:'Direct',exact:true}).isChecked());await p.getByRole('radio',{name:'System',exact:true}).check();
 await p.getByLabel('Show the rabbit companion').check();await saved('Save settings');
 await p.waitForFunction(()=>document.querySelector('.pip svg')?.getBoundingClientRect().width>0);
 await p.setViewportSize({width:390,height:844});await p.emulateMedia({colorScheme:'light'});
 const tab=await context.newPage();await tab.goto(origin);
 await btn('Capture task').click();await fill('Title','Conflicting capture');
 await tab.getByRole('button',{name:'Capture task',exact:true}).first().click();await tab.getByLabel('Title',{exact:true}).fill('Capture from second tab');await tab.locator('dialog button[type=submit]').click();
 await p.locator('dialog button[type=submit]').click();await p.getByRole('alert').filter({hasText:'changed'}).waitFor();assert.equal(await p.getByLabel('Title',{exact:true}).inputValue(),'Conflicting capture');
 await tab.close();
 const learner=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const guide=await learner.newPage();
 const press=name=>guide.getByRole('button',{name,exact:true}).click();
 await guide.goto(origin);
 await guide.getByRole('heading',{name:'Pick a starting point'}).waitFor();
 await press('Learning');await press('Read a chapter');assert.equal(await guide.getByLabel('Priority',{exact:true}).inputValue(),'Read a chapter');
 await guide.getByLabel('Priority',{exact:true}).fill('Prepare a lesson');
 await press('Pause guide');await guide.reload();await press('Resume first-day guide');
 assert.equal(await guide.getByLabel('Priority',{exact:true}).inputValue(),'Prepare a lesson');
 await press('Set my priority');await guide.getByRole('heading',{name:'Your day is ready'}).waitFor();
 await press('Back');await guide.getByRole('dialog').getByText('Prepare a lesson',{exact:true}).waitFor();
 await press('Continue');await guide.getByLabel('Another task (optional)').fill('Choose an example');
 await press('Start my day');await guide.locator('#dialog').waitFor({state:'hidden'});await guide.reload();
 await guide.getByRole('heading',{name:'Prepare a lesson',exact:true}).waitFor();
 assert.equal(await guide.getByRole('button',{name:'Resume first-day guide'}).count(),0);
 await press('Settings');await press('First-day guide');await guide.getByRole('heading',{name:'Pick a starting point'}).waitFor();
 assert.equal(await guide.evaluate(async()=>(await import('./src/store.js')).snapshot().tasks.length),2);
 await learner.close();
 // An isolated device exercises Appearance and Pip without altering the other test workspaces.
 const device=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light'});
 const appearancePage=await device.newPage();
 const tap=name=>appearancePage.getByRole('button',{name,exact:true}).click();
 const choose=(group,name)=>appearancePage.getByRole('group',{name:group,exact:true}).getByRole('radio',{name,exact:true}).check();
 await appearancePage.goto(origin);await tap('Skip for now');
 const input=appearancePage.getByLabel('New task for this day');
 await input.fill('Today draft');await tap('Tomorrow');assert.equal(await input.inputValue(),'');
 await input.fill('Tomorrow draft');await tap('Today');assert.equal(await input.inputValue(),'Today draft');
 const phoneTabs=appearancePage.locator('.phone-tabs');
 assert.equal(await phoneTabs.getByRole('link').count(),5);
 for(const name of ['Goals','Today']){
  const link=phoneTabs.getByRole('link',{name,exact:true});
  await link.hover();
  assert.deepEqual(await link.evaluate(el=>[getComputedStyle(el).boxShadow,getComputedStyle(el).filter]),['none','none']);
 }
 // Sample the actual lens between tabs before the transition can finish on a fast runner.
 await appearancePage.evaluate(()=>{
  window.addEventListener('hashchange',()=>{
   const bar=document.querySelector('.phone-tabs'),lens=bar.querySelector('.tab-lens');
   const travel=lens.getAnimations()[0];
   if(!travel)return;
   travel.currentTime=travel.effect.getTiming().duration*.3;
   const frame=lens.getBoundingClientRect(),to=bar.querySelector('[aria-current]').getBoundingClientRect();
   window.testLensMoved=frame.left>bar.querySelector('a').getBoundingClientRect().left&&frame.left<to.left&&frame.width>to.width;
  },{once:true});
 });
 await phoneTabs.getByRole('link',{name:'Goals'}).click();
 await phoneTabs.locator('[aria-current][href="#Goals"]').waitFor();
 assert.equal(await appearancePage.evaluate(()=>window.testLensMoved),true);
 await phoneTabs.getByRole('link',{name:'Today'}).click();await input.waitFor();
 await appearancePage.waitForFunction(()=>{
  const bar=document.querySelector('.phone-tabs'),lens=bar.querySelector('.tab-lens').getBoundingClientRect();
  return bar.dataset.page==='Today'&&Math.abs(lens.left-bar.querySelector('[aria-current]').getBoundingClientRect().left)<1;
 });
 await appearancePage.reload();assert.equal(await input.inputValue(),'Today draft');
 await input.focus();assert.equal(await input.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 assert.notEqual(await appearancePage.locator('.quick-task').evaluate(el=>getComputedStyle(el).borderColor),'transparent');
 await input.fill('Call Maya about Friday');await input.press('Enter');await appearancePage.waitForFunction(()=>document.querySelector('.quick-task input')?.value==='');
 await appearancePage.getByText('Open the contact details for Maya.',{exact:true}).waitFor();
 assert.equal(await input.inputValue(),'');await tap('Tomorrow');assert.equal(await input.inputValue(),'Tomorrow draft');await tap('Today');
 assert.equal(await appearancePage.locator('.pip').count(),1);
 await tap('Greet Pip the rabbit');
 assert(await appearancePage.getByRole('button',{name:'Capture another thought'}).isVisible());
 assert.equal(await appearancePage.locator('.pip').getAttribute('data-pose'),'greet');
 if(process.env.DAYMARK_SCREENSHOTS)await appearancePage.screenshot({path:require('node:path').join(process.env.DAYMARK_SCREENSHOTS,'pip-capture.png')});
 await tap('Start');await tap('Open focus timer');
 await appearancePage.locator('.priority .pip[data-pose=focus]').waitFor();
 assert.equal(await appearancePage.locator('.priority .pip-ear').first().evaluate(el=>getComputedStyle(el).animationDuration),'2.6s');
 assert.equal(await appearancePage.locator('.pip-tail').evaluate(el=>getComputedStyle(el).animationName),'pip-tail-flick');
 assert.equal(await appearancePage.locator('.pip:visible').count(),1);
 await tap('Finish session');
 await tap('Complete Call Maya about Friday');
 await appearancePage.getByText('What helped you finish this one?').waitFor();
 await tap('Write a reflection');await appearancePage.getByLabel('Your entry',{exact:true}).fill('Calling first helped.');
 await tap('Save entry');await appearancePage.locator('#dialog').waitFor({state:'hidden'});
 await tap('Settings');
 assert(await appearancePage.getByRole('radio',{name:'Garnet',exact:true}).isChecked());
 for(const palette of ['Garnet','Mist & Indigo','Oat & Moss','Apricot & Clay']){
  await choose('Palette',palette);
  for(const mode of ['Light','Dark']){await choose('Color mode',mode);assert.equal(await appearancePage.locator('html').evaluate(el=>getComputedStyle(el).colorScheme),mode.toLowerCase());const chip=appearancePage.getByRole('radio',{name:palette,exact:true});await chip.hover();await appearancePage.waitForFunction(()=>getComputedStyle(document.querySelector('label:hover:has([data-appearance=palette])')).boxShadow.includes('9px'));}
 }
 for(const font of ['Clean sans','Reading serif','Daymark']){
  await choose('Font style',font);assert.equal(await appearancePage.locator('html').getAttribute('data-font'),font);
 }
 await appearancePage.setViewportSize({width:320,height:820});
 await choose('Text size','Large');
 for(const size of ['Small','Large']){
  await choose('Display size',size);
  assert(await appearancePage.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 }
 if(process.env.DAYMARK_SCREENSHOTS)await appearancePage.screenshot({path:require('node:path').join(process.env.DAYMARK_SCREENSHOTS,'pip-settings.png')});
 await appearancePage.locator('#dialog').evaluate(el=>el.scrollTop=el.scrollHeight);assert(await appearancePage.getByRole('button',{name:'Close',exact:true}).evaluate(el=>{const box=el.getBoundingClientRect(),d=el.closest('dialog').getBoundingClientRect();return box.top>=d.top&&box.bottom<=d.bottom;}));
 await tap('Close');await appearancePage.reload();await tap('Settings');
 assert(await appearancePage.getByRole('radio',{name:'Apricot & Clay'}).isChecked());
 await tap('Reset appearance');await tap('Close');await tap('Switch to dark mode');await appearancePage.waitForFunction(()=>document.documentElement.style.colorScheme==='dark');
 assert.equal(await appearancePage.locator('#dialog[open]').count(),0);
 await tap('Switch to light mode');await appearancePage.waitForFunction(()=>document.documentElement.style.colorScheme==='light');
 await tap('Account');await appearancePage.getByRole('heading',{name:'Storage',exact:true}).waitFor();await tap('Close');
 await appearancePage.emulateMedia({reducedMotion:'reduce'});
 await tap('Greet Pip the rabbit');
 assert.equal(await appearancePage.locator('.pip').evaluate(el=>el.getAnimations({subtree:true}).length),0);
 await device.close();
 console.log('PASS four palettes, three typefaces, independent sizes, quick mode, reset, persisted appearance, contextual first step, Pip reactions and reflection.');
 console.log('PASS first-day guide: dismiss, replay, recover draft, save a real priority once, automatic first visit, automatic first step, optional second task, finish locally.');
 const unavailable=await browser.newContext();await unavailable.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:undefined}));const unavailablePage=await unavailable.newPage();await unavailablePage.goto(origin);await unavailablePage.getByRole('heading',{name:'Workspace unavailable'}).waitFor();await unavailable.close();
 console.log('PASS responsive checks at 320 and 1280 px in both themes; stale cross-tab form retains input.');
 console.log('PASS Chromium '+browser.version()+': capture, goal, milestone, priority, start, partial, completion/undo, retrospective work, draft recovery, review, five offline destinations, portable restore into clean profile.');
 }finally{if(browser)await browser.close();server?.kill();}
})().catch(error=>{
 console.error(error);
 if(process.env.GITHUB_ACTIONS){
  const details=String(error.stack||error).slice(0,2500).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.error('::error title=Daymark browser check::'+details);
 }
 process.exitCode=1;
});

