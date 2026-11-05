import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Exercise the production geometry routine with explicit CSS/layout inputs.
// Hidden full-song nodes deliberately have a different font from visible nodes.
const source=await readFile(new URL('../src/components/playerSheet.js',import.meta.url),'utf8');
const start=source.indexOf('  function updateBottomBounds()');
const end=source.indexOf("  audioEl.addEventListener('loadedmetadata',updateBottomBounds)",start);
assert.ok(start>=0 && end>start);
const routine=source.slice(start,end)+';updateBottomBounds();';
function layout({portrait=false,bottom=true,width=320,height=180,sheetBottom=portrait?844:height+1,footerTop=760,naturalHeight=54,lineHeights=['27px','27px'],bodyLineHeight='27px',safeBottom=0}={}) {
 const style={bottom:'100px',maxHeight:'54px',removeProperty(key){delete this[key==='max-height'?'maxHeight':key];}};
 const sheet={borderBottomWidth:'1px',getBoundingClientRect:()=>({bottom:sheetBottom})};
 const body={style,scrollHeight:naturalHeight,lineHeight:bodyLineHeight,
  querySelector(){assert.fail('Do not measure the hidden first lyric');},
  querySelectorAll(selector){assert.equal(selector,'.lyric-line.current, .lyric-line.next');return lineHeights.map(lineHeight=>({lineHeight}));},
  getBoundingClientRect:()=>({bottom:sheetBottom-1-(parseFloat(style.bottom) || safeBottom)}),
 };
 const footer={getBoundingClientRect:()=>({top:footerTop,height:5})};
 const videoHost={getBoundingClientRect:()=>({width,height,top:0})};
 vm.runInNewContext(routine,{
  modal:{classList:{contains:name=>name==='open'||(name==='subtitles-bottom'&&bottom)}},
  landscape:{matches:!portrait},videoHost,controls:footer,progressTrack:footer,
  $:selector=>selector==='#lyricsBody'?body:selector==='.player-sheet'?sheet:footer,
  audioEl:{videoWidth:320,videoHeight:180},getComputedStyle:node=>node,
 });
 return {style,body,videoHost};
}

test('visible 24px/36px lines get 72px even if the hidden first line is 18px/27px',()=>{
 const {style}=layout({lineHeights:['36px','36px'],naturalHeight:72});assert.equal(style.maxHeight,'72px');
});
test('normal and mixed visible line heights determine the two-text-line cap',()=>{
 assert.equal(layout().style.maxHeight,'54px');
 assert.equal(layout({lineHeights:['27px','36px'],naturalHeight:72}).style.maxHeight,'72px');
});
test('missing current/next uses container line height, skipping invalid measurements',()=>{
 assert.equal(layout({lineHeights:[]}).style.maxHeight,'54px');
 assert.equal(layout({lineHeights:['normal','0px'],bodyLineHeight:'30px'}).style.maxHeight,'60px');
});
test('portrait lyrics start at the contain picture bottom when they fit before transport',()=>{
 const {style,body}=layout({portrait:true,height:844,naturalHeight:54});
 // Actual picture bottom = (844+180)/2 = 512; lyrics bottom = 566.
 assert.equal(style.bottom,'277px');assert.equal(body.getBoundingClientRect().bottom-54,512);
});
test('portrait naturally wrapped lyrics use blank space without shrinking video',()=>{
 const {style,body,videoHost}=layout({portrait:true,height:844,naturalHeight:135});
 assert.equal(style.bottom,'196px');assert.equal(style.maxHeight,'135px');
 assert.equal(body.getBoundingClientRect().bottom-135,512);
 assert.deepEqual(videoHost.getBoundingClientRect(),{width:320,height:844,top:0});
});
test('insufficient portrait blank space overlays video above the footer and clips long content',()=>{
 const {style,body}=layout({portrait:true,height:844,footerTop:530,naturalHeight:135});
 assert.equal(style.bottom,'313px');assert.equal(style.maxHeight,'54px');assert.equal(body.getBoundingClientRect().bottom,530);
});
test('portrait placement follows safe-area-adjusted transport geometry',()=>{
 const {style,body}=layout({portrait:true,height:844,footerTop:500,naturalHeight:72,lineHeights:['36px','36px']});
 assert.equal(style.bottom,'343px');assert.equal(body.getBoundingClientRect().bottom,500);assert.equal(style.maxHeight,'72px');
});
test('landscape removes portrait position; leaving bottom clears overlay inline geometry',()=>{
 assert.equal(layout({portrait:false,safeBottom:24}).style.bottom,undefined);
 const {style}=layout({bottom:false});assert.equal(style.bottom,undefined);assert.equal(style.maxHeight,undefined);
});
