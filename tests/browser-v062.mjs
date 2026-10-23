// v0.6.2: field-by-field final prompt editor kept in sync with the advanced JSON box.
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
 const bytes=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(req.method==='HEAD'?undefined:bytes);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sent=[];
await page.route('**/api/plugins/naice-shot/**',async route=>{const u=new URL(route.request().url());
 if(u.pathname.endsWith('/generate')){const b=route.request().postDataJSON();sent.push(b);
  return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,options:b.options,assembled:b.assembled,snapshot:b.snapshot}});}
 route.fulfill({json:{items:[],total:0,hasMore:false}});});
const click=action=>page.locator(`[data-action="${action}"]`).first().click();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#ncs-extension-settings > summary').click();await page.locator('.ncs-launch-button').click();
 await click('extract');await page.locator('[data-character="leo"]').waitFor();
 await page.locator('#ncs-final-box > summary').click();
 const slot=page.locator('#ncs-final-form [data-final="prompt"][data-slot="0"]');
 assert.match(await slot.inputValue(),/brown hair/,'form shows the assembled slot prompt');
 assert.equal(await page.locator('#ncs-final-form [data-final="base"]').count(),1);
 assert.equal(await page.locator('#ncs-final').isVisible(),false,'JSON is folded away as the advanced view');
 assert.equal(await page.locator('#ncs-final-badge').isHidden(),true);

 // Edit one slot field: JSON follows, badge shows, the field keeps focus and text.
 await slot.fill('1boy, brown hair, waving');
 assert.equal(await page.locator('#ncs-final-badge').isVisible(),true);
 assert.equal(JSON.parse(await page.locator('#ncs-final').inputValue()).characters[0].prompt,'1boy, brown hair, waving');
 assert.equal(await slot.inputValue(),'1boy, brown hair, waving');
 await page.locator('#ncs-final-form [data-final="negative"]:not([data-slot])').fill('lowres');
 await page.locator('#ncs-final-form [data-final="position"][data-slot="0"]').selectOption('left');
 // A settings change keeps the manual edit.
 await page.locator('[data-tab="settings"]').click();await page.locator('#ncs-steps').fill('20');await page.locator('[data-tab="scene"]').click();
 assert.equal(await slot.inputValue(),'1boy, brown hair, waving');
 // The generation request carries the edited fields.
 await page.locator('#ncs-allow-anlas').check();await click('generate');await page.locator('#ncs-result img').waitFor();
 const a=sent.at(-1).assembled;
 assert.equal(a.characters[0].prompt,'1boy, brown hair, waving');assert.equal(a.negative,'lowres');assert.equal(a.characters[0].position,'left');

 // Editing the advanced JSON updates the form.
 await page.locator('#ncs-final').evaluate(el=>el.closest('details').open=true);
 const json=JSON.parse(await page.locator('#ncs-final').inputValue());json.base='edited in json';
 await page.locator('#ncs-final').fill(JSON.stringify(json,null,2));
 await page.locator('#ncs-final-box > p').click(); // leave the JSON box
 await page.locator('[data-tab="settings"]').click();await page.locator('[data-tab="scene"]').click();
 assert.equal(await page.locator('#ncs-final-form [data-final="base"]').inputValue(),'edited in json');

 // Reset returns to the assembled prompt.
 await click('reset-final');
 assert.match(await slot.inputValue(),/brown hair/);assert.doesNotMatch(await slot.inputValue(),/waving/);
 assert.equal(await page.locator('#ncs-final-badge').isHidden(),true);

 // AI output that names people or uses template macros is cleaned before it reaches the prompt.
 await page.evaluate(()=>{mock.extraction={characters:[{id:'leo',name:'Leo',expression:'Smile',action:'looking at Mira, Sitting',position:'auto',outfitMode:'unchanged',outfit:''}],
  unregistered:[],location:"Mira's bedroom, Night",lighting:'dim_lighting',camera:'{{user}} pov',interaction:'Leo talks to Mira'};});
 await click('extract');await page.waitForFunction(()=>document.querySelector('#ncs-location').value==='bedroom, night');
 assert.equal(await page.locator('#ncs-camera').inputValue(),'pov');assert.equal(await page.locator('#ncs-lighting').inputValue(),'dim lighting');
 assert.equal(await page.locator('[data-character="leo"] [data-field="action"]').inputValue(),'looking at another, sitting');
 assert.match(await page.locator('#ncs-notice').textContent(),/이름\(.*Mira.*\)을 빼고 일반 표현으로/);
 assert.doesNotMatch(await page.locator('#ncs-final').inputValue(),/Mira|\{\{/);
 assert.match(JSON.stringify(await page.evaluate(()=>mock.lastExtract)),/GENERIC VISUALS/);
 // Mobile: the editor fits.
 await page.setViewportSize({width:375,height:760});
 assert.ok(await page.locator('.ncs-content').evaluate(c=>c.scrollWidth<=c.clientWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: field editor shows assembled prompt, edits sync to JSON and generation, survive settings changes, JSON edits sync back, reset, AI names and macros cleaned out of the prompt, 375px');
}finally{await browser.close();server.close();}
