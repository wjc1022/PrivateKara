import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/playerSheet.js',import.meta.url),'utf8');
function harness(paused=true){
 const handlers={},classes=new Set(),seeks=[],previews=[];let reveals=0,captureFails=false;
 const audioEl={duration:100,currentTime:20,paused};
 const track={getBoundingClientRect:()=>({left:10,width:100}),classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},setPointerCapture(){if(captureFails)throw Error('capture');},releasePointerCapture(){handlers.lostpointercapture({pointerId:1,type:'lostpointercapture'});},addEventListener:(name,fn)=>handlers[name]=fn};
 const context={progressTrack:track,audioEl,Number,Math,seekTo:r=>{seeks.push(r);audioEl.currentTime=r*100;},updateProgressUI:(t,d)=>previews.push(t),reveal:()=>reveals++};
 vm.runInNewContext('let isDragging=false,dragPointerId;'+source.slice(source.indexOf('  // Capture tracks'),source.indexOf('\n  variantBtn.addEventListener')),context);
 const fire=(type,x=60,id=1,extra={})=>handlers[type]({type,clientX:x,pointerId:id,button:0,isPrimary:true,preventDefault(){},...extra});
 return {fire,seeks,previews,audioEl,classes,get reveals(){return reveals;},failCapture(){captureFails=true;}};
}
test('tap seeks once on release; drag previews continuously without seeking, retaining play state',()=>{
 for(const paused of [true,false]){
  const h=harness(paused);h.fire('pointerdown',30);assert.deepEqual(h.seeks,[]);h.fire('pointerup',30);assert.deepEqual(h.seeks,[.2]);
  h.fire('pointerdown',40);h.fire('pointermove',60);h.fire('pointermove',90);assert.deepEqual(h.seeks,[.2]);assert.equal(h.previews.at(-1),80);
  h.fire('pointerup',90);assert.deepEqual(h.seeks,[.2,.8]);assert.equal(h.audioEl.paused,paused);assert.equal(h.classes.size,0);
 }
});
test('outside positions clamp; other pointers and repeated releases cannot commit',()=>{
 const h=harness();h.fire('pointerdown');h.fire('pointermove',500,2);assert.equal(h.previews.at(-1),50);
 h.fire('pointerup',500,2);assert.deepEqual(h.seeks,[]);h.fire('pointermove',-100);assert.equal(h.previews.at(-1),0);h.fire('pointermove',500);assert.equal(h.previews.at(-1),100);
 h.fire('pointerup',500);h.fire('pointerup',20);assert.deepEqual(h.seeks,[1]);
});
test('cancel, lost capture, and lifecycle cancellation restore preview without seek and allow a new drag',()=>{
 for(const type of ['pointercancel','lostpointercapture',undefined]){
  const h=harness();h.fire('pointerdown');h.fire('pointermove',90);h.fire(type ?? 'pointercancel',60,1,{type});assert.deepEqual(h.seeks,[]);assert.equal(h.previews.at(-1),20);assert.equal(h.classes.size,0);assert.equal(h.reveals,2);
  h.fire('pointerdown',40);h.fire('pointerup',40);assert.deepEqual(h.seeks,[.3]);
 }
});
test('secondary buttons, non-primary touch and capture failure do not start drag',()=>{
 const h=harness();h.fire('pointerdown',60,1,{button:2});h.fire('pointerdown',60,1,{isPrimary:false});h.failCapture();h.fire('pointerdown');h.fire('pointerup');assert.deepEqual(h.seeks,[]);assert.equal(h.reveals,0);
});
// Run the production visibility routines and event registration against a fake clock.
test('picture click toggles once; controls do not toggle; dragging suspends and restores the 3s timer',()=>{
 const handlers={},hidden=new Set(),timers=new Map();let serial=0;
 const node=()=>({inert:false,hidden:true});const controls=node(),secondary=node(),progressTrack=node(),morePanel=node(),queuePanel=node();
 const modal={classList:{contains:n=>n==='open'||hidden.has(n),add:n=>hidden.add(n),remove:n=>hidden.delete(n)},addEventListener:(n,fn)=>handlers[n]=fn};
 const videoHost={addEventListener:(n,fn)=>handlers['picture-'+n]=fn};
 const audioEl={paused:false};
 const c={modal,videoHost,audioEl,controls,secondary,progressTrack,morePanel,queuePanel,moreBtn:{setAttribute(){}},getCurrentSong:()=>({mediaType:'video'}),clearTimeout:id=>timers.delete(id),setTimeout:(fn,ms)=>{assert.equal(ms,3000);timers.set(++serial,fn);return serial;}};
 const start=source.indexOf('  function isLandscapeVideo()'),end=source.indexOf('  function layoutButtons()',start);
 const events=source.slice(source.indexOf("  modal.addEventListener('pointerdown'"),source.indexOf("  modal.addEventListener('keydown'"));
 vm.runInNewContext('let hideTimer,keyboardFocus=false,isDragging=false;'+source.slice(start,end)+events+';globalThis.drag=v=>{isDragging=v;reveal();};globalThis.show=reveal;',c);
 const picture={target:{closest:s=>s==='#videoHost'}};const control={target:{closest:()=>false}};
 c.show();assert.equal(timers.size,1);handlers.pointerdown(picture);handlers['picture-click']();assert.ok(hidden.has('controls-hidden'));assert.equal(timers.size,0);
 handlers.pointerdown(picture);handlers['picture-click']();assert.ok(!hidden.has('controls-hidden'));assert.equal(timers.size,1);
 handlers.pointerdown(control);assert.ok(!hidden.has('controls-hidden'));assert.equal(timers.size,1);
 c.drag(true);assert.equal(timers.size,0);c.drag(false);assert.equal(timers.size,1);[...timers.values()][0]();assert.ok(hidden.has('controls-hidden'));
 audioEl.paused=true;c.show();assert.equal(timers.size,0);assert.ok(!hidden.has('controls-hidden'));
});

test('seek while metadata is loading still submits the final ratio to the engine',()=>{const h=harness();h.audioEl.duration=NaN;h.fire('pointerdown');h.fire('pointermove',80);assert.deepEqual(h.seeks,[]);h.fire('pointerup',80);assert.deepEqual(h.seeks,[.7]);});
