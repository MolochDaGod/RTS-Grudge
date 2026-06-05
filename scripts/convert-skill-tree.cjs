/**
 * convert-skill-tree.cjs — FBX→GLB for the grudge-skill-tree asset drop.
 *
 * Source : attached_assets/grudge-skill-tree/assets/*.fbx (+ shared PNGs + class icons)
 * Output : client/public/models/skill_tree/<Name>.glb
 *          client/public/models/skill_tree/tools_bits_*.png  (shared KayKit-style texture maps)
 *          client/public/models/skill_tree/icons/<class>.png  (class emblems for UI)
 *
 * Usage:
 *   node scripts/convert-skill-tree.cjs [--force]
 *     --force    Overwrite existing GLBs/PNGs
 *
 * Follows the same FBX→GLB pipeline as scripts/convert-all-craftpix.cjs (static-mesh path,
 * no skeleton/animation). Conventions per AGENTS.md:
 *   - Static meshes land in client/public/models/<pack>/<Name>.glb (PascalCase, _ separators).
 *   - Shared texture PNGs are copied next to the GLBs that reference them.
 *   - Icons go in a sibling `icons/` directory for UI consumers.
 */
const fs = require('fs');
const path = require('path');

// ── DOM shims (mirrors convert-all-craftpix.cjs) ──
if (typeof document === 'undefined') {
  class FET { constructor(){this._l={}} addEventListener(t,f){(this._l[t]=this._l[t]||[]).push(f)} removeEventListener(t,f){if(this._l[t])this._l[t]=this._l[t].filter(x=>x!==f)} dispatchEvent(e){(this._l[e.type]||[]).forEach(f=>f(e))} }
  class FI extends FET { constructor(){super();this.width=1;this.height=1;this.complete=false;this.naturalWidth=1;this.naturalHeight=1} set src(v){this._s=v;this.complete=true;setTimeout(()=>{this.dispatchEvent({type:'load',target:this});if(this.onload)this.onload({type:'load',target:this})},0)} get src(){return this._s||''} }
  class FC extends FET { constructor(){super();this.width=1;this.height=1;this.style={}} getContext(){return{canvas:this,fillRect:()=>{},clearRect:()=>{},drawImage:()=>{},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData:()=>{},createImageData:()=>({data:new Uint8ClampedArray(4)}),setTransform:()=>{},resetTransform:()=>{},measureText:()=>({width:0}),fillText:()=>{},scale:()=>{},translate:()=>{},rotate:()=>{},save:()=>{},restore:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},stroke:()=>{},fill:()=>{},arc:()=>{},rect:()=>{},clip:()=>{}}} toDataURL(){return'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='} }
  global.document={createElement:t=>t==='canvas'?new FC():t==='img'?new FI():new FET(),createElementNS:(_,t)=>{const e=t==='canvas'?new FC():t==='img'?new FI():new FET();e.style=e.style||{};return e},body:{appendChild:()=>{},removeChild:()=>{}}};
  global.window=global;global.self=global;global.navigator={userAgent:'node',platform:'node'};
  global.HTMLCanvasElement=FC;global.HTMLImageElement=FI;global.Image=FI;
  global.ImageData=class{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4)}};
  global.Blob=global.Blob||class{constructor(p,o){this.parts=p;this.type=o?.type}};
  global.atob=global.atob||((s)=>Buffer.from(s,'base64').toString('binary'));
  global.btoa=global.btoa||((s)=>Buffer.from(s,'binary').toString('base64'));
  global.requestAnimationFrame=(cb)=>setTimeout(cb,16);global.cancelAnimationFrame=clearTimeout;
  global.OffscreenCanvas=class extends FC{constructor(w,h){super();this.width=w;this.height=h}};
  global.createImageBitmap=async()=>new FI();
}

const THREE = require('three');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');

function sanitize(n){return n?n.replace(/:/g,''):n}

// ── Minimal static-mesh GLB builder (same shape as convert-all-craftpix.cjs) ──
function buildGlb(scene){
  const gltf={asset:{version:'2.0',generator:'skill-tree-converter'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],accessors:[],bufferViews:[],buffers:[],materials:[],animations:[]};
  const chunks=[];let off=0;
  function bv(data,tgt){const b=Buffer.from(data.buffer,data.byteOffset,data.byteLength);const p=(4-(b.length%4))%4;const pb=p>0?Buffer.concat([b,Buffer.alloc(p)]):b;const i=gltf.bufferViews.length;const v={buffer:0,byteOffset:off,byteLength:b.length};if(tgt)v.target=tgt;gltf.bufferViews.push(v);off+=pb.length;chunks.push(pb);return i}
  function acc(data,type,ct,tgt){const vi=bv(data,tgt);const es=type==='SCALAR'?1:type==='VEC2'?2:type==='VEC3'?3:type==='VEC4'?4:16;const c=data.length/es;const a={bufferView:vi,componentType:ct||5126,count:c,type};if(type==='VEC3'||type==='VEC2'||type==='SCALAR'){const mn=Array(es).fill(Infinity),mx=Array(es).fill(-Infinity);for(let i=0;i<data.length;i++){const k=i%es;if(data[i]<mn[k])mn[k]=data[i];if(data[i]>mx[k])mx[k]=data[i]}a.min=mn;a.max=mx}gltf.accessors.push(a);return gltf.accessors.length-1}
  const mm=new Map();
  function mat(m){if(!m)return 0;const k=m.uuid||m.name||'d';if(mm.has(k))return mm.get(k);const g={name:sanitize(m.name)||`mat_${gltf.materials.length}`};const p={};p.baseColorFactor=m.color?[m.color.r,m.color.g,m.color.b,m.opacity??1]:[.8,.8,.8,1];p.roughnessFactor=m.roughness??.8;p.metallicFactor=m.metalness??0;g.pbrMetallicRoughness=p;if(m.transparent)g.alphaMode='BLEND';if(m.side===THREE.DoubleSide)g.doubleSided=true;const i=gltf.materials.length;gltf.materials.push(g);mm.set(k,i);return i}
  let tv=0,tt=0,mc=0;
  scene.traverse(ch=>{if(!ch.isMesh)return;const g=ch.geometry;mc++;const pa=g.attributes.position;if(!pa)return;tv+=pa.count;const at={};at.POSITION=acc(new Float32Array(pa.array),'VEC3',5126,34962);if(g.attributes.normal)at.NORMAL=acc(new Float32Array(g.attributes.normal.array),'VEC3',5126,34962);if(g.attributes.uv)at.TEXCOORD_0=acc(new Float32Array(g.attributes.uv.array),'VEC2',5126,34962);if(g.attributes.color)at.COLOR_0=acc(new Float32Array(g.attributes.color.array),g.attributes.color.itemSize===4?'VEC4':'VEC3',5126,34962);
  const pr={attributes:at};if(g.index){const id=g.index.count>65535?new Uint32Array(g.index.array):new Uint16Array(g.index.array);pr.indices=acc(id,'SCALAR',g.index.count>65535?5125:5123,34963);tt+=g.index.count/3}else tt+=pa.count/3;
  const mt=Array.isArray(ch.material)?ch.material[0]:ch.material;pr.material=mat(mt);const mi=gltf.meshes.length;gltf.meshes.push({name:sanitize(ch.name)||`mesh_${mi}`,primitives:[pr]});
  const ni=gltf.nodes.length;const nd={name:sanitize(ch.name)||`node_${ni}`,mesh:mi};if(ch.position&&(ch.position.x||ch.position.y||ch.position.z))nd.translation=[ch.position.x,ch.position.y,ch.position.z];if(ch.quaternion&&(ch.quaternion.x||ch.quaternion.y||ch.quaternion.z||ch.quaternion.w!==1))nd.rotation=[ch.quaternion.x,ch.quaternion.y,ch.quaternion.z,ch.quaternion.w];if(ch.scale&&(ch.scale.x!==1||ch.scale.y!==1||ch.scale.z!==1))nd.scale=[ch.scale.x,ch.scale.y,ch.scale.z];
  gltf.nodes.push(nd);gltf.scenes[0].nodes.push(ni)});
  if(!gltf.materials.length)gltf.materials.push({name:'default',pbrMetallicRoughness:{baseColorFactor:[.8,.8,.8,1],roughnessFactor:.8,metallicFactor:0}});
  const ab=Buffer.concat(chunks.length?chunks:[Buffer.alloc(0)]);gltf.buffers.push({byteLength:ab.length});
  const js=JSON.stringify(gltf),jb=Buffer.from(js,'utf8'),jp=(4-(jb.length%4))%4,pj=jp>0?Buffer.concat([jb,Buffer.alloc(jp,0x20)]):jb;
  const bp=(4-(ab.length%4))%4,pb=bp>0?Buffer.concat([ab,Buffer.alloc(bp)]):ab;
  const tl=12+8+pj.length+8+pb.length;const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(tl,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(pj.length,0);jh.writeUInt32LE(0x4E4F534A,4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(pb.length,0);bh.writeUInt32LE(0x004E4942,4);
  return{glb:Buffer.concat([h,jh,pj,bh,pb]),stats:{verts:tv,tris:tt,meshes:mc}};
}

function convertOne(fbxPath,outPath){
  const buf=fs.readFileSync(fbxPath);const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const loader=new FBXLoader();const scene=loader.parse(ab,path.dirname(fbxPath)+'/');
  const{glb,stats}=buildGlb(scene);fs.writeFileSync(outPath,glb);return stats;
}

// ── Skill-tree pack definition ──
const SRC = path.resolve(__dirname,'../attached_assets/grudge-skill-tree/assets');
const OUT = path.resolve(__dirname,'../client/public/models/skill_tree');
const OUT_ICONS = path.join(OUT,'icons');

// Source FBX → PascalCase GLB name. `reciepe.fbx` is renamed to fix the upstream typo.
const FILES = {
  'alliesbuildingandlumberyard.fbx': 'Allies_Building_Lumberyard.glb',
  'axe.fbx':                          'Axe.glb',
  'builderhammer.fbx':                'Builder_Hammer.glb',
  'cooking.fbx':                      'Cooking.glb',
  'engineering.fbx':                  'Engineering.glb',
  'enhancebench.fbx':                 'Enhance_Bench.glb',
  'mining.fbx':                       'Mining.glb',
  'reciepe.fbx':                      'Recipe.glb',
  'recipe_rolled.fbx':                'Recipe_Rolled.glb',
  'repairhammer.fbx':                 'Repair_Hammer.glb',
  'rope_bundle_A.fbx':                'Rope_Bundle_A.glb',
  'shovellandeditor.fbx':             'Shovel_Land_Editor.glb',
  'torch.fbx':                        'Torch.glb',
  'torch_burnt.fbx':                  'Torch_Burnt.glb',
  'wand.fbx':                         'Wand.glb',
  'workbench.fbx':                    'Workbench.glb',
};

// Shared KayKit-style PNGs that GLBs in this pack reference by relative name.
const TEXTURES = ['tools_bits_blueprint.png','tools_bits_map_empty.png','tools_bits_texture.png'];

// Class emblem PNGs (skill-tree UI consumers).
// `Worge Emblem.png` in the source drop is renamed to `worge.png` to match the
// lowercase / no-space convention of the other class icons.
const ICONS = [
  { src: 'mage.png',         dst: 'mage.png' },
  { src: 'ranger.png',       dst: 'ranger.png' },
  { src: 'warrior.png',      dst: 'warrior.png' },
  { src: 'Worge Emblem.png', dst: 'worge.png' },
];

async function main(){
  const force = process.argv.includes('--force');
  console.log('\n=== Grudge Skill Tree FBX → GLB ===');
  console.log(`SRC: ${SRC}`);
  console.log(`OUT: ${OUT}\n`);

  fs.mkdirSync(OUT,{recursive:true});
  fs.mkdirSync(OUT_ICONS,{recursive:true});

  // 1) Convert FBX → GLB
  let conv=0,skip=0,fail=0;
  for(const [src,dst] of Object.entries(FILES)){
    const sp=path.join(SRC,src), op=path.join(OUT,dst);
    if(fs.existsSync(op)&&!force){skip++;continue}
    if(!fs.existsSync(sp)){console.log(`  ✗ missing source: ${src}`);fail++;continue}
    try{const s=convertOne(sp,op);console.log(`  ✓ ${dst}  (${s.verts}v ${s.tris}t ${s.meshes}m)`);conv++}
    catch(e){console.log(`  ✗ ${dst}: ${e.message}`);fail++}
  }

  // 2) Copy shared texture PNGs (so GLB material refs resolve in-place)
  console.log('\n── shared textures ──');
  for(const t of TEXTURES){
    const sp=path.join(SRC,t), op=path.join(OUT,t);
    if(!fs.existsSync(sp)){console.log(`  ✗ missing: ${t}`);continue}
    if(fs.existsSync(op)&&!force){console.log(`  · skip ${t}`);continue}
    fs.copyFileSync(sp,op);console.log(`  ✓ ${t}`);
  }

  // 3) Copy class icons
  console.log('\n── class icons ──');
  for(const i of ICONS){
    const sp=path.join(SRC,'icons',i.src), op=path.join(OUT_ICONS,i.dst);
    if(!fs.existsSync(sp)){console.log(`  ✗ missing: ${i.src}`);continue}
    if(fs.existsSync(op)&&!force){console.log(`  · skip ${i.dst}`);continue}
    fs.copyFileSync(sp,op);console.log(`  ✓ ${i.dst}${i.src!==i.dst?`  (from ${i.src})`:''}`);
  }

  console.log(`\n=== Done: ${conv} converted, ${skip} skipped, ${fail} failed ===\n`);
  process.exit(fail>0?1:0);
}

main().catch(e=>{console.error(e);process.exit(1)});
