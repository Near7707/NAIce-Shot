// v0.1.169: the last Korean left on the English screen that the app can show — the 프리샷 card question's names for a
// card with no name, an outfit request the AI sent with no name, and the server plugin's texts that reach the panel.
// Korean reads exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setLang,trMsg} from '../i18n.mjs';
import {confirmText} from '../free-people.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const HANGUL=/[가-힣]/;
const en=fn=>{setLang('en');try{return fn();}finally{setLang('ko');}};

test('프리샷 card question: a card with no name reads in English, a name stays as written; Korean as before',()=>{
  const plan={removed:[{temp:true,name:''},{id:'gone'}],pinnedOut:[{id:'p1',included:true}],refilled:[]};
  const profiles=[{id:'p1',name:'세로'}];
  const text=en(()=>trMsg(confirmText(plan,profiles)));
  assert.equal(text.split('\n')[1],'Will be removed: Unnamed person, Person (not pinned)');
  assert.equal(text.split('\n')[2],'Will only be unticked: 세로 (📌 pinned)');
  assert.ok(!HANGUL.test(text.replace('세로','')),text);
  const ko=confirmText(plan,profiles);
  assert.equal(ko.split('\n')[1],'지워져요: 이름 없는 인물, 인물 (고정 안 함)');
  assert.equal(trMsg(ko),ko);
});

test('Not applied: an outfit request with no name reads in English; a named one keeps its name; Korean as before',()=>{
  en(()=>{
    assert.equal(trMsg('인물 복장 · 장면에서 찾지 못함'),'outfit (no name) · not found in the scene');
    assert.equal(trMsg('Mira 복장 · 장면에서 찾지 못함'),'Mira outfit · not found in the scene');
  });
  assert.equal(trMsg('인물 복장 · 장면에서 찾지 못함'),'인물 복장 · 장면에서 찾지 못함');
});

// Every text the server sends to the panel (PublicError / fail400 / the internal-error reply). Plain Errors inside the
// server (ZIP, prompt checks) never reach the panel: the reply turns them into the internal-error text.
const SERVER=['실리태번 사용자 경로를 찾지 못했어요.','NAI 계정 확인 시간이 초과됐어요. 생성 요청은 보내지 않았어요.',
  'NAI 계정 확인 실패 (응답을 읽지 못했어요). 생성 요청은 보내지 않았어요.','NAI 계정 확인 실패 (연결하지 못했어요). 생성 요청은 보내지 않았어요.',
  '요청 처리 중 내부 오류가 발생했어요. 설치 경로와 파일 접근 권한을 확인해 주세요.','채팅 정보가 잘못됐어요.','요청 ID가 잘못됐어요.',
  '확인할 이미지 ID가 잘못됐어요.','다른 창이나 기기에서 작업이 바뀌었어요. 현재 작업은 화면에 유지했어요.','작업 내용이 너무 커요.',
  '이미지 ID 목록이 잘못됐어요.','삭제할 이미지 ID가 잘못됐어요.','요청 ID 또는 채팅 정보가 잘못됐어요.','상황 글 형식이 잘못됐어요.',
  '요청 크기가 너무 커요.','이 요청의 그림 파일을 확인하지 못했어요. 같은 요청의 상태를 확인해 주세요.',
  '이미 보낸 요청이에요. 같은 요청의 결과를 확인해 주세요.','서버에 요청을 준비하지 못했어요. NovelAI로 보내지 않았어요.'];

test('the server texts that reach the panel read in English; Korean as before',()=>{
  const dir=['naice-shot-server','NAIce-Shot-Server'].map(d=>path.resolve(root,'..',d)).find(d=>fs.existsSync(path.join(d,'handlers.mjs')));
  if(dir){const src=fs.readFileSync(path.join(dir,'handlers.mjs'),'utf8');for(const t of SERVER)assert.ok(src.includes(`'${t}'`),`still a server text: ${t}`);
    assert.ok(src.includes('`NAI 계정 확인 실패 (${response.status}).`'),'the status form is still the server text');}
  en(()=>{
    for(const t of SERVER){const out=trMsg(t);assert.ok(!HANGUL.test(out),`${t} → ${out}`);}
    assert.equal(trMsg('NAI 계정 확인 실패 (502).'),'NAI account check failed (502).');
  });
  for(const t of SERVER)assert.equal(trMsg(t),t);
});
