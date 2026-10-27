// 0.1.18 regressions from an outside review of 0.1.17 (invented names only):
// the generate warning and the pending profile link never cross into another chat; the warning is a
// real modal (Tab stays inside, Escape closes only it); "don't ask again" is saved only by 그래도 그리기
// and can be turned back on; a failed save keeps the planned link; linking adds the exact alias,
// refuses a name another profile already uses, links group members' cards, and can be undone;
// group member descriptions get {{char}}/{{user}} filled.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=await import(modules?`${modules}/playwright/index.mjs`:'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=','base64');
const server=http.createServer(async(req,res)=>{try{
 const rel=new URL(req.url,'http://localhost').pathname;
 if(/^\/user\/images\//.test(rel)){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const profile=(id,name,extra={})=>({id,name,aliases:[],subject:'girl',appearance:'short black hair',defaultOutfit:'grey hoodie',positive:'',negative:'',cardKey:'',...extra});
const sceneOf=(characters,unregistered)=>({characters,unregistered,location:'cafe',lighting:'sunlight',camera:'medium shot',interaction:''});
const mira={id:'mira',name:'Mira',expression:'smile',action:'standing',position:'auto',outfitMode:'unchanged',outfit:''};
const leo={id:'leo',name:'Leo',expression:'calm',action:'sitting',position:'auto',outfitMode:'unchanged',outfit:''};
async function setup({profiles,extraction,init=''}){
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const sent=[];
 await page.route('**/api/plugins/naice-shot/**',async route=>{const u=new URL(route.request().url());
  if(u.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);
   return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:1,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});}
  route.fulfill({json:{items:[],total:0,hasMore:false}});});
 await page.addInitScript(cfg=>{document.addEventListener('DOMContentLoaded',()=>{const m=window.mock;
  m.extensionSettings.naice_shot.profiles=cfg.profiles;m.extensionSettings.naice_shot.positive='masterpiece';m.extraction=cfg.extraction;m.drafts=[];
  const base=m.generateRaw;m.generateRaw=async function(options){if(options.prompt.startsWith('Convert ONE character description')){this.drafts.push(options.prompt);return JSON.stringify({name:'',aliases:[],subject:'boy',appearance:'silver hair',defaultOutfit:'coat',positive:'',negative:''});}return base.call(this,options);};
  if(cfg.init)new Function('m',cfg.init)(m);});},{profiles,extraction,init});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
 const click=a=>page.locator(`[data-action="${a}"]`).first().click();
 await click('extract');await page.waitForFunction(()=>document.querySelector('#ncs-location').value!=='');
 await page.locator('#ncs-allow-anlas').check();
 return {page,errors,sent,click};
}
const dialogOpen=page=>page.locator('#ncs-missing-dialog').evaluate(d=>d.open);
try{
 // 1) Modal behavior, chat switch, cancel with the box ticked, re-enable.
 let t=await setup({profiles:[profile('mira','Mira')],extraction:sceneOf([mira],['Leo'])});let {page}=t;
 await t.click('generate');await page.waitForFunction(()=>document.querySelector('#ncs-missing-dialog').open);
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');const where=await page.evaluate(()=>{const a=document.activeElement;return a.closest('#ncs-missing-dialog')?'inside':a===document.body||a===document.documentElement?'page':'behind';});assert.notEqual(where,'behind','Tab never reaches panel controls behind the warning');}
 await page.keyboard.press('Escape');
 assert.equal(await dialogOpen(page),false,'Escape closes the warning');assert.equal(await page.locator('#naice-shot-dialog').evaluate(d=>d.open),true,'…but not the panel');
 // Ticked + 취소: nothing is saved.
 await t.click('generate');await page.locator('#ncs-missing-skip').check();await t.click('missing-cancel');
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot?.skipMissingWarning),undefined);assert.equal(t.sent.length,0);
 // Chat switch while the warning is open: it closes, nothing is generated, nothing is saved in the new chat.
 await t.click('generate');await page.locator('#ncs-missing-skip').check();
 await page.evaluate(()=>mock.switchChat('B'));
 assert.equal(await dialogOpen(page),false);assert.equal(t.sent.length,0);
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot?.skipMissingWarning),undefined);
 // Closing the panel also closes the warning.
 await page.evaluate(()=>mock.switchChat('A'));await t.click('extract');await page.waitForFunction(()=>document.querySelector('#ncs-location').value!=='');
 await t.click('generate');await page.waitForFunction(()=>document.querySelector('#ncs-missing-dialog').open);
 await page.evaluate(()=>document.querySelector('#naice-shot-dialog').close());
 await page.waitForFunction(()=>!document.querySelector('#ncs-missing-dialog').open,null,{timeout:2000});
 await page.locator('.ncs-launch-button').click();assert.equal(await dialogOpen(page),false,'no stale warning on reopen');
 // 그래도 그리기 with the box ticked saves it; the line offers to turn it back on.
 await t.click('generate');await page.locator('#ncs-missing-skip').check();await t.click('missing-proceed');await page.locator('#ncs-result img').waitFor();
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.skipMissingWarning),true);
 assert.match(await page.locator('#ncs-left-out').innerText(),/생성 전 경고창을 띄우지 않아요/);
 await t.click('missing-reenable');assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.skipMissingWarning),undefined);
 await t.click('generate');await page.waitForFunction(()=>document.querySelector('#ncs-missing-dialog').open);
 assert.match(await page.locator('#ncs-missing-dialog').innerText(),/원문 앞부분\(최대 4,000자\)|Leo · 대화 중인 캐릭터/);
 await t.click('missing-cancel');
 assert.deepEqual(t.errors,[]);await page.close();

 // 2) Pending link: does not follow into another chat; survives a failed save.
 t=await setup({profiles:[profile('leo','Leo',{subject:'boy'})],extraction:sceneOf([leo],['Mira'])});page=t.page;
 await page.locator('#ncs-missing-main [data-missing-do="direct"]').click();
 await page.evaluate(()=>{mock.switchChat('B');});
 await page.locator('#ncs-profile-name').fill('Mira');await page.locator('#ncs-profile-appearance').fill('red hair');
 await page.locator('#ncs-profile-submit').click();await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.some(p=>p.name==='Mira'));
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot?.bindings?.userProfileId),undefined,'chat B got no user link from chat A');
 await page.close();
 t=await setup({profiles:[profile('mira','Mira')],extraction:sceneOf([mira],['Leo'])});page=t.page;
 await page.locator('#ncs-missing-main [data-missing-do="direct"]').click();
 await page.locator('#ncs-profile-subject').selectOption('boy');await page.locator('#ncs-profile-appearance').fill('silver hair');
 await page.locator('#ncs-profile-aliases').fill('x'.repeat(120));await page.locator('#ncs-profile-submit').click();
 await page.waitForFunction(()=>/별칭 목록을 확인해 주세요/.test(document.querySelector('#ncs-notice').textContent));
 await page.locator('#ncs-profile-aliases').fill('');await page.locator('#ncs-profile-submit').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.some(p=>p.name==='Leo'));
 assert.equal(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.name==='Leo').cardKey),'Leo.png','card link kept after fixing the error');
 assert.deepEqual(t.errors,[]);await page.close();

 // 3) Linking: exact alias even when names partly match; refusal on a name another profile owns; undo.
 t=await setup({profiles:[profile('mira','Mira'),profile('lp','Leo Park',{subject:'boy'}),profile('kai','Kai',{subject:'boy',aliases:['Leo']}),profile('other','Other',{aliases:['Leo']})],extraction:sceneOf([mira],['Leo'])});page=t.page;
 // A unique saved alias is now recovered automatically. Keep this one ambiguous so the warning
 // remains, then verify that linking Leo Park cannot steal a name already owned by other profiles.
 assert.match(await page.locator('#ncs-missing-main').innerText(),/프로필 연결을 확정하지 못해서/);
 await page.locator('#ncs-missing-main [data-missing-do="link"]').click();await page.locator('#ncs-link-profile').selectOption('lp');
 await page.locator('#ncs-missing-main [data-missing-do="link-confirm"]').click();
 await page.waitForFunction(()=>/이미 Kai, Other 프로필의 이름·별칭이에요/.test(document.querySelector('#ncs-notice').textContent));
 assert.deepEqual(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='lp').aliases),[]);
 await page.close();
 t=await setup({profiles:[profile('mira','Mira'),profile('lp','Leo Park',{subject:'boy'})],extraction:sceneOf([mira],['Leo'])});page=t.page;
 await page.locator('#ncs-missing-main [data-missing-do="link"]').click();await page.locator('#ncs-link-profile').selectOption('lp');
 await page.locator('#ncs-missing-main [data-missing-do="link-confirm"]').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='lp').aliases.includes('Leo'));
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.bindings.characterProfileId),'lp');
 assert.equal(await page.locator('[data-character="lp"]').count(),1);
 assert.match(await page.locator('#ncs-missing-main .ncs-link-done').innerText(),/Leo Park 프로필에 연결했어요/);
 await page.locator('[data-missing-do="link-undo"]').click();
 await page.waitForFunction(()=>!mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='lp').aliases.includes('Leo'));
 assert.equal(await page.evaluate(()=>mock.chatMetadata.naice_shot.bindings.characterProfileId),undefined,'chat link restored');
 assert.equal(await page.locator('[data-character="lp"]').count(),0,'removed from the scene');
 assert.match(await page.locator('#ncs-missing-main .ncs-missing-main').innerText(),/"Leo"의 프로필이 없어서/,'warning back');
 assert.deepEqual(t.errors,[]);await page.close();

 // 4) Group chat: member warning, card link on linking, {{char}}/{{user}} filled in the description sent.
 const groupInit=`m.characters.push({name:'Kai',avatar:'Kai.png',description:'{{char}} is tall with silver hair and smiles at {{user}}.'});m.groupId='g1';m.groups=[{id:'g1',members:['Leo.png','Kai.png']}];`;
 t=await setup({profiles:[profile('mira','Mira'),profile('leo','Leo',{subject:'boy'}),profile('kd','Kade',{subject:'boy'})],extraction:sceneOf([mira],['Kai']),init:groupInit});page=t.page;
 assert.match(await page.locator('#ncs-missing-main').innerText(),/그룹 멤버 "Kai"의 프로필이 없어서/);
 await page.locator('#ncs-missing-main [data-missing-do="source"]').click();await page.waitForFunction(()=>mock.drafts.length===1);
 const sentText=await page.evaluate(()=>mock.drafts[0]);
 assert.match(sentText,/Kai is tall with silver hair and smiles at Mira\./);assert.doesNotMatch(sentText,/\{\{/);
 await page.locator('[data-action="close-quick-profile"]').click();
 await page.locator('#ncs-missing-main [data-missing-do="link"]').click();await page.locator('#ncs-link-profile').selectOption('kd');
 await page.locator('#ncs-missing-main [data-missing-do="link-confirm"]').click();
 await page.waitForFunction(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='kd').cardKey==='Kai.png');
 assert.ok(await page.evaluate(()=>mock.extensionSettings.naice_shot.profiles.find(p=>p.id==='kd').aliases.includes('Kai')));
 assert.deepEqual(t.errors,[]);await page.close();
 console.log('PASS: warning is a real modal (Tab/Escape), closes on chat switch and panel close without generating or saving, cancel never saves "don\'t ask", re-enable works; pending link stays in its chat and survives a failed save; exact alias added despite partial name match, name owned by another profile refused, undo restores alias/link/scene; group member card link and filled {{char}}/{{user}}');
}finally{await browser.close();server.close();}
