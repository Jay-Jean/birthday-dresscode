import {promises as fs} from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dest=path.join(root,'dist');
const src=path.join(root,'web');
const vendor=path.join(root,'node_modules/@mediapipe/tasks-vision');
await fs.rm(dest,{recursive:true,force:true});
await fs.cp(src,dest,{recursive:true});
await fs.mkdir(path.join(dest,'vendor'),{recursive:true});
await fs.copyFile(path.join(vendor,'vision_bundle.mjs'),path.join(dest,'vendor/vision_bundle.mjs'));
await fs.cp(path.join(vendor,'wasm'),path.join(dest,'vendor/wasm'),{recursive:true});
const modelDest=path.join(dest,'vendor/selfie_multiclass_256x256.tflite');
const sources=[
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite'
];
let downloaded=false;
for(const url of sources){
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
    if(!response.ok) throw new Error('HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.byteLength<1000000)throw new Error('Unexpectedly small model');
    await fs.writeFile(modelDest,bytes);
    console.log('Downloaded clothing segmentation model:',bytes.byteLength,'bytes');
    downloaded=true;break;
  } catch(err){ console.warn('Source failed:',url,err.message); }
}
if(!downloaded) throw new Error('Cannot download MediaPipe model. Check GitHub Actions logs.');
await fs.writeFile(path.join(dest,'.nojekyll'),'');
console.log('GitHub Pages-ready static site written to dist/');
