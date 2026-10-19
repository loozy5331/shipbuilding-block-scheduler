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

export const STEPS: TourStep[] = [
  {
    page: 'setup',
    eyebrow: '01. 튜토리얼',
    title: '해야 할 작업은 많은데, 사용할 수 있는 시간은 부족하다',
    body: () =>
      '발표 자료의 "작업 배정 실습 10일 아침의 다섯 블록" 상황을 불러왔습니다. 제한된 자원 안에서 어떤 블록부터 처리할지 함께 정해 봅니다.',
    enter: () => useStore.getState().loadScenario(),
  },
  {
    page: 'setup',
    target: 'summary',
    eyebrow: '02. 문제 확인',
    title: '필요 80MH, 하루 가용은 44MH',
    body: () => '전체 필요 작업시간이 하루 가용 작업시간의 약 2배입니다. 그래서 우선순위 판단이 필요합니다.',
  },
  {
    page: 'setup',
    target: 'upload',
    eyebrow: '03. 블록 입력',
    title: '엑셀 파일을 그대로 올리세요',
    body: () =>
      '"블록 ID · 납기일 · 필요 작업 시간 · 자재준비 여부" 열이 있는 엑셀을 끌어다 놓거나, 셀을 복사해 붙여넣을 수 있습니다. 납기일이 날짜면 계획 시작일 기준 남은 일수로 바꿉니다.',
  },
  {
    page: 'setup',
    target: 'blocks',
    eyebrow: '03. 블록 입력',
    title: '오늘의 작업 목록',
    body: () => 'C-115는 자재가 아직 준비되지 않았습니다. 비상 자재를 써야 착수할 수 있습니다.',
  },
  {
    page: 'setup',
    target: 'resources',
    eyebrow: '04. 가용 자원',
    title: '작업장 2곳, 작업자 4명, 숙련공 1명, 크레인 2대',
    body: () => '일반 작업자는 하루 8MH, 숙련공은 12MH를 처리합니다. 블록마다 크레인 1대가 필요하고 비상 자재는 1개뿐입니다.',
  },
  {
    page: 'schedule',
    target: 'palette',
    eyebrow: '05. 직접 배치',
    title: '아이콘을 끌어 블록에 놓으세요',
    body: () =>
      '작업자·숙련공·크레인·비상 자재 아이콘을 블록 줄로 끌어 놓으면 배정되고, 놓인 아이콘을 누르면 빠집니다. 굵은 테두리 하나가 작업장 하나입니다. 막대를 좌우로 끌면 착수일, 다른 작업장 테두리로 끌면 작업장이 바뀝니다.',
    enter: () => useStore.getState().clearAssignments(),
  },
  {
    page: 'schedule',
    target: 'gantt',
    eyebrow: '06. 변경 전',
    title: '입력 순서대로 배치하면?',
    body: lateText,
    enter: async () => {
      await runSolve('input');
    },
  },
  {
    page: 'schedule',
    target: 'policy',
    eyebrow: '07. 의사결정',
    title: '추가 비용 투입보다, 작업 순서 조정부터',
    body: () => '세 가지 배치 정책을 비교합니다. 납기 빠른 순으로 바꾸기만 해도 추가 비용 없이 지연이 해소되는지 확인하세요.',
  },
  {
    page: 'schedule',
    target: 'kpi',
    eyebrow: '08. 변경 후',
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
    eyebrow: '09. 자원 부하',
    title: '날마다 자원이 넘치지 않는지 확인',
    body: () => '채운 칸은 쓰는 양, 빈칸은 남는 양입니다. 직접 배치를 바꾸다 용량을 넘으면 빨간 칸으로 표시됩니다.',
  },
  {
    page: 'schedule',
    target: 'whatif',
    eyebrow: '10. 자원 제안',
    title: '자원이 부족하면 무엇을 늘려야 할지 제안',
    body: () =>
      '현재 자원으로 불가능하면 작업자·숙련공·크레인·작업장·비상 자재를 하나씩 늘려 보고, 지연을 해소하는 최소 추가 자원을 알려 줍니다.',
  },
  {
    page: 'result',
    target: 'tbm',
    eyebrow: '11. 결과',
    title: '오늘 작업을 TBM 메시지로 공유하고 엑셀로 저장',
    body: () =>
      '결과 페이지에서는 날짜별 작업장·블록·인원·주의 사항을 TBM 메시지로 복사할 수 있고, 최적 배치 대비 평가서와 엑셀 저장을 제공합니다. 이제 실제 블록 엑셀로 시작해 보세요.',
  },
];
