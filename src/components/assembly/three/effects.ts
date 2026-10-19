import * as THREE from 'three';

/** 부드러운 원형 점 텍스처 (불꽃·먼지·연기 공용) */
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface Kind {
  size: number;
  additive: boolean;
  gravity: number;
  drag: number;
  /** 바닥에 닿으면 튀어 오르는 정도 (0이면 그대로 멈춤) */
  bounce: number;
  /** 수명 비율(0→1)에 따른 RGBA */
  color(life: number, out: number[]): void;
}

/** 수명이 있는 입자 묶음. emit으로 뿌리고 update로 움직인다 */
export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private ttl: Float32Array;
  private next = 0;
  private tmp = [0, 0, 0, 0];

  constructor(
    private n: number,
    private kind: Kind,
  ) {
    this.pos = new Float32Array(n * 3).fill(-999);
    this.col = new Float32Array(n * 4);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1);
    this.ttl = new Float32Array(n).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const mat = new THREE.PointsMaterial({
      size: kind.size,
      map: softDot(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: kind.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** origin에서 count개를 뿌린다. velocity(i)가 각 입자의 초기 속도를 정한다 */
  emit(origin: THREE.Vector3, count: number, velocity: () => [number, number, number], ttl: [number, number]) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      this.pos.set([origin.x, origin.y, origin.z], i * 3);
      this.vel.set(velocity(), i * 3);
      this.age[i] = 0;
      this.ttl[i] = ttl[0] + Math.random() * (ttl[1] - ttl[0]);
    }
  }

  update(dt: number) {
    const { gravity, drag, bounce } = this.kind;
    for (let i = 0; i < this.n; i++) {
      const life = this.age[i] / this.ttl[i];
      if (life >= 1) {
        this.col[i * 4 + 3] = 0;
        continue;
      }
      this.age[i] += dt;
      const p = i * 3;
      this.vel[p + 1] -= gravity * dt;
      for (let a = 0; a < 3; a++) {
        this.vel[p + a] *= 1 - drag * dt;
        this.pos[p + a] += this.vel[p + a] * dt;
      }
      if (this.pos[p + 1] < 0.01) {
        this.pos[p + 1] = 0.01;
        this.vel[p + 1] = -this.vel[p + 1] * bounce;
        this.vel[p] *= 0.6;
        this.vel[p + 2] *= 0.6;
      }
      this.kind.color(life, this.tmp);
      this.col.set(this.tmp, i * 4);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** 용접 불꽃: 흰색 → 노랑 → 주황 → 빨강으로 식으며 바닥에서 튄다 */
export const sparks = () =>
  new Particles(700, {
    size: 0.03,
    additive: true,
    gravity: 5.5,
    drag: 0.6,
    bounce: 0.35,
    color: (l, o) => {
      o[0] = 1;
      o[1] = Math.max(0.15, 1 - l * 1.1);
      o[2] = Math.max(0, 0.85 - l * 2.2);
      o[3] = 1 - l * l;
    },
  });

/** 블록이 내려앉을 때 이는 먼지 */
export const dust = () =>
  new Particles(160, {
    size: 0.32,
    additive: false,
    gravity: -0.15,
    drag: 2.2,
    bounce: 0,
    color: (l, o) => {
      o[0] = o[1] = o[2] = 0.62;
      o[3] = 0.45 * (1 - l);
    },
  });

/** 용접 연기 */
export const smoke = () =>
  new Particles(120, {
    size: 0.38,
    additive: false,
    gravity: -0.35,
    drag: 0.8,
    bounce: 0,
    color: (l, o) => {
      o[0] = o[1] = o[2] = 0.7;
      o[3] = 0.18 * Math.sin(Math.PI * l);
    },
  });

/** 반구 방향 무작위 속도 (dir 쪽으로 치우침) */
export function burst(speed: number, dir = new THREE.Vector3(0, 1, 0), spread = 1): () => [number, number, number] {
  return () => {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(spread).add(dir).normalize();
    const s = speed * (0.4 + Math.random() * 0.8);
    return [v.x * s, v.y * s, v.z * s];
  };
}
