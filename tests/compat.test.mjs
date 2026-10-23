import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCompat,compareVersions,MIN_SERVER_VERSION,REQUIRED_SERVER_FEATURES} from '../compat.mjs';
import {VERSION} from '../core.mjs';
import {hasServer,serverModule,SERVER_DIR} from './server-dir.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
const all=REQUIRED_SERVER_FEATURES;
test('compareVersions is numeric, not alphabetical',()=>{
  assert.equal(compareVersions('0.1.10','0.1.9'),1);assert.equal(compareVersions('0.1','0.1.0'),0);
  assert.equal(compareVersions('0.1.2','0.1.3'),-1);assert.equal(compareVersions('1.0.0','0.9.9'),1);
});
test('compat levels',()=>{
  assert.equal(checkCompat({uiVersion:'0.1.3',status:-1,data:null}).level,'none','network failure stays quiet');
  const missing=checkCompat({uiVersion:'0.1.3',status:404,data:null});assert.equal(missing.level,'error');assert.match(missing.message,/enableServerPlugins/);
  assert.equal(checkCompat({uiVersion:'0.1.3',status:500,data:{error:'x'}}).level,'none','error JSON without a version is not compared');
  const old=checkCompat({uiVersion:'0.2.0',status:200,data:{version:'0.0.9',features:all},minServer:'0.1.0'});
  assert.equal(old.level,'warn');assert.match(old.message,/서버 플러그인이 이전 버전\(v0\.0\.9\)/);
  assert.equal(checkCompat({uiVersion:'0.1.3',status:200,data:{version:'0.1.3',features:['delete']}}).level,'warn','missing feature');
  const oldUi=checkCompat({uiVersion:'0.1.3',status:200,data:{version:'0.2.0',features:all,minClient:'0.2.0'}});
  assert.equal(oldUi.level,'warn');assert.match(oldUi.message,/확장\(UI\) 파일이/);
  assert.equal(checkCompat({uiVersion:'0.1.3',status:200,data:{version:'0.1.2',features:all},minServer:'0.1.0'}).level,'info');
  assert.equal(checkCompat({uiVersion:'0.1.3',status:200,data:{version:'0.1.3',features:all,minClient:'0.1.0'},minServer:'0.1.0'}).level,'ok');
});
test('this release\'s server satisfies this release\'s UI',{skip:!hasServer&&'NAIce-Shot-Server not found'},async()=>{
  const {VERSION:SERVER_CORE_VERSION}=await serverModule('core.mjs'),{createHandlers}=await serverModule('handlers.mjs');
  // UI-only releases may be ahead of the server; the shared core must still match apart from the version line.
  assert.ok(compareVersions(VERSION,SERVER_CORE_VERSION)>=0);
  let called=0;const handlers=createHandlers({readKey:()=>'k',fetcher:async()=>{called++;return new Response('{}');}});
  const res={statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(d){this.body=d;return this;}};
  await handlers.status({user:{directories:{root:'/nonexistent',userImages:'/nonexistent/images'}},query:{quick:'1'}},res);
  assert.equal(called,0,'quick status never calls NovelAI');
  assert.equal(res.body.keyConfigured,true);assert.equal(res.body.version,SERVER_CORE_VERSION);
  assert.ok(['ok','info'].includes(checkCompat({uiVersion:VERSION,status:200,data:res.body}).level),'no banner for this release pair');
  assert.ok(compareVersions(res.body.version,MIN_SERVER_VERSION)>=0);
});
test('UI and server share the same core apart from the version line',{skip:!hasServer&&'NAIce-Shot-Server not found'},async()=>{
  const body=async p=>(await fs.readFile(new URL(p,import.meta.url),'utf8')).split('\n').slice(1).join('\n');
  assert.equal(await body('../core.mjs'),(await fs.readFile(path.join(SERVER_DIR,'core.mjs'),'utf8')).split('\n').slice(1).join('\n'));
});
