/*! Open Historia - Mercator polar coverage regression, AGPL-3.0-or-later (see LICENSE). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import geojsonvt from '@maplibre/geojson-vt';
import earcut from 'earcut';
import clipping from 'polygon-clipping';
import { buildRegionRenderRepair } from './regionRenderRepair.js';

const LIMIT=85.0511287798066;
const BAND=[[[-180,-LIMIT],[180,-LIMIT],[180,LIMIT],[-180,LIMIT],[-180,-LIMIT]]];
const options={maxZoom:18,tolerance:.016,extent:8192,buffer:2048};
const tileTriangles=feature=>{
  const tile=geojsonvt({type:'FeatureCollection',features:[feature]},options).getTile(2,2,3);
  return (tile?.features ?? []).flatMap(f=>{
    const vertices=[], holes=[];
    f.geometry.forEach((ring,i)=>{ if(i) holes.push(vertices.length/2); ring.forEach(p=>vertices.push(...p)); });
    const ids=earcut(vertices,holes,2), triangles=[];
    for(let i=0;i<ids.length;i+=3) triangles.push(ids.slice(i,i+3).map(n=>[vertices[2*n],vertices[2*n+1]]));
    return triangles;
  });
};
const inTriangle=(p,[a,b,c])=>{
  const cross=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
  const x=cross(a,b,p),y=cross(b,c,p),z=cross(c,a,p);
  return (x>=0&&y>=0&&z>=0)||(x<=0&&y<=0&&z<=0);
};
const contains=(triangles,p)=>triangles.some(t=>inTriangle(p,t));

for(const bookmark of ['egypt-3000bc','john-1200']) test(`${bookmark} retains Antarctic land coverage in the Mercator tile`,async()=>{
  const data=JSON.parse(readFileSync(new URL(`../../../../server/seed/historical/${bookmark}/regions.geojson`,import.meta.url),'utf8'));
  const original=data.features.find(f=>f.properties.id==='physical-1378'); assert.ok(original);
  const before=JSON.stringify(original);
  const bandGeometry={type:'MultiPolygon',coordinates:clipping.intersection(original.geometry.coordinates,BAND)};
  const expected=tileTriangles({...original,geometry:bandGeometry});
  const repair=await buildRegionRenderRepair({type:'FeatureCollection',features:[original]},{projection:'mercator'});
  const rendered=repair.data.features.find(f=>f.properties.id===original.properties.id) ?? original;
  const actual=tileTriangles(rendered);
  let land=0, missing=0;
  for(let y=64;y<8192;y+=128) for(let x=64;x<8192;x+=128) {
    const p=[x,y]; if(contains(expected,p)){land++;if(!contains(actual,p))missing++;}
  }
  assert.ok(land>500,'reference tile must contain substantial expected land');
  assert.ok(missing/land<0.01,`${missing}/${land} expected-land grid points are missing from rendered triangles`);
  assert.equal(JSON.stringify(original),before,'source geometry stays untouched');
  assert.equal(rendered.properties.id,original.properties.id);
});

test('shared tiler clipping preserves holes, multipart and antimeridian identities without mutating source data',async()=>{
  const ring=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
  const geometry={type:'MultiPolygon',coordinates:[
    [ring(170,-89,179,-75),ring(172,-82,175,-78).reverse()],
    [ring(-179,-89,-170,-75)],
  ]};
  const polar={type:'Feature',properties:{id:'polar-edge',owner:'example'},geometry};
  const ordinary={type:'Feature',properties:{id:'ordinary',owner:'example'},geometry:{type:'Polygon',coordinates:[ring(-5,10,5,20)]}};
  const input={type:'FeatureCollection',features:[polar,ordinary]},before=JSON.stringify(input);
  const flat=await buildRegionRenderRepair(input,{projection:'mercator'});
  const actual=flat.data.features.find(f=>f.properties.id==='polar-edge');
  assert.ok(actual); assert.equal(actual.properties.owner,'example');
  assert.equal(flat.repairedIds.includes('ordinary'),false);
  const polygons=actual.geometry.type==='Polygon'?[actual.geometry.coordinates]:actual.geometry.coordinates;
  const expected=clipping.intersection(geometry.coordinates,BAND);
  assert.deepEqual(clipping.xor(polygons,expected),[]);
  assert.equal(polygons.length,2); assert.ok(polygons.some(p=>p.length===2),'interior hole remains');
  const globe=await buildRegionRenderRepair(input,{projection:'globe'});
  assert.deepEqual(globe.data,flat.data);
  assert.deepEqual(globe.repairedIds,flat.repairedIds);
  assert.equal(JSON.stringify(input),before);
});

test('worker keeps shared tiler repairs across flat and globe projection epochs',async()=>{
  const messages=[]; globalThis.self={postMessage:message=>messages.push(message)};
  try {
    await import(`./polityBoundariesWorker.js?polar=${Date.now()}`);
    const feature={type:'Feature',properties:{id:'polar-zone',owner:'A',name:'Polar'},geometry:{type:'Polygon',coordinates:[[[0,-89],[12,-89],[12,-75],[0,-75],[0,-89]]]}};
    const regions={type:'FeatureCollection',features:[feature]};
    const request=async(projection,epoch)=>{
      await globalThis.self.onmessage({data:{type:'initialize',requestId:epoch,geometryEpoch:epoch,regions,projection,ownershipOverrides:{},regionClaimants:{}}});
      for(let i=0;i<100&&!messages.some(m=>m.messageType==='render-repair-ready'&&m.geometryEpoch===epoch);i++) await new Promise(resolve=>setTimeout(resolve,5));
      const result=messages.find(m=>m.messageType==='render-repair-ready'&&m.geometryEpoch===epoch);
      assert.ok(result,`worker returned ${projection} repair`); return result;
    };
    const flat=await request('mercator','flat');
    assert.deepEqual(flat.repairedIds,['polar-zone']);
    assert.equal(flat.repairData.features[0].properties.id,'polar-zone');
    assert.ok(flat.repairData.features[0].geometry.coordinates.flat(3).every(Number.isFinite));
    const globe=await request('globe','globe');
    assert.deepEqual(globe.repairedIds,flat.repairedIds);
    assert.deepEqual(globe.repairData,flat.repairData);
    assert.equal(feature.geometry.coordinates[0][0][1],-89);
  } finally { delete globalThis.self; }
});

test('a region fully beyond the shared tiler band is suppressed in both views with its source retained',async()=>{
  const polar={type:'Feature',properties:{id:'south-cap',owner:'A'},geometry:{type:'Polygon',coordinates:[[[10,-89],[20,-89],[20,-87],[10,-87],[10,-89]]]}};
  const input={type:'FeatureCollection',features:[polar]};
  const flat=await buildRegionRenderRepair(input,{projection:'mercator'});
  assert.deepEqual(flat.repairedIds,['south-cap']);
  assert.deepEqual(flat.data.features[0].geometry,{type:'MultiPolygon',coordinates:[]});
  const globe=await buildRegionRenderRepair(input,{projection:'globe'});
  assert.deepEqual(globe.repairedIds,flat.repairedIds);
  assert.deepEqual(globe.data,flat.data);
  assert.equal(polar.geometry.coordinates[0][0][1],-89);
});

test('Nations uses the projection-scoped repair source for fills, outlines and hit tests',()=>{
  const src=readFileSync(new URL('../Nations.jsx',import.meta.url),'utf8');
  assert.match(src,/activeGeometryEpoch = `[^`]+\$\{isGlobe \? "globe" : "mercator"\}/);
  assert.match(src,/projection: isGlobe \? "globe" : "mercator"/);
  assert.match(src,/id="custom-regions-repair-source"[\s\S]*?data=\{activeRegionRenderRepair\.data\}[\s\S]*?id="custom-regions-repair-fill"[\s\S]*?id="custom-regions-repair-local-outline"/);
  assert.match(src,/candidateLayers = \(scenarioOwnsRegionGeometryAtAllZooms[\s\S]*?"custom-regions-repair-fill"[\s\S]*?queryRenderedFeatures/);
  assert.match(src,/canonicalCustomAuthoritativeGeometryFilter[\s\S]*?unrepairedRegionFilter/);
});

test('polar clipping does not cut an unwrapped antimeridian polygon at longitude 180',async()=>{
  const region={type:'Feature',properties:{id:'wrap',owner:'A'},geometry:{type:'Polygon',coordinates:[[[179,-89],[181,-89],[181,-75],[179,-75],[179,-89]]]}};
  const result=await buildRegionRenderRepair({type:'FeatureCollection',features:[region]},{projection:'mercator'});
  const geometry=result.data.features.find(f=>f.properties.id==='wrap').geometry;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const longitudes=polygons.flatMap(poly=>poly.flatMap(ring=>ring.map(point=>point[0])));
  assert.ok(Math.max(...longitudes)>180,'preserve the authored unwrapped longitude');
});
