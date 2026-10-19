import type { Assignments, Block, Policy, Resources } from '../domain/types';
import { compareObjective, evaluate, meetsMinimum, objective, type Kpi } from '../domain/evaluate';
import { buildModeTable, serialSchedule, type ModeTable, type PickRule } from './sgs';

export interface Plan {
  assignments: Assignments;
  kpi: Kpi;
  feasible: boolean;
}

export interface Solution extends Plan {
  policy: Policy;
  /** 최적화만: 착수 순서가 다른 차선·차차선 (좋은 순, 최대 MAX_ALTERNATIVES개) */
  alternatives?: Plan[];
}

/** 후보는 최적 · 차선 · 차차선 3개까지 */
export const MAX_ALTERNATIVES = 2;

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
  const plan = (c: Candidate): Plan => {
    const ev = evaluate(blocks, r, c.assignments);
    return { assignments: c.assignments, kpi: ev.kpi, feasible: ev.feasible };
  };
  if (policy === 'input') return { policy, ...plan(run(blocks, 'fast', blocks, r, modes)) };
  if (policy === 'edd') return { policy, ...plan(run(eddOrder(blocks, modes), 'fast', blocks, r, modes)) };
  const archive = new Archive();
  const best = localSearch(blocks, r, modes, opts, archive);
  return { policy, ...plan(best), alternatives: archive.top(MAX_ALTERNATIVES, best, blocks, r).map(plan) };
}

/** 착수 순서(같은 날은 ID 순). 미배치 블록은 빠진다. */
function startOrder(a: Assignments): string {
  return Object.values(a)
    .filter((x) => x.startDay !== null)
    .sort((x, y) => x.startDay! - y.startDay! || x.blockId.localeCompare(y.blockId))
    .map((x) => x.blockId)
    .join('>');
}

/** 탐색 중 만난 해를 착수 순서별로 가장 좋은 것만 모아 둔다 (차선책 후보) */
class Archive {
  private byOrder = new Map<string, Candidate>();

  add(c: Candidate) {
    const key = startOrder(c.assignments);
    const prev = this.byOrder.get(key);
    if (!prev || compareObjective(c.score, prev.score) < 0) this.byOrder.set(key, c);
    if (this.byOrder.size > 400) {
      const keep = [...this.byOrder.entries()].sort((x, y) => compareObjective(x[1].score, y[1].score)).slice(0, 100);
      this.byOrder = new Map(keep);
    }
  }

  get size() {
    return this.byOrder.size;
  }

  /**
   * best와 착수 순서가 다른 해 중 좋은 순으로 n개.
   * 최소 요건(자재·크레인·작업자, 자원 초과 없음)을 만족하고, 착수 못 하는 블록이 최적해보다 많지 않은 것만.
   */
  top(n: number, best: Candidate, blocks: Block[], r: Resources): Candidate[] {
    const skip = startOrder(best.assignments);
    const out: Candidate[] = [];
    const sorted = [...this.byOrder.entries()].filter(([k]) => k !== skip).sort((x, y) => compareObjective(x[1].score, y[1].score));
    for (const [, c] of sorted) {
      if (out.length >= n) break;
      if (c.score[0] > best.score[0] || !meetsMinimum(blocks, r, c.assignments)) continue;
      out.push(c);
    }
    return out;
  }
}

/** EDD/여유시간/입력순서 초기해에서 시작해 교환·삽입 이웃을 탐색하고, 정체되면 섞어서 재시작한다. */
function localSearch(blocks: Block[], r: Resources, modes: ModeTable, { budgetMs = 800, seed = 7 }: SolveOptions, archive: Archive): Candidate {
  const rand = rng(seed);
  const deadline = Date.now() + budgetMs;
  const edd = eddOrder(blocks, modes);
  const slack = [...blocks].sort((a, b) => a.dueDay - (modes[a.id][0]?.duration ?? 0) - (b.dueDay - (modes[b.id][0]?.duration ?? 0)));
  const starts: Candidate[] = [];
  for (const order of [edd, slack, blocks]) for (const rule of ['fast', 'lean'] as PickRule[]) starts.push(run(order, rule, blocks, r, modes));
  starts.forEach((c) => archive.add(c));
  starts.sort((a, b) => compareObjective(a.score, b.score));
  let best = starts[0];
  if (blocks.length < 2) return best;

  let cur = best;
  let stall = 0;
  // 미배치·초과·지연·낭비가 모두 0이면 더 볼 필요가 없다
  const isPerfect = (s: number[]) => s[0] === 0 && s[1] === 0 && s[2] === 0 && s[5] === 0;

  // 최선해가 완벽해도 차선책 후보를 모을 만큼은 더 둘러본다
  const enough = () => isPerfect(best.score) && archive.size > MAX_ALTERNATIVES * 8;
  while (Date.now() < deadline && !enough()) {
    const order = [...cur.order];
    const i = Math.floor(rand() * order.length);
    let j = Math.floor(rand() * (order.length - 1));
    if (j >= i) j++;
    if (rand() < 0.5) [order[i], order[j]] = [order[j], order[i]];
    else order.splice(j, 0, order.splice(i, 1)[0]);
    const rule: PickRule = rand() < 0.15 ? (cur.rule === 'fast' ? 'lean' : 'fast') : cur.rule;
    const next = run(order, rule, blocks, r, modes);
    archive.add(next);

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
