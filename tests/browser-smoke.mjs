import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{
 try {
  const rel=new URL(req.url,'http://localhost').pathname;
  if(/^\/user\/images\/naice-shot\/[0-9a-f-]+\.png$/.test(rel)){res.setHeader('Content-Type','image/png');res.end(Buffer.from(png,'base64'));return;}
  const file=path.join(root,rel==='/'?'tests/fixture.html':rel);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,
 args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],env:{...process.env}});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=';
let generationCount=0,items=[],deferGeneration,releaseGeneration;
const errors=[];
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/plugins/naice-shot/**',async route=>{
 const req=route.request(),url=new URL(req.url());let data;
 if(url.pathname.endsWith('/status'))data={keyConfigured:true,version:'0.1.0',subscription:{tier:3,perks:{unlimitedImageGeneration:true},anlas:{subscription:10000,purchased:0}}};
 else if(url.pathname.endsWith('/history'))data={items:items.filter(x=>x.chatKey===url.searchParams.get('chatKey')),total:items.length};
 else {
  generationCount++;const b=req.postDataJSON();
  assert.equal(b.options.model,'nai-diffusion-5-full');assert.equal(req.headers()['x-csrf-token'],'mock-csrf');
  if(!b.allowAnlas){await route.fulfill({status:402,json:{error:'Anlas 사용 가능성을 허용해 주세요.'}});return;}
  if(deferGeneration)await new Promise(resolve=>{releaseGeneration=resolve;});
  data={id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot};items.push(data);
 }
 await route.fulfill({json:data});
});
const click=action=>page.locator(`[data-action="${action}"]`).click();
try {
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings').waitFor();
 assert.equal(await page.locator('#ncs-extension-settings .inline-drawer-content').isVisible(),false,'drawer starts closed');
 assert.equal(await page.locator('#ncs-extension-settings .inline-drawer-header').count(),1,'uses SillyTavern drawer markup');
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();
 await page.getByRole('button',{name:'NAIce Shot 열기',exact:true}).click();
 await click('extract');await page.locator('[data-character="leo"]').waitFor();
 assert.equal(await page.locator('#ncs-location').inputValue(),'cafe');
 assert.equal(await page.evaluate(()=>mock.lastExtract.prompt.includes('brown hair')),false);
 assert.match(await page.locator('#ncs-final').inputValue(),/brown hair/);
 assert.equal(await page.locator('[data-field="manualOutfit"]').inputValue(),'white shirt, jeans');
 assert.equal(await page.evaluate(()=>Object.keys(mock.chatMetadata).length),0,'extraction must not commit clothes');
 await page.locator('[data-save-outfit]').click();
 await page.waitForFunction(()=>mock.chatMetadata.naice_shot?.outfits.leo?.value==='white shirt, jeans');
 const stored=await page.evaluate(()=>mock.chatMetadata.naice_shot.outfits.leo);
 assert.ok(stored.source.fingerprints[0].signature);assert.equal(stored.source.fingerprints[0].text,undefined);
 assert.doesNotMatch(await page.locator('[data-character]').innerText(),/근거 메시지가 바뀌/);
 await page.locator('[data-lock]').check();await page.waitForFunction(()=>mock.chatMetadata.naice_shot.outfits.leo.locked);
 await page.evaluate(()=>mock.extraction.characters[0].outfit='pink pajamas');await click('extract');
 await page.waitForFunction(()=>document.querySelector('#ncs-raw').value.includes('pink pajamas'));
 assert.equal(await page.locator('[data-field="manualOutfit"]').inputValue(),'white shirt, jeans');
 await page.locator('#ncs-allow-anlas').check();await click('generate');await page.locator('#ncs-result img').waitFor();
 assert.equal(generationCount,1);const first=items[0];assert.equal(first.assembled.characters[0].negative,'black hair');
 assert.equal(first.snapshot.scene.source.fingerprints[0].text,undefined);
 // Inline attachment modifies only display metadata, with no NAIce Shot message.
 const rpBefore=await page.evaluate(()=>JSON.stringify(mock.chat.map(m=>({name:m.name,mes:m.mes,is_user:m.is_user,is_system:m.is_system}))));
 const textBefore=await page.locator('#chat .mes_text').allTextContents();
 await click('attach');await page.waitForFunction(()=>mock.chat[1]?.extra?.naice_shot_images?.length===1);
 assert.equal(await page.evaluate(()=>JSON.stringify(mock.chat.map(m=>({name:m.name,mes:m.mes,is_user:m.is_user,is_system:m.is_system})))),rpBefore);
 assert.deepEqual(await page.locator('#chat .mes_text').allTextContents(),textBefore);
 assert.equal(await page.locator('#chat img').count(),1);assert.equal(await page.locator('#chat .mes').count(),2);
 assert.equal(await page.evaluate(()=>mock.chat[1].extra.media),undefined);assert.equal(await page.evaluate(()=>mock.chatSaves),1);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#ncs-result a[download]').click()]);
 assert.equal(download.suggestedFilename(),`naice-shot-${first.id}.png`);assert.deepEqual(await fs.readFile(await download.path()),Buffer.from(png,'base64'));
 await click('attach');assert.equal(await page.locator('#chat img').count(),1);assert.equal(await page.evaluate(()=>mock.chat.length),2);
 await click('detach');await page.waitForFunction(()=>!mock.chat[1].extra?.naice_shot_images);assert.equal(await page.locator('#chat img').count(),0);
 assert.equal(items.length,1,'removing from chat must keep the generated image history');
 await click('attach');await page.evaluate(()=>{mock.chat=JSON.parse(mock.savedChat);mock.renderChat();});await page.locator('#chat .ncs-inline-images img').waitFor();
 assert.deepEqual(await page.locator('#chat .mes_text').allTextContents(),textBefore);
 const metadataBefore=await page.evaluate(()=>JSON.stringify(mock.chatMetadata));
 await page.locator('[data-tab="profiles"]').click();await page.locator('[data-profile="leo"]').click();
 await page.locator('#ncs-profile-appearance').fill('green hair');await page.getByRole('button',{name:'프로필 저장',exact:true}).click();
 await page.locator('[data-tab="history"]').click();await page.locator('[data-history-id]').first().click();
 assert.match(await page.locator('#ncs-final').inputValue(),/brown hair/);assert.doesNotMatch(await page.locator('#ncs-final').inputValue(),/green hair/);
 assert.equal(await page.evaluate(()=>JSON.stringify(mock.chatMetadata)),metadataBefore);
 await click('same-seed');await page.waitForFunction(seed=>document.querySelector('#ncs-notice').textContent.includes(`seed ${seed}`),first.seed);
 assert.equal(items.at(-1).seed,first.seed);assert.equal(items.at(-1).assembled.characters[0].prompt,first.assembled.characters[0].prompt);
 await page.waitForFunction(()=>document.querySelector('#ncs-final-badge').hidden);
 assert.match(await page.locator('#ncs-final').inputValue(),/green hair/,'a successful generation consumes the historical prompt once');
 // Restore again to test editing dimensions while a history draft is still pending.
 await page.locator('[data-tab="history"]').click();await page.locator('[data-history-id]').first().click();
 // Presets synchronize both fields; editing a dimension moves back to Custom.
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-size-preset').selectOption('landscape');
 assert.equal(await page.locator('#ncs-width').inputValue(),'1216');assert.equal(await page.locator('#ncs-height').inputValue(),'832');
 await page.locator('#ncs-size-preset').selectOption('square');assert.equal(await page.locator('#ncs-width').inputValue(),'1024');assert.equal(await page.locator('#ncs-height').inputValue(),'1024');
 await page.locator('#ncs-width').fill('960');assert.equal(await page.locator('#ncs-size-preset').inputValue(),'custom');
 await page.locator('#ncs-size-preset').selectOption('portrait');
 await page.locator('[data-tab="scene"]').click();assert.match(await page.locator('#ncs-final').inputValue(),/brown hair/,'size changes must preserve a restored final prompt');
 // Saved prompts and all NAI options, with explicit overwrite and form synchronization.
 await page.locator('[data-tab="settings"]').click();
 await page.locator('#ncs-positive').fill('watercolor');await page.locator('#ncs-negative').fill('photo');
 const presetOptions={'ncs-width':'832','ncs-height':'1216','ncs-steps':'18','ncs-scale':'5.5','ncs-seed':'-1','ncs-cfg':'0.2'};
 for(const [id,value] of Object.entries(presetOptions))await page.locator(`#${id}`).fill(value);
 await page.locator('#ncs-sampler').selectOption('k_euler');
 await page.locator('#ncs-common-preset-name').fill('수채화');await click('save-preset');
 const presetId=await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresetId);
 await page.locator('#ncs-size-preset').selectOption('square');assert.match(await page.locator('#ncs-preset-state').innerText(),/수정됐어요/);
 for(const [id,value] of Object.entries({'ncs-steps':'28','ncs-scale':'6','ncs-seed':'42','ncs-cfg':'0.4'}))await page.locator(`#${id}`).fill(value);
 await page.locator('#ncs-sampler').selectOption('k_euler_ancestral');
 await page.locator('#ncs-positive').fill('different');await page.locator('#ncs-model').selectOption('nai-diffusion-4-5-full');
 assert.match(await page.locator('#ncs-preset-state').innerText(),/수정됐어요/);
 await page.locator('#ncs-common-preset').selectOption('');await page.locator('#ncs-common-preset').selectOption(presetId);
 assert.equal(await page.locator('#ncs-positive').inputValue(),'watercolor');assert.equal(await page.locator('#ncs-negative').inputValue(),'photo');
 assert.equal(await page.locator('#ncs-model').inputValue(),'nai-diffusion-5-full');
 for(const [id,value] of Object.entries(presetOptions))assert.equal(await page.locator(`#${id}`).inputValue(),value,id);
 assert.equal(await page.locator('#ncs-size-preset').inputValue(),'portrait');assert.equal(await page.locator('#ncs-sampler').inputValue(),'k_euler');assert.equal(await page.locator('#ncs-scheduler').count(),0,'Noise Schedule is not offered');
 assert.doesNotMatch(await page.locator('#ncs-preset-state').innerText(),/수정됐어요/);
 await page.locator('#ncs-cfg').fill('0.3');
 await page.locator('#ncs-negative').fill('bad anatomy');await click('save-preset'); // a preset is selected: 프리셋 저장 overwrites it
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets[0].negative),'bad anatomy');
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.imagePresets[0].options.cfgRescale),0.3);
 await page.locator('#ncs-cfg').fill('0');await page.locator('#ncs-common-preset').selectOption('');await page.locator('#ncs-common-preset').selectOption(presetId);
 assert.equal(await page.locator('#ncs-cfg').inputValue(),'0.3');
 // Independent extraction uses the chosen connection profile, not generateRaw.
 const mainBefore=await page.evaluate(()=>mock.extensionSettings.connectionManager.selectedProfile),rawCalls=await page.evaluate(()=>mock.extractCalls);
 await page.locator('#ncs-extraction-profile').selectOption('extract-cheap');await page.locator('[data-tab="scene"]').click();
 await click('extract');await page.waitForFunction(()=>mock.profileCalls===1);
 await page.waitForFunction(()=>!document.querySelector('[data-action="extract"]').disabled);
 assert.equal(await page.evaluate(()=>mock.extractCalls),rawCalls);assert.equal(await page.evaluate(()=>mock.extensionSettings.connectionManager.selectedProfile),mainBefore);
 assert.equal(await page.evaluate(()=>mock.profileRequest.maxTokens),4096);
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-extraction-profile').selectOption('');await page.locator('[data-tab="scene"]').click();
 // An extraction finishing after a swipe change is discarded.
 await page.evaluate(()=>{mock.extractionDeferred=new Promise(resolve=>mock.resolveExtraction=resolve);});
 await click('extract');await page.waitForFunction(()=>document.querySelector('[data-action="extract"]').disabled);
 await page.evaluate(()=>{mock.chat[1].mes='different active swipe';mock.chat[1].swipe_id=1;mock.emit('swiped');mock.resolveExtraction(JSON.stringify({...mock.extraction,location:'WRONG'}));mock.extractionDeferred=null;});
 await page.waitForFunction(()=>!document.querySelector('[data-action="extract"]').disabled);
 assert.notEqual(await page.locator('#ncs-location').inputValue(),'WRONG');
 // A generation finishing after switching chats persists to A, never into B's editor.
 deferGeneration=true;await click('generate');
 await page.waitForFunction(()=>document.querySelector('[data-action="generate"]').disabled);
 while(!releaseGeneration)await new Promise(resolve=>setTimeout(resolve,20));
 await page.evaluate(()=>mock.switchChat('B'));releaseGeneration();
 await page.waitForFunction(()=>!document.querySelector('[data-action="generate"]').disabled);
 assert.equal(await page.locator('#ncs-result img').count(),0);assert.equal(await page.locator('#ncs-location').inputValue(),'');
 assert.equal(JSON.parse(items.at(-1).chatKey).chat,'A');
 // Mobile: the actual dialog and profile form fit inside the viewport.
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tab="profiles"]').click();
 const geometry=await page.locator('#naice-shot-dialog').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.clientWidth,scrollWidth:el.scrollWidth}));
 assert.ok(geometry.left>=0 && geometry.right<=390);assert.ok(geometry.scrollWidth<=geometry.width+1);
 for(const tab of ['settings','history','scene','profiles']){
  await page.locator(`[data-tab="${tab}"]`).click();
  const g=await page.locator('.ncs-content').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth}));
  assert.ok(g.scrollWidth<=g.width+1,`${tab} must fit at 390px`);
 }
 await fs.mkdir(path.join(root,'test-output'),{recursive:true});await page.screenshot({path:path.join(root,'test-output','mobile.png')});
 await page.locator('[data-tab="scene"]').click();await page.locator('.ncs-content').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(root,'test-output','mobile-scene.png')});
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(root,'test-output','desktop.png')});
 // The reported issue was a light theme. Check unfocused borders and selection
 // under light/dark theme variables and at desktop/mobile widths.
 for(const theme of ['light','dark']) {
  await page.evaluate(theme=>{
   const bg=theme==='light'?'#fcf7ef':'#181d27',fg=theme==='light'?'#403d3a':'#edf0f5';
   document.documentElement.style.setProperty('--SmartThemeBlurTintColor',bg);
   document.documentElement.style.setProperty('--SmartThemeBodyColor',fg);
   document.body.style.background=bg;document.body.style.color=fg;
  },theme);
  for(const width of [1280,390]) {
   await page.setViewportSize({width,height:900});
   for(const tab of ['profiles','settings','history','scene']) {
    await page.locator(`[data-tab="${tab}"]`).click();await page.locator('.ncs-content').evaluate(el=>el.scrollTop=0);
    if(tab==='profiles')await page.locator('[data-profile="leo"]').click();
    await page.locator('.ncs-header strong').click(); // blur controls before checking
    const visibility=await page.locator('#naice-shot-dialog').evaluate(el=>{
     const target=el.querySelector('[data-page]:not([hidden]) input:not([type=hidden]):not([type=checkbox]):not([type=radio]),[data-page]:not([hidden]) textarea,[data-page]:not([hidden]) button')??el.querySelector('[data-tab]');
     const css=getComputedStyle(target),canvas=document.createElement('canvas'),c=canvas.getContext('2d');
     const rgb=color=>{c.clearRect(0,0,1,1);c.fillStyle=color;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3);};
     const lum=values=>values.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
     const a=lum(rgb(css.borderColor)),b=lum(rgb(getComputedStyle(el).backgroundColor));
     return {border:parseFloat(css.borderTopWidth),style:css.borderTopStyle,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),
      selected:getComputedStyle(el.querySelector('.ncs-tabs .ncs-active')).borderTopWidth,overflow:el.scrollWidth>el.clientWidth+1};
    });
    assert.ok(visibility.border>=1&&visibility.style!=='none');assert.ok(visibility.contrast>=3,`${theme} ${tab} border contrast ${visibility.contrast}`);
    assert.equal(visibility.selected,'2px');assert.equal(visibility.overflow,false);
    if(tab==='profiles'||tab==='settings')await page.screenshot({path:path.join(root,'test-output',`${theme}-${width}-${tab}.png`)});
   }
  }
 }
 // The display-name setting is gone; a name saved by an older version is ignored.
 await page.locator('[data-tab="settings"]').click();assert.equal(await page.locator('#ncs-display-name').count(),0);
 assert.equal(await page.locator('.ncs-header [data-brand]').innerText(),'NAIce Shot');
 // Regression: multiple profiles and chat switches cannot keep the previous room's identity.
 await page.evaluate(()=>{
  const s=mock.extensionSettings.naice_shot;
  s.profiles.push({id:'ash',name:'Ash',aliases:['애쉬'],subject:'boy',appearance:'brown skin',defaultOutfit:'hoodie',positive:'',negative:'',cardKey:''},{id:'mira',name:'Mira',aliases:['미라'],subject:'girl',appearance:'pink hair',defaultOutfit:'coat',positive:'',negative:'',cardKey:''});
  mock.characters.push({name:'Ash',avatar:'Ash.png',chat:'B'});mock.characterId=1;mock.name2='Ash';mock.chatId='B';mock.chatMetadata={};
  mock.chat=[{name:'Mira',is_user:true,mes:'I stand beside him.'},{name:'Ash',mes:'He jumps onto the platform.'}];
  mock.extraction.characters[0]={...mock.extraction.characters[0],id:'leo',name:'Ash',outfitMode:'unchanged',outfit:''};mock.renderChat();mock.emit('chat');
 });
 await page.locator('[data-tab="scene"]').click();await click('extract');await page.locator('[data-character="ash"]').waitFor();
 assert.match(await page.locator('#ncs-final').inputValue(),/brown skin/);assert.doesNotMatch(await page.locator('#ncs-final').inputValue(),/green hair|brown hair/);
 const altPrompt=await page.evaluate(()=>mock.lastExtract.prompt);assert.doesNotMatch(altPrompt,/"id":"leo"/);assert.match(altPrompt,/"profileId":"ash"/);
 await page.evaluate(()=>{
  mock.characterId=0;mock.name2='Leo';mock.chatId='LEO';mock.chatMetadata={};
  mock.chat=[{name:'Mira',is_user:true,mes:'I look at the shards.'},{name:'Leo',mes:'He watches the shards orbit.'}];
  mock.extraction.characters[0]={...mock.extraction.characters[0],id:'ash',name:'Leo'};mock.renderChat();mock.emit('chat');
 });
 await click('extract');await page.locator('[data-character="leo"]').waitFor();assert.match(await page.locator('#ncs-final').inputValue(),/green hair/);assert.doesNotMatch(await page.locator('#ncs-final').inputValue(),/brown skin/);
 assert.doesNotMatch(await page.evaluate(()=>mock.lastExtract.prompt),/"id":"ash"/);
 // A differently named chat can be linked once without changing global profiles.
 await page.evaluate(()=>{mock.characters[0].name='Different name';mock.name2='Different name';mock.chat[1].name='Different name';mock.emit('chat');});
 await page.locator('#ncs-character-binding').evaluate(el=>el.closest('details').open=true);
 await page.locator('#ncs-character-binding').selectOption('leo');await page.waitForFunction(()=>mock.chatMetadata.naice_shot?.bindings.characterProfileId==='leo');
 await page.evaluate(()=>mock.extraction.characters[0].name='Different name');await click('extract');await page.waitForFunction(()=>document.querySelector('#ncs-raw').value.includes('Different name'));assert.equal(await page.locator('[data-character="leo"]').count(),1);
 assert.equal(await page.locator('#ncs-extension-settings .ncs-extension-body p').innerText(),'프로필 · 장면 편집 · 이미지 생성');
 assert.deepEqual(errors,[]);console.log('PASS: browser extraction, manual clothing commit, lock, exact history restore, swipe race, chat race, desktop and 390px layout');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
