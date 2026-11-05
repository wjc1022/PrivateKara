import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function load(storage = new Map()) {
 const context=vm.createContext({localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},window:{dispatchEvent(){}},Event:class{}});
 const module=new vm.SourceTextModule(await readFile(new URL('../src/services/playerPreferences.js',import.meta.url),'utf8'),{context});
 await module.link(()=>assert.fail('Preferences must stay independent of media storage'));
 await module.evaluate();return module.namespace;
}

test('landscape three-state and portrait two-state cycles persist independently across module reloads',async()=>{
 const storage=new Map(),p=await load(storage);
 assert.equal(p.getLyricMode('landscape'),'side');assert.equal(p.getLyricMode('portrait'),'bottom');
 for(const mode of ['bottom','off','side']){assert.equal(p.nextLyricMode('landscape'),mode);assert.equal(p.cycleLyricMode('landscape'),mode);assert.equal(p.getLyricMode('portrait'),'bottom');}
 for(const mode of ['off','bottom']){assert.equal(p.nextLyricMode('portrait'),mode);assert.equal(p.cycleLyricMode('portrait'),mode);assert.equal(p.getLyricMode('landscape'),'side');}
 p.cycleLyricMode('landscape');p.cycleLyricMode('portrait');p.setPlayerButtons({subtitles:false});
 const reloaded=await load(storage);
 assert.equal(reloaded.getLyricMode('landscape'),'bottom');assert.equal(reloaded.getLyricMode('portrait'),'off');
 reloaded.setPlayerButtons({});assert.equal(reloaded.getLyricMode('portrait'),'off');assert.equal(reloaded.getLyricMode('landscape'),'bottom');
 assert.equal(reloaded.getPlayerButtons().subtitles,true);
});

test('invalid and legacy preferences fall back without overwriting the other orientation or visibility',async()=>{
 for(const value of ['bad JSON','null','[]','{"portrait":"side","landscape":"bad"}']) {
  const p=await load(new Map([['lumen.lyricModes',value],['lumen.playerButtons','{"subtitles":false}']]));
  assert.equal(p.getLyricMode('portrait'),'bottom');assert.equal(p.getLyricMode('landscape'),'side');assert.equal(p.getPlayerButtons().subtitles,false);
 }
 const storage=new Map([['lumen.lyricModes','{"portrait":"off","landscape":"bad"}']]),p=await load(storage);
 assert.equal(p.cycleLyricMode('landscape'),'bottom');assert.equal(p.getLyricMode('portrait'),'off');
});
