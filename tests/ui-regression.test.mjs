import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID, webcrypto} from 'node:crypto';
import {DEFAULTS, clone} from '../core.mjs';
import {captureImagePreset} from '../presets.mjs';

// Run the actual UI module and its input handlers with small DOM doubles.
// This exercises state and rendered markup; it does not measure browser layout.
async function setup() {
  let source=await fs.readFile(new URL('../index.js',import.meta.url),'utf8');
  const imports={};
  for(const match of source.matchAll(/import\s+[\s\S]*?\s+from\s+'([^']+)';/g))
    Object.assign(imports,await import(new URL(match[1],new URL('../index.js',import.meta.url))));
  source=source.replace(/import\s+[\s\S]*?\s+from\s+'[^']+';/g,'');
  source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../index.js',import.meta.url).href));
  const html=await fs.readFile(new URL('../panel.html',import.meta.url),'utf8');
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const nodes=new Map(),listeners=new Map();
  const node=selector=>{
    if(selector.startsWith('#'))assert.ok(ids.has(selector.slice(1)),`missing panel element ${selector}`);
    if(!nodes.has(selector)) {
      const classes=new Set();
      nodes.set(selector,{id:selector.startsWith('#')?selector.slice(1):'',value:'',options:[],innerHTML:'',textContent:'',dataset:{},hidden:false,disabled:false,type:'',name:'',checked:false,
        classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},add(k){classes.add(k);},contains:k=>classes.has(k)},
        closest:()=>null,contains:()=>false,hasAttribute:()=>false,setAttribute(){},addEventListener(){},
      });
    }
    return nodes.get(selector);
  };
  const dialog={open:true,querySelector:node,querySelectorAll:()=>[],addEventListener:(type,fn)=>listeners.set(type,fn)};
  const settings=clone(DEFAULTS);
  settings.profiles=[{id:'leo',name:'Leo',aliases:[],subject:'boy',appearance:'brown hair',defaultOutfit:'white shirt',positive:'',negative:'',cardKey:''}];
  const context={extensionSettings:{naice_shot:settings},chatMetadata:{},characters:[{name:'Leo',avatar:'Leo.png'}],characterId:0,groupId:null,chatId:'A',name1:'Mira',name2:'Leo',mainApi:'openai',
    chat:[{name:'Leo',mes:'Leo stands in a cafe.'}],getCurrentChatId(){return this.chatId;},saveSettingsDebounced(){},getRequestHeaders:()=>({'Content-Type':'application/json'}),
    eventTypes:{GENERATION_STOPPED:'stop'},eventSource:{emit(){}},
    generateRaw:async()=>JSON.stringify({characters:[{id:'leo',name:'Leo',expression:'smile',action:'standing',position:'auto',outfitMode:'unchanged',outfit:''}],unregistered:[],location:'cafe',lighting:'day',camera:'medium shot',interaction:''}),
  };
  const sent=[];
  const sandbox=vm.createContext({...imports,console,URL,crypto:webcrypto,AbortController,setInterval,clearInterval,confirm:()=>true,
    SillyTavern:{getContext:()=>context},document:{readyState:'loading',activeElement:null,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null},
    fetch:async(url,options)=>{
      if(String(url).endsWith('/generate')) {
        const body=JSON.parse(options.body);sent.push(body);
        if(context.generationResponse)await context.generationResponse;
        return {ok:true,text:async()=>JSON.stringify({id:body.requestId,image:`/user/images/naice-shot/${body.requestId}.png`,created:new Date().toISOString(),chatKey:body.chatKey,seed:body.options.seed,assembled:body.assembled,options:body.options,snapshot:body.snapshot})};
      }
      return {ok:true,text:async()=>JSON.stringify({items:[],total:0,hasMore:false})};
    },
  });
  vm.runInContext(source+`\n globalThis.ui={attach(d){dialog=d;},bindEvents,renderSettings,extract,cancelExtraction,generate,saveImagePreset,onAction,updateFinal,chatChanged,
    focus(el){document.activeElement=el;},
    restore(item){historyItems=[item];restoreHistory(item.id);},
    state(){return {options:clone(effectiveOptions()),override:clone(optionsOverride),final:clone(finalData()),scene:clone(scene),result:clone(result),busy};}};`,sandbox);
  sandbox.ui.attach(dialog);sandbox.ui.bindEvents();sandbox.ui.renderSettings();sandbox.ui.chatChanged();
  const input=(id,value)=>{const el=node('#'+id);el.value=String(value);listeners.get('input')({target:el});};
  node('#ncs-target').value='';
  const item={id:randomUUID(),created:'2026-10-23T00:00:00Z',chatKey:JSON.stringify({group:null,card:'Leo.png',chat:'A'}),image:'',
    seed:777,options:{...clone(settings.options),seed:777,steps:19,width:1024,height:1024},assembled:{base:'old history scene',negative:'old negative',characters:[],warnings:[]},snapshot:null};
  item.image=`/user/images/naice-shot/${item.id}.png`;
  return {ui:sandbox.ui,context,settings,node,input,item,sent};
}

test('history settings survive failed/cancelled extraction, then clear after a successful new scene',async()=>{
  const h=await setup(),normal=clone(h.settings.options);
  h.ui.restore(h.item);
  assert.equal(h.ui.state().options.seed,777);
  assert.deepEqual(clone(h.settings.options),normal,'restoring history must not rewrite persistent settings');
  const succeed=h.context.generateRaw;
  h.context.generateRaw=async()=>{throw new Error('mock provider unavailable');};
  await h.ui.extract();
  assert.equal(h.ui.state().options.seed,777,'failure keeps the existing history edit');
  h.context.generateRaw=()=>new Promise(()=>{});
  const pending=h.ui.extract();h.ui.cancelExtraction();await pending;
  assert.equal(h.ui.state().options.seed,777,'cancellation keeps the existing history edit');
  h.context.generateRaw=succeed;
  await h.ui.extract();
  assert.equal(h.ui.state().override,null);
  assert.equal(h.ui.state().options.seed,-1);
  assert.equal(h.ui.state().options.steps,normal.steps);
  assert.equal(h.ui.state().options.width,normal.width);
  assert.notEqual(h.ui.state().final.base,'old history scene');
  await h.ui.generate();
  assert.equal(h.sent.at(-1).options.steps,normal.steps);
  assert.equal(h.sent.at(-1).options.width,normal.width);
  assert.equal(h.settings.options.seed,-1,'random seed is still a persistent user choice');
});

test('scene and settings preset pickers share application, modified state, deletion and generation options',async()=>{
  const h=await setup();
  const p=captureImagePreset({...h.settings,positive:'watercolor',negative:'lowres',options:{...h.settings.options,seed:42,steps:20,width:1024,height:1024}},'watercolor','Watercolor');
  const q=captureImagePreset({...h.settings,positive:'ink drawing',options:{...h.settings.options,seed:99}},'ink','Ink');
  h.settings.imagePresets=[p,q];h.ui.renderSettings();
  assert.match(h.node('#ncs-scene-preset').innerHTML,/Watercolor/);
  h.ui.restore(h.item);
  h.input('ncs-scene-preset','watercolor');
  assert.equal(h.settings.imagePresetId,'watercolor');
  assert.equal(h.node('#ncs-common-preset').value,'watercolor');
  assert.equal(h.ui.state().override,null,'a preset replaces history settings');
  assert.equal(h.ui.state().options.seed,42);
  assert.equal(h.ui.state().options.width,1024);
  assert.match(h.ui.state().final.base,/watercolor/);
  assert.doesNotMatch(h.ui.state().final.base,/old history scene/);
  h.input('ncs-common-preset','ink');
  assert.equal(h.node('#ncs-scene-preset').value,'ink');
  h.node('#ncs-steps').type='number';h.input('ncs-steps',21);
  assert.match(h.node('#ncs-scene-preset-state').textContent,/수정/);
  assert.equal(q.options.steps,28,'editing current values leaves saved presets intact');
  h.input('ncs-scene-preset','');
  assert.equal(h.node('#ncs-common-preset').value,'');
  assert.equal(h.settings.options.steps,21,'clearing selection keeps current values');
  h.input('ncs-scene-preset','watercolor');await h.ui.generate();
  assert.equal(h.sent.at(-1).options.seed,42);
  assert.equal(h.sent.at(-1).options.steps,20);
  assert.match(h.sent.at(-1).assembled.base,/watercolor/);
  h.node('#ncs-common-preset-name').value='New preset';h.ui.saveImagePreset();
  const savedId=h.settings.imagePresetId;
  assert.equal(h.node('#ncs-scene-preset').value,savedId);
  assert.match(h.node('#ncs-scene-preset').innerHTML,/New preset/);
  const before=clone(h.settings.options);
  await h.ui.onAction('delete-preset');
  assert.equal(h.node('#ncs-scene-preset').value,'');
  assert.equal(h.node('#ncs-common-preset').value,'');
  assert.doesNotMatch(h.node('#ncs-scene-preset').innerHTML,/New preset/);
  assert.deepEqual(clone(h.settings.options),before,'deleting a saved preset leaves active values intact');
});


test('raw extraction stays out of requests by default; opt-in removes reasoning before sending',async()=>{
  const h=await setup();
  const original=h.context.generateRaw;
  h.context.generateRaw=async()=>'<think>PRIVATE REASONING</think>'+await original();
  await h.ui.extract();await h.ui.generate();
  assert.equal(h.sent.at(-1).retainRawExtraction,false);
  assert.equal('rawExtraction' in h.sent.at(-1).snapshot,false);
  h.settings.retainRawExtraction=true;
  await h.ui.generate();
  assert.equal(h.sent.at(-1).retainRawExtraction,true);
  assert.match(h.sent.at(-1).snapshot.rawExtraction,/cafe/);
  assert.doesNotMatch(h.sent.at(-1).snapshot.rawExtraction,/PRIVATE REASONING|<think>/);
});

test('successful generation consumes the final prompt and history options once',async()=>{
  const h=await setup(),normal=clone(h.settings.options);
  h.settings.positive='current common prompt';
  h.ui.restore(h.item);
  h.input('ncs-final',JSON.stringify({...h.item.assembled,base:'edited for one image'}));
  await h.ui.generate();
  assert.equal(h.sent.at(-1).assembled.base,'edited for one image');
  assert.equal(h.sent.at(-1).options.seed,777);
  assert.equal(h.ui.state().override,null);
  assert.match(h.ui.state().final.base,/current common prompt/);
  assert.equal(h.node('#ncs-final-badge').hidden,true);
  assert.doesNotMatch(h.node('#ncs-scene-preset-state').textContent,/이력에서/);
  assert.deepEqual(clone(h.settings.options),normal);
  await h.ui.generate();
  assert.match(h.sent.at(-1).assembled.base,/current common prompt/);
  assert.equal(h.sent.at(-1).options.steps,normal.steps);
});

test('chat switching replaces a focused final editor and clears history settings',async()=>{
  const h=await setup();
  h.ui.restore(h.item);
  const form=h.node('#ncs-final-form'),field={};
  form.contains=el=>el===field;h.ui.focus(field);
  h.context.chatId='B';h.ui.chatChanged();
  assert.equal(h.ui.state().override,null);
  assert.equal(h.node('#ncs-final-badge').hidden,true);
  assert.doesNotMatch(form.innerHTML,/old history scene/);
  assert.doesNotMatch(h.node('#ncs-final').value,/old history scene/);
  assert.doesNotMatch(h.node('#ncs-warnings').textContent,/seed 777/);
  h.settings.positive='new chat scene';
  await h.ui.generate();
  assert.match(h.sent.at(-1).assembled.base,/new chat scene/);
  assert.equal(JSON.parse(h.sent.at(-1).chatKey).chat,'B');
  assert.equal(h.sent.at(-1).options.steps,h.settings.options.steps);
});

test('resetting the final prompt also resets temporary history generation options',async()=>{
  const h=await setup();
  h.ui.restore(h.item);
  await h.ui.onAction('reset-final');
  assert.equal(h.ui.state().override,null);
  assert.deepEqual(clone(h.ui.state().options),clone(h.settings.options));
  assert.equal(h.node('#ncs-final-badge').hidden,true);
});

test('failed generation keeps the draft for retry, while success preserves edits made in flight',async()=>{
  const h=await setup();h.ui.restore(h.item);
  h.context.generationResponse=Promise.reject(new Error('generation failed'));
  await assert.rejects(h.ui.generate(),/generation failed/);
  assert.equal(h.ui.state().final.base,'old history scene');
  assert.equal(h.ui.state().options.seed,777);
  let finish;h.context.generationResponse=new Promise(resolve=>{finish=resolve;});
  const pending=h.ui.generate();
  h.input('ncs-final',JSON.stringify({...h.item.assembled,base:'next draft typed during generation'}));
  finish();await pending;
  assert.equal(h.sent.at(-1).assembled.base,'old history scene');
  assert.equal(h.ui.state().final.base,'next draft typed during generation');
  assert.equal(h.ui.state().override,null,'the submitted history options were used once');
});

test('completion from the previous chat does not reset a new chat draft',async()=>{
  const h=await setup();h.ui.restore(h.item);
  let finish;h.context.generationResponse=new Promise(resolve=>{finish=resolve;});
  const pending=h.ui.generate();
  h.context.chatId='B';h.ui.chatChanged();
  h.input('ncs-final',JSON.stringify({...h.item.assembled,base:'new chat draft'}));
  finish();await pending;
  assert.equal(h.ui.state().final.base,'new chat draft');
  assert.equal(h.ui.state().override,null);
  assert.equal(h.ui.state().result,null);
  assert.equal(h.ui.state().busy,false);
});

test('draft resets replace focused fields but ordinary updates preserve typing',async()=>{
  const h=await setup();h.ui.restore(h.item);
  const form=h.node('#ncs-final-form'),field={};
  form.contains=el=>el===field;h.ui.focus(field);
  form.innerHTML='text currently being typed';
  h.ui.updateFinal();
  assert.equal(form.innerHTML,'text currently being typed');
  await h.ui.onAction('blank');
  assert.notEqual(form.innerHTML,'text currently being typed');
  h.ui.restore(h.item);
  assert.match(form.innerHTML,/old history scene/,'history restore also replaces focused fields');
  await h.ui.generate();
  assert.doesNotMatch(form.innerHTML,/old history scene/,'generation completion resets the focused editor');
});

test('chat changes discard invalid final JSON and return to assembled prompts',async()=>{
  const h=await setup();h.ui.restore(h.item);
  h.ui.focus(h.node('#ncs-final'));h.input('ncs-final','{invalid JSON');
  assert.match(h.node('#ncs-warnings').textContent,/JSON/);
  h.context.chatId='B';h.ui.chatChanged();
  assert.doesNotThrow(()=>JSON.parse(h.node('#ncs-final').value));
  assert.doesNotMatch(h.node('#ncs-warnings').textContent,/JSON|seed 777/);
  assert.equal(h.ui.state().override,null);
});
