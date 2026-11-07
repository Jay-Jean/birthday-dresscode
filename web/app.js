import {measure} from './color.js';

const $ = id => document.getElementById(id);
const defaults = {perPoint:10,capPoints:3,chroma:12,blackL:25,whiteL:82,accessories:false};
const settings = {...defaults};
const ids = {'per-point':'perPoint','cap-points':'capPoints','chroma':'chroma','black-l':'blackL','white-l':'whiteL'};
let segmenter=null, cached=null, visibleOverlay=true, version=0, redrawQueued=false;
let sharedMode=false;

function setStatus(text,type='idle') {
  $('status-text').textContent=text;
  $('status-dot').className='dot'+(type==='ok'?' active':type==='error'?' error':'');
}
function readSettings() {
  try {
    const saved=JSON.parse(localStorage.getItem('color-party-rules')||'null');
    if (saved && typeof saved==='object') {
      for (const [key,value] of Object.entries(defaults)) {
        if (typeof saved[key]===typeof value) settings[key]=saved[key];
      }
    }
  } catch(e) { /* private browsing or malformed storage; defaults are safe */ }
  const params = new URLSearchParams(location.search);
  if(params.get('rule')==='1') {
    const queryMap={p:['perPoint',2,25],c:['capPoints',0,8],ch:['chroma',4,30],bl:['blackL',12,40],wl:['whiteL',65,96]};
    for(const [key,[name,min,max]] of Object.entries(queryMap)) {
      const value=Number(params.get(key));
      if(params.has(key)&&Number.isFinite(value)) settings[name]=Math.max(min,Math.min(max,Math.round(value)));
    }
    if(params.has('acc')) settings.accessories=params.get('acc')==='1';
    sharedMode=true;
    for(const id of [...Object.keys(ids),'accessories']) $(id).disabled=true;
    $('restore-settings').hidden=true;
    $('share-rules').hidden=true;
    $('shared-lock').hidden=false;
  }
  paintSettings();
}
function paintSettings() {
  for (const [id,key] of Object.entries(ids)) $(id).value=settings[key];
  $('accessories').checked=settings.accessories;
  $('per-point-label').textContent=settings.perPoint+'%';
  $('cap-points-label').textContent=settings.capPoints+' 点';
  $('chroma-label').textContent=settings.chroma;
  $('black-l-label').textContent=settings.blackL;
  $('white-l-label').textContent=settings.whiteL;
  $('formula-step').textContent=settings.perPoint;
  $('formula-cap').textContent=settings.capPoints;
}
function changed() {
  paintSettings();
  try {localStorage.setItem('color-party-rules',JSON.stringify(settings));} catch(e) {}
  if(cached && !redrawQueued) {
    redrawQueued=true;
    requestAnimationFrame(()=>{redrawQueued=false; render();});
  }
}
for (const [id,key] of Object.entries(ids)) {
  $(id).addEventListener('input',()=>{settings[key]=Number($(id).value);changed();});
}
$('accessories').addEventListener('change',()=>{settings.accessories=$('accessories').checked;changed();});
$('restore-settings').addEventListener('click',()=>{Object.assign(settings,defaults);changed();});
$('share-link').addEventListener('click',async()=>{
  const url=new URL(location.href);
  url.search='';url.hash='';
  const params=new URLSearchParams({rule:'1',p:String(settings.perPoint),c:String(settings.capPoints),ch:String(settings.chroma),bl:String(settings.blackL),wl:String(settings.whiteL),acc:settings.accessories?'1':'0'});
  url.search=params.toString();
  try {
    await navigator.clipboard.writeText(url.href);
    $('share-status').textContent='✅ 已复制！把这个链接发给来宾，他们打开后规则将锁定。';
  } catch (e) {
    window.prompt('复制以下统一规则链接并发给来宾：',url.href);
    $('share-status').textContent='请复制上面的链接发送给来宾。';
  }
});
$('camera-button').addEventListener('click',()=>$('camera-input').click());
$('album-button').addEventListener('click',()=>$('album-input').click());
for(const id of ['camera-input','album-input']) {
  $(id).addEventListener('change',e=>{
    const file=e.target.files?.[0]; if(file) handlePhoto(file);
    e.target.value='';
  });
}
$('view-overlay').addEventListener('click',()=>{visibleOverlay=true;render();});
$('view-original').addEventListener('click',()=>{visibleOverlay=false;render();});
$('reset-button').addEventListener('click',()=>{
  version++;cached=null;
  $('preview-canvas').hidden=true;
  $('empty-state').hidden=false;
  $('photo-tag').hidden=true;
  $('view-actions').hidden=true;
  $('export-button').disabled=true;
  clearResult();setStatus('上传照片后开始检测');
});
$('export-button').addEventListener('click',exportResult);
readSettings();
clearResult();

function clearResult() {
  $('ratio-output').innerHTML='--<small>%</small>';
  $('points-output').innerHTML='--<small>点</small>';
  $('points-caption').textContent='等待检测';
  $('sample-count').textContent='尚未检测';
  $('verdict').textContent='上传照片后揭晓今日的彩色通行证！';
  for(const kind of ['black','gray','white','color']) {
    $('meter-'+kind).style.width='0%';
    $(kind+'-value').textContent='--';
  }
}
async function getSegmenter() {
  if(segmenter) return segmenter;
  const {FilesetResolver,ImageSegmenter} = await import('./vendor/vision_bundle.mjs');
  const wasm = new URL('./vendor/wasm',import.meta.url).href;
  const model = new URL('./vendor/selfie_multiclass_256x256.tflite',import.meta.url).href;
  const vision=await FilesetResolver.forVisionTasks(wasm);
  segmenter=await ImageSegmenter.createFromOptions(vision,{
    baseOptions:{modelAssetPath:model,delegate:'CPU'},
    runningMode:'IMAGE',outputCategoryMask:true,outputConfidenceMasks:false
  });
  return segmenter;
}
function imageFromFile(file) {
  return new Promise((resolve,reject)=>{
    const src=URL.createObjectURL(file);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(src);resolve(image);};
    image.onerror=()=>{URL.revokeObjectURL(src);reject(new Error('无法读取图片，请换一张 JPG/PNG 照片。'));};
    image.src=src;
  });
}
async function handlePhoto(file) {
  if(!file.type.startsWith('image/')) {setStatus('请上传图片文件。','error');return;}
  const mine=++version;
  cached=null;
  clearResult();
  $('export-button').disabled=true;
  setStatus('正在打开照片…');
  try {
    const image=await imageFromFile(file);
    if(mine!==version) return;
    const maxSide=600;
    const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
    const width=Math.max(1,Math.round(image.naturalWidth*scale));
    const height=Math.max(1,Math.round(image.naturalHeight*scale));
    const base=document.createElement('canvas');base.width=width;base.height=height;
    const ctx=base.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,width,height);
    const rgba=ctx.getImageData(0,0,width,height);
    $('empty-state').hidden=true;
    $('preview-canvas').hidden=false;
    const display=$('preview-canvas');display.width=width;display.height=height;
    display.getContext('2d').drawImage(base,0,0);
    setStatus('首次加载 AI 模型可能需要几秒钟…');
    const engine=await getSegmenter();
    if(mine!==version) return;
    setStatus('正在识别服装区域与颜色…');
    // Replacing the cached mask always follows image selection, so no cross-image mixups.
    const segmentResult=engine.segment(base);
    const categoryMask=segmentResult.categoryMask;
    if(!categoryMask) throw new Error('AI 模型没有返回服装分割区域。');
    const mask=Uint8Array.from(categoryMask.getAsUint8Array());
    cached={rgba,width,height,mask,maskWidth:categoryMask.width,maskHeight:categoryMask.height};
    segmentResult.close?.();
    if(mine!==version) return;
    visibleOverlay=true;
    $('view-actions').hidden=false;
    render();
    setStatus('检测完成！可调整右侧规则实时重新计分。','ok');
  } catch(error) {
    console.error(error);
    setStatus('检测失败：'+(error?.message||'未知错误')+'。请确认模型已经由 GitHub Actions 部署。','error');
  }
}
function render() {
  if(!cached) return;
  const c=cached;
  const result=measure(c.rgba.data,c.width,c.height,c.mask,c.maskWidth,c.maskHeight,settings,visibleOverlay);
  cached.result=result;
  const display=$('preview-canvas');
  const ctx=display.getContext('2d');
  ctx.putImageData(c.rgba,0,0);
  if(visibleOverlay&&result.highlight) {
    const over=document.createElement('canvas');over.width=c.width;over.height=c.height;
    over.getContext('2d').putImageData(new ImageData(result.highlight,c.width,c.height),0,0);
    ctx.drawImage(over,0,0);
  }
  $('photo-tag').hidden=!visibleOverlay;
  $('view-overlay').classList.toggle('active',visibleOverlay);
  $('view-original').classList.toggle('active',!visibleOverlay);
  if(!result.total) {
    clearResult();
    $('verdict').textContent='未识别到有效服装区域，请选择一张正面全身照，或尝试开启「计入配饰」。';
    $('export-button').disabled=true;
    return;
  }
  const ratio=result.ratio;
  $('ratio-output').innerHTML=ratio.toFixed(1)+'<small>%</small>';
  $('points-output').innerHTML=result.points+'<small>点</small>';
  $('points-caption').textContent='按 '+settings.perPoint+'% / 点 · 上限 '+settings.capPoints+' 点';
  $('sample-count').textContent=result.total.toLocaleString()+' 个服饰像素';
  for(const kind of ['black','gray','white','color']) {
    const percentage=result.counts[kind]/result.total*100;
    $('meter-'+kind).style.width=percentage+'%';
    $(kind+'-value').textContent=percentage.toFixed(1)+'%';
  }
  $('verdict').textContent=ratio<5?'彩色通行证 GET！今天的穿搭非常遵守 Dress Code ✨':ratio<20?'不错！只有一点点黑白灰混入彩色派对 🌈':ratio<50?'被裁判发现了不少低调色块！下次再大胆一点 🎨':'黑白灰含量偏高！今晚的彩色改造计划安排上 🪩';
  $('export-button').disabled=false;
}
function exportResult() {
  if(!cached?.result?.total) return;
  const {ratio,points}=cached.result;
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1050;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff6ea';ctx.fillRect(0,0,720,1050);
  ctx.fillStyle='#f97155';ctx.fillRect(0,0,720,115);
  ctx.fillStyle='white';ctx.font='bold 34px sans-serif';ctx.fillText('THE COLOR CLUB',40,70);
  const image=$('preview-canvas');
  const box={x:80,y:160,w:560,h:620};
  const scale=Math.min(box.w/image.width,box.h/image.height);
  const w=Math.round(image.width*scale),h=Math.round(image.height*scale);
  ctx.drawImage(image,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);
  ctx.fillStyle='#2e2534';ctx.font='bold 28px sans-serif';ctx.fillText('黑白灰占比 '+ratio.toFixed(1)+'%',45,860);
  ctx.font='bold 31px sans-serif';ctx.fillText('趣味惩罚 '+points+' 点',45,916);
  ctx.fillStyle='#9f8290';ctx.font='18px sans-serif';ctx.fillText('只估算可见服饰像素；不等于真实面积',45,967);
  const link=document.createElement('a');link.href=canvas.toDataURL('image/png');
  link.download='彩色通行证-'+Date.now()+'.png';link.click();
}
