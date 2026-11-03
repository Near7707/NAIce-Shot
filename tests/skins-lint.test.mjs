// Themes change colour, corner radius and shadow only (docs/DESIGN.md). Size, spacing and arrangement
// belong to style.css, so every theme keeps the same layout. A layout property in a theme fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','skins');
const ALLOWED=new Set(['color','background','background-color','background-image','background-size','background-position','background-repeat',
 'border-color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-bottom-style','border-radius',
 'box-shadow','text-shadow','color-scheme','backdrop-filter','-webkit-backdrop-filter','outline-color','accent-color','caret-color']);
// Property names are case-insensitive in CSS, so MIN-WIDTH counts as min-width (UI-049-08).
function layoutProps(text){
 const css=text.replace(/\/\*[\s\S]*?\*\//g,'').replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g,'url()');
 const bad=[];
 for(const body of css.split('{').slice(1).map(part=>part.split('}')[0])){
  for(const m of body.matchAll(/(?:^|;)\s*(-?-?[a-z][a-z-]*)\s*:/gi)){const prop=m[1].startsWith('--')?m[1]:m[1].toLowerCase();if(!prop.startsWith('--')&&!ALLOWED.has(prop))bad.push(prop);}
 }
 return [...new Set(bad)];
}
test('the check itself catches layout properties in any letter case',()=>{
 assert.deepEqual(layoutProps('#x .a{color:red;MIN-WIDTH:999px}#x .b{Padding:2px;--ncs-gap:4px}'),['min-width','padding']);
 assert.deepEqual(layoutProps('#x .a{COLOR:red;Border-Radius:4px}'),[]);
});
test('themes set colours and decoration only, never layout',async()=>{
 const files=(await fs.readdir(dir)).filter(f=>f.endsWith('.css'));assert.ok(files.length>=16);
 for(const f of files)assert.deepEqual(layoutProps(await fs.readFile(path.join(dir,f),'utf8')),[],`${f} sets layout properties`);
});
