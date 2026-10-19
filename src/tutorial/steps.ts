import { evaluate } from '../domain/evaluate';
import { runSolve } from '../store/actions';
import { useStore, type Page } from '../store/schedulerStore';

export interface TourStep {
  page: Page;
  /** data-tour 값. 없으면 화면 가운데 */
  target?: string;
  eyebrow: string;
  title: string;
  body: () => string;
  /** 단계에 들어갈 때 실행 */
  enter?: () => void | Promise<void>;
}

function lateText(): string {
  const { blocks, resources, assignments } = useStore.getState();
  const ev = evaluate(blocks, resources, assignments);
  const bad = blocks.filter((b) => ev.blocks[b.id].status !== 'ok');
  if (bad.length === 0) return '이 순서로도 모두 납기 안에 끝났습니다.';
  return `${bad.map((b) => b.id).join(', ')} 블록이 납기를 넘깁니다 (빨간 막대). 급한 블록이 앞 블록에 밀려 작업장을 못 잡았기 때문입니다.`;
}

/**
 * 가이드는 페이지마다 따로 진행한다 (공통 설정 입력 1/4~4/4 → 블록 스케줄링 → 결과).
 * 한 페이지 가이드가 끝나면 닫히고, 그 페이지의 다음 버튼으로 넘어가면 다음 페이지 가이드가 열린다.
 */
export const STEPS: TourStep[] = [
  {
    page: 'setup',
    eyebrow: '튜토리얼',
    title: '해야 할 작업은 많은데, 사용할 수 있는 시간은 부족하다',
    body: () =>
      '발표 자료의 "작업 배정 실습 10일 아침의 다섯 블록" 상황으로 공통 설정을 채워 두었습니다. 엑셀을 올렸을 때와 같은 순서로 공통 설정 입력 → 블록 스케줄링 → 결과를 따라가 봅니다.',
    enter: () => useStore.getState().loadScenario(),
  },
  {
    page: 'setup',
    target: 'summary',
    eyebrow: '문제 확인',
    title: '필요 80MH, 하루 가용은 40MH',
    body: () => '전체 필요 작업시간이 하루 가용 작업시간의 2배입니다. 그래서 우선순위 판단이 필요합니다.',
  },
  {
    page: 'setup',
    target: 'blocks',
    eyebrow: '블록 작업',
    title: '오늘의 작업 목록',
    body: () => 'C-115는 자재가 아직 준비되지 않았습니다. 비상 자재를 써야 착수할 수 있습니다.',
  },
  {
    page: 'setup',
    target: 'resources',
    eyebrow: '가용 자원',
    title: '작업장 2곳, 작업자 2명, 숙련공 2명, 크레인 2대',
    body: () => '일반 작업자는 하루 8MH, 숙련공은 12MH를 처리해 하루 40인시입니다. 블록마다 크레인 1대가 필요하고 비상 자재는 1개뿐입니다.',
  },
  {
    page: 'schedule',
    target: 'verdict',
    eyebrow: '가능 여부',
    title: '가용 자원으로 가능한지 맨 위에 표시',
    body: () =>
      '블록 스케줄링으로 넘어오면 현재 자원으로 전 블록 납기 준수가 가능한지 바로 판정합니다. 불가능하면 무엇을 몇 개 늘리면 해소되는지 아래에 제안합니다.',
    enter: () => useStore.getState().clearAssignments(),
  },
  {
    page: 'schedule',
    target: 'palette',
    eyebrow: '직접 배치',
    title: '아이콘을 끌어 블록에 놓으세요',
    body: () =>
      '작업자·숙련공·크레인·비상 자재 아이콘을 블록 줄로 끌어 놓으면 배정되고, 놓인 아이콘을 누르면 빠집니다. 굵은 테두리 하나가 작업장 하나입니다. 막대를 좌우로 끌면 착수일, 다른 작업장 테두리로 끌면 작업장이 바뀝니다.',
  },
  {
    page: 'schedule',
    target: 'gantt',
    eyebrow: '변경 전',
    title: '입력 순서대로 배치하면?',
    body: lateText,
    enter: async () => {
      await runSolve('input');
    },
  },
  {
    page: 'schedule',
    target: 'optimize',
    eyebrow: '의사결정',
    title: '추가 비용 투입보다, 작업 순서 조정부터',
    body: () =>
      '최적 배치 버튼은 작업 순서와 인원 구성을 바꿔 지연이 없는 안을 찾습니다. 다시 누르면 최소 요건을 만족하는 차선책을 차례로 보여 줍니다. (신입 모드에서는 힌트 버튼)',
  },
  {
    page: 'schedule',
    target: 'kpi',
    eyebrow: '변경 후',
    title: '작업 순서 변경으로 납기 위험 해소',
    body: () => {
      const { blocks, resources, assignments } = useStore.getState();
      const k = evaluate(blocks, resources, assignments).kpi;
      return `최적 배치를 적용했습니다. 블록 납기 준수 ${k.onTime}/${k.total}, 비상 자재 ${k.emergencyUsed}개 사용.`;
    },
    enter: async () => {
      await runSolve('optimal');
    },
  },
  {
    page: 'schedule',
    target: 'load',
    eyebrow: '자원 부하',
    title: '날마다 자원이 넘치지 않는지 확인',
    body: () => '채운 칸은 쓰는 양, 빈칸은 남는 양입니다. 직접 배치를 바꾸다 용량을 넘으면 빨간 칸으로 표시됩니다.',
  },
  {
    page: 'result',
    target: 'tbm',
    eyebrow: '결과',
    title: '오늘 작업을 TBM 메시지로 공유',
    body: () => '날짜별로 작업장·블록·인원·주의 사항을 TBM 메시지로 정리합니다. 복사해서 바로 공유하세요.',
  },
  {
    page: 'result',
    target: 'report',
    eyebrow: '평가서',
    title: '최적 배치와 비교하고 엑셀로 저장',
    body: () => '납기 만족 블록 수와 잔여 납기 여유일을 최적 배치와 비교합니다. 엑셀 저장으로 배치표·TBM·평가서를 받을 수 있습니다. 이제 실제 블록 엑셀로 시작해 보세요.',
  },
];

export const stepsOf = (page: Page) => STEPS.filter((s) => s.page === page);
