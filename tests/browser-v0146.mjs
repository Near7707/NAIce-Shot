// Anlas balance and cost wording per account, the consent block vs NovelAI errors, and balance refresh.
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
 if(rel.startsWith('/user/images/naice-shot/')){res.setHeader('Content-Type','image/png');res.end(png);return;}
 const file=path.join(root,rel==='/'?'tests/fixture.html':rel);if(!file.startsWith(root+'/'))throw Error();
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript');res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.NAICE_SHOT_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const features=['paged-history','delete','private-records','all-history','privacy-controls','draft-work','draft-delete','free-text','draft-tombstone','nai-error-codes'];
try{
 for(const width of [1100,375]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(9000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  // Mock account: tier, balance, and whether the full status check fails. /generate can answer with an error.
  const acct={tier:1,perk:false,fixed:1000,purchased:5,statusFails:false,statusCalls:0,generateError:null,generated:0};
  await page.route('**/api/plugins/naice-shot/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/status')){
    if(u.searchParams.get('quick')==='1')return route.fulfill({json:{keyConfigured:true,version:'0.1.12',features,minClient:'0.1.44'}});
    acct.statusCalls++;if(acct.statusFails)return route.fulfill({status:502,json:{error:'NAI 계정 확인 실패 (503).'}});
    return route.fulfill({json:{keyConfigured:true,version:'0.1.12',features,subscription:{tier:acct.tier,active:true,isGracePeriod:false,usage:acct.usage,perks:{unlimitedImageGeneration:acct.perk},anlas:{subscription:acct.fixed,purchased:acct.purchased}}}});
   }
   if(u.pathname.endsWith('/draft'))return route.fulfill({json:route.request().method()==='GET'?{revision:null,work:null}:{revision:'r'}});
   if(u.pathname.endsWith('/history'))return route.fulfill({json:{items:[],total:0,hasMore:false}});
   if(u.pathname.endsWith('/generate')){
    if(acct.generateError)return route.fulfill({status:acct.generateError.status,json:acct.generateError.json});
    const b=route.request().postDataJSON();acct.generated++;acct.fixed-=20;
    return route.fulfill({json:{id:b.requestId,created:new Date().toISOString(),chatKey:b.chatKey,image:`/user/images/naice-shot/${b.requestId}.png`,seed:b.options.seed,assembled:b.assembled,options:b.options,snapshot:b.snapshot}});
   }
   throw Error('Unexpected API '+u.pathname);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#ncs-extension-settings .inline-drawer-toggle').click();await page.locator('.ncs-launch-button').click();
  await page.locator('[data-action="extract"]').click();await page.locator('[data-character="leo"]').waitFor();
  const balance=page.locator('#ncs-anlas-balance'),cost=page.locator('#ncs-cost'),note=page.locator('#ncs-consent-note'),go=page.locator('[data-action="goto-anlas"]'),allow=page.locator('#ncs-allow-anlas');
  const notice=()=>page.locator('#ncs-notice').innerText();
  // 1) Tablet/Scroll: balance, "uses Anlas", consent off → not sent, button only shows the switch.
  await page.waitForFunction(()=>/^Anlas 1,005 · .+ 확인$/.test(document.querySelector('#ncs-anlas-balance').textContent));
  assert.equal(await cost.innerText(),'이 생성은 Anlas를 사용해요.');assert.equal(await page.locator('#ncs-cost-link').isHidden(),true);
  assert.equal(await note.isVisible(),true);assert.equal(await go.isVisible(),true);
  await go.click();assert.equal(await allow.isChecked(),false,'the button never turns it on');
  assert.equal(await allow.evaluate(el=>el===document.activeElement&&el.closest('label').classList.contains('ncs-attention')),true);
  await page.locator('[data-action="generate"]').click();await page.waitForFunction(()=>/허용이 꺼져 있어서 보내지 않았어요/.test(document.querySelector('#ncs-notice').textContent));assert.equal(acct.generated,0);
  // 2) Consent on: sent; afterwards the balance is checked again and shown as a difference since the last check.
  await allow.check();assert.equal(await note.isHidden(),true);assert.equal(await go.isHidden(),true);
  await page.locator('[data-action="generate"]').click();await page.locator('#ncs-result img').waitFor();assert.equal(acct.generated,1);
  await page.waitForFunction(()=>/^Anlas 985 · .+ 확인 · 이전 조회보다 −20$/.test(document.querySelector('#ncs-anlas-balance').textContent));
  assert.doesNotMatch(await balance.innerText(),/이번/,'never called the cost of this image');
  await page.locator('[data-tab="settings"]').click();assert.match(await page.locator('#ncs-status').innerText(),/Tablet · Anlas 985 \(구독 980 \+ 구매 5\)/,'settings shares the same check');
  await page.locator('[data-tab="scene"]').click();
  // 3) The image is made but the balance check fails: still a success, and no old balance shown as current.
  acct.statusFails=true;await page.locator('[data-action="new-seed"]').click();await page.waitForFunction(()=>/잔액 확인 실패 · 다시 확인/.test(document.querySelector('#ncs-anlas-balance').textContent));
  assert.equal(acct.generated,2);assert.match(await notice(),/^생성했어요/);assert.doesNotMatch(await balance.innerText(),/\d/);
  assert.equal(await cost.innerText(),'비용 조건을 확인하지 못했어요.');assert.equal(await note.isHidden(),true,'an unchecked account is left to the server');
  acct.statusFails=false;await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>/^Anlas 965 · .+ 확인 · 이전 조회보다 −40$/.test(document.querySelector('#ncs-anlas-balance').textContent));
  // 4) NovelAI's own Anlas error is shown as such and re-checks the balance; the consent block is different.
  let calls=acct.statusCalls;acct.generateError={status:402,json:{error:'Anlas가 부족해요. 자동 재요청하지 않았어요. (NovelAI 402: Insufficient Anlas)',code:'nai-anlas'}};
  await page.locator('[data-action="new-seed"]').click();await page.waitForFunction(()=>/Anlas가 부족해요.*Insufficient Anlas/.test(document.querySelector('#ncs-notice').textContent));
  for(let i=0;i<30&&acct.statusCalls===calls;i++)await page.waitForTimeout(100);assert.ok(acct.statusCalls>calls,'balance re-checked');
  assert.equal(await go.isHidden(),true,'an Anlas shortage is not a consent problem');
  // Unknown account + consent off: the server refuses with anlas-consent, and the switch is shown.
  await allow.uncheck();acct.statusFails=true;await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>/잔액 확인 실패/.test(document.querySelector('#ncs-anlas-balance').textContent));
  acct.generateError={status:428,json:{error:'비용 조건을 확인하지 못했어요. Anlas 사용 허용이 꺼져 있어서 보내지 않았어요.',code:'anlas-consent'}};
  await page.locator('[data-action="new-seed"]').click();await page.waitForFunction(()=>/허용이 꺼져 있어서 보내지 않았어요/.test(document.querySelector('#ncs-notice').textContent));
  assert.equal(await go.isVisible(),true);assert.equal(await note.isVisible(),true);assert.equal(await allow.isChecked(),false);
  acct.generateError=null;acct.statusFails=false;
  // 5) Opus: V5 "may", with a link to NovelAI; V4.5 within limits is free and needs no consent.
  acct.tier=3;acct.perk=true;acct.usage={percent:82,purchasedPercent:0,isNegative:false,timeUntilNextPercent:600};await page.locator('[data-action="refresh-anlas"]').click();await page.waitForFunction(()=>/^Anlas /.test(document.querySelector('#ncs-anlas-balance').textContent));
  await page.locator('#ncs-gen-box > summary').click();await page.locator('[data-gen="model"]').selectOption('nai-diffusion-5-full');
  assert.equal(await cost.innerText(),'V5 사용량으로 생성해요. 부족하면 Anlas가 차감될 수 있어요.');assert.equal(await page.locator('#ncs-cost-link').isVisible(),true);
  assert.equal(await page.locator('#ncs-cost-link').getAttribute('rel'),'noopener noreferrer');assert.equal(await go.isVisible(),true,'Opus V5 still needs consent');
  await page.locator('[data-gen="model"]').selectOption('nai-diffusion-4-5-full');
  assert.match(await cost.innerText(),/^Opus 무료 조건/);assert.equal(await page.locator('#ncs-cost-link').isHidden(),true);assert.equal(await go.isHidden(),true);
  assert.ok(await page.locator('.ncs-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'fits the width');
  if(process.env.NAICE_TEST_FONTS)await page.locator('#ncs-anlas-box').screenshot({path:`/tmp/naice-anlas-${width}.png`});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: Tablet/Scroll cost line and consent block (button shows the switch only), balance difference since the last check, failed balance check after a finished image, NovelAI Anlas error vs consent refusal, Opus V5 may-cost with link, Opus V4.5 free, 1100/375px');
}finally{await browser.close();server.close();}
