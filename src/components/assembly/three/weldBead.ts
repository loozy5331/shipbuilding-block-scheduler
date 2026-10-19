import * as THREE from 'three';
import type { SeamPath } from './models';

/** 비드 폭·높이·물결 간격 (월드 단위). 낮고 납작하게 눌러붙은 모양 */
const WIDTH = 0.035;
const HEIGHT = 0.006;
const RIPPLE = 0.009;
/** 길이 방향 분할 (드러나는 정도·식는 색을 이 단위로 바꾼다) */
const ROWS_PER_UNIT = 220;
const COLS = 6;
/** 막 쌓인 비드가 식는 속도 (초). 클수록 오래 달아 있다 */
const COOL = 0.45;

/** 물결 텍스처 한 장에 담는 물결 수 (간격·세기를 물결마다 조금씩 다르게) */
const RIPPLES_PER_TILE = 8;

/**
 * 물결 높이 텍스처. 초승달 모양 물결이 진행 방향으로 겹쳐 쌓인다: 가운데가 앞서고 가장자리가 뒤처지는 곡선,
 * 앞 가장자리가 솟았다 뒤로 완만히 내려간다. 물결마다 간격·세기가 조금씩 달라 손으로 녹인 비드처럼 보인다.
 */
function rippleTexture() {
  const w = 64;
  const h = 64 * RIPPLES_PER_TILE;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  // 물결 경계 위치(0~RIPPLES_PER_TILE)와 세기: 고정된 의사 난수
  const edges = Array.from({ length: RIPPLES_PER_TILE + 1 }, (_, k) => (k === 0 || k === RIPPLES_PER_TILE ? k : k + Math.sin(k * 12.9898) * 0.18));
  const amp = Array.from({ length: RIPPLES_PER_TILE }, (_, k) => 0.75 + 0.25 * Math.abs(Math.sin(k * 78.233)));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      // 가장자리로 갈수록 뒤처지는 초승달 (물결 1.1개만큼 휜다)
      let v = (y / h) * RIPPLES_PER_TILE + 1.1 * u * u;
      v = ((v % RIPPLES_PER_TILE) + RIPPLES_PER_TILE) % RIPPLES_PER_TILE;
      let k = 0;
      while (k < RIPPLES_PER_TILE - 1 && v >= edges[k + 1]) k++;
      const phase = (v - edges[k]) / (edges[k + 1] - edges[k]);
      const ridge = Math.pow(Math.sin(Math.PI * Math.pow(phase, 0.7)), 1.5) * amp[k];
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(ridge * (1 - 0.3 * u * u) * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 비드 양옆 열 변색 띠: 짚색 → 보라·파랑 → 바탕 */
function heatTintTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 4;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 128, 0);
  const stops: [number, string][] = [
    [0, 'rgba(70,80,140,0)'],
    [0.22, 'rgba(70,80,150,0.35)'],
    [0.35, 'rgba(120,80,130,0.4)'],
    [0.44, 'rgba(200,160,90,0.55)'],
    [0.5, 'rgba(60,50,40,0.6)'],
    [0.56, 'rgba(200,160,90,0.55)'],
    [0.65, 'rgba(120,80,130,0.4)'],
    [0.78, 'rgba(70,80,150,0.35)'],
    [1, 'rgba(70,80,140,0)'],
  ];
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** 식는 정도(1 = 막 녹은 상태)에 따른 빛 색: 흰빛 → 주황 → 검붉은색 → 꺼짐 */
function glow(heat: number, out: number[]) {
  if (heat > 0.6) [out[0], out[1], out[2]] = [2.2, lerp(0.9, 2, (heat - 0.6) / 0.4), lerp(0.25, 1.4, (heat - 0.6) / 0.4)];
  else if (heat > 0.25) [out[0], out[1], out[2]] = [lerp(0.8, 2.2, (heat - 0.25) / 0.35), lerp(0.12, 0.9, (heat - 0.25) / 0.35), lerp(0.02, 0.25, (heat - 0.25) / 0.35)];
  else [out[0], out[1], out[2]] = [heat * 3.2, heat * 0.4, 0];
}

/**
 * 경로를 따라가는 띠 메시. 폭 방향은 x(이음부를 가로지름), 높이는 바깥쪽(normal)으로 띄운다.
 * 줄(row) 단위로 그려 drawRange로 앞부분만 드러낼 수 있다
 */
function strip(path: SeamPath, rows: number, width: (s: number) => number, lift: (u: number) => number, v: (s: number) => number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let r = 0; r <= rows; r++) {
    const s = (r / rows) * path.total;
    const p = path.at(s);
    const n = path.normal(s);
    const w = width(s);
    for (let c = 0; c <= COLS; c++) {
      const u = (c / COLS) * 2 - 1;
      const h = lift(u);
      pos.push(p.x + (u * w) / 2 + n.x * h, p.y + n.y * h, p.z + n.z * h);
      uv.push(c / COLS, v(s));
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c;
      const b = a + COLS + 1;
      // 폭 방향(+x) × 진행 방향 = 바깥쪽이 앞면이 되도록 감는다
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 두 블록 이음부의 용접 비드. 이음부 윤곽(path)을 따라가는 낮은 띠 하나로 만들고 표면에 초승달 물결을 새긴다.
 * 용접한 만큼만 드러나며 막 쌓인 부분만 달아올랐다 식는다. 아래에는 용접 전 홈, 양옆에는 열 변색 띠가 남는다.
 */
export function makeWeldBead(path: SeamPath) {
  const rows = Math.ceil(path.total * ROWS_PER_UNIT);
  const flat = () => 0.0008;
  const geo = strip(
    path,
    rows,
    // 폭은 조금씩 출렁이고, 단면은 가운데가 볼록하며 가장자리는 판에 녹아 붙듯 낮아진다
    (s) => WIDTH * (1 + 0.07 * Math.sin(s * 95) + 0.04 * Math.sin(s * 240 + 1.3)),
    (u) => HEIGHT * Math.pow(1 - u * u, 1.4) + 0.0012,
    (s) => s / (RIPPLE * RIPPLES_PER_TILE),
  );
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const metal = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#a2a6ab', metalness: 0.55, roughness: 0.48, bumpMap: rippleTexture(), bumpScale: 3 }));
  metal.castShadow = true;
  metal.receiveShadow = true;
  // 같은 띠를 더해 그려 달아오른 색을 낸다 (식으면 검정 = 보이지 않음)
  const hot = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));

  // 용접 전 두 블록 사이의 홈 (처음부터 끝까지)
  const groove = new THREE.Mesh(
    strip(path, Math.ceil(path.total * 40), () => 0.014, () => 0.0006, () => 0),
    new THREE.MeshStandardMaterial({ color: '#15181d', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  // 열 변색 띠: 비드가 지나간 만큼만 드러난다
  const hazRows = Math.ceil(path.total * 80);
  const hazGeo = strip(path, hazRows, () => 0.16, flat, () => 0);
  const hazMat = new THREE.MeshStandardMaterial({ map: heatTintTexture(), transparent: true, depthWrite: false, metalness: 0.6, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const haz = new THREE.Mesh(hazGeo, hazMat);

  const group = new THREE.Group();
  group.add(groove, haz, metal, hot);

  const rgb = [0, 0, 0];
  /** progress: 0~1 (얼마나 용접했는지), now/start/end: 초. 줄마다 쌓인 시각부터 식는다 */
  const update = (progress: number, now: number, start: number, end: number) => {
    const shown = Math.floor(progress * rows);
    geo.setDrawRange(0, shown * COLS * 6);
    hazGeo.setDrawRange(0, Math.floor(progress * hazRows) * COLS * 6);
    // 용접이 끝나면 토치 열이 없으니 더 빨리 식는다 (강조 장면에서 빛이 남지 않게)
    const after = Math.max(0, now - end);
    for (let r = 0; r <= Math.min(rows, shown + 1); r++) {
      const heat = Math.exp(-(now - (start + (r / rows) * (end - start))) / COOL - after / 0.18);
      glow(Math.min(1, heat), rgb);
      for (let c = 0; c <= COLS; c++) colors.set(rgb, (r * (COLS + 1) + c) * 3);
    }
    geo.attributes.color.needsUpdate = true;
  };
  update(0, 0, 0, 1);

  return { group, update, tipAt: (progress: number) => path.at(progress * path.total) };
}
