import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID, webcrypto} from 'node:crypto';
import {DEFAULTS, clone} from '../ui/core.mjs';
import {captureImagePreset} from '../ui/presets.mjs';

// Run the actual UI module and its input handlers with small DOM doubles.
// This exercises state and rendered markup; it does not measure browser layout.
async function setup() {
  let source=await fs.readFile(new URL('../ui/index.js',import.meta.url),'utf8');
  const imports={};
  for(const match of source.matchAll(/import\s+[\s\S]*?\s+from\s+'([^']+)';/g))
    Object.assign(imports,await import(new URL(match[1],new URL('../ui/index.js',import.meta.url))));
  source=source.replace(/import\s+[\s\S]*?\s+from\s+'[^']+';/g,'');
  source=source.replaceAll('import.meta.url',JSON.stringify(new URL('../ui/index.js',import.meta.url).href));
  const html=await fs.readFile(new URL('../ui/panel.html',import.meta.url),'utf8');
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const nodes=new Map(),listeners=new Map();
  const node=selector=>{
    if(selector.startsWith('#'))assert.ok(ids.has(selector.slice(1)),`missing panel element ${selector}`);
    if(!nodes.has(selector)) {
      const classes=new Set();
      nodes.set(selector,{id:selector.startsWith('#')?selector.slice(1):'',value:'',innerHTML:'',textContent:'',dataset:{},hidden:false,disabled:false,type:'',name:'',checked:false,
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
    SillyTavern:{getContext:()=>context},document:{readyState:'loading',activeElement:null,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null},
    fetch:async(url,options)=>{
      if(String(url).endsWith('/generate')) {
        const body=JSON.parse(options.body);sent.push(body);
        return {ok:true,text:async()=>JSON.stringify({id:body.requestId,image:`/user/images/naice-shot/${body.requestId}.png`,created:new Date().toISOString(),chatKey:body.chatKey,seed:body.options.seed,assembled:body.assembled,options:body.options,snapshot:body.snapshot})};
      }
      return {ok:true,text:async()=>JSON.stringify({items:[],total:0,hasMore:false})};
    },
  });
  vm.runInContext(source+`\n globalThis.ui={attach(d){dialog=d;},bindEvents,renderSettings,extract,cancelExtraction,generate,saveImagePreset,onAction,updateFinal,
    restore(item){historyItems=[item];restoreHistory(item.id);},
    state(){return {options:clone(effectiveOptions()),override:clone(optionsOverride),final:clone(finalData()),scene:clone(scene),busy};}};`,sandbox);
  sandbox.ui.attach(dialog);sandbox.ui.bindEvents();sandbox.ui.renderSettings();
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
