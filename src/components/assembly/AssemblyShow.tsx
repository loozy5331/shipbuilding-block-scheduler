import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from '../../store/schedulerStore';
import { useEvaluation } from '../../store/evaluation';
import { buildScene, type Scene } from './scene';

/** 장면 순서와 시작 시각(ms). 앞 장면의 클래스는 남겨 두어 CSS에서 "이 장면 이후"로 고른다 */
const TIMELINE = [
  ['flat', 0],
  ['tilt', 600],
  ['rise', 1500],
  ['walk', 2300],
  ['drop', 3500],
  ['weld', 4300],
  ['seam', 5900],
  ['done', 6700],
  ['black', 7900],
  ['out', 8500],
] as const;
const END = 8900;
type Phase = (typeof TIMELINE)[number][0];

// 바닥(간트) 좌표. 1px = 장면 단위
const W = 960;
const HEAD = 36;
const LANE_H = 64;
const DEPTH = 38;
const CRANE_H = 230;

/** 사용자가 움직임 줄이기를 켰는지 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/** 바닥 위 직육면체. 높이는 CSS 변수 --h로 키운다 */
function Box({ r, className, label, children, style }: { r: Rect; className: string; label?: string | null; children?: React.ReactNode; style?: CSSProperties }) {
  return (
    <div className={`asm-box ${className}`} style={{ left: r.x, top: r.y, width: r.w, height: r.d, ...style }}>
      <div className="face back" />
      <div className="face left" />
      <div className="face right" />
      <div className="face front">
        <i className="seam" />
      </div>
      <div className="face top">
        {label && <span>{label}</span>}
        <i className="seam" />
      </div>
      {children}
    </div>
  );
}

/** 안전모를 쓴 용접공. flip이면 왼쪽을 본다 */
function Welder({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 40 72" width="40" height="72" aria-hidden="true">
      <g transform={flip ? 'translate(40 0) scale(-1 1)' : undefined}>
        <g className="leg leg-b">
          <rect x="15" y="44" width="6" height="22" rx="2" fill="#1f3a5c" />
          <rect x="13" y="64" width="10" height="5" rx="2" fill="#1d2433" />
        </g>
        <g className="leg leg-f">
          <rect x="20" y="44" width="6" height="22" rx="2" fill="#27486f" />
          <rect x="20" y="64" width="10" height="5" rx="2" fill="#1d2433" />
        </g>
        <g className="body">
          <rect x="12" y="22" width="17" height="25" rx="5" fill="#e07a2e" />
          <rect x="12" y="34" width="17" height="3" fill="#f6e7a0" />
          <circle cx="20" cy="15" r="6.5" fill="#f3c9a0" />
          <rect x="20" y="13" width="8" height="5" rx="1.5" fill="#1d2433" />
          <path d="M11.5 13c0-5.6 3.8-9 8.5-9s8.5 3.4 8.5 9z" fill="#f2b705" stroke="#1d2433" strokeWidth="1" />
          <rect x="10" y="12" width="20" height="2.6" rx="1.3" fill="#f2b705" stroke="#1d2433" strokeWidth="1" />
          <g className="arm">
            <rect x="21" y="25" width="5" height="16" rx="2.5" fill="#c9661f" />
            <rect x="22" y="39" width="3" height="12" rx="1" fill="#3a4556" />
            <circle className="torch" cx="23.5" cy="52" r="2.2" fill="#ffd36b" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** 용접 불꽃 (위치·방향은 고정된 의사 난수) */
const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const speed = 34 + ((i * 53) % 46);
  return { dx: Math.cos(angle) * speed, dy: -Math.abs(Math.sin(angle)) * speed * 1.1 - 10, delay: (i % 11) * 0.05 };
});

/**
 * 결과로 넘어갈 때 보여 주는 블록 조립 연출: 간트 탑뷰 → 3D로 기울며 막대가 블록이 되고,
 * 용접공이 양쪽에서 걸어오고, 크레인이 붙일 블록을 내려놓고, 용접 → 용접부 강조 → "완료" → 암전.
 */
export function AssemblyShow() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const close = useStore((s) => s.endAssembly);
  const ev = useEvaluation();
  const scene = useMemo(() => buildScene(blocks, resources, assignments, ev), [blocks, resources, assignments, ev]);

  useEffect(() => {
    if (!scene) close();
  }, [scene, close]);
  if (!scene) return null;
  return <Stage scene={scene} onEnd={close} />;
}

function Stage({ scene, onEnd }: { scene: Scene; onEnd(): void }) {
  const [reached, setReached] = useState<Phase[]>(['flat']);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const skipRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    skipRef.current?.focus();
    const timers = TIMELINE.slice(1).map(([p, at]) => window.setTimeout(() => setReached((r) => [...r, p]), at));
    timers.push(window.setTimeout(() => endRef.current(), END));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && endRef.current();
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const H = HEAD + scene.lanes * LANE_H;
  const U = W / scene.days;
  const rectOf = (lane: number, start: number, length: number): Rect => ({
    x: (start - 1) * U + 3,
    y: HEAD + lane * LANE_H + (LANE_H - DEPTH) / 2,
    w: Math.max(8, length * U - 6),
    d: DEPTH,
  });
  const heroBar = scene.bars.find((b) => b.id === scene.hero)!;
  const hero = rectOf(heroBar.lane, heroBar.start, heroBar.length);
  // 붙일 블록은 주인공 블록 오른쪽 끝에 맞붙인다
  const seamX = hero.x + hero.w;
  const partner: Rect = { x: seamX, y: hero.y, w: Math.min(Math.max(hero.w * 0.8, 70), 170), d: DEPTH };
  const cy = hero.y + DEPTH / 2;

  // 카메라: 처음엔 화면에 맞춘 탑뷰, 기울인 뒤 용접부로 다가간다
  const fit = Math.min(1, (view.w - 32) / W, (view.h - 140) / H);
  const has = (p: Phase) => reached.includes(p);
  const focus = has('walk');
  // 크레인이 화면에 들어오도록 용접부보다 조금 뒤를 가운데에 둔다
  const camera = focus
    ? `scale(${Math.min(fit * 1.8, 2)}) rotateX(58deg) rotateZ(-24deg) translate3d(${W / 2 - seamX}px, ${H / 2 - cy + 60}px, 0)`
    : has('tilt')
      ? `scale(${fit * 0.95}) rotateX(52deg) rotateZ(-18deg) translate3d(0px, 0px, 0)`
      : `scale(${fit}) rotateX(0deg) rotateZ(0deg) translate3d(0px, 0px, 0)`;

  const craneL = seamX - 200;
  const craneR = seamX + partner.w + 160;

  return (
    <div className={`asm ${reached.map((p) => `p-${p}`).join(' ')}`} role="dialog" aria-modal="true" aria-label="블록 조립 애니메이션" data-testid="assembly-show">
      <div className="asm-sky" />
      <div className="asm-stage">
        <div className="asm-cam" style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: camera }}>
          <div className="asm-floor" style={{ backgroundSize: `${U}px ${LANE_H}px`, backgroundPosition: `0 ${HEAD}px` }}>
            <div className="asm-days" style={{ gridTemplateColumns: `repeat(${scene.days}, 1fr)` }}>
              {Array.from({ length: scene.days }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
          </div>

          {scene.bars.map((b) => (
            <Box
              key={b.id}
              r={rectOf(b.lane, b.start, b.length)}
              className={b.id === scene.hero ? 'hero' : b.id === scene.partner ? 'other origin' : 'other'}
              label={b.id}
            />
          ))}

          {/* 골리앗 크레인: 다리 둘 + 거더 + 트롤리 */}
          <div className="asm-crane">
            <div className="crane-leg" style={{ left: craneL - 9, top: cy - CRANE_H, height: CRANE_H }} />
            <div className="crane-leg" style={{ left: craneR - 9, top: cy - CRANE_H, height: CRANE_H }} />
            <div className="crane-girder" style={{ left: craneL - 14, top: cy - 10, width: craneR - craneL + 28, transform: `translateZ(${CRANE_H}px)` }} />
            <div className="crane-trolley" style={{ left: seamX + partner.w / 2 - 16, top: cy - 14, transform: `translateZ(${CRANE_H + 6}px)` }} />
          </div>

          <Box r={partner} className="partner" label={scene.partner}>
            <div className="cable" style={{ left: partner.w / 2 - 1, bottom: DEPTH / 2, height: `calc(${CRANE_H}px - var(--lift) - var(--h))` }}>
              <i className="hook" />
            </div>
          </Box>

          {[
            { from: seamX - 340, to: seamX - 44, flip: false },
            { from: seamX + partner.w + 300, to: seamX + 44, flip: true },
          ].map((m, i) => (
            <div key={i} className={`asm-walker ${m.flip ? 'right' : 'left'}`} style={{ top: hero.y + DEPTH + 14, ['--from' as string]: `${m.from}px`, ['--to' as string]: `${m.to}px` }}>
              <div className="figure">
                <Welder flip={m.flip} />
              </div>
            </div>
          ))}

          <div className="asm-sparks" style={{ left: seamX - 70, top: hero.y + DEPTH - 160 }}>
            <i className="flash" />
            {SPARKS.map((s, i) => (
              <i key={i} className="spark" style={{ ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, animationDelay: `${s.delay}s` }} />
            ))}
          </div>
        </div>
      </div>

      <p className="asm-caption">
        블록 조립 · <b>{scene.hero}</b>
        {scene.partner && (
          <>
            {' '}
            + <b>{scene.partner}</b>
          </>
        )}
      </p>
      <div className="asm-done" aria-live="polite">
        {has('done') && <strong>완료</strong>}
      </div>
      <div className="asm-black" />
      <button ref={skipRef} type="button" className="asm-skip" onClick={() => endRef.current()} data-testid="assembly-skip">
        건너뛰기 ›
      </button>
    </div>
  );
}
