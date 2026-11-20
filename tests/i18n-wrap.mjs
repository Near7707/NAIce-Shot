// wip-en tool (run by hand): node tests/i18n-wrap.mjs index.js <sinkFns,comma> <allFns,comma> [--dry]
// Use --dry first: it prints what would be wrapped and changes nothing. Never wrap a text that is saved or compared.
// Wraps Hangul string/template literals with tr`…` inside the named top-level owners.
// sink owners: only literals that end up in a display sink. all owners: every literal except excluded contexts.
import fs from 'node:fs';import * as acorn from 'acorn';import * as walk from 'acorn-walk';
const [file,sinkArg='',allArg='',dry]=process.argv.slice(2);
const sinkFns=new Set(sinkArg.split(',').filter(Boolean)),allFns=new Set(allArg.split(',').filter(Boolean));
const src=fs.readFileSync(file,'utf8');const ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'});
const H=/[가-힣]/;const edits=[];const seen=new Set();
const ownerOf=anc=>{const top=anc[1];if(!top)return '';if(top.type==='FunctionDeclaration')return top.id.name;
 if(top.type==='VariableDeclaration')return top.declarations.map(d=>d.id.name).join('|');if(top.type==='ExportNamedDeclaration'&&top.declaration?.id)return top.declaration.id.name;return '';};
const SKIPCALL=new Set(['startsWith','endsWith','includes','indexOf','replace','replaceAll','test','match','split','push','unshift','querySelector','querySelectorAll','getElementById','setItem','getItem','has','get','set','add','delete','closest','matches']);
const SINKCALL=new Set(['report','notice','say','confirm','toast']);
const SINKPROP=new Set(['textContent','innerHTML','title','placeholder']);
const ATTR=new Set(['aria-label','title','placeholder','alt']);
const within=(n,child)=>child&&n.start>=child.start&&n.end<=child.end;
walk.ancestor(ast,{Literal(n,anc){visit(n,anc);},TemplateLiteral(n,anc){visit(n,anc);}});
function visit(n,anc){
  if(n.type==='Literal'&&!(typeof n.value==='string'&&H.test(n.value)))return;
  if(n.type==='TemplateLiteral'&&!n.quasis.some(q=>H.test(q.value.cooked??'')))return;
  const owner=ownerOf(anc),names=owner.split('|');const all=names.some(x=>allFns.has(x)),sinkOk=names.some(x=>sinkFns.has(x));
  if(!all&&!sinkOk)return;
  const parent=anc[anc.length-2];
  if(parent.type==='TaggedTemplateExpression')return;
  if(parent.type==='Property'&&parent.key===n)return;
  if(parent.type==='ImportDeclaration'||parent.type==='ExportAllDeclaration')return;
  let sink=all;
  for(let i=anc.length-2;i>=0;i--){const a=anc[i],child=anc[i+1];
    if(a.type==='BinaryExpression'&&['==','===','!=','!=='].includes(a.operator))return;
    if(a.type==='ThrowStatement'||(a.type==='NewExpression'&&a.callee.name==='Error'))return;
    if(a.type==='CallExpression'){const c=a.callee;const name=c.type==='Identifier'?c.name:c.type==='MemberExpression'&&!c.computed?c.property.name:'';
      if(a.arguments.includes(child)||a.arguments.some(x=>within(n,x))){
        if(SKIPCALL.has(name))return;
        if(['tr','trMsg','localize'].includes(name))return;
        if(SINKCALL.has(name)&&within(n,a.arguments[0]))sink=true;
        if(name==='setAttribute'&&a.arguments[0]?.type==='Literal'&&ATTR.has(a.arguments[0].value)&&within(n,a.arguments[1]))sink=true;}}
    if(a.type==='AssignmentExpression'&&a.left.type==='MemberExpression'&&!a.left.computed&&SINKPROP.has(a.left.property.name)&&within(n,a.right))sink=true;
  }
  if(!sink)return;
  const key=n.start;if(seen.has(key))return;seen.add(key);
  if(n.type==='Literal'){const inner=src.slice(n.start+1,n.end-1).replace(/`/g,'\\`').replace(/\$\{/g,'\\${');edits.push([n.start,n.end,'tr`'+inner+'`']);}
  else edits.push([n.start,n.start,'tr']);
}
edits.sort((a,b)=>b[0]-a[0]);let out=src;for(const [s,e,t] of edits)out=out.slice(0,s)+t+out.slice(e);
console.error(`${file}: ${edits.length} wrapped`);
if(dry){for(const [s,e,t] of edits.slice().reverse())console.log(src.slice(0,s).split('\n').length+': '+(e>s?src.slice(s,e):'`…')+' → '+t.slice(0,60));}
else fs.writeFileSync(file,out);
