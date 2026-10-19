import * as THREE from 'three';
import type { Scene } from '../scene';

/** 간트 1일 = 1, 작업 자리 한 줄 = LANE (월드 단위) */
export const LANE = 1.3;
const HEAD = 0.5;
export const DEPTH = 0.8;
export const BLOCK_H = 0.9;

export interface Rect {
  x0: number;
  x1: number;
  z: number;
}

export function layoutOf(scene: Scene) {
  const W = scene.days;
  const D = HEAD + scene.lanes * LANE;
  const zOf = (lane: number) => -D / 2 + HEAD + (lane + 0.5) * LANE;
  const rectOf = (lane: number, start: number, length: number): Rect => ({ x0: -W / 2 + start - 1 + 0.06, x1: -W / 2 + start - 1 + length - 0.06, z: zOf(lane) });
  const heroBar = scene.bars.find((b) => b.id === scene.hero)!;
  const hero = rectOf(heroBar.lane, heroBar.start, heroBar.length);
  const len = hero.x1 - hero.x0;
  // 붙일 블록은 주인공 블록 오른쪽 끝에 맞붙인다
  const partner: Rect = { x0: hero.x1, x1: hero.x1 + Math.min(Math.max(len * 0.8, 0.9), 2), z: hero.z };
  return { W, D, rectOf, hero, partner, seamX: hero.x1, front: hero.z + DEPTH / 2 };
}
export type Layout = ReturnType<typeof layoutOf>;

const std = (color: THREE.ColorRepresentation, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 글자 텍스처 (블록 윗면 이름표) */
function textTexture(text: string, w: number, h: number, color = '#ffffff') {
  const c = document.createElement('canvas');
  const scale = 128;
  c.width = Math.max(64, Math.round(w * scale));
  c.height = Math.max(32, Math.round(h * scale));
  const g = c.getContext('2d')!;
  g.font = `800 ${Math.round(c.height * 0.42)}px Pretendard, -apple-system, sans-serif`;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, c.height * 0.25, c.height / 2, c.width - c.height * 0.4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function label(text: string, w: number, d: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: textTexture(text, w, d), color: '#d3dae2', transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** 간트 판: 날짜 칸·작업 자리 줄·날짜 머리글 */
export function makeBoard(scene: Scene, L: Layout) {
  const px = Math.min(96, 2048 / L.W);
  const c = document.createElement('canvas');
  c.width = Math.round(L.W * px);
  c.height = Math.round(L.D * px);
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#eef2f0';
  g.fillRect(0, 0, c.width, HEAD * px);
  g.strokeStyle = '#d5dde3';
  g.lineWidth = 2;
  for (let d = 1; d < L.W; d++) {
    g.beginPath();
    g.moveTo(d * px, 0);
    g.lineTo(d * px, c.height);
    g.stroke();
  }
  for (let l = 0; l <= scene.lanes; l++) {
    const y = (HEAD + l * LANE) * px;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(c.width, y);
    g.stroke();
  }
  g.fillStyle = '#6b7686';
  g.font = `700 ${Math.round(px * 0.22)}px Pretendard, -apple-system, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let d = 0; d < L.W; d++) g.fillText(`${d + 1}`, (d + 0.5) * px, (HEAD / 2) * px);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L.W, L.D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.receiveShadow = true;
  return m;
}

/** 간트 막대 = 납작한 상자 (높이는 scale.y로 키운다) */
export function makeBar(r: Rect, text: string) {
  const w = r.x1 - r.x0;
  const mat = new THREE.MeshStandardMaterial({ color: '#1e6b45', roughness: 0.5, metalness: 0.2, transparent: true });
  const mesh = box(1, 1, 1, mat);
  mesh.scale.set(w, 0.02, DEPTH);
  const group = new THREE.Group();
  group.position.set((r.x0 + r.x1) / 2, 0, r.z);
  const tag = label(text, w, DEPTH);
  group.add(mesh, tag);
  const setHeight = (h: number) => {
    mesh.scale.y = h;
    mesh.position.y = h / 2;
    tag.position.y = h + 0.004;
  };
  setHeight(0.02);
  return { group, mat, tagMat: tag.material as THREE.MeshBasicMaterial, setHeight };
}

/** 이중선체 측면 블록 단면 (단위: 월드). 앞(+z)이 바깥 외판, 바닥에서 빌지로 휘어 올라간다 */
const BILGE_R = 0.42;
const SHELL_T = 0.025;
const TANK_TOP = 0.26;
const STRINGER_W = 0.28;

const hullPaint = std('#7f8a96', 0.55, 0.35);
const primer = std('#8d4b35', 0.75, 0.1);

/** (z, y) 평면 도형을 x 방향으로 len만큼 밀어 낸 메시 (x 가운데 정렬) */
function extrudeX(shape: THREE.Shape, len: number, mat: THREE.Material, x = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 40 }).rotateY(-Math.PI / 2).translate(len / 2 + x, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** 외판: 바닥판 → 빌지 곡면 → 측면 외판 (두께 SHELL_T) */
function shellShape() {
  const D = DEPTH / 2;
  const s = new THREE.Shape();
  s.moveTo(-D, 0);
  s.lineTo(D - BILGE_R, 0);
  s.absarc(D - BILGE_R, BILGE_R, BILGE_R, -Math.PI / 2, 0, false);
  s.lineTo(D, BLOCK_H);
  s.lineTo(D - SHELL_T, BLOCK_H);
  s.lineTo(D - SHELL_T, BILGE_R);
  s.absarc(D - BILGE_R, BILGE_R, BILGE_R - SHELL_T, 0, -Math.PI / 2, true);
  s.lineTo(-D, SHELL_T);
  s.lineTo(-D, 0);
  return s;
}

/** 이중저 늑판: 바닥과 내저판 사이 가로 판, 가운데 경감 구멍 */
function floorShape() {
  const D = DEPTH / 2;
  const right = D - BILGE_R + Math.sqrt((BILGE_R - SHELL_T) ** 2 - (BILGE_R - TANK_TOP) ** 2) - 0.01;
  const s = new THREE.Shape();
  s.moveTo(-D + 0.02, SHELL_T);
  s.lineTo(D - BILGE_R, SHELL_T);
  s.lineTo(right, TANK_TOP);
  s.lineTo(-D + 0.02, TANK_TOP);
  s.lineTo(-D + 0.02, SHELL_T);
  const hole = new THREE.Path();
  hole.absellipse(-0.05, (SHELL_T + TANK_TOP) / 2, 0.11, 0.06, 0, Math.PI * 2, false, 0);
  s.holes.push(hole);
  return s;
}

/**
 * 선박 블록(이중선체 측면 블록): 회색 도장 외판(바닥·빌지·측면), 안쪽은 방청 도장한 구조 —
 * 내저판, 이중저 늑판, 횡늑골, 외판·종격벽 종늑골, 내측 종격벽, 중간·상부 스트링거. 외판에 블록 번호를 칠한다.
 * 원점은 바닥 가운데, 길이는 x 방향
 */
export function makeShipBlock(len: number, text: string | null) {
  const D = DEPTH / 2;
  const g = new THREE.Group();
  g.add(extrudeX(shellShape(), len, hullPaint));
  const tankRight = D - BILGE_R + Math.sqrt((BILGE_R - SHELL_T) ** 2 - (BILGE_R - TANK_TOP) ** 2);
  g.add(box(len, 0.02, tankRight + D, primer, 0, TANK_TOP + 0.01, (tankRight - D) / 2));
  // 내측 종격벽과 종늑골
  const wallH = BLOCK_H - TANK_TOP;
  g.add(box(len, wallH, 0.02, primer, 0, TANK_TOP + wallH / 2, -D + 0.01));
  for (const y of [0.5, 0.72]) {
    g.add(box(len, 0.016, 0.05, primer, 0, y, D - SHELL_T - 0.025));
    g.add(box(len, 0.016, 0.04, primer, 0, y, -D + 0.04));
  }
  // 중간 스트링거와 상부 갑판 스트링거 (외판 쪽 선반)
  g.add(box(len, 0.018, 0.16, primer, 0, 0.61, D - SHELL_T - 0.08));
  g.add(box(len, 0.02, STRINGER_W, hullPaint, 0, BLOCK_H - 0.01, D - STRINGER_W / 2));
  // 횡늑골·늑판: 블록 길이를 따라 일정 간격 (이음부에 닿지 않게 양끝은 비운다)
  const n = Math.max(1, Math.round(len / 0.3));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / n) * (i + 0.5);
    g.add(extrudeX(floorShape(), 0.018, primer, x));
    // 외판 쪽 늑골은 빌지 곡면 위부터 갑판 스트링거 아래까지 (외판 밖으로 튀어나오지 않게)
    const frameH = BLOCK_H - 0.02 - BILGE_R;
    g.add(box(0.018, frameH, 0.07, primer, x, BILGE_R + frameH / 2, D - SHELL_T - 0.036));
    g.add(box(0.018, wallH - 0.002, 0.05, primer, x, TANK_TOP + wallH / 2 - 0.001, -D + 0.045));
  }
  if (text) {
    // 외판에 칠한 블록 번호
    const w = Math.min(len * 0.7, 0.9);
    const tag = label(text, w, 0.2);
    tag.rotation.x = 0;
    tag.position.set(-len / 2 + w / 2 + 0.06, BLOCK_H * 0.72, D + 0.002);
    g.add(tag);
  }
  return g;
}

/**
 * 두 블록 이음부 용접선: 빌지 곡면(아래 → 옆) → 측면 외판(위로) → 갑판 스트링거(바깥 → 안).
 * at(s)는 s(0~total) 위치의 점, normal(s)은 바깥쪽 방향. seamX에서 x는 일정
 */
export function seamPath(seamX: number, z0: number) {
  const D = DEPTH / 2;
  const arc = (BILGE_R * Math.PI) / 2;
  const side = BLOCK_H - BILGE_R;
  const total = arc + side + STRINGER_W;
  const at = (s: number) => {
    if (s < arc) {
      const a = s / BILGE_R;
      return new THREE.Vector3(seamX, BILGE_R - BILGE_R * Math.cos(a), z0 + D - BILGE_R + BILGE_R * Math.sin(a));
    }
    if (s < arc + side) return new THREE.Vector3(seamX, BILGE_R + (s - arc), z0 + D);
    return new THREE.Vector3(seamX, BLOCK_H, z0 + D - (s - arc - side));
  };
  const normal = (s: number) => {
    if (s < arc) {
      const a = s / BILGE_R;
      return new THREE.Vector3(0, -Math.cos(a), Math.sin(a));
    }
    return s < arc + side ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  };
  return { at, normal, total };
}
export type SeamPath = ReturnType<typeof seamPath>;

/** 실린더를 두 점 사이에 걸친다 (크레인 와이어) */
export function stretch(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const d = b.clone().sub(a);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.scale.set(1, Math.max(0.001, d.length()), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

export const CRANE_H = 3.2;

/** 골리앗 크레인: 양쪽 A자 다리 + 대차 + 이중 거더 + 트롤리 + 훅 + 와이어 4줄 */
export function makeCrane(span: number) {
  const yellow = std('#f2b705', 0.45, 0.3);
  const dark = std('#3a4250', 0.6, 0.4);
  const red = std('#c8373a', 0.5, 0.3);
  const g = new THREE.Group();
  for (const sx of [-span / 2, span / 2]) {
    for (const sz of [-1, 1]) {
      const lean = Math.atan2(0.35, CRANE_H);
      const col = box(0.17, Math.hypot(CRANE_H, 0.35), 0.17, yellow, sx, CRANE_H / 2, sz * 0.32);
      col.rotation.x = sz * lean;
      g.add(col);
    }
    g.add(box(0.12, 0.12, 0.9, yellow, sx, CRANE_H * 0.45, 0));
    g.add(box(0.55, 0.22, 1.5, dark, sx, 0.15, 0));
    for (const wz of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.1, wz);
      g.add(wheel);
    }
    g.add(box(0.35, 0.34, 0.75, yellow, sx, CRANE_H + 0.17, 0));
  }
  for (const gz of [-0.22, 0.22]) g.add(box(span + 0.5, 0.3, 0.15, yellow, 0, CRANE_H + 0.15, gz));
  const trolley = box(0.6, 0.28, 0.62, red, 0, CRANE_H + 0.44, 0);
  g.add(trolley);

  const wireMat = std('#1d2433', 0.4, 0.6);
  const wireGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const cable = new THREE.Mesh(wireGeo, wireMat);
  const slings = Array.from({ length: 4 }, () => new THREE.Mesh(wireGeo, wireMat));
  const hook = new THREE.Group();
  hook.add(box(0.2, 0.22, 0.14, yellow, 0, 0.11, 0));
  const hookRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI * 1.4), dark);
  hookRing.position.y = -0.04;
  hook.add(hookRing);
  g.add(cable, hook, ...slings);
  return { group: g, trolley, cable, slings, hook };
}

/** 용접공 (안전모·작업복·반사띠·용접 마스크·토치). 원점은 발밑, +z를 본다 */
export function makeWorker() {
  const g = new THREE.Group();
  const pants = std('#27486f', 0.8);
  const boots = std('#1d2433', 0.7);
  const suit = std('#e07a2e', 0.7);
  const stripe = new THREE.MeshStandardMaterial({ color: '#f6eaa0', emissive: '#6a6640', roughness: 0.4 });
  const skin = std('#f0c49c', 0.8);
  const helmet = std('#f2b705', 0.6, 0.05);

  const limb = (x: number, y: number, w: number, h: number, mat: THREE.Material) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(box(w, h, w * 1.1, mat, 0, -h / 2, 0));
    return pivot;
  };
  const legL = limb(-0.05, 0.28, 0.075, 0.27, pants);
  const legR = limb(0.05, 0.28, 0.075, 0.27, pants);
  legL.add(box(0.085, 0.045, 0.13, boots, 0, -0.265, 0.02));
  legR.add(box(0.085, 0.045, 0.13, boots, 0, -0.265, 0.02));
  const armL = limb(-0.135, 0.49, 0.06, 0.23, suit);
  const armR = limb(0.135, 0.49, 0.06, 0.23, suit);
  const torch = box(0.022, 0.022, 0.16, std('#3a4556', 0.5, 0.6), 0, -0.24, 0.06);
  const tip = new THREE.Object3D();
  tip.position.set(0, -0.24, 0.15);
  armR.add(torch, tip);

  const body = new THREE.Group();
  body.add(box(0.21, 0.24, 0.13, suit, 0, 0.4, 0), box(0.215, 0.03, 0.135, stripe, 0, 0.36, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.066, 20, 14), skin);
  head.position.y = 0.585;
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmet);
  hat.position.y = 0.6;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.012, 24), helmet);
  brim.position.y = 0.6;
  const visor = box(0.12, 0.085, 0.02, std('#13241c', 0.2, 0.3), 0, 0.58, 0.07);
  visor.visible = false;
  body.add(head, hat, brim, visor);
  for (const o of [hat, brim, head]) o.castShadow = true;
  g.add(legL, legR, armL, armR, body);
  return { group: g, body, legL, legR, armL, armR, visor, tip };
}

/** 배경: 멀리 정박한 선체 실루엣과 창 불빛, 투광등 기둥 */
export function makeBackdrop() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-14, 0);
  s.lineTo(10, 0);
  s.quadraticCurveTo(14.5, 0.4, 16, 4.2);
  s.lineTo(-14, 4.2);
  s.lineTo(-14, 0);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }), std('#172131', 0.9));
  hull.position.set(-2, 0, -19);
  g.add(hull);
  g.add(box(7, 2.2, 2.4, std('#1b2638', 0.9), -9, 5.3, -17.6));
  const lit = new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffcf70', emissiveIntensity: 2.2 });
  for (let i = 0; i < 9; i++) g.add(box(0.28, 0.16, 0.05, lit, -12 + i * 0.8, 5.7 - (i % 3) * 0.55, -16.37));
  for (let i = 0; i < 14; i++) g.add(box(0.2, 0.1, 0.05, lit, -10 + i * 1.6, 2.6, -15.98));
  return g;
}
