/** Fixed, deterministic approximate RGB -> CIE Lab D65 conversion. */
export function rgbToLab(r, g, b) {
  const linear = v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = linear(r), G = linear(g), B = linear(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return {L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz)};
}

export function classifyColor(r, g, b, settings) {
  const {L,a,b:labB} = rgbToLab(r,g,b);
  const chroma = Math.hypot(a,labB);
  if (chroma > settings.chroma) return 'color';
  if (L <= settings.blackL) return 'black';
  if (L >= settings.whiteL) return 'white';
  return 'gray';
}

/** pixels: RGBA ImageData array, mask: category map, dimensions from segmenter. */
export function measure(pixels, width, height, mask, maskWidth, maskHeight, settings, withOverlay = false) {
  const counts = {black:0,gray:0,white:0,color:0};
  const highlight = withOverlay ? new Uint8ClampedArray(pixels.length) : null;
  let total = 0;
  for (let y=0; y<height; y++) {
    const my = Math.min(maskHeight-1, Math.floor(y*maskHeight/height));
    for (let x=0; x<width; x++) {
      const mx = Math.min(maskWidth-1, Math.floor(x*maskWidth/width));
      const c = mask[my*maskWidth+mx];
      if (c !== 4 && !(settings.accessories && c === 5)) continue;
      const i = (y*width+x)*4;
      const kind = classifyColor(pixels[i],pixels[i+1],pixels[i+2],settings);
      counts[kind]++;
      total++;
      if (highlight && kind !== 'color') {
        // Orange-magenta overlay makes judged pixels visually apparent, including dark garments.
        highlight[i]=255;highlight[i+1]=75;highlight[i+2]=140;highlight[i+3]=115;
      }
    }
  }
  const neutral = counts.black+counts.gray+counts.white;
  const ratio = total ? 100*neutral/total : 0;
  const points = total ? Math.min(Math.ceil(ratio / settings.perPoint), settings.capPoints) : 0;
  return {counts,total,neutral,ratio,points,highlight};
}
