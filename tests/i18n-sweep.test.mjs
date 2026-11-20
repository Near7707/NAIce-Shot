// wip-en: no fixed Korean text of the app comes out of the English screen's trMsg/localize half translated.
// A dictionary pattern with little fixed text ("{0} {1}장{2}", the history count) once matched any text with a space and
// a "장" and cut it out: "삭제된 프로필이 장면에 있어요." showed as "삭제된 프로필이 면에 있어요." (GPT wip-en P3, ninth
// review; 31 texts of the app). Every quoted Korean text in the code (no `${}` in it) is looked up as English: it must
// come back as it was (not in the dictionary yet) or with no Korean left.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setLang,tr,trMsg,localize} from '../i18n.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// The server plugin's texts reach the panel too (errors, check lines): its folder sits next to this one when npm test runs.
const server=['naice-shot-server','NAIce-Shot-Server'].map(d=>path.resolve(root,'..',d)).find(d=>fs.existsSync(path.join(d,'handlers.mjs')));
const files=[...fs.readdirSync(root).filter(f=>/\.(mjs|js)$/.test(f)&&!f.startsWith('i18n')).map(f=>path.join(root,f)),
  ...(server?fs.readdirSync(server).filter(f=>/\.mjs$/.test(f)).map(f=>path.join(server,f)):[])];
const QUOTED=/(['"`])((?:(?!\1)[^\\\n]|\\.)*?[가-힣](?:(?!\1)[^\\\n]|\\.)*?)\1/g;
const unescape=s=>s.replace(/\\n/g,'\n').replace(/\\(['"`\\])/g,'$1');
function texts(){
  const out=new Set();
  for(const f of files)for(const m of fs.readFileSync(f,'utf8').matchAll(QUOTED)){
    if(/\$\{|`/.test(m[2]))continue;out.add(unescape(m[2]));} // a template with values, or a piece cut out of one
  return out;
}

test('every fixed Korean text of the app and the server is either left as it is or fully English (never half translated)',()=>{
  setLang('en');
  try{
    const list=texts();assert.ok(list.size>500,`found the app's texts (${list.size})`);
    const half=[...list].filter(t=>{const out=trMsg(t);return out!==t&&/[가-힣]/.test(out);}).map(t=>`${t} → ${trMsg(t)}`);
    assert.deepEqual(half,[]);
  }finally{setLang('ko');}
});

test('the history count still reads in English where it is made, and is not a pattern for other texts',()=>{
  setLang('en');
  try{
    assert.equal(tr`${tr`총`} ${2}장${tr` · ${1}장 표시`}`,'Total 2 · 1 shown');
    assert.equal(trMsg('삭제된 프로필이 장면에 있어요. 다시 선택해 주세요.'),'삭제된 프로필이 장면에 있어요. 다시 선택해 주세요.');
    assert.equal(trMsg('이 장면은 아직 저장하지 않았어요.'),'이 장면은 아직 저장하지 않았어요.');
    // localize reads text nodes with the same lookup
    // (any Korean text not in the dictionary with a space and a "장"; "외형이나 복장이 비어 있어요." is in it since the twelfth review)
    const node={nodeValue:' 복장 저장이 끝난 뒤 다시 선택해 주세요. ',parentElement:null};
    const fake={ownerDocument:{createTreeWalker:()=>{let done=false;return {nextNode:()=>done?null:(done=true,node)};}},querySelectorAll:()=>[],nodeType:11};
    localize(fake);assert.equal(node.nodeValue,' 복장 저장이 끝난 뒤 다시 선택해 주세요. ');
  }finally{setLang('ko');}
});

test('keys with under 4 fixed letters are tr only: texts not in the dictionary stay whole (GPT wip-en P3, tenth review)',()=>{
  setLang('en');
  try{
    // texts a server or an older version may send, not in the dictionary: each matched a short key before
    for(const t of ['서버 응답 제한 시간: 30초','서버 연결 확인 중…','모델 정보 열기','다른 후보 3','기본 인물 2','남은 시간 1분 5초','설명: 12자'])
      assert.equal(trMsg(t),t,t);
    // the app still makes them in English where it shows them
    assert.equal(tr`${3}초`,'3s');assert.equal(tr`${1}분 ${5}초`,'1m 5s');assert.equal(tr`${'NAIce Shot'} 열기`,'Open NAIce Shot');
    assert.equal(tr`${'Saving'} 중…`,'Saving…');
  }finally{setLang('ko');}
});

test('the attach notices\' open keys are tr only: server texts not in the dictionary stay whole (GPT wip-en P3, eleventh review)',()=>{
  setLang('en');
  try{
    for(const t of ['#3 메시지가 변경됐어요.','편집하지 않았어요. 본문은 그대로예요.'])assert.equal(trMsg(t),t,t);
    // the app still makes them in English where it shows them
    const where=tr`#${3} 메시지${''}`;assert.equal(where,'message #3');
    assert.equal(tr`${'Moved 1 already there below the text.'} 본문은 그대로예요.`,'Moved 1 already there below the text. The message text is unchanged.');
    assert.equal(tr`${where}에 이미 넣은 그림이에요.`,'The picture is already in message #3.');
    // the work memory's own conflict error, shown in the status line
    assert.equal(trMsg('다른 곳에서 작업이 바뀌었어요.'),'The work was changed elsewhere.');
  }finally{setLang('ko');}
});

test('프리샷 question about cards not in the text: every line in English, card names as written (GPT wip-en P3, ninth review)',async()=>{
  const {confirmText}=await import('../free-people.mjs');
  const profiles=[{id:'p1',name:'세로'}]; // a name that is also a dictionary word ("Vertical")
  const text=confirmText({removed:[{temp:true,name:'Mira'}],pinnedOut:[{id:'p1',included:true}],refilled:[{temp:true,name:'보통'}]},profiles);
  setLang('en');
  try{
    assert.equal(trMsg(text),['Some character cards are not in the text.','Will be removed: Mira (not pinned)','Will only be unticked: 세로 (📌 pinned)',
      'Look refilled from the new result: 보통 (temporary, not pinned)','','OK: extract as it is · Cancel: go back to edit the text or 📌 pin'].join('\n'));
  }finally{setLang('ko');}
  assert.equal(trMsg(text),text,'Korean: as written');
});

test('the AI reply read errors are English, also inside "JSON을 읽지 못했어요" and the left-out candidate warning (GPT wip-en P3, twelfth review)',()=>{
  setLang('en');
  try{
    const cases={
      'JSON을 읽지 못했어요: lighting 필드 형식이 잘못됐어요.':'Could not read the JSON: the lighting field has the wrong format.',
      '읽지 못한 후보를 뺐어요: lighting 필드 형식이 잘못됐어요.':'Left out a candidate that could not be read: the lighting field has the wrong format.',
      'JSON을 읽지 못했어요: 캐릭터가 중복됐어요: leo':'Could not read the JSON: a character appears twice: leo',
      '읽지 못한 후보를 뺐어요: 위치 값이 잘못됐어요.':'Left out a candidate that could not be read: The position value is wrong.',
      'JSON을 읽지 못했어요: name 값이 문자열이 아니에요.':'Could not read the JSON: the name value is not text.',
      'JSON을 읽지 못했어요: characters 배열을 확인해 주세요.':'Could not read the JSON: Check the characters list.'};
    for(const [ko,en] of Object.entries(cases))assert.equal(trMsg(ko),en,ko);
    // the field name is never looked up, and a wrapped text the dictionary does not know stays whole
    assert.equal(trMsg('JSON을 읽지 못했어요: 닫기 필드 형식이 잘못됐어요.'),'Could not read the JSON: the 닫기 field has the wrong format.');
    assert.equal(trMsg('장면 추출 실패: x 필드 형식이 잘못됐어요.'),'장면 추출 실패: x 필드 형식이 잘못됐어요.');
    // twelfth review: the ID the AI sent stays as written, even when it ends like an app sentence
    assert.equal(trMsg('미등록 ID 제외: unlisted123'),'Left out an unknown ID: unlisted123');
    assert.equal(trMsg('미등록 ID 제외: x / 위치 값이 잘못됐어요.'),'Left out an unknown ID: x / 위치 값이 잘못됐어요.');
    assert.equal(trMsg('미등록 ID 제외: 위치 값이 잘못됐어요.'),'Left out an unknown ID: 위치 값이 잘못됐어요.','an ID word for word an app sentence');
    assert.equal(trMsg('결과가 영어가 아니어서 영어로 다시 요청하고 있어요.'),'The result is not in English, so asking again for English.');
    assert.equal(trMsg('영어로 바뀌지 않은 칸이 있어요(lighting, action). 직접 고치거나 다시 추출해 주세요.'),'Some fields are not in English (lighting, action). Fix them yourself or extract again.');
    // a name the AI sent before ":" still matches the dictionary only as a whole name (no re-lookup of a non-sentence)
    assert.equal(trMsg('세로: 이름에 맞춰 Kai 프로필로 연결을 바로잡았어요.'),'세로: the link was corrected to the Kai profile to match the name.');
  }finally{setLang('ko');}
});
