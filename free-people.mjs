// 프리샷 people (0.1.59): who stays, who goes and who is filled again when 장면 추출 runs on the written text.
// Pure functions over the scene's cards, so the rules can be tested without a browser.
//   • The local name check (mentioned) only decides which cards are KEPT. Finding too much keeps a card; whether
//     the person is actually visible is the AI's answer. A card whose name is not in the text:
//     📌 pinned → kept, unticked; not pinned → removed (only from this work, never the saved profile).
//   • The inclusion tick follows each successful extraction: ticked if the AI returned the person, else unticked.
//   • A pinned temporary person keeps its look and 인원 태그; an unpinned one takes a new look when the AI gives one.
//   • Clothes: the AI's clothes are "automatic" (outfitMode/outfit); the user's own choice (manualOutfit, may be
//     empty) always wins and is never touched here. A temporary person's typed clothes (outfitManual) are kept.
import {identityKey,mentioned} from './matching.mjs';

export const cardNames=(c,profiles)=>{
  if(c.temp)return [c.name].filter(Boolean);
  const p=profiles.find(p=>p.id===c.id);return p?[p.name,...(p.aliases??[])].filter(Boolean):[];
};
export const cardLabel=(c,profiles)=>c.temp?(c.name||'이름 없는 인물'):(profiles.find(p=>p.id===c.id)?.name??c.entityName??'인물');

// Before the request: what the text keeps. present = cards named in the text (sent to the AI as people who may be in it).
export function planFreePeople(cards,text,profiles){
  const present=[],pinnedOut=[],removed=[];
  for(const c of cards){
    if(cardNames(c,profiles).some(n=>mentioned(text,n)))present.push(c);
    else if(c.pinned)pinnedOut.push(c);
    else removed.push(c);
  }
  const refilled=present.filter(c=>c.temp&&!c.pinned&&String(c.appearance??'').trim());
  // Ask only when something is lost: a card removed, or a ticked pinned card unticked. Unticked pinned cards stay quietly.
  const ask=removed.length>0||pinnedOut.some(c=>c.included!==false);
  return {present,pinnedOut,removed,refilled,ask};
}

export function confirmText(plan,profiles){
  const names=list=>list.map(c=>cardLabel(c,profiles)).join(', ');
  const unticked=plan.pinnedOut.filter(c=>c.included!==false);
  const lines=[plan.removed.length?`지워져요: ${names(plan.removed)} (고정 안 함)`:'',unticked.length?`체크만 풀려요: ${names(unticked)} (📌 고정)`:'',
    plan.refilled.length?`외형이 새 결과로 다시 채워져요: ${names(plan.refilled)} (고정 안 한 임시 인물)`:''].filter(Boolean);
  return ['글에 나오지 않는 인물 카드가 있어요.',...lines,'','확인: 그대로 추출 · 취소: 돌아가서 글을 고치거나 📌 고정하기'].join('\n');
}

// Two separate conversions, each run on every load (so data saved by 0.1.59 with only the pin is fixed too, UI-059-03):
//   • no pin field → pinned (cards from before 📌 are never deleted unasked);
//   • a temporary person's clothes with no recorded source (outfitManual missing) → chosen. Clothes the AI fills in
//     are marked automatic (outfitManual:false), so they are told apart from such old clothes.
export function migratePins(cards){
  let changed=false;
  for(const c of cards??[]){
    if(c.pinned===undefined){c.pinned=true;changed=true;}
    if(c.temp&&c.outfitManual===undefined&&String(c.outfit??'').trim()){c.outfitManual=true;changed=true;}
  }
  return changed;
}

// After a valid response. people: [{profile|null, name, subject, appearance, outfit, expression, action, position}]
// (identity already checked). Returns the new card list and what to tell the user.
export function applyFreePeople(cards,plan,people,{makeTemp}){
  const keep=new Set([...plan.present,...plan.pinnedOut].map(c=>c.id));
  const next=cards.filter(c=>keep.has(c.id)).map(c=>({...c,included:false}));
  const seen=new Set(),refreshed=[],added=[];
  const autoOutfit=(card,o)=>{if(o){card.outfitMode='replace';card.outfit=o;}else{card.outfitMode='unchanged';card.outfit='';}};
  for(const person of people){
    let card;
    if(person.profile){
      card=next.find(c=>!c.temp&&c.id===person.profile.id);
      if(card&&seen.has(card.id))continue; // the same person twice: the first entry counts
      if(!card){card={id:person.profile.id,entityName:person.name||person.profile.name,included:true,expression:'',action:'',position:'auto',outfitMode:'unchanged',outfit:'',manualOutfit:null,pinned:false};next.push(card);added.push(card);}
      autoOutfit(card,person.outfit);
    }else{
      const key=identityKey(person.name??'');
      card=key?next.find(c=>c.temp&&!seen.has(c.id)&&identityKey(c.name)===key):null;
      if(!card){card={...makeTemp(person.name),subject:person.subject,appearance:person.appearance??'',pinned:false};next.push(card);added.push(card);}
      else if(!card.pinned){
        if(String(person.appearance??'').trim()){if(card.appearance!==person.appearance)refreshed.push(card);card.appearance=person.appearance;card.subject=person.subject;}
      }
      if(!card.outfitManual){card.outfit=person.outfit??'';card.outfitManual=false;} // automatic, recorded as such
      card.needsCheck=false;
    }
    if(seen.has(card.id))continue;seen.add(card.id);
    card.included=true;card.expression=person.expression??'';card.action=person.action??'';if(!card.positionManual)card.position=person.position??'auto';
  }
  const notShown=next.filter(c=>!seen.has(c.id)&&plan.present.some(p=>p.id===c.id));
  return {cards:next,refreshed,added,notShown};
}
