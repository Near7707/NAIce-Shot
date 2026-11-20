// wip-en tool (run by hand): node tests/i18n-keys.mjs [file=index.js]
// Lists every tr`…` key of the file that i18n-en.mjs does not have (those texts would stay Korean on the English screen).
import fs from 'node:fs';import * as acorn from 'acorn';import * as walk from 'acorn-walk';
import EN from '../i18n-en.mjs';
const file=process.argv[2]??new URL('../index.js',import.meta.url);
const ast=acorn.parse(fs.readFileSync(file,'utf8'),{ecmaVersion:'latest',sourceType:'module'});
const keys=new Set();
walk.full(ast,n=>{if(n.type==='TaggedTemplateExpression'&&n.tag.name==='tr'){const q=n.quasi.quasis;let k=q[0].value.cooked;for(let i=1;i<q.length;i++)k+=`{${i-1}}`+q[i].value.cooked;keys.add(k);}});
const missing=[...keys].filter(k=>!(k in EN));
console.log(`${keys.size} keys, ${missing.length} missing`);for(const k of missing)console.log(JSON.stringify(k));
