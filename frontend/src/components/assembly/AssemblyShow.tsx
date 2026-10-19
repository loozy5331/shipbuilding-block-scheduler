import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { useEvaluation } from '../../store/evaluation';
import { buildScene, type Scene } from './scene';
import type { Phase } from './timeline';

/** 사용자가 움직임 줄이기를 켰는지 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * 결과로 넘어갈 때 보여 주는 블록 조립 연출 (three.js). 간트 탑뷰 → 3D로 기울며 막대가 블록이 되고,
 * 용접공이 걸어오고, 크레인이 붙일 블록을 내려놓고, 용접 → 용접부 강조 → "완료" → 암전.
 * three.js는 이 연출을 재생할 때만 불러온다.
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
  return <Stage scene={scene} summary={`납기 준수 ${ev.kpi.onTime}/${ev.kpi.total} · 지연 ${ev.kpi.totalLateDays}일`} onEnd={close} />;
}

function Stage({ scene, summary, onEnd }: { scene: Scene; summary: string; onEnd(): void }) {
  const [reached, setReached] = useState<Phase[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    skipRef.current?.focus();
    let stop: (() => void) | null = null;
    let alive = true;
    import('./three/runShow')
      .then(({ runShow }) => {
        if (!alive || !canvasRef.current) return;
        stop = runShow(canvasRef.current, scene, {
          onPhase: (p) => setReached((r) => [...r, p]),
          onEnd: () => endRef.current(),
        });
      })
      // WebGL을 쓸 수 없는 환경이면 연출 없이 결과로
      .catch(() => alive && endRef.current());
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && endRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      stop?.();
      window.removeEventListener('keydown', onKey);
    };
  }, [scene]);

  const has = (p: Phase) => reached.includes(p);
  return (
    <div className={`asm ${reached.map((p) => `p-${p}`).join(' ')}`} role="dialog" aria-modal="true" aria-label="블록 조립 애니메이션" data-testid="assembly-show">
      <canvas ref={canvasRef} className="asm-canvas" />
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
        {has('done') && (
          <>
            <strong>완료</strong>
            <span>{summary}</span>
          </>
        )}
      </div>
      <div className="asm-black" />
      <button ref={skipRef} type="button" className="asm-skip" onClick={() => endRef.current()} data-testid="assembly-skip">
        건너뛰기 ›
      </button>
    </div>
  );
}
