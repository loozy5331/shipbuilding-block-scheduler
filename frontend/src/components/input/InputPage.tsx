import { useStore } from '../../store/schedulerStore';
import { BlockSource } from './BlockSource';
import { BlockTable } from './BlockTable';
import { CapacitySummary } from './CapacitySummary';
import { ResourceForm } from './ResourceForm';
import { WorkDaysForm } from './WorkDaysForm';
import { SideLayout } from '../common/SideLayout';

/**
 * ③ 공통 설정 입력: 블록·자원·계획 시작일.
 * 튜토리얼이든 아니든 같은 화면이고, 튜토리얼 중에는 편집 도구(업로드 줄·입력 칸·± 버튼)만 감춘다.
 */
export function InputPage() {
  const blocks = useStore((s) => s.blocks);
  const planStart = useStore((s) => s.planStart);
  const setPlanStart = useStore((s) => s.setPlanStart);
  const setPage = useStore((s) => s.setPage);
  const touring = useStore((s) => s.tutorialActive);
  const hasDup = new Set(blocks.map((b) => b.id)).size !== blocks.length || blocks.some((b) => !b.id);

  return (
    <div className="board setup">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">— 공통 설정 입력</span>
          <h1 data-testid="setup-title">블록 · 자원 · 계획 시작일</h1>
        </div>
        <div className="board-actions">
          <label className="plan-start">
            계획 시작일(오늘)
            <input type="date" value={planStart} disabled={touring} onChange={(e) => e.target.value && setPlanStart(e.target.value)} />
          </label>
          <button type="button" className="btn ghost" onClick={() => setPage('menu')}>
            ← 메뉴
          </button>
        </div>
      </div>

      <SideLayout
        side={<CapacitySummary />}
        foot={
          <>
            <button type="button" className="btn primary" data-tour="next" disabled={blocks.length === 0 || hasDup} onClick={() => setPage('schedule')}>
              다음: 블록 스케줄링 →
            </button>
            {hasDup && <p className="error-text">블록 ID가 비었거나 중복되었습니다.</p>}
          </>
        }
      >
        <section className="panel" data-tour="blocks">
          <h3>
            <span className="step-no">1</span> 블록 작업 <small className="muted">{blocks.length}개</small>
          </h3>
          {!touring && <BlockSource />}
          <BlockTable readOnly={touring} />
        </section>
        <section className="panel" data-tour="resources">
          <h3>
            <span className="step-no">2</span> 가용 자원{!touring && ' · 작업하지 않는 날'}
          </h3>
          <div className="resource-cols">
            <div>
              <ResourceForm readOnly={touring} />
            </div>
            {/* 튜토리얼은 발표 자료대로 매일 작업한다 */}
            {!touring && <WorkDaysForm />}
          </div>
        </section>
      </SideLayout>
    </div>
  );
}
