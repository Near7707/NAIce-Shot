// Cross-chat profiles, side-character extraction, and preserving an unresolved person's visual fields.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(rel.startsWith('/user/images/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(req.method==='HEAD'?undefined:await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const profile=(id,name,aliases=[],cardKey='')=>({id,name,aliases,cardKey,subject:id==='mira'?'girl':'boy',appearance:`${id} fixed appearance`,defaultOutfit:'grey coat',positive:'',negative:''});
const profiles=[profile('leo','Leo',[],'Leo.png'),profile('mira','Mira'),profile('robin','Robin',['Jae-Sun','제이선'],'Robin.png')];
const person=(id,name,action='standing',extra={})=>({id,name,expression:'smile',action,position:'auto',outfitMode:'unchanged',outfit:'',...extra});
const frame=(characters,unregistered=[])=>({characters,unregistered,location:'cafe',lighting:'sunlight',camera:'wide shot',interaction:'conversation'});
async function setup(extraction){
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],sent=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/plugins/naice-shot/**',async route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/generate')){
  const b=route.request().postDataJSON();sent.push(b);return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});
 }return route.fulfill({json:{items:[],total:0,hasMore:false}});});
 await page.addInitScript(cfg=>document.addEventListener('DOMContentLoaded',()=>{mock.extensionSettings.naice_shot.profiles=cfg.profiles;mock.extraction=cfg.extraction;mock.characters.push({name:'Jae Sun',avatar:'Robin.png',description:'PRIVATE CARD TEXT'});mock.chat[1].mes='Leo and Mira talk while Jae Sun holds a cup.';mock.renderChat();}),{profiles,extraction});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 const extract=async()=>{const before=await page.evaluate(()=>mock.extractCalls??0);await click('extract');await page.waitForFunction(n=>(mock.extractCalls??0)>n&&document.querySelector('#ncs-progress').hidden,before);};
 await extract();return {page,errors,sent,click,extract};
}
const row=(page,id)=>page.locator(`[data-character="${id}"]`);
const visual=(page,id,key)=>row(page,id).locator(`[data-field="${key}"]`);
try{
 // Three visible people include a profile bound to a different card, returned without an ID.
 let t=await setup(frame([person('leo','Leo'),person('mira','Mira'),person('','제이선','holding cup')],['제이선']));
 assert.equal(await t.page.locator('[data-character]').count(),3);
 assert.equal(await visual(t.page,'robin','action').inputValue(),'holding cup');
 assert.equal(await t.page.locator('#ncs-left-out').isHidden(),true,'saved side profile is not called unregistered');
 const prompt=await t.page.evaluate(()=>mock.lastExtract.prompt);assert.match(prompt,/Jae-Sun/);assert.doesNotMatch(prompt,/PRIVATE CARD TEXT|(?:leo|mira|robin) fixed appearance/);
 // Saved profiles also resolve in a different character's chat when they were not in its initial roster.
 await t.page.evaluate(data=>{mock.characters[0]={name:'Different card',avatar:'Different.png'};mock.name2='Different card';mock.switchChat('B');mock.extraction=data;},frame([person('','Jae Sun','waving')]));
 await t.extract();assert.equal(await t.page.locator('[data-character]').count(),1);assert.equal(await visual(t.page,'robin','action').inputValue(),'waving');
 // The older name-only form is recovered too.
 await t.page.evaluate(data=>{mock.extraction=data;},frame([person('mira','Mira')],['제이선']));await t.extract();
 assert.equal(await row(t.page,'robin').count(),1);assert.equal(await t.page.locator('#ncs-left-out').isHidden(),true);
 assert.deepEqual(t.errors,[]);await t.page.close();

 // An unresolved side character retains visual fields. Linking is local and undo retains them too.
 const unknown=frame([person('leo','Leo'),person('','Visitor','holding cup',{expression:'grin',position:'right',outfitMode:'replace',outfit:'blue shirt, jeans'})],['Visitor']);
 t=await setup(unknown);
 await t.page.setViewportSize({width:375,height:760});assert.ok(await t.page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await t.page.setViewportSize({width:1280,height:900});
 const link=()=>t.page.locator('#ncs-unregistered [data-missing-do="link"]').click();
 await link();await t.page.locator('#ncs-link-profile').selectOption('robin');await t.page.locator('[data-missing-do="link-confirm"]').click();
 assert.equal(await visual(t.page,'robin','action').inputValue(),'holding cup');assert.equal(await visual(t.page,'robin','expression').inputValue(),'grin');
 assert.equal(await visual(t.page,'robin','position').inputValue(),'right');assert.equal(await visual(t.page,'robin','manualOutfit').inputValue(),'blue shirt, jeans');
 assert.equal(await t.page.evaluate(()=>mock.extractCalls),1,'linking restored data without another AI request');
 await t.page.locator('[data-missing-do="link-undo"]').click();assert.equal(await row(t.page,'robin').count(),0);
 await link();await t.page.locator('#ncs-link-profile').selectOption('robin');await t.page.locator('[data-missing-do="link-confirm"]').click();
 assert.equal(await visual(t.page,'robin','action').inputValue(),'holding cup','undo did not discard preserved action');
 await t.page.locator('#ncs-allow-anlas').check();await t.click('generate');await t.page.locator('#ncs-result img').waitFor();
 const robin=t.sent[0].assembled.characters.find(c=>c.name==='Robin');assert.match(robin.prompt,/holding cup/);assert.match(robin.prompt,/blue shirt/);
 assert.equal(t.sent[0].snapshot.rawExtraction,undefined);assert.ok(t.sent[0].snapshot.scene.source.fingerprints.every(f=>!('text' in f)));
 await t.page.setViewportSize({width:375,height:760});assert.ok(await t.page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 assert.deepEqual(t.errors,[]);await t.page.close();

 // A profile saved in the ordinary profile tab can be manually added later with cached details.
 t=await setup(unknown);await t.page.locator('[data-tab="profiles"]').click();await t.click('new-profile');
 await t.page.locator('[data-profile-mode="direct"]').click();await t.page.locator('#ncs-profile-name').fill('Visitor');
 await t.page.locator('#ncs-profile-appearance').fill('brown hair, green eyes');await t.page.locator('#ncs-profile-submit').click();
 const saved=await t.page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Visitor').id);
 await t.page.locator('[data-tab="scene"]').click();await t.page.locator('#ncs-add-profile').selectOption(saved);await t.click('add-character');
 assert.equal(await visual(t.page,saved,'action').inputValue(),'holding cup');assert.equal(await visual(t.page,saved,'position').inputValue(),'right');
 assert.equal(await t.page.evaluate(()=>mock.extractCalls),1,'manual late addition also restores cached details without an AI call');
 assert.deepEqual(t.errors,[]);await t.page.close();

 // Creating a new profile also fills the preserved action, instead of creating an empty person.
 t=await setup(unknown);await t.page.locator('[data-quick-profile-name="Visitor"]').click();
 await t.page.locator('[data-profile-mode="direct"]').click();await t.page.locator('#ncs-profile-appearance').fill('brown hair, green eyes');await t.page.locator('#ncs-profile-submit').click();
 const created=await t.page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Visitor').id);
 assert.equal(await visual(t.page,created,'action').inputValue(),'holding cup');assert.equal(await visual(t.page,created,'manualOutfit').inputValue(),'blue shirt, jeans');
 assert.equal(await t.page.locator('#ncs-left-out').isHidden(),true);assert.equal(await t.page.evaluate(()=>mock.extractCalls),1);
 assert.deepEqual(t.errors,[]);await t.page.close();

 // A late manual addition reaches the next roster, but is never forced into an absent scene.
 t=await setup(frame([person('leo','Leo'),person('mira','Mira')]));
 await t.page.evaluate(()=>{mock.chat[1].mes='Leo and Mira talk while the newcomer holds a cup.';mock.renderChat();});
 await t.page.locator('#ncs-add-profile').selectOption('robin');await t.click('add-character');
 assert.equal(await visual(t.page,'robin','action').inputValue(),'');
 await t.page.evaluate(data=>{mock.extraction=data;},frame([person('leo','Leo'),person('mira','Mira'),person('robin','Jae Sun','holding cup')]));
 await t.extract();assert.equal(await visual(t.page,'robin','action').inputValue(),'holding cup');
 assert.ok(await t.page.evaluate(()=>mock.lastExtract.jsonSchema.value.properties.characters.items.properties.id.enum.includes('robin')));
 await t.page.evaluate(data=>{mock.extraction=data;},frame([person('leo','Leo')]));await t.extract();
 assert.equal(await row(t.page,'robin').count(),0);assert.equal(await t.page.locator('#ncs-left-out').isHidden(),true);
 assert.deepEqual(t.errors,[]);await t.page.close();
 console.log('PASS: three-person and cross-card/cross-chat matching, old name-only recovery, unresolved visual fields restored on linking/undo/profile creation without another AI call, late additions reach re-extraction, absent people stay absent, payload/privacy and 375px layout.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
