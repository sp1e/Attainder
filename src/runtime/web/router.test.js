import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
const code=transformSync(readFileSync(new URL('./router.js',import.meta.url),'utf8'),{loader:'js',format:'cjs',logLevel:'silent'}).code;
const setup = origin => {
  const native=[],store=[];
  const win={location:{origin,href:origin+'/'},fetch:async (...args)=>{native.push(args);return new Response('native');}};
  const module={exports:{}};
  const noop=async()=>null;
  vm.runInNewContext(code,{module,exports:module.exports,window:win,URL,Request,Response,Uint8Array,AbortSignal,
    require:id=> id==='./util.js' ? {jsonResponse:v=>Response.json(v),errorResponse:(error,status)=>Response.json({error},{status})}
      : id==='../assetsBase.js' ? {ASSETS_BASE:'/assets'}
      : id==='./libraryStore.js' ? {handleGames:async ctx=>{store.push(ctx);return Response.json({ok:true});},handleLibrary:noop,handleScenarios:noop,handleRuntimeJson:noop,getScenarioPmtilesOverride:noop}
      : {handleMapEditor:noop,handleBasemaps:noop,handleFlags:noop,handleLang:noop,handleUiSettings:noop}});
  module.exports.installWebApiRouter();
  return {win,native,store};
};
test('local web bridge delegates only exact supported method/path pairs with body and headers intact',async()=>{
  const {win,native,store}=setup('http://127.0.0.1:4169');
  for(const [method,path] of [['GET','info'],['GET','status'],['POST','generate']]) {
    const req=new Request(`http://127.0.0.1:4169/api/local-models/${path}`,{method,headers:{'X-Test':'preserved'},...(method==='POST'?{body:'{"prompt":"hello"}'}:{})});
    assert.equal(await (await win.fetch(req)).text(),'native');
    assert.equal(native.at(-1)[0],req);
    assert.equal(native.at(-1)[0].headers.get('X-Test'),'preserved');
    if(method==='POST') assert.equal(await native.at(-1)[0].text(),'{"prompt":"hello"}');
  }
  assert.equal((await win.fetch('http://127.0.0.1:4169/api/local-models/generate')).status,404);
  assert.equal((await win.fetch('http://127.0.0.1:4169/api/local-models/status/extra')).status,404);
  assert.equal((await win.fetch('http://127.0.0.1:4169/api/games',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"test"}'})).status,200);
  assert.equal(store.length,1);assert.equal(native.length,3);
});
test('static non-loopback hosts do not acquire a model bridge',async()=>{
  const {win,native}=setup('https://example.org');
  assert.equal((await win.fetch('https://example.org/api/local-models/status')).status,404);
  assert.equal(native.length,0);
});
