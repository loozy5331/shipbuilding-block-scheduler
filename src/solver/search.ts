import type { Assignments, Block, Policy, Resources } from '../domain/types';
import { compareObjective, evaluate, objective, type Kpi } from '../domain/evaluate';
import { buildModeTable, serialSchedule, type ModeTable, type PickRule } from './sgs';

export interface Solution {
  policy: Policy;
  assignments: Assignments;
  kpi: Kpi;
  feasible: boolean;
}

/** 재현 가능한 의사난수 (mulberry32) */
export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** 납기 빠른 순, 같으면 여유(납기 - 최단 기간)가 작은 순, 같으면 MH 큰 순 */
export function eddOrder(blocks: Block[], modes: ModeTable): Block[] {
  const minDur = (b: Block) => modes[b.id][0]?.duration ?? Infinity;
  return [...blocks].sort((a, b) => a.dueDay - b.dueDay || a.dueDay - minDur(a) - (b.dueDay - minDur(b)) || b.requiredMH - a.requiredMH);
}

interface Candidate {
  order: Block[];
  rule: PickRule;
  assignments: Assignments;
  score: number[];
}

function run(order: Block[], rule: PickRule, blocks: Block[], r: Resources, modes: ModeTable): Candidate {
  const assignments = serialSchedule(order, r, modes, rule);
  return { order, rule, assignments, score: objective(evaluate(blocks, r, assignments).kpi) };
}

export interface SolveOptions {
  budgetMs?: number;
  seed?: number;
}

export function solvePolicy(policy: Policy, blocks: Block[], r: Resources, opts: SolveOptions = {}): Solution {
  const modes = buildModeTable(blocks, r);
  let best: Candidate;
  if (policy === 'input') best = run(blocks, 'fast', blocks, r, modes);
  else if (policy === 'edd') best = run(eddOrder(blocks, modes), 'fast', blocks, r, modes);
  else best = localSearch(blocks, r, modes, opts);
  const ev = evaluate(blocks, r, best.assignments);
  return { policy, assignments: best.assignments, kpi: ev.kpi, feasible: ev.feasible };
}

/** EDD/여유시간/입력순서 초기해에서 시작해 교환·삽입 이웃을 탐색하고, 정체되면 섞어서 재시작한다. */
function localSearch(blocks: Block[], r: Resources, modes: ModeTable, { budgetMs = 800, seed = 7 }: SolveOptions): Candidate {
  const rand = rng(seed);
  const deadline = Date.now() + budgetMs;
  const edd = eddOrder(blocks, modes);
  const slack = [...blocks].sort((a, b) => a.dueDay - (modes[a.id][0]?.duration ?? 0) - (b.dueDay - (modes[b.id][0]?.duration ?? 0)));
  const starts: Candidate[] = [];
  for (const order of [edd, slack, blocks]) for (const rule of ['fast', 'lean'] as PickRule[]) starts.push(run(order, rule, blocks, r, modes));
  starts.sort((a, b) => compareObjective(a.score, b.score));
  let best = starts[0];
  if (blocks.length < 2) return best;

  let cur = best;
  let stall = 0;
  // 미배치·초과·지연·낭비가 모두 0이면 더 볼 필요가 없다
  const isPerfect = (s: number[]) => s[0] === 0 && s[1] === 0 && s[2] === 0 && s[5] === 0;

  while (Date.now() < deadline && !isPerfect(best.score)) {
    const order = [...cur.order];
    const i = Math.floor(rand() * order.length);
    let j = Math.floor(rand() * (order.length - 1));
    if (j >= i) j++;
    if (rand() < 0.5) [order[i], order[j]] = [order[j], order[i]];
    else order.splice(j, 0, order.splice(i, 1)[0]);
    const rule: PickRule = rand() < 0.15 ? (cur.rule === 'fast' ? 'lean' : 'fast') : cur.rule;
    const next = run(order, rule, blocks, r, modes);

    const c = compareObjective(next.score, cur.score);
    if (c <= 0) {
      cur = next;
      stall = c < 0 ? 0 : stall + 1;
      if (compareObjective(cur.score, best.score) < 0) best = cur;
    } else stall++;

    if (stall > 200) {
      // 최선해를 기준으로 몇 번 섞어서 재시작
      const order2 = [...best.order];
      for (let k = 0; k < Math.max(2, order2.length / 5); k++) {
        const a = Math.floor(rand() * order2.length);
        const b = Math.floor(rand() * order2.length);
        [order2[a], order2[b]] = [order2[b], order2[a]];
      }
      cur = run(order2, best.rule, blocks, r, modes);
      stall = 0;
    }
  }
  return best;
}
