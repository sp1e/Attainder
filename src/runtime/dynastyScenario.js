import { createCharacterSystem } from './characters/index.js';

export const DYNASTY_SCENARIO_ID = 'dynasties-hadara-v1';
export const DYNASTY_DATE = '-0300-01-01';
export const DYNASTY_CITIES = [
  { id: 'hadara', name: 'Hadara', regionId: 'HAD.6_1', lng: 30.1, lat: 34.9 },
  { id: 'narim', name: 'Narim', regionId: 'HAD.2_1', lng: 28.9, lat: 36.1 },
  { id: 'selene', name: 'Selene', regionId: 'HAD.8_1', lng: 32.5, lat: 34.5 },
  { id: 'tamaris', name: 'Tamaris', regionId: 'HAD.11_1', lng: 30.9, lat: 33.25 },
];

// Original fictional geography. Shared vertices keep province borders aligned.
const vertices = [
  [[26.7,36.8],[28.2,37.2],[29.7,37.1],[31.2,37.5],[33.1,36.9]],
  [[26.9,35.2],[28.4,35.4],[30.1,35.3],[31.8,35.5],[33.4,35.1]],
  [[27.6,33.9],[28.8,33.7],[30.3,33.8],[31.9,33.9],[33.2,33.4]],
  [[28.0,32.4],[29.3,32.1],[30.8,32.5],[32.1,32.0],[33.0,32.2]],
];
const regionNames = ['Kopparhöjderna','Narims dal','Övre Hadara','Selenes höjder','Västra fälten','Hadara','Flodkröken','Selene','Saltkusten','Nedre dalen','Tamaris','Östra gränsen'];
export function createDynastyMap() {
  const features = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const n = row * 4 + col, id = `HAD.${n + 1}_1`;
    const ring = [vertices[row][col],vertices[row][col+1],vertices[row+1][col+1],vertices[row+1][col],vertices[row][col]];
    features.push({ type: 'Feature', id, properties: { GID_1: id, GID_0: 'Hadara', NAME_0: 'Hadara', NAME_1: regionNames[n], COUNTRY: 'Hadara', owner: 'Hadara' }, geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  return { type: 'FeatureCollection', features };
}

export function createDynastyWorld({ mode = 'realm', seed = 104729 } = {}) {
  const characterSystem = createCharacterSystem({ date: DYNASTY_DATE, polityId: 'Hadara', polityName: 'Hadara', mode, seed, cities: DYNASTY_CITIES });
  return {
    ownerSchema: 2, customRegions: true, customCities: true,
    background: { kind: 'vector' }, basemap: 'strategy',
    author: 'Simon · Open Historia Dynasties', mapCredit: 'Egen fiktiv geografi',
    language: 'Swedish', allowedUnitTypes: ['infantry','garrison','naval'],
    characterScenarioId: DYNASTY_SCENARIO_ID, characterSystem,
    initialCameraBounds: [[26.7,32.0],[33.4,37.5]],
    polityOverrides: { Hadara: { name: 'Hadara', status: 'active', color: '#b99755', note: 'Ett fiktivt antikt rike mellan flod, kust och höjder.' } },
    regionOwnershipOverrides: Object.fromEntries(createDynastyMap().features.map(f => [f.id, 'Hadara'])),
    countryStats: { Hadara: { leader: 'Arel av Hadara', government: 'Arvsmonarki med familjeråd', population: 240000, stability: 65, treasury: 180 } },
    units: [
      { id:'hadara-guard',name:'Hadara · stadsvakten',ownerCode:'Hadara',type:'garrison',strength:80,lng:30.1,lat:34.9,regionId:'HAD.6_1',composition:'Spjutbärare och bågskyttar',note:'Bevakar huvudstaden.',status:'idle',source:'scenario' },
      { id:'narim-army',name:'Narim · gränsarmén',ownerCode:'Hadara',type:'infantry',strength:75,lng:28.9,lat:36.1,regionId:'HAD.2_1',composition:'Infanteri och lätta ryttare',note:'Beredskapen påverkas av befäl och familjernas stöd.',status:'idle',source:'scenario' },
    ],
    simulationRules: 'Fiktiv antik värld år 300 f.Kr. Personer, ämbeten, arv, pengar och rättigheter styrs av characterSystem. Använd giltiga characterOps för politiska handlingar; hitta inte på dödsfall, arvingar eller ämbetsbyten som strider mot regelmotorn. Berätta om faktiska skeenden och följ personernas kännedom och motiv.',
    startingTimelineText: 'Arel har samlat Hadara. Fyra familjer tävlar om stadens ämbeten och rikets framtid. Ett gammalt löfte till Namar väntar på att uppfyllas. Riket består, men människorna förändras.',
  };
}

export function createDynastyScenarioBundle() {
  const regions = createDynastyMap();
  const land = { type:'FeatureCollection',features:regions.features.map(f => ({ ...f,properties:{fill:'#a98d60'} })) };
  const cities = { type:'FeatureCollection',features:DYNASTY_CITIES.map((c,i)=>({ type:'Feature',id:c.id,properties:{ id:c.id,name:c.name,NAME:c.name,city:c.name,capital:i===0,population:60000,owner:'Hadara',GID_0:'Hadara',country:'Hadara',regionId:c.regionId },geometry:{type:'Point',coordinates:[c.lng,c.lat]} })) };
  const embedded = data => ({ mode:'embedded',data });
  return {
    schema:'open-historia-scenario-bundle/2',version:2,mode:'full',
    scenario:{ id:DYNASTY_SCENARIO_ID,name:'Antika dynastier · Hadara',eyebrow:'300 f.Kr. · Personer och makt',heroTitle:'Riket består. Människorna förändras.',
      description:'Ett fiktivt antikt rike med fyra politiska familjer, levande karaktärer och skilda arv. Följ riket eller familjen genom generationerna.',
      subtitle:'Fyra familjer · fyra städer · två sätt att styra',accentColor:'#c49b53',
      features:{idleDiplomacy:{enabled:false},espionage:{enabled:false}} },
    data:{game:{country:'Hadara',startDate:DYNASTY_DATE,gameDate:DYNASTY_DATE,round:1,difficulty:'standard',language:'Swedish'},world:createDynastyWorld(),prompts:{},actions:[],events:[],chat:[],advisor:[]},
    assets:{regionsGeojson:embedded(regions),citiesGeojson:embedded(cities),backgroundData:embedded({geojson:land}),colors:embedded({Hadara:'#b99755'}),flags:embedded({}),tags:embedded({}),stats:embedded({})},
  };
}
