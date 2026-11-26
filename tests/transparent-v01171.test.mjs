// 0.1.171 Transparent BG: the extraction prompts carry the rule only when asked, and are otherwise unchanged;
// the save menu says what happens to transparency (both languages).
import test from 'node:test';
import assert from 'node:assert/strict';
import {freeScenePrompt,TRANSPARENT_RULE} from '../free-scene.mjs';
import {momentExtractionPrompt} from '../scene-extraction.mjs';
import {SAVE_NOTES} from '../inline-images.mjs';
import {setLang,trMsg} from '../i18n.mjs';

const profiles=[{id:'leo',name:'Leo',aliases:[],subject:'boy',appearance:'',defaultOutfit:'',positive:'',negative:''}];
const messages=[{name:'Leo',text:'Leo eats ice cream.',isUser:false}];
test('free and chat extraction prompts add the transparent rule only when it is on', ()=>{
  const free=freeScenePrompt('Leo eats ice cream',profiles,[],'tags');
  assert.equal(freeScenePrompt('Leo eats ice cream',profiles,[],'tags',[],null,false),free);
  const freeOn=freeScenePrompt('Leo eats ice cream',profiles,[],'tags',[],null,true);
  assert.ok(!free.includes('TRANSPARENT BACKGROUND'));assert.equal(freeOn.split(TRANSPARENT_RULE).length,2);
  assert.equal(freeOn.replace(`\n${TRANSPARENT_RULE}`,''),free,'only that line is added');
  for(const lang of ['ko','en'])for(const wish of ['','in the rain']){
    const off=momentExtractionPrompt(messages,profiles,{},'tags',[],wish,[],lang);
    assert.equal(momentExtractionPrompt(messages,profiles,{},'tags',[],wish,[],lang,false),off);
    const on=momentExtractionPrompt(messages,profiles,{},'tags',[],wish,[],lang,true);
    assert.ok(!off.includes('TRANSPARENT BACKGROUND'));assert.equal(on.replace(`\n${TRANSPARENT_RULE}`,''),off);
  }
  assert.match(TRANSPARENT_RULE,/Leave location empty/);
});
test('the save menu notes say what happens to a transparent background', ()=>{
  assert.match(SAVE_NOTES.shared,/투명한 부분은 흰색이 돼요\.$/);assert.match(SAVE_NOTES.original,/투명 배경도 그대로예요\.$/);
  setLang('en');
  assert.equal(trMsg(SAVE_NOTES.shared),'A copy without metadata such as the prompt and seed. Transparent parts turn white.');
  assert.equal(trMsg(SAVE_NOTES.original),'Saved as is, with metadata such as the prompt and seed. A transparent background stays transparent.');
  setLang('ko');
});
