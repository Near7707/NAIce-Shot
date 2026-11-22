// Screen language (English): no fixed Korean text of the app comes out of the English screen's trMsg/localize half translated.
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
    assert.equal(trMsg('오래된 장부가 서랍에 있어요. 다시 찾아 주세요.'),'오래된 장부가 서랍에 있어요. 다시 찾아 주세요.');
    assert.equal(trMsg('이 장면은 아직 저장하지 않았어요.'),'이 장면은 아직 저장하지 않았어요.');
    // localize reads text nodes with the same lookup
    // (any Korean text not in the dictionary with a space and a "장"; the app's own sentences are all in it since the fourteenth review)
    const node={nodeValue:' 새 장갑을 고른 뒤 다시 눌러 주세요. ',parentElement:null};
    const fake={ownerDocument:{createTreeWalker:()=>{let done=false;return {nextNode:()=>done?null:(done=true,node)};}},querySelectorAll:()=>[],nodeType:11};
    localize(fake);assert.equal(node.nodeValue,' 새 장갑을 고른 뒤 다시 눌러 주세요. ');
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

test('names in the warnings stay as written even when they read like an app sentence; two chat shot texts in English (GPT wip-en P3, thirteenth review)',()=>{
  setLang('en');
  try{
    const S='위치 값이 잘못됐어요.'; // a name (or alias) word for word an app sentence
    const cases={
      [`${S}: Leo와 같은 인물로 보여 한 번만 넣었어요.`]:`${S}: looks like the same person as Leo, so added once.`,
      [`Mira: 이름에 맞춰 ${S} 프로필로 연결을 바로잡았어요.`]:`Mira: the link was corrected to the ${S} profile to match the name.`,
      [`${S}: 자동 연결 없음. 이름·별칭 또는 이 채팅의 연결을 확인해 주세요.`]:`${S}: no automatic match. Check names and aliases, or this chat's profile link.`,
      [`${S}: 프로필을 확정하지 못해 자동 적용하지 않았어요. 장면 정보는 보관했어요.`]:`${S}: the profile is not settled, so it was not applied automatically. The scene details are kept.`,
      [`${S}: 새 복장 후보가 있지만 잠금을 유지해요.`]:`${S}: a new outfit was found, but the lock is kept.`,
      [`임시 인물 ${S}의 외형이 비어 있어요. 외형을 채우면 더 잘 그려져요.`]:`The temporary person ${S} has no look. Filling it in draws them better.`,
      [`${S} 복장 · 장면에서 찾지 못함`]:`${S} outfit · not found in the scene`, // a piece of "Not applied: …" (user, 2026-11-22)
      [`장면 설명에 들어간 이름(Mira, ${S})을 빼고 일반 표현으로 정리했어요.`]:`Removed the names in the scene description (Mira, ${S}) and used general wording instead.`,
      '장면 설명에 들어간 이름(Mira, Leo)을 빼고 일반 표현으로 정리했어요.':'Removed the names in the scene description (Mira, Leo) and used general wording instead.',
      '추출 인물의 name 필드가 없어요. 실제 인물 이름을 함께 반환해야 해요.':'A person in the result has no name field. The reply must include the real name of each person.'};
    for(const [ko,en] of Object.entries(cases))assert.equal(trMsg(ko),en,ko);
  }finally{setLang('ko');}
});

test('프리샷 question: card names that read like an app sentence stay as written (GPT wip-en P3, fourteenth review)',async()=>{
  const {confirmText}=await import('../free-people.mjs');
  const S='위치 값이 잘못됐어요.';
  const text=confirmText({removed:[{temp:true,name:S},{temp:true,name:'복사했어요.'}],pinnedOut:[{id:'p1',included:true}],refilled:[{temp:true,name:S}]},[{id:'p1',name:S}]);
  setLang('en');
  try{
    assert.equal(trMsg(text),['Some character cards are not in the text.',`Will be removed: ${S}, 복사했어요. (not pinned)`,`Will only be unticked: ${S} (📌 pinned)`,
      `Look refilled from the new result: ${S} (temporary, not pinned)`,'','OK: extract as it is · Cancel: go back to edit the text or 📌 pin'].join('\n'));
  }finally{setLang('ko');}
  assert.equal(trMsg(text),text,'Korean: as written');
});

// Every whole sentence the app's own code writes (a quoted text ending in 요. or 요?) is in the dictionary: notices, thrown
// errors and warnings reach the English screen through trMsg, so one missing sentence shows as Korean. The panel turns
// 스텝 into Steps first, so both spellings are tried. Kept out on purpose, with the reason:
const NOT_SHOWN={
  'NAIce Shot 패널 파일을 읽지 못했어요.':'console only, before the panel exists',
  '과(와) 이름이 같은 프로필이 여러 개라 연결하지 못했어요.':'a piece of the missing-person sentence, read by localize as a whole',
  '에 연결된 프로필이 없어요.':'a piece of the missing-person sentence, read by localize as a whole',
  '이번 생성에서 Anlas가 차감될 수 있어요.':'a piece of the V5 questions, checked whole below'};
const stepsWord=text=>String(text).replace(/(\d+)스텝/g,'$1 Steps').replace(/스텝은/g,'Steps는').replace(/스텝/g,'Steps');
test('every whole sentence of the app is English on the English screen; none is left in Korean (GPT wip-en P3, fourteenth review)',()=>{
  const own=files.filter(f=>path.dirname(f)===root);const found=new Set();
  for(const f of own)for(const line of fs.readFileSync(f,'utf8').split('\n')){
    if(/^\s*\/\//.test(line))continue;
    for(const m of line.matchAll(/'([^'\n\\<>]*[가-힣][^'\n\\<>]*)'/g))if(/요[.?]$/.test(m[1]))found.add(m[1]);}
  assert.ok(found.size>150,`found the app's sentences (${found.size})`);
  setLang('en');
  try{
    const korean=[...found].filter(t=>!NOT_SHOWN[t]&&/[가-힣]/.test(trMsg(stepsWord(t))));
    assert.deepEqual(korean,[]);
    const may='이번 생성에서 Anlas가 차감될 수 있어요.';
    for(const t of [`V5 사용량을 확인하지 못했어요. ${may}`,`V5 기본 사용량이 0%로 표시돼요 (추가 구매 30%). ${may}`,`V5 사용량이 12% 남았어요. ${may}`])
      assert.doesNotMatch(trMsg(t),/[가-힣]/,t);
  }finally{setLang('ko');}
});

test('프리샷 notices while waiting and the notices put together from pieces are English (GPT wip-en P3, fourteenth review)',async()=>{
  const {lengthProblem}=await import('../mentions.mjs');
  setLang('en');
  try{
    const cases={
      '작업 내용이 바뀌어서 채운 결과를 적용하지 않았어요.':'The work changed, so the filled result was not applied.',
      '추출하는 동안 상황 글이 바뀌어서 결과를 적용하지 않았어요. 바꾼 글로 다시 눌러 주세요.':'The situation text changed during extraction, so the result was not applied. Press again with the new text.',
      [lengthProblem('a'.repeat(4100),'free')]:'The situation text is too long. Up to 4,000 characters as shown on screen. (now 4,100)',
      [lengthProblem('a'.repeat(201),'wish')]:'The extra request is too long. Up to 200 characters as shown on screen. (now 201)',
      [`@이름을 프로필에 연결하면 ${lengthProblem('a'.repeat(4100),'free')}`]:'Linking the @names to profiles makes the situation text too long. Up to 4,000 characters as shown on screen. (now 4,100)',
      [stepsWord('스텝은 1~50으로 입력해 주세요.')]:'Enter Steps from 1 to 50.'};
    for(const [ko,en] of Object.entries(cases))assert.equal(trMsg(ko),en,ko);
    for(const label of ['상황 글','추가 요청']){
      for(const x of ['다른 프로필로 바꾸지','@이름을 넣지','붙여 넣지'])assert.doesNotMatch(trMsg(`${label}이 너무 길어서 ${x} 못했어요.`),/[가-힣]/);
      assert.doesNotMatch(trMsg(`${label}이 글자 수 한도를 넘었어요. 줄이기 전에는 추출하거나 생성할 수 없어요.`),/[가-힣]/);
      assert.doesNotMatch(trMsg(`${label}에 @프로필 연결이 너무 많아요. 줄여 주세요.`),/[가-힣]/);
      assert.doesNotMatch(trMsg(`@이름을 프로필에 연결하면 ${label}에 @프로필 연결이 너무 많아요. 줄여 주세요.`),/[가-힣]/);}
  }finally{setLang('ko');}
});

test('names and tags in errors stay as written; the @ people limit is English (GPT wip-en P3, fifteenth review)',()=>{
  setLang('en');
  try{
    const S='그릴 상황을 적어 주세요.'; // a name or tag word for word an app sentence (in the dictionary since the fourteenth review)
    const cases={
      [`"${S}" 옷의 태그가 비어 있거나 너무 길어요.`]:`The tags of the "${S}" outfit are empty or too long.`,
      [`"${S}"은(는) 이미 Mira의 옷장에 있어요. 다른 이름을 붙여 주세요.`]:`"${S}" is already in Mira's wardrobe. Please give it another name.`,
      [`"Leo"은(는) 이미 ${S} 프로필의 이름·별칭이에요. 같은 이름이 두 프로필에 있으면 자동 연결이 안 돼요. 그 프로필을 고르거나, 그쪽 별칭을 먼저 정리해 주세요.`]:
        `"Leo" is already a name or alias of the ${S} profile. With the same name on two profiles, automatic linking does not work. Pick that profile, or tidy its aliases first.`,
      [`태그는 30자까지예요: "${S}…"`]:`A tag can be up to 30 characters: "${S}…"`,
      '@로 지정한 필수 인물이 23명이라 지금 모델의 한도(22명)를 넘어요. 일부의 @를 지워 주세요.':"23 required people are set with @, over the current model's limit (22). Remove the @ from some of them.",
      '상황은 180,000자까지 적을 수 있어요.':'The situation can be up to 180,000 characters.'};
    for(const [ko,en] of Object.entries(cases))assert.equal(trMsg(ko),en,ko);
  }finally{setLang('ko');}
});

// Sentences with values put in (a template thrown, noticed, pushed as a warning or returned as a message): every one is
// English with its values filled in, except these, kept out on purpose:
const PIECED=[
  /^X의 @참조를 확인해 주세요/,  // joins the user's @names and several problems into one line: needs a code change (known limit)
  /^@X: |^X: 같은 이름·별칭의 프로필이 여러 개예요/, // the @ problems above, never shown alone
  /^@이름을 프로필에 연결하면 X$/,/^X이 너무 길어서 X 못했어요/,/^X이 글자 수 한도를 넘었어요/, // pieces, checked whole above
  /^X 필드 형식이 잘못됐어요|^캐릭터가 중복됐어요: X|^X 값이 문자열이 아니에요/]; // only shown inside "JSON을 읽지 못했어요: …"
test('every sentence with values in it is English on the English screen (GPT wip-en P3, fifteenth review)',()=>{
  const own=files.filter(f=>path.dirname(f)===root);const found=new Set();
  for(const f of own)for(const line of fs.readFileSync(f,'utf8').split('\n')){
    if(/^\s*\/\//.test(line))continue;
    for(const m of line.matchAll(/(?:new Error\(|notice\(|report\(|\.push\(|message:|say\(|toast\()\s*`((?:[^`\\]|\\.)*[가-힣](?:[^`\\]|\\.)*)`/g)){
      if(/</.test(m[1]))continue;found.add(m[1].replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g,'X'));}}
  assert.ok(found.size>15,`found the app's sentences with values (${found.size})`);
  setLang('en');
  try{
    const korean=[...found].filter(t=>!PIECED.some(re=>re.test(t))&&/[가-힣]/.test(trMsg(t)));
    assert.deepEqual(korean,[]);
  }finally{setLang('ko');}
});
