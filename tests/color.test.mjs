import test from 'node:test';
import assert from 'node:assert/strict';
import {rgbToLab,classifyColor,measure} from '../web/color.js';
const conf={chroma:12,blackL:25,whiteL:82,perPoint:10,capPoints:3,accessories:false};
test('RGB primary white/gray/black and colorful classification',()=>{
  assert.equal(classifyColor(0,0,0,conf),'black');
  assert.equal(classifyColor(255,255,255,conf),'white');
  assert.equal(classifyColor(128,128,128,conf),'gray');
  assert.equal(classifyColor(230,50,40,conf),'color');
  assert.ok(rgbToLab(255,255,255).L>99);
});
test('Only clothes are counted and ceil threshold applies',()=>{
  const pixels=new Uint8ClampedArray([
    0,0,0,255,
    200,20,40,255,
    0,0,0,255,
    255,255,255,255
  ]);
  const mask=new Uint8Array([4,4,1,4]);
  const result=measure(pixels,4,1,mask,4,1,conf,true);
  assert.equal(result.total,3);
  assert.equal(result.neutral,2);
  assert.equal(result.points,3);
  assert.ok(Math.abs(result.ratio-66.6667)<.001);
  assert.equal(result.highlight[3],115);
  assert.equal(result.highlight[4+3],0);
});
test('Accessory toggle and score zero for empty clothes',()=>{
  const pixels=new Uint8ClampedArray([255,255,255,255]);
  const mask=new Uint8Array([5]);
  assert.equal(measure(pixels,1,1,mask,1,1,conf).total,0);
  assert.equal(measure(pixels,1,1,mask,1,1,{...conf,accessories:true}).points,3);
  assert.equal(measure(pixels,1,1,mask,1,1,{...conf,accessories:true,capPoints:0}).points,0);
});
