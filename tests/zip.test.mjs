import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {makeZip,crc32} from '../zip.mjs';
test('crc32 matches the standard check value',()=>{assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);});
test('makeZip writes a ZIP that standard tools read back byte for byte',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'naice-zip-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const a=new Uint8Array([137,80,78,71,1,2,3]),b=new Uint8Array(70000).map((_,i)=>i%251);
  const zip=makeZip([{name:'a.png',data:a,date:new Date(2026,9,23,13,5,8)},{name:'a.png',data:b},{name:'그림/../x?.png',data:a}]);
  const file=path.join(dir,'t.zip');await fs.writeFile(file,zip);
  const out=JSON.parse(execFileSync('python3',['-I','-c',"import zipfile,sys,json,hashlib\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nprint(json.dumps([[i.filename,i.file_size,hashlib.sha256(z.read(i)).hexdigest(),list(i.date_time)] for i in z.infolist()]))",file]).toString());
  assert.deepEqual(out.map(x=>x[0]),['a.png','a (2).png','그림_.._x_.png'],'duplicates renamed, no folders or unsafe characters');
  assert.deepEqual(out.map(x=>x[1]),[7,70000,7]);
  assert.deepEqual(out[0][3],[2026,10,23,13,5,8]);
});
