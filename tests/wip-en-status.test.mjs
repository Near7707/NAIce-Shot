// wip-en: the work-memory line above the drawing fields swaps its text each time typing stops ("saving" → "kept").
// On an iPhone the long English "The last work is remembered on the server." went to two lines while "Saving the last
// work…" fits in one, so every pause pushed the fields down and up (the user's iPhone, Free Shot). The texts that swap
// while typing stay short in English, no longer than the Korean ones that never wrapped.
// The real cause on the user's iPhone (second screenshot): the note left there after loading saved work ("Loaded the
// scene you were working on in Free Shot. …", 79 characters, two lines) swaps with "Saving the last work…" on every
// pause. The Korean note (39 characters) fits one line there; the iPhone fits about 55 English characters a line.
import test from 'node:test';
import assert from 'node:assert/strict';
import EN from '../i18n-en.mjs';

test('wip-en: the work-memory texts that swap while typing are short in English',()=>{
 for(const ko of ['마지막 작업 저장 중…','마지막 작업을 서버에 기억해요.','마지막 작업을 불러오는 중…']){
  const en=EN[ko];assert.ok(en,`${ko} has English`);
  assert.ok(en.length<=24,`"${en}" is short enough for one line on a phone (${en.length} characters)`);
 }
});

test('wip-en: the notes that stay on the work-memory line fit one phone line in English (the long stale note: two)',()=>{
 for(const ko of ['프리샷에서 작업하던 장면을 불러왔어요. AI를 다시 호출하지 않았어요.','이 채팅에서 작업하던 장면을 불러왔어요 · 대상 메시지: 최신',
  '이 채팅에서 작업하던 장면을 불러왔어요 · 대상 메시지 #{0}','서버에서 삭제된 작업이라 화면을 비웠어요.','작업을 불러오지 못했어요. 다시 시도해 주세요.']){
  const en=EN[ko];assert.ok(en,`${ko} has English`);
  assert.ok(en.replace('{0}','1234').length<=48,`"${en}" fits one line on a phone (${en.length} characters)`);
 }
 const stale=EN['이 채팅에서 작업하던 장면을 불러왔어요. 원문이나 리롤이 바뀌었으니 대상·추가 요청과 프롬프트를 다시 확인해 주세요.'];
 assert.ok(stale.length<=100,`the stale note is two lines at most, like the Korean (${stale.length} characters)`);
});
