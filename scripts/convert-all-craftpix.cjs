/**
 * convert-all-craftpix.cjs — Batch FBX→GLB for all Craftpix asset packs.
 *
 * Usage: node scripts/convert-all-craftpix.cjs [--force] [--pack=name]
 *   --force    Overwrite existing GLBs
 *   --pack=X   Only convert pack X (e.g. --pack=battle_towers)
 */
const fs = require('fs');
const path = require('path');

// ── DOM shims ──
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

// ── Minimal GLB builder (same as other converters) ──
function buildGlb(scene){
  const gltf={asset:{version:'2.0',generator:'craftpix-batch'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],accessors:[],bufferViews:[],buffers:[],materials:[],animations:[]};
  const chunks=[];let off=0;
  function bv(data,tgt){const b=Buffer.from(data.buffer,data.byteOffset,data.byteLength);const p=(4-(b.length%4))%4;const pb=p>0?Buffer.concat([b,Buffer.alloc(p)]):b;const i=gltf.bufferViews.length;const v={buffer:0,byteOffset:off,byteLength:b.length};if(tgt)v.target=tgt;gltf.bufferViews.push(v);off+=pb.length;chunks.push(pb);return i}
  function acc(data,type,ct,tgt){const vi=bv(data,tgt);const es=type==='SCALAR'?1:type==='VEC2'?2:type==='VEC3'?3:type==='VEC4'?4:16;const c=data.length/es;const a={bufferView:vi,componentType:ct||5126,count:c,type};if(type==='VEC3'||type==='VEC2'||type==='SCALAR'){const mn=Array(es).fill(Infinity),mx=Array(es).fill(-Infinity);for(let i=0;i<data.length;i++){const k=i%es;if(data[i]<mn[k])mn[k]=data[i];if(data[i]>mx[k])mx[k]=data[i]}a.min=mn;a.max=mx}gltf.accessors.push(a);return gltf.accessors.length-1}
  const mm=new Map();
  function mat(m){if(!m)return 0;const k=m.uuid||m.name||'d';if(mm.has(k))return mm.get(k);const g={name:sanitize(m.name)||`mat_${gltf.materials.length}`};const p={};p.baseColorFactor=m.color?[m.color.r,m.color.g,m.color.b,m.opacity??1]:[.8,.8,.8,1];p.roughnessFactor=m.roughness??.8;p.metallicFactor=m.metalness??0;g.pbrMetallicRoughness=p;if(m.transparent)g.alphaMode='BLEND';if(m.side===THREE.DoubleSide)g.doubleSided=true;const i=gltf.materials.length;gltf.materials.push(g);mm.set(k,i);return i}
  // Bones
  const bni=new Map(),bl=[];scene.traverse(c=>{if(c.isBone)bl.push(c)});
  if(bl.length>0){for(const b of bl){const ni=gltf.nodes.length;bni.set(b,ni);const n={name:sanitize(b.name)};if(b.position&&(b.position.x||b.position.y||b.position.z))n.translation=[b.position.x,b.position.y,b.position.z];if(b.quaternion&&(b.quaternion.x||b.quaternion.y||b.quaternion.z||b.quaternion.w!==1))n.rotation=[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w];if(b.scale&&(b.scale.x!==1||b.scale.y!==1||b.scale.z!==1))n.scale=[b.scale.x,b.scale.y,b.scale.z];gltf.nodes.push(n)}
  const ib=new Float32Array(bl.length*16);for(let i=0;i<bl.length;i++){const m=new THREE.Matrix4();bl[i].updateWorldMatrix(true,false);m.copy(bl[i].matrixWorld).invert();ib.set(m.elements,i*16)}
  gltf.skins=[{inverseBindMatrices:acc(ib,'MAT4',5126),joints:bl.map(b=>bni.get(b))}]}
  const si=gltf.skins?0:-1;
  let tv=0,tt=0,mc=0;
  scene.traverse(ch=>{if(!ch.isMesh)return;const g=ch.geometry;mc++;const pa=g.attributes.position;if(!pa)return;tv+=pa.count;const at={};at.POSITION=acc(new Float32Array(pa.array),'VEC3',5126,34962);if(g.attributes.normal)at.NORMAL=acc(new Float32Array(g.attributes.normal.array),'VEC3',5126,34962);if(g.attributes.uv)at.TEXCOORD_0=acc(new Float32Array(g.attributes.uv.array),'VEC2',5126,34962);if(g.attributes.color)at.COLOR_0=acc(new Float32Array(g.attributes.color.array),g.attributes.color.itemSize===4?'VEC4':'VEC3',5126,34962);
  if(si>=0&&g.attributes.skinIndex&&g.attributes.skinWeight){const jd=new Uint16Array(g.attributes.skinIndex.array.length);for(let i=0;i<jd.length;i++)jd[i]=Math.floor(g.attributes.skinIndex.array[i]);at.JOINTS_0=acc(jd,'VEC4',5123,34962);at.WEIGHTS_0=acc(new Float32Array(g.attributes.skinWeight.array),'VEC4',5126,34962)}
  const pr={attributes:at};if(g.index){const id=g.index.count>65535?new Uint32Array(g.index.array):new Uint16Array(g.index.array);pr.indices=acc(id,'SCALAR',g.index.count>65535?5125:5123,34963);tt+=g.index.count/3}else tt+=pa.count/3;
  const mt=Array.isArray(ch.material)?ch.material[0]:ch.material;pr.material=mat(mt);const mi=gltf.meshes.length;gltf.meshes.push({name:sanitize(ch.name)||`mesh_${mi}`,primitives:[pr]});
  const ni=gltf.nodes.length;const nd={name:sanitize(ch.name)||`node_${ni}`,mesh:mi};if(ch.position&&(ch.position.x||ch.position.y||ch.position.z))nd.translation=[ch.position.x,ch.position.y,ch.position.z];if(ch.quaternion&&(ch.quaternion.x||ch.quaternion.y||ch.quaternion.z||ch.quaternion.w!==1))nd.rotation=[ch.quaternion.x,ch.quaternion.y,ch.quaternion.z,ch.quaternion.w];if(ch.scale&&(ch.scale.x!==1||ch.scale.y!==1||ch.scale.z!==1))nd.scale=[ch.scale.x,ch.scale.y,ch.scale.z];
  if(si>=0&&ch.isSkinnedMesh)nd.skin=si;gltf.nodes.push(nd);gltf.scenes[0].nodes.push(ni)});
  if(!gltf.materials.length)gltf.materials.push({name:'default',pbrMetallicRoughness:{baseColorFactor:[.8,.8,.8,1],roughnessFactor:.8,metallicFactor:0}});
  const ab=Buffer.concat(chunks.length?chunks:[Buffer.alloc(0)]);gltf.buffers.push({byteLength:ab.length});
  const js=JSON.stringify(gltf),jb=Buffer.from(js,'utf8'),jp=(4-(jb.length%4))%4,pj=jp>0?Buffer.concat([jb,Buffer.alloc(jp,0x20)]):jb;
  const bp=(4-(ab.length%4))%4,pb=bp>0?Buffer.concat([ab,Buffer.alloc(bp)]):ab;
  const tl=12+8+pj.length+8+pb.length;const h=Buffer.alloc(12);h.writeUInt32LE(0x46546C67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(tl,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(pj.length,0);jh.writeUInt32LE(0x4E4F534A,4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(pb.length,0);bh.writeUInt32LE(0x004E4942,4);
  return{glb:Buffer.concat([h,jh,pj,bh,pb]),stats:{verts:tv,tris:tt,meshes:mc,bones:bl.length}};
}

function convert(fbxPath,outPath){
  const buf=fs.readFileSync(fbxPath);const ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  const loader=new FBXLoader();const scene=loader.parse(ab,path.dirname(fbxPath)+'/');
  const{glb,stats}=buildGlb(scene);fs.writeFileSync(outPath,glb);return stats;
}

// ── Pack definitions: srcDir, outDir, file map {src→dst} ──
const B = 'D:/Games/Models';
const O = path.resolve(__dirname,'../client/public/models');

const PACKS = {
  medieval_props: {
    srcDir: `${B}/craftpix_medieval_props/Fbx`,
    outDir: `${O}/medieval_props`,
    files: {
      'Axe.fbx':'Axe.glb','Barrel_broken.fbx':'Barrel_Broken.glb','Barrel.fbx':'Barrel.glb',
      'Basin.fbx':'Basin.glb','Bench.fbx':'Bench.glb','Box.fbx':'Crate.glb',
      'Bucket.fbx':'Bucket.glb','Chest.fbx':'Chest.glb','Firewood.fbx':'Firewood.glb',
      'Fork.fbx':'Pitchfork.glb','Haystack_01.fbx':'Haystack_A.glb','Haystack_02.fbx':'Haystack_B.glb',
      'Haystack_03.fbx':'Haystack_C.glb','Pot_01.fbx':'Pot_A.glb','Pot_02.fbx':'Pot_B.glb',
      'Pot_03.fbx':'Cauldron.glb','Rake.fbx':'Rake.glb','Scythe.fbx':'Scythe.glb',
      'Shovel.fbx':'Shovel.glb','Signpost_01.fbx':'Signpost_A.glb','Signpost_02.fbx':'Signpost_B.glb',
      'Signpost_03.fbx':'Signpost_C.glb','Stump.fbx':'Tree_Stump.glb','Trough.fbx':'Trough.glb',
      'Washboard.fbx':'Washboard.glb','Well.fbx':'Well.glb',
    }
  },
  farm_animals: {
    srcDir: `${B}/craftpix_farm_animals/fbx`,
    outDir: `${O}/farm_animals`,
    files: {
      'bull.fbx':'Bull.glb','chicken.fbx':'Chicken.glb','cow.fbx':'Cow.glb',
      'dack.fbx':'Duck.glb','dog.fbx':'Dog.glb','horse.fbx':'Horse.glb',
      'pig.fbx':'Pig.glb','ram.fbx':'Ram.glb','rooster.fbx':'Rooster.glb','sheep.fbx':'Sheep.glb',
    }
  },
  env_props: {
    srcDir: `${B}/craftpix_environment_props/fbx`,
    outDir: `${O}/env_props`,
    files: {
      'barrel_2.fbx':'Barrel_B.glb','barrel.fbx':'Barrel_A.glb','boat.fbx':'Boat.glb',
      'box.fbx':'Crate.glb','bridge.fbx':'Bridge.glb','bucket.fbx':'Bucket.glb',
      'Bulletin_board.fbx':'Bulletin_Board.glb','cart_1.fbx':'Cart_A.glb',
      'cart_2.fbx':'Cart_B.glb','cart_3.fbx':'Cart_C.glb',
      'Fense_1.fbx':'Fence_A.glb','Fense_2.fbx':'Fence_B.glb',
      'gallows.fbx':'Gallows.glb','gate_1.fbx':'Gate_A.glb','gate_2.fbx':'Gate_B.glb',
      'Ledder.fbx':'Ladder.glb','pads.fbx':'Stepping_Stones.glb',
      'pointer_1.fbx':'Sign_A.glb','pointer_2.fbx':'Sign_B.glb',
      'warning_bell.fbx':'Warning_Bell.glb',
    }
  },
  flora: {
    srcDir: `${B}/craftpix_flora/fbx`,
    outDir: `${O}/flora`,
    files: {
      '_bush_1.fbx':'Bush_A.glb','_bush_2.fbx':'Bush_B.glb','_bush_3.fbx':'Bush_C.glb',
      '_bush_4.fbx':'Bush_D.glb','_bush_5.fbx':'Bush_E.glb',
      '_flower_1.fbx':'Flower_A.glb','_flower_2.fbx':'Flower_B.glb','_flower_3.fbx':'Flower_C.glb',
      '_flower_4.fbx':'Flower_D.glb','_flower_5.fbx':'Flower_E.glb','_flower_6.fbx':'Flower_F.glb',
      '_grass_1.fbx':'Grass_A.glb','_grass_2.fbx':'Grass_B.glb',
      '_mashroom_1.fbx':'Mushroom_A.glb','_mashroom_2.fbx':'Mushroom_B.glb',
      '_mashroom_3.fbx':'Mushroom_C.glb','_mashroom_4.fbx':'Mushroom_D.glb',
      '_stone_2.fbx':'Stone_A.glb','_stone_3.fbx':'Stone_B.glb','_stones_1.fbx':'Stone_Cluster.glb',
    }
  },
  elven_runes: {
    srcDir: `${B}/craftpix_elven_runes/fbx`,
    outDir: `${O}/elven_runes`,
    files: {
      '_lamp_1.fbx':'Rune_Lamp.glb',
      '_sculpture_1.fbx':'Sculpture_A.glb','_sculpture_2.fbx':'Sculpture_B.glb',
      '_sculpture_3.fbx':'Sculpture_C.glb','_sculptire_4.fbx':'Sculpture_D.glb',
      '_sculpture_5.fbx':'Sculpture_E.glb','_sculpture_6.fbx':'Sculpture_F.glb',
      '_sculpture_7.fbx':'Sculpture_G.glb','_sculpture_8.fbx':'Sculpture_H.glb',
      '_sculptire_9.fbx':'Sculpture_I.glb',
      '_STOLB_1.fbx':'Rune_Pillar_A.glb','_stolb_2.fbx':'Rune_Pillar_B.glb',
      '_stone_1.fbx':'Rune_Stone.glb',
      '_STUMP_1.fbx':'Ancient_Stump_A.glb','_stump_2.fbx':'Ancient_Stump_B.glb',
      '_stump_3.fbx':'Ancient_Stump_C.glb','_stump_4.fbx':'Ancient_Stump_D.glb',
      '_stump_5.fbx':'Ancient_Stump_E.glb',
      '_throne_1.fbx':'Elven_Throne.glb','_tree_1.fbx':'Ancient_Tree.glb',
    }
  },
  mine: {
    srcDir: `${B}/craftpix_mine/fbx/full`,
    outDir: `${O}/mine`,
    files: {
      '_coal_1.fbx':'Coal_Node.glb',
      '_crystal_1.fbx':'Crystal_A.glb','_crystal_2.fbx':'Crystal_B.glb',
      '_crystal_3.fbx':'Crystal_C.glb','_crystal_4.fbx':'Crystal_D.glb',
      '_crystal_5.fbx':'Crystal_E.glb','_crystal_6.fbx':'Crystal_F.glb',
      '_for_wood.fbx':'Woodcutting_Block.glb',
      '_gold_1.fbx':'Gold_Node_A.glb','_gold_2.fbx':'Gold_Node_B.glb',
      '_mine_1.fbx':'Mine_Entrance_A.glb','_mine_2.fbx':'Mine_Entrance_B.glb',
      '_mine_3.fbx':'Mine_Entrance_C.glb','_mine_4.fbx':'Mine_Shaft.glb',
      '_pick_1.fbx':'Pickaxe_A.glb','_pick_2.fbx':'Pickaxe_B.glb',
      '_samwill.fbx':'Sawmill.glb',
      '_sapfir_1.fbx':'Sapphire_Node_A.glb','_sapfir_2.fbx':'Sapphire_Node_B.glb',
      '_saw_1.fbx':'Saw_A.glb','_saw_2.fbx':'Saw_B.glb',
      '_stone_2.fbx':'Stone_Node_A.glb','_stone_3.fbx':'Stone_Node_B.glb','_stone_4.fbx':'Stone_Node_C.glb',
      '_stone_coal.fbx':'Ore_Coal.glb','_stone_diamond.fbx':'Ore_Diamond.glb',
      '_stone_emerald.fbx':'Ore_Emerald.glb','_stone_gold.fbx':'Ore_Gold.glb',
      '_stone_mineral.fbx':'Ore_Mineral.glb',
      '_wheelbarrow_coal.fbx':'Wheelbarrow_Coal.glb','_wheelbarrow_diamonds.fbx':'Wheelbarrow_Diamonds.glb',
      '_wheelbarrow_emerald.fbx':'Wheelbarrow_Emerald.glb','_wheelbarrow_empty.fbx':'Wheelbarrow_Empty.glb',
      '_wheelbarrow_gold.fbx':'Wheelbarrow_Gold.glb','_wheelbarrow_mineral.fbx':'Wheelbarrow_Mineral.glb',
      '_wood_1.fbx':'Log_Pile_A.glb','_wood_2.fbx':'Log_Pile_B.glb','_wood_3.fbx':'Log_Pile_C.glb',
      '_wood_house.fbx':'Lumber_Shed.glb',
    }
  },
  battle_towers: {
    srcDir: `${B}/craftpix_battle_towers/fbx/full_fbx`,
    outDir: `${O}/battle_towers`,
    files: {
      '_archers_tower_LVL_1.fbx':'Archer_Tower_L1.glb','_archers_tower_LVL_2.fbx':'Archer_Tower_L2.glb',
      '_arches_tower_LVL_3.fbx':'Archer_Tower_L3.glb','_arches_tower_LVL_4.fbx':'Archer_Tower_L4.glb',
      '_Ballista_tower_LVL_1.fbx':'Ballista_Tower_L1.glb','_Ballista_tower_LVL_2.fbx':'Ballista_Tower_L2.glb',
      '_Ballista_tower_LVL_3.fbx':'Ballista_Tower_L3.glb','_Ballista_tower_LVL_4.fbx':'Ballista_Tower_L4.glb',
      '_Cannon_tower_LVL_1.fbx':'Cannon_Tower_L1.glb','_Cannon_tower_LVL_2.fbx':'Cannon_Tower_L2.glb',
      '_Cannon_Tower_LVL_3.fbx':'Cannon_Tower_L3.glb','_Cannon_tower_LVL_4.fbx':'Cannon_Tower_L4.glb',
      '_Fire_tower_LVL_1.fbx':'Fire_Tower_L1.glb','_Fire_tower_LVL_2.fbx':'Fire_Tower_L2.glb',
      '_Fire_tower_LVL_3.fbx':'Fire_Tower_L3.glb','_Fire_tower_LVL_4.fbx':'Fire_Tower_L4.glb',
      '_Wizard_tower_LVL_1.fbx':'Wizard_Tower_L1.glb','_Wizard_tower_LVL_2.fbx':'Wizard_Tower_L2.glb',
      '_Wizard_tower_LVL_3.fbx':'Wizard_Tower_L3.glb','_Wizard_tower_LVL_4.fbx':'Wizard_Tower_L4.glb',
    }
  },
  battle_tower_shells: {
    srcDir: `${B}/craftpix_battle_towers/fbx/Shells`,
    outDir: `${O}/battle_towers`,
    files: {
      '_Archers_shells_LVL_1.fbx':'Shell_Arrow_L1.glb','_Archers_shell_LVL_2.fbx':'Shell_Arrow_L2.glb',
      '_Archers_shell_LVL_3.fbx':'Shell_Arrow_L3.glb','_Archers_shell_LVL_4.fbx':'Shell_Arrow_L4.glb',
      '_Ballisya_shell.fbx':'Shell_Ballista.glb','_Cannon_shell.fbx':'Shell_Cannon.glb',
      '_Fire_shell.fbx':'Shell_Fire.glb','_Wizard_shell.fbx':'Shell_Wizard.glb',
    }
  },
  battle_tower_rigs: {
    srcDir: `${B}/craftpix_battle_towers/fbx/Rig_unity`,
    outDir: `${O}/battle_towers`,
    files: {
      '_archers_tower_LVL_1_rig.fbx':'Archer_Tower_L1_Rig.glb','_archers_tower_LVL_2_rig.fbx':'Archer_Tower_L2_Rig.glb',
      '_archers_tower_LVL_3_rig.fbx':'Archer_Tower_L3_Rig.glb','_archers_tower_LVL_4_rig.fbx':'Archer_Tower_L4_Rig.glb',
      '_ballista_tower_LVL_1_rig.fbx':'Ballista_Tower_L1_Rig.glb','_ballista_tower_LVL_2_rig.fbx':'Ballista_Tower_L2_Rig.glb',
      '_ballista_tower_LVL_3_rig.fbx':'Ballista_Tower_L3_Rig.glb','_ballista_tower_LVL_4_rig.fbx':'Ballista_Tower_L4_Rig.glb',
      '_cannon_tower_LVL_1_rig.fbx':'Cannon_Tower_L1_Rig.glb','_cannon_tower_LVL_2_rig.fbx':'Cannon_Tower_L2_Rig.glb',
      '_cannon_tower_LVL_3_rig.fbx':'Cannon_Tower_L3_Rig.glb','_cannon_tower_LVL_4_rig.fbx':'Cannon_Tower_L4_Rig.glb',
      '_fire_tower_LVL_1_rig.fbx':'Fire_Tower_L1_Rig.glb','_fire_tower_LVL_2_rig.fbx':'Fire_Tower_L2_Rig.glb',
      '_fire_tower_LVL_3_rig.fbx':'Fire_Tower_L3_Rig.glb','_fire_tower_LVL_4_rig.fbx':'Fire_Tower_L4_Rig.glb',
      '_wizard_tower_LVL_1_rig.fbx':'Wizard_Tower_L1_Rig.glb','_wizard_tower_LVL_2_rig.fbx':'Wizard_Tower_L2_Rig.glb',
      '_wizard_tower_LVL_3_rig.fbx':'Wizard_Tower_L3_Rig.glb','_wizard_tower_LVL_4_rig.fbx':'Wizard_Tower_L4_Rig.glb',
    }
  },
  volcano: {
    srcDir: `${B}/craftpix_volcano/fbx`,
    outDir: `${O}/volcano`,
    files: Object.fromEntries([
      ...Array.from({length:10},(_,i)=>[`Volcanoe_0${i+1}.fbx`,`Volcano_${String(i+1).padStart(2,'0')}.glb`]),
      [`Volcanoe_010.fbx`,'Volcano_10.glb'],
      ...Array.from({length:10},(_,i)=>[`Boulder_0${i+1}.fbx`,`Lava_Boulder_${String(i+1).padStart(2,'0')}.glb`]),
      [`Boulder_010.fbx`,'Lava_Boulder_10.glb'],
    ]),
  },
  mountain: {
    srcDir: `${B}/craftpix_mountain/fbx`,
    outDir: `${O}/mountain`,
    files: Object.fromEntries([
      ...Array.from({length:5},(_,i)=>[`Hill_temperate_climate_00${i+1}.fbx`,`Hill_${String(i+1).padStart(2,'0')}.glb`]),
      ...Array.from({length:10},(_,i)=>[`Mountains_temperate_climate_00${i+1}.fbx`,`Mountain_${String(i+1).padStart(2,'0')}.glb`]),
      [`Mountains_temperate_climate_010.fbx`,'Mountain_10.glb'],
      ...Array.from({length:5},(_,i)=>[`Plateau_temperate_climate_00${i+1}.fbx`,`Plateau_${String(i+1).padStart(2,'0')}.glb`]),
    ]),
  },
  orc_props: {
    srcDir: `${B}/craftpix_orc_props/fbx`,
    outDir: `${O}/orc_props`,
    files: {
      '_alarm_horn.fbx':'Alarm_Horn.glb','_bake.fbx':'Bakery_Oven.glb',
      '_barrel_1.fbx':'Barrel_A.glb','_barrel_2.fbx':'Barrel_B.glb',
      '_bottle.fbx':'Bottle.glb','_box.fbx':'Storage_Box.glb',
      '_chair1.fbx':'Chair.glb','_cup.fbx':'Drinking_Cup.glb',
      '_drum_1.fbx':'War_Drum_A.glb','_drum_2.fbx':'War_Drum_B.glb',
      '_flag.fbx':'War_Banner.glb','_pointer.fbx':'Sign_Post.glb',
      '_pot_1.fbx':'Cooking_Pot.glb','_pot_2.fbx':'Clay_Pot.glb','_pot_3.fbx':'Cauldron.glb',
      '_table.fbx':'Table.glb','_throne.fbx':'Warchief_Throne.glb',
      '_torch_1.fbx':'Torch_A.glb','_torch_2.fbx':'Torch_B.glb',
      '_waterwheel.fbx':'Waterwheel.glb',
    }
  },
  stones: {
    srcDir: `${B}/craftpix_stones/fbx`,
    outDir: `${O}/stones`,
    files: Object.fromEntries([
      ...Array.from({length:10},(_,i)=>[`Stone_big_00${i+1}.fbx`,`Stone_Big_${String(i+1).padStart(2,'0')}.glb`]),
      [`Stone_big_010.fbx`,'Stone_Big_10.glb'],
      ...Array.from({length:10},(_,i)=>[`Stone_mid_00${i+1}.fbx`,`Stone_Mid_${String(i+1).padStart(2,'0')}.glb`]),
      [`Stone_mid_010.fbx`,'Stone_Mid_10.glb'],
      ...Array.from({length:20},(_,i)=>{const n=String(i+1).padStart(3,'0');return[`Stone_lit_${n}.fbx`,`Stone_Small_${n}.glb`]}),
    ]),
  },
};

// Also copy textures
const TEXTURES = [
  { src: `${B}/craftpix_medieval_props/Texture/Texture_MAp.png`, dst: `${O}/medieval_props/texture_map.png` },
  { src: `${B}/craftpix_farm_animals/texture/Texture_MAp.png`, dst: `${O}/farm_animals/texture_map.png` },
  { src: `${B}/craftpix_environment_props/texture/texture_MAp.png`, dst: `${O}/env_props/texture_map.png` },
  { src: `${B}/craftpix_flora/texture/Texture.png`, dst: `${O}/flora/texture_map.png` },
  { src: `${B}/craftpix_elven_runes/texture/Texture_MAp.png`, dst: `${O}/elven_runes/texture_map.png` },
  { src: `${B}/craftpix_mine/texture/Texture_MAp.png`, dst: `${O}/mine/texture_map.png` },
  { src: `${B}/craftpix_battle_towers/texture/Texture_MAp.png`, dst: `${O}/battle_towers/texture_map.png` },
  { src: `${B}/craftpix_volcano/Texture/Texture_MAp.png`, dst: `${O}/volcano/texture_map.png` },
  { src: `${B}/craftpix_mountain/Texture/Texture_MAp.png`, dst: `${O}/mountain/texture_map.png` },
  { src: `${B}/craftpix_stones/Texture/Texture_MAp.png`, dst: `${O}/stones/texture_map.png` },
  { src: `${B}/craftpix_orc_props/texture/Texture_MAp.png`, dst: `${O}/orc_props/texture_map.png` },
];

async function main(){
  const force=process.argv.includes('--force');
  const packArg=process.argv.find(a=>a.startsWith('--pack='));
  const onlyPack=packArg?packArg.split('=')[1]:null;

  console.log('\n=== Craftpix Batch FBX → GLB ===\n');

  // Copy textures
  for(const t of TEXTURES){
    if(fs.existsSync(t.src)&&(!fs.existsSync(t.dst)||force)){
      fs.mkdirSync(path.dirname(t.dst),{recursive:true});
      fs.copyFileSync(t.src,t.dst);
    }
  }

  let totalConverted=0,totalSkipped=0,totalFailed=0;

  for(const[packName,pack] of Object.entries(PACKS)){
    if(onlyPack&&packName!==onlyPack)continue;
    console.log(`\n── ${packName} (${Object.keys(pack.files).length} files) ──`);
    fs.mkdirSync(pack.outDir,{recursive:true});

    for(const[src,dst] of Object.entries(pack.files)){
      const srcPath=path.join(pack.srcDir,src);
      const outPath=path.join(pack.outDir,dst);
      if(fs.existsSync(outPath)&&!force){totalSkipped++;continue}
      if(!fs.existsSync(srcPath)){console.log(`  ✗ Missing: ${src}`);totalFailed++;continue}
      try{
        const s=convert(srcPath,outPath);
        console.log(`  ✓ ${dst}  (${s.verts}v ${s.tris}t ${s.bones}b)`);
        totalConverted++;
      }catch(e){console.log(`  ✗ ${dst}: ${e.message}`);totalFailed++}
    }
  }
  console.log(`\n=== Done: ${totalConverted} converted, ${totalSkipped} skipped, ${totalFailed} failed ===\n`);
}

main().catch(e=>{console.error(e);process.exit(1)});
