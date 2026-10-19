import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Scene } from '../scene';
import { END, PHASES, at, easeIn, easeInOut, easeOut, lerp, progress, type Phase } from '../timeline';
import { BLOCK_H, CRANE_H, DEPTH, layoutOf, makeBackdrop, makeBar, makeBoard, makeCrane, makeShipBlock, makeWorker, stretch } from './models';
import { burst, dust, smoke, sparks } from './effects';

interface Callbacks {
  onPhase(p: Phase): void;
  onEnd(): void;
}

const APP_BG = new THREE.Color('#f6f8f7');
const NIGHT = new THREE.Color('#0b1424');
const GREEN = new THREE.Color('#1e6b45');
const STEEL = new THREE.Color('#8e9bab');

/** 카메라 위치: 바라볼 점 + 거리 + 기울기(0 = 바로 위) + 방위(0 = 앞(+z)쪽) */
interface View {
  target: THREE.Vector3;
  dist: number;
  polar: number;
  az: number;
}

/**
 * canvas에 조립 장면을 그리고 시간표(timeline.ts)대로 움직인다. 정리 함수를 돌려준다.
 * WebGL을 쓸 수 없으면 예외를 던진다 (부르는 쪽에서 애니메이션을 건너뜀).
 */
export function runShow(canvas: HTMLCanvasElement, scene: Scene, cb: Callbacks): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const world = new THREE.Scene();
  world.background = APP_BG.clone();
  world.fog = new THREE.Fog(APP_BG.clone(), 400, 500);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);

  const L = layoutOf(scene);
  const seam = new THREE.Vector3(L.seamX, BLOCK_H * 0.45, L.hero.z + 0.15);

  // ── 빛: 처음엔 고르게 밝은 종이(간트), 기울면서 밤 작업장 조명으로
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 3);
  const key = new THREE.DirectionalLight('#eef2ff', 0);
  key.position.set(seam.x - 6, 10, seam.z + 7);
  key.target.position.copy(seam);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  const flood = new THREE.SpotLight('#ffd7a0', 0, 40, 0.5, 0.6, 0);
  flood.position.set(seam.x + 7, 9, seam.z - 6);
  flood.target.position.copy(seam);
  const weldLight = new THREE.PointLight('#ff9a3c', 0, 3, 2);
  world.add(hemi, key, key.target, flood, flood.target, weldLight);

  // ── 바닥·간트 판·배경
  const floorMat = new THREE.MeshStandardMaterial({ color: APP_BG.clone(), roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const board = makeBoard(scene, L);
  const boardMat = board.material as THREE.MeshStandardMaterial;
  const backdrop = makeBackdrop();
  backdrop.visible = false;
  world.add(floor, board, backdrop);
  for (const sx of [-1, 1]) {
    // 크레인 레일
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 40), new THREE.MeshStandardMaterial({ color: '#5b6573', metalness: 0.7, roughness: 0.35 }));
    rail.position.set(sx < 0 ? L.seamX - 2.4 : L.partner.x1 + 1.6, 0.025, 0);
    rail.receiveShadow = true;
    rail.userData.rail = true;
    rail.visible = false;
    world.add(rail);
  }

  // ── 간트 막대 → 블록
  const bars = scene.bars.map((b) => {
    const bar = makeBar(L.rectOf(b.lane, b.start, b.length), b.id);
    world.add(bar.group);
    return { ...bar, id: b.id };
  });
  const heroBlock = makeShipBlock(L.hero.x1 - L.hero.x0, scene.hero);
  heroBlock.position.set((L.hero.x0 + L.hero.x1) / 2, 0, L.hero.z);
  heroBlock.scale.y = 0.001;
  heroBlock.visible = false;
  const partnerBlock = makeShipBlock(L.partner.x1 - L.partner.x0, scene.partner);
  partnerBlock.visible = false;
  world.add(heroBlock, partnerBlock);

  // 용접 비드: 앞면 세로 → 윗면 앞뒤
  const beadMat = new THREE.MeshStandardMaterial({ color: '#5c6470', emissive: '#ff8a2a', emissiveIntensity: 0, roughness: 0.4, metalness: 0.6 });
  const beadV = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10).translate(0, 0.5, 0), beadMat);
  beadV.position.set(L.seamX, 0, L.front + 0.005);
  const beadT = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10).rotateX(Math.PI / 2).translate(0, 0, -0.5), beadMat);
  beadT.position.set(L.seamX, BLOCK_H + 0.01, L.front);
  beadV.scale.y = beadT.scale.z = 0.0001;
  world.add(beadV, beadT);

  // ── 크레인 (레일을 따라 뒤에서 들어온다)
  const span = L.partner.x1 + 1.6 - (L.seamX - 2.4);
  const crane = makeCrane(span);
  const craneX = (L.seamX - 2.4 + L.partner.x1 + 1.6) / 2;
  crane.trolley.position.x = (L.partner.x0 + L.partner.x1) / 2 - craneX;
  crane.group.visible = false;
  world.add(crane.group);
  const HANG = 1.2;

  // ── 용접공 둘: 양쪽에서 걸어와 이음부 앞에 선다
  const workers = [
    // face: 다 와서 바라볼 방향 (블록 쪽(-z)에서 이음부 쪽으로 조금 돌린다)
    { from: L.seamX - 4.5, to: L.seamX - 0.32, face: Math.PI - 0.55 },
    { from: L.partner.x1 + 4.5, to: L.seamX + 0.32, face: -(Math.PI - 0.55) },
  ].map((w) => {
    const m = makeWorker();
    m.group.position.set(w.from, 0, L.front + 0.42);
    m.group.rotation.y = w.from < w.to ? Math.PI / 2 : -Math.PI / 2;
    m.group.visible = false;
    world.add(m.group);
    return { ...m, ...w };
  });

  const fx = { sparks: sparks(), dust: dust(), smoke: smoke() };
  world.add(fx.sparks.points, fx.dust.points, fx.smoke.points);

  // ── 후처리: 불꽃·용접부가 번져 보이게
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── 카메라 경로
  const center = new THREE.Vector3(0, 0, 0);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let topDist = 10;
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const fit = 1.12 / (2 * Math.tan(fov / 2));
    topDist = Math.max(L.D * fit, (L.W * fit) / camera.aspect);
  };
  resize();
  window.addEventListener('resize', resize);
  // 기울인 뒤에는 주인공 블록 쪽으로 조금 옮겨 본다 (화면 가장자리에서 잘리지 않게)
  const tiltCenter = center.clone().lerp(seam.clone().setY(0), 0.4);
  const focus = seam.clone().setY(0.5);
  // 크레인이 블록을 매달고 오는 동안은 조금 위를 본다
  const focusHigh = seam.clone().setY(1.1);
  const views = (): [number, View][] => [
    [0, { target: center, dist: topDist, polar: 0.001, az: 0 }],
    [at('tilt'), { target: center, dist: topDist, polar: 0.001, az: 0 }],
    [at('rise') + 0.3, { target: tiltCenter, dist: topDist * 1.05, polar: 0.88, az: -0.35 }],
    [at('walk'), { target: tiltCenter, dist: topDist, polar: 0.9, az: -0.38 }],
    [at('walk') + 1.1, { target: focusHigh, dist: 7.4, polar: 1.0, az: -0.5 }],
    [at('weld'), { target: focus, dist: 6.2, polar: 1.06, az: -0.42 }],
    [at('seam'), { target: focus, dist: 4.9, polar: 1.1, az: -0.26 }],
    [END, { target: focus, dist: 4.3, polar: 1.12, az: -0.2 }],
  ];
  const tmpT = new THREE.Vector3();
  const placeCamera = (t: number, shake: number) => {
    const ks = views();
    let i = ks.findIndex(([kt]) => kt > t) - 1;
    if (i < 0) i = ks.length - 2;
    const [t0, a] = ks[i];
    const [t1, b] = ks[i + 1];
    const x = easeInOut(progress(t, t0, t1));
    tmpT.lerpVectors(a.target, b.target, x);
    const dist = lerp(a.dist, b.dist, x);
    const polar = lerp(a.polar, b.polar, x);
    const az = lerp(a.az, b.az, x);
    camera.position.set(tmpT.x + dist * Math.sin(polar) * Math.sin(az), tmpT.y + dist * Math.cos(polar), tmpT.z + dist * Math.sin(polar) * Math.cos(az));
    if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
    camera.lookAt(tmpT);
  };

  // ── 매 프레임
  const tLand = at('drop') + 0.5;
  let landed = false;
  const tipPos = new THREE.Vector3();
  const update = (t: number, dt: number) => {
    const night = easeInOut(progress(t, at('tilt'), at('rise') + 0.4));
    const dim = easeInOut(progress(t, at('seam'), at('seam') + 0.6));
    (world.background as THREE.Color).lerpColors(APP_BG, NIGHT, night);
    world.fog!.color.copy(world.background as THREE.Color);
    (world.fog as THREE.Fog).near = lerp(400, 14, night);
    (world.fog as THREE.Fog).far = lerp(500, 46, night);
    floorMat.color.lerpColors(APP_BG, new THREE.Color('#2b323d'), night);
    boardMat.color.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#5d6878'), night);
    hemi.intensity = lerp(3, 0.7, night) * lerp(1, 0.35, dim);
    hemi.color.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#c9d4e4'), night);
    hemi.groundColor.lerpColors(new THREE.Color('#ffffff'), new THREE.Color('#2a2320'), night);
    key.intensity = lerp(0, 2.4, night) * lerp(1, 0.35, dim);
    flood.intensity = lerp(0, 3.5, night) * lerp(1, 0.4, dim);
    backdrop.visible = night > 0.2;
    world.children.forEach((o) => o.userData.rail && (o.visible = t > at('walk')));

    // 막대: 초록 간트 막대 → 철판 블록으로 솟고, 주인공 외에는 가라앉는다
    const rise = easeOut(progress(t, at('rise'), at('rise') + 0.8));
    const sink = easeInOut(progress(t, at('walk'), at('walk') + 0.8));
    for (const b of bars) {
      b.mat.color.lerpColors(GREEN, STEEL, progress(t, at('tilt') + 0.4, at('rise') + 0.4));
      b.setHeight(lerp(0.02, 0.26, rise) * lerp(1, 0.3, sink));
      const fade = b.id === scene.partner ? 1 - sink : lerp(1, 0.28, sink) * (1 - dim * 0.8);
      b.mat.opacity = b.tagMat.opacity = fade;
      b.group.visible = b.id !== scene.hero || t < at('rise');
    }
    heroBlock.visible = t >= at('rise');
    const pop = progress(t, at('rise'), at('rise') + 0.7);
    heroBlock.scale.y = Math.max(0.001, pop < 1 ? easeOut(pop) * (1 + 0.08 * Math.sin(pop * Math.PI)) : 1);

    // 크레인: 레일 위로 블록을 매달고 들어와 내려놓는다
    crane.group.visible = partnerBlock.visible = t >= at('walk');
    const arrive = easeOut(progress(t, at('walk'), at('drop')));
    const cz = lerp(L.hero.z - 9, L.hero.z, arrive);
    crane.group.position.set(craneX, 0, cz);
    const p = progress(t, at('drop'), at('drop') + 0.7);
    let y = HANG;
    if (p > 0) y = p < 0.72 ? HANG * (1 - easeIn(p / 0.72)) : 0.07 * Math.sin((Math.PI * (p - 0.72)) / 0.28) * (1 - p);
    partnerBlock.position.set((L.partner.x0 + L.partner.x1) / 2, Math.max(0, y), cz);
    const lift = easeInOut(progress(t, tLand + 0.3, tLand + 1));
    const hookY = Math.max(0, y) + BLOCK_H + 0.55 + lift * 1.2;
    const hookLocal = new THREE.Vector3(crane.trolley.position.x, hookY, 0);
    crane.hook.position.copy(hookLocal);
    stretch(crane.cable, hookLocal.clone().setY(hookY + 0.2), new THREE.Vector3(crane.trolley.position.x, CRANE_H + 0.3, 0));
    const half = (L.partner.x1 - L.partner.x0) / 2 - 0.08;
    crane.slings.forEach((s, i) => {
      const corner = new THREE.Vector3(crane.trolley.position.x + (i % 2 ? half : -half), Math.max(0, y) + BLOCK_H, i < 2 ? DEPTH / 2 - 0.08 : -DEPTH / 2 + 0.08);
      stretch(s, corner, hookLocal);
      s.visible = lift < 0.05;
    });
    if (!landed && t >= tLand) {
      landed = true;
      for (const x of [L.partner.x0, L.partner.x1, (L.partner.x0 + L.partner.x1) / 2]) {
        for (const z of [L.hero.z - DEPTH / 2, L.hero.z + DEPTH / 2]) fx.dust.emit(new THREE.Vector3(x, 0.05, z), 14, burst(1.6, new THREE.Vector3(0, 0.15, 0), 1.6), [0.8, 1.6]);
      }
    }

    // 용접공: 걷기 → 이음부를 보고 서기 → 토치를 들고 마스크를 내린다
    const walk = progress(t, at('walk'), at('drop') - 0.1);
    for (const w of workers) {
      w.group.visible = t >= at('walk');
      w.group.position.x = lerp(w.from, w.to, walk);
      const moving = walk > 0 && walk < 1;
      const phase = t * 11;
      const swing = moving ? Math.sin(phase) * 0.6 : 0;
      w.legL.rotation.x = swing;
      w.legR.rotation.x = -swing;
      w.armL.rotation.x = -swing * 0.7;
      w.body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.018 : 0;
      const facing = moving || walk === 0 ? (w.from < w.to ? Math.PI / 2 : -Math.PI / 2) : w.face;
      w.group.rotation.y += (facing - w.group.rotation.y) * Math.min(1, dt * 8);
      const welding = t >= at('weld') - 0.2;
      w.armR.rotation.x = welding ? -1.25 : -swing * 0.7 * (moving ? 1 : 0);
      w.visor.visible = welding;
    }

    // 용접: 비드가 앞면을 타고 올라가 윗면을 지나며 불꽃·연기·불빛
    const weld = progress(t, at('weld') + 0.1, at('seam') - 0.1);
    const welding = t > at('weld') && t < at('seam');
    const v = Math.min(1, weld / 0.55);
    const top = Math.max(0, (weld - 0.55) / 0.45);
    beadV.visible = beadT.visible = weld > 0;
    beadV.scale.y = Math.max(0.0001, v * BLOCK_H);
    beadT.scale.z = Math.max(0.0001, top * DEPTH);
    tipPos.set(L.seamX, v < 1 ? v * BLOCK_H : BLOCK_H + 0.02, v < 1 ? L.front + 0.02 : L.front - top * DEPTH);
    const pulse = t >= at('seam') ? 2 + 1.2 * Math.sin((t - at('seam')) * 7) : 0;
    beadMat.emissiveIntensity = welding ? 2.2 : pulse;
    beadMat.emissive.set(t >= at('seam') ? '#ffc35a' : '#ff8a2a');
    if (welding) {
      fx.sparks.emit(tipPos, Math.ceil(200 * dt), burst(2.6, new THREE.Vector3(0, 0.9, 0.7), 1.2), [0.35, 0.9]);
      if (Math.random() < dt * 14) fx.smoke.emit(tipPos, 1, burst(0.25, new THREE.Vector3(0, 1, 0), 0.6), [1.6, 2.6]);
      weldLight.position.copy(tipPos).add(new THREE.Vector3(0, 0.05, 0.25));
      weldLight.intensity = 1.2 + Math.random() * 1.8;
    } else weldLight.intensity = t >= at('seam') ? 1.2 + 0.8 * Math.sin((t - at('seam')) * 7) : 0;
    if (t >= at('seam')) weldLight.position.set(L.seamX, BLOCK_H * 0.6, L.front + 0.4);
    // 밝은 탑뷰(종이)에서는 번짐을 끈다
    bloom.strength = lerp(0, 0.6, night) + 0.35 * dim;

    fx.sparks.update(dt);
    fx.dust.update(dt);
    fx.smoke.update(dt);
    const shake = t > tLand && t < tLand + 0.35 ? 0.06 * (1 - (t - tLand) / 0.35) : 0;
    placeCamera(t, shake);
  };

  // ── 시계
  let raf = 0;
  let start = 0;
  let last = 0;
  let fired = 0;
  let ended = false;
  const frame = () => {
    if (!start) {
      // 셰이더를 미리 컴파일한 뒤 시계를 시작한다 (첫 프레임이 늦어 탑뷰 장면을 건너뛰지 않도록).
      // 숨겨 둔 물체(크레인·용접공 등)도 컴파일되게 잠깐 모두 보이게 하고, update가 다시 정리한다
      world.traverse((o) => (o.visible = true));
      renderer.compile(world, camera);
      update(0, 0);
      composer.render();
      start = last = performance.now();
      raf = requestAnimationFrame(frame);
      return;
    }
    const now = performance.now();
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    while (fired < PHASES.length && t >= PHASES[fired][1]) cb.onPhase(PHASES[fired++][0]);
    update(t, dt);
    composer.render();
    if (t >= END && !ended) {
      ended = true;
      cb.onEnd();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    const seen = new Set<unknown>();
    world.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !seen.has(m.geometry)) seen.add(m.geometry) && m.geometry.dispose();
      for (const mat of ([] as THREE.Material[]).concat((m.material as THREE.Material) ?? [])) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    composer.dispose();
    renderer.dispose();
  };
}
