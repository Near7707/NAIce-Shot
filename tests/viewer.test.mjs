import test from 'node:test';
import assert from 'node:assert/strict';
import {fitScale,fitView,clampPan,zoomAt,originalView,clampScale,ZOOM_MIN,ZOOM_MAX} from '../viewer.mjs';

const nat={w:832,h:1216};
test('fit centres a portrait image inside a phone stage and a wide desktop stage',()=>{
  const phone={w:390,h:700},v=fitView(nat,phone);
  assert.equal(v.scale,Math.min(390/832,700/1216));
  assert.ok(Math.abs(v.x-(390-832*v.scale)/2)<1e-9);assert.ok(v.y>=0);
  const wide={w:1600,h:800},w=fitView(nat,wide);
  assert.ok(Math.abs(nat.h*w.scale-800)<1e-9,'height-limited fit');assert.ok(w.x>0);
});
test('original size is 100% and keeps the stage centre point still',()=>{
  const stage={w:390,h:700},fit=fitView(nat,stage),o=originalView(fit,nat,stage);
  assert.equal(o.scale,1);
  // Image is larger than the stage at 100%, so edges stay outside the stage.
  assert.ok(o.x<=0 && o.x>=stage.w-nat.w);assert.ok(o.y<=0 && o.y>=stage.h-nat.h);
});
test('zoom keeps the pointed image pixel under the pointer',()=>{
  const stage={w:1000,h:1000},view={scale:1,x:-100,y:-100},point={x:400,y:300};
  const before={x:(point.x-view.x)/view.scale,y:(point.y-view.y)/view.scale};
  const z=zoomAt(view,2,point,nat,stage);
  assert.ok(Math.abs((point.x-z.x)/z.scale-before.x)<1e-9);assert.ok(Math.abs((point.y-z.y)/z.scale-before.y)<1e-9);
});
test('pan cannot push a zoomed image out of view and zoom is clamped',()=>{
  const stage={w:390,h:700};
  const p=clampPan({scale:2,x:500,y:-99999},nat,stage);
  assert.equal(p.x,0);assert.equal(p.y,stage.h-nat.h*2);
  assert.equal(clampScale(100),ZOOM_MAX);assert.equal(clampScale(0),ZOOM_MIN);assert.equal(clampScale(NaN),1);
  assert.equal(fitScale({w:0,h:0},stage),1,'unloaded image does not divide by zero');
});
