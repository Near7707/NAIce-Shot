// wip-en check (run by hand): node tests/i18n-compare.mjs <old file> <new file>
// Takes the screen-language wrapping out of the new file — tr`…` back to a plain template, trMsg(x), doneText(x) and localize(x, …)
// back to x, list.map(trMsg) back to list, a localize(…) statement left out — and compares the result with the old file, statement by statement, ignoring positions and quote styles
// ('…' equals `…` with the same text). Every statement that still differs is printed: those are the real changes.
import fs from 'node:fs';import * as acorn from 'acorn';
const [oldFile,newFile]=process.argv.slice(2);
const parse=f=>acorn.parse(fs.readFileSync(f,'utf8'),{ecmaVersion:'latest',sourceType:'module'});
const isLocalize=s=>s?.type==='ExpressionStatement'&&s.expression.type==='CallExpression'&&s.expression.callee.name==='localize';
function norm(n){
  if(Array.isArray(n))return n.filter(x=>!isLocalize(x)).map(norm); // localize(…) alone on a line only translates what is on screen
  if(!n||typeof n!=='object')return n;
  if(n.type==='TaggedTemplateExpression'&&n.tag.type==='Identifier'&&n.tag.name==='tr')return norm(n.quasi);
  if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&['trMsg','localize','doneText'].includes(n.callee.name))return norm(n.arguments[0]);
  if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='map'&&n.arguments.length===1&&n.arguments[0].name==='trMsg')return norm(n.callee.object);
  if(n.type==='Literal'&&typeof n.value==='string')return {type:'Str',value:n.value};
  if(n.type==='TemplateLiteral'&&!n.expressions.length)return {type:'Str',value:n.quasis[0].value.cooked};
  if(n.type==='TemplateLiteral'){ // a template whose value is itself a plain template is the same text
    const q=[],e=[];let cur=n.quasis[0].value.cooked;
    n.expressions.forEach((x,i)=>{const v=norm(x);if(v?.type==='Str'){cur+=v.value+n.quasis[i+1].value.cooked;}else{q.push(cur);e.push(v);cur=n.quasis[i+1].value.cooked;}});
    q.push(cur);return e.length?{type:'Tpl',q,e}:{type:'Str',value:q[0]};
  }
  const out={};for(const [k,v] of Object.entries(n)){if(['start','end','loc','range','raw'].includes(k))continue;out[k]=norm(v);}return out;
}
const label=s=>s.type==='FunctionDeclaration'?`function ${s.id.name}`:s.type==='VariableDeclaration'?`${s.kind} ${s.declarations.map(d=>d.id.name).join(',')}`:s.type==='ImportDeclaration'?`import ${s.source.value}`:s.type;
const a=parse(oldFile).body,b=parse(newFile).body;
const ka=a.map(s=>JSON.stringify(norm(s))),kb=b.map(s=>JSON.stringify(norm(s)));
const inA=new Map();ka.forEach((k,i)=>inA.set(k,(inA.get(k)??0)+1));
let diffs=0;
for(let i=0;i<b.length;i++){if(inA.get(kb[i])){inA.set(kb[i],inA.get(kb[i])-1);continue;}diffs++;console.log(`changed or new: ${label(b[i])} (new line ${fs.readFileSync(newFile,'utf8').slice(0,b[i].start).split('\n').length})`);}
for(const [k,left] of inA)if(left>0){diffs++;const i=ka.indexOf(k);console.log(`only in old: ${label(a[i])}`);}
console.log(diffs?`${diffs} statement(s) differ`:'same');
