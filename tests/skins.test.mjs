import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {SKINS,detectSkins} from '../ui/skins.mjs';

const dir=new URL('../ui/skins/',import.meta.url);
const parse=c=>{
  c=c.trim();if(c==='transparent')return [0,0,0,0];
  if(c.startsWith('#')){const h=c.slice(1);const f=h.length===3?[...h].map(x=>x+x).join(''):h;return [0,2,4].map(i=>parseInt(f.slice(i,i+2),16)).concat(f.length===8?parseInt(f.slice(6,8),16)/255:1);}
  const m=c.match(/rgba?\(([^)]+)\)/);if(!m)throw new Error(`color? ${c}`);
  const v=m[1].split(',').map(x=>parseFloat(x));return [v[0],v[1],v[2],v[3]??1];
};
const over=(top,under)=>{const a=top[3];return [0,1,2].map(i=>top[i]*a+under[i]*(1-a)).concat(1);};
const lum=c=>c.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
async function tokens(file){
  const css=await fs.readFile(new URL(file,dir),'utf8');
  const block=css.slice(css.indexOf('{')+1,css.indexOf('}'));
  return Object.fromEntries([...block.matchAll(/--(ncs-[\w-]+):([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
}

test('every listed skin has its file, scoped to its own id and the viewer',async()=>{
  for(const skin of SKINS.filter(s=>s.file)){
    const css=await fs.readFile(new URL(skin.file,dir),'utf8');
    assert.match(css,new RegExp(`#naice-shot-dialog\\[data-skin="${skin.id}"\\]`),skin.id);
    assert.match(css,new RegExp(`#ncs-viewer\\[data-skin="${skin.id}"\\]`),`${skin.id} viewer accent`);
    assert.doesNotMatch(css,/SmartTheme/,`${skin.id} must not depend on the ST theme`);
    // Skins restyle color, corners and shadows only, so icons, fonts and tabs stay in the same place on every skin.
    const layout=css.match(/(?:^|[;{\s])(padding|margin|gap|font-size|font-family|font-weight|letter-spacing|line-height|width|height|min-height|top|left|right|bottom|--ncs-icon-size[\w-]*|--ncs-heading-[\w-]+|--ncs-border-width|--ncs-tab-icon)\s*:/m);
    assert.equal(layout,null,`${skin.id} changes layout with ${layout?.[1]}`);
  }
});
// Worst cases behind a translucent panel: the ST page is pure white or pure black under the dimmed backdrop.
for(const skin of SKINS.filter(s=>s.file)){
  test(`${skin.name} skin keeps readable text and visible controls on any ST theme`,async()=>{
    const t=await tokens(skin.file),c=k=>parse(t[k]);
    for(const page of [[255,255,255,1],[0,0,0,1]]){
      const behind=over(parse('#00000099'),page),bg=over(c('ncs-bg'),behind);
      const control=over(c('ncs-control'),bg),tab=over(c('ncs-tab-active-bg')[3]===0?bg:c('ncs-tab-active-bg'),bg);
      const checks={
        'text':[c('ncs-fg'),bg,4.5],'muted text':[c('ncs-muted'),bg,4.5],'accent text':[c('ncs-accent-text'),bg,4.5],'warning text':[c('ncs-warning'),bg,4.5],
        'primary button':[c('ncs-primary-fg'),over(c('ncs-primary-bg'),bg),4.5],'active tab':[c('ncs-tab-active-fg'),tab,4.5],
        'danger button':[c('ncs-danger-fg'),over(c('ncs-warning'),bg),4.5],
        'checkbox outline':[over(c('ncs-check-border'),bg),bg,3],'checkmark':[c('ncs-check-mark'),over(c('ncs-check-on'),bg),4.5],
        'checked box':[over(c('ncs-check-on'),bg),bg,3],'select arrow':[c('ncs-arrow'),control,3],'input text':[c('ncs-fg'),control,4.5],
      };
      for(const [name,[a,b,min]] of Object.entries(checks)){const r=ratio(a,b);assert.ok(r>=min,`${skin.id} ${name} ${r.toFixed(2)} < ${min}`);}
    }
  });
}
test('detection hides a deleted skin file and keeps the built-in one',async()=>{
  const fetcher=async url=>({ok:!String(url).endsWith('pastel.css'),status:String(url).endsWith('pastel.css')?404:200});
  const ids=(await detectSkins('http://x/ext/',fetcher)).map(s=>s.id);
  assert.ok(ids.includes('classic'));assert.ok(!ids.includes('pastel'));assert.ok(ids.includes('neon'));
  const offline=(await detectSkins('http://x/ext/',async()=>{throw new Error('offline');})).map(s=>s.id);
  assert.deepEqual(offline,['classic']);
});
test('skins never tint the page behind the panel',async()=>{
  for(const skin of SKINS.filter(s=>s.file)){const css=await fs.readFile(new URL(`../ui/skins/${skin.file}`,import.meta.url),'utf8');
    assert.doesNotMatch(css,/backdrop\s*\{|--ncs-backdrop/,`${skin.id} must not restyle the backdrop`);}
});
