import {clone} from './core.mjs';

const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const namesOf=p=>[p.name,...p.aliases].map(normalize).filter(Boolean);
const unique=values=>[...new Set(values.filter(Boolean))];
function namedProfiles(profiles,name) {
 const normalized=normalize(name);return normalized?profiles.filter(p=>namesOf(p).includes(normalized)):[];
}
function mentioned(text,name) {
 const needle=normalize(name);if(!needle)return false;
 const source=normalize(text);let start=0,index;
 while((index=source.indexOf(needle,start))>=0){
  const before=Array.from(source.slice(0,index)).at(-1)??'',after=Array.from(source.slice(index+needle.length))[0]??'';
  const suffix=source.slice(index+needle.length);
  // Korean attaches particles and honorifics directly to names (하나에게서, 하나야, Hana씨), so any Hangul
  // right after a name counts. Over-inclusion only adds a candidate; it never forces a person into the image.
  const hangulAfter=/^[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/u.test(suffix);
  if(!/[\p{L}\p{N}_]/u.test(before)&&(!/[\p{L}\p{N}_]/u.test(after)||hangulAfter))return true;
  start=index+needle.length;
 }
 return false;
}

// Identity only: never send card descriptions, fixed appearance or style tags.
export function matchChatProfiles(context,storedProfiles,messages,overrides={}) {
 const profiles=clone(storedProfiles),warnings=[],mappings=[],allowed=new Set();
 for(const p of profiles){
  const card=context.characters?.find(c=>c.avatar===p.cardKey);
  if(card?.name)p.aliases=unique([...p.aliases,card.name]);
 }
 function resolve(name,cardKey='',overrideId='') {
  if(overrideId){const p=profiles.find(p=>p.id===overrideId);if(p)return p;warnings.push('저장된 채팅 연결 프로필이 삭제됐어요. 자동으로 다른 프로필을 선택하지 않아요.');return null;}
  const bound=cardKey?profiles.filter(p=>p.cardKey===cardKey):[];
  const matches=bound.length?bound:namedProfiles(profiles,name);
  if(matches.length===1)return matches[0];
  if(matches.length>1)warnings.push(`${name}: 프로필 연결이 겹쳐요. 이 채팅의 프로필을 지정해 주세요.`);
  return null;
 }
 function add(name,cardKey,overrideId,role) {
  if(!name)return null;
  const p=resolve(name,cardKey,overrideId);
  if(p){allowed.add(p.id);mappings.push({name,profileId:p.id,profileName:p.name,role});}
  return p;
 }
 const inGroup=context.groupId!==null&&context.groupId!==undefined;
 const currentCard=inGroup?null:context.characters?.[context.characterId];
 const characterName=currentCard?.name||(!inGroup?context.name2:'')||'';
 const character=add(characterName,currentCard?.avatar??'',overrides.characterProfileId,'character');
 const userName=context.name1||messages.filter(m=>m.role==='user').at(-1)?.speaker||context.chat?.filter(m=>m.is_user&&!m.is_system).at(-1)?.name||'';
 const user=add(userName,'',overrides.userProfileId,'user');
 for(const m of messages){
  if(m.role==='user'&&normalize(m.speaker)===normalize(userName)){if(user)allowed.add(user.id);continue;}
  if(!inGroup&&m.role!=='user'&&normalize(m.speaker)===normalize(characterName)){if(character)allowed.add(character.id);continue;}
  const card=m.avatar?context.characters?.find(c=>c.avatar===m.avatar):null;
  add(m.speaker,card?.avatar??'','',m.role??'character');
 }
 const text=messages.map(m=>m.text).join('\n');
 for(const p of profiles)if([p.name,...p.aliases].some(name=>mentioned(text,name)))allowed.add(p.id);
 const identities=unique(mappings.map(m=>JSON.stringify(m))).map(m=>JSON.parse(m));
 const candidates=profiles.filter(p=>allowed.has(p.id));
 if(characterName&&!character)warnings.push(`${characterName}: 자동 연결 없음. 이름·별칭 또는 이 채팅의 연결을 확인해 주세요.`);
 if(userName&&!user)warnings.push(`${userName}: 자동 연결 없음. 필요하면 유저 프로필을 연결해 주세요.`);
 return {profiles:candidates,mappings:identities,warnings,characterName,userName,characterProfileId:character?.id??'',userProfileId:user?.id??''};
}

export function reconcileCharacters(scene,matching) {
 const warnings=[],characters=[],used=new Set(),unregistered=[...scene.unregistered];
 for(const c of scene.characters){
  if(!c.entityName)throw new Error('추출 인물의 name 필드가 없어요. 실제 인물 이름을 함께 반환해야 해요.');
  const named=normalize(c.entityName);
  const mappedIds=unique(matching.mappings.filter(m=>normalize(m.name)===named).map(m=>m.profileId));
  const matches=mappedIds.length?matching.profiles.filter(p=>mappedIds.includes(p.id)):namedProfiles(matching.profiles,c.entityName);
  if(matches.length!==1){unregistered.push(c.entityName);warnings.push(`${c.entityName}: 프로필을 확정하지 못해 자동 적용하지 않았어요.`);continue;}
  const p=matches[0];if(used.has(p.id)){warnings.push(`${c.entityName}: ${p.name}와 같은 인물로 보여 한 번만 넣었어요.`);continue;}
  used.add(p.id);
  if(c.id!==p.id)warnings.push(`${c.entityName}: 이름에 맞춰 ${p.name} 프로필로 연결을 바로잡았어요.`);
  characters.push({...c,id:p.id});
 }
 return {scene:{...scene,characters,unregistered:unique(unregistered)},warnings};
}
