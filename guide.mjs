// 0.1.106: the 사용 가이드 is written in guide.md (a small Markdown subset) and turned into panel HTML here.
// "# 묶음 {#id}" starts a group, "## 주제" a topic. Blocks: paragraphs, "- " lists, "1. " lists, "> " quotes.
// Inline: **bold**, `code`, [text](#group-id) or [text](https://github.com/Near7707/…). Everything is escaped first.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LINK_OK=/^(#[a-z][a-z0-9-]*|https:\/\/github\.com\/Near7707\/[A-Za-z0-9._\-/#]*)$/;
// 0.1.107 (GPT P3-3): "../" could leave the account once the browser resolves the address, so the resolved path is checked too.
const linkOk=raw=>{if(!LINK_OK.test(raw))return false;if(raw.startsWith('#'))return true;
  try{const u=new URL(raw);return u.origin==='https://github.com'&&u.pathname.startsWith('/Near7707/');}catch{return false;}};
export function guideInline(text){
  const codes=[];let s=esc(text).replace(/`([^`]+)`/g,(_,c)=>`\u0000${codes.push(c)-1}\u0000`);
  s=s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  s=s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(all,label,href)=>{
    const raw=href.replace(/&amp;/g,'&');if(!linkOk(raw))return label;
    return raw.startsWith('#')?`<a href="${raw}" data-guide-link="${raw.slice(1)}">${label}</a>`:`<a href="${raw}" target="_blank" rel="noopener noreferrer">${label}</a>`;});
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>`<code>${codes[Number(i)]}</code>`);
}
function blockHtml(lines){
  if(lines.every(l=>/^- /.test(l)))return `<ul>${lines.map(l=>`<li>${guideInline(l.slice(2))}</li>`).join('')}</ul>`;
  if(lines.every(l=>/^\d+\. /.test(l)))return `<ol>${lines.map(l=>`<li>${guideInline(l.replace(/^\d+\. /,''))}</li>`).join('')}</ol>`;
  if(lines.every(l=>/^> ?/.test(l)))return `<blockquote>${lines.map(l=>guideInline(l.replace(/^> ?/,''))).join('<br>')}</blockquote>`;
  return `<p>${lines.map(guideInline).join('<br>')}</p>`;
}
// → [{id,title,topics:[{title,html}]}]
export function parseGuide(md){
  const groups=[];let group=null,topic=null,block=[];
  const flush=()=>{if(block.length&&topic)topic.html+=blockHtml(block);block=[];};
  for(const line of String(md).replace(/\r\n?/g,'\n').split('\n')){
    const g=/^# (.+?)(?:\s*\{#([a-z][a-z0-9-]*)\})?\s*$/.exec(line),t=/^## (.+?)\s*$/.exec(line);
    if(g){flush();group={id:g[2]??`g${groups.length+1}`,title:g[1],topics:[]};groups.push(group);topic=null;continue;}
    if(t){flush();if(!group)continue;topic={title:t[1],html:''};group.topics.push(topic);continue;}
    if(!line.trim()){flush();continue;}
    block.push(line.trim());
  }
  flush();return groups;
}
