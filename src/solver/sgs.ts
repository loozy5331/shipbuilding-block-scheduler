import type { Assignments, Block, Resources } from '../domain/types';
import { emptyAssignment } from '../domain/types';
import { buildModes, type Mode } from './modes';

/** fast: 가장 빨리 끝나는 배치 / lean: 납기 안이면 낭비 MH가 적은 배치 우선 */
export type PickRule = 'fast' | 'lean';

export type ModeTable = Record<string, Mode[]>;

export function buildModeTable(blocks: Block[], r: Resources): ModeTable {
  const t: ModeTable = {};
  for (const b of blocks) t[b.id] = buildModes(b, r);
  return t;
}

class FreeTable {
  private slots: number[] = [];
  private general: number[] = [];
  private skilled: number[] = [];
  private crane: number[] = [];
  constructor(private r: Resources) {}

  private ensure(day: number) {
    while (this.slots.length < day) {
      this.slots.push(this.r.workplaces * this.r.blocksPerWorkplace);
      this.general.push(this.r.generalWorkers);
      this.skilled.push(this.r.skilledWorkers);
      this.crane.push(this.r.cranes);
    }
  }

  fits(start: number, m: Mode): boolean {
    this.ensure(start + m.duration - 1);
    for (let d = start - 1; d < start - 1 + m.duration; d++) {
      if (this.slots[d] < 1 || this.crane[d] < 1 || this.general[d] < m.general || this.skilled[d] < m.skilled) return false;
    }
    return true;
  }

  take(start: number, m: Mode) {
    for (let d = start - 1; d < start - 1 + m.duration; d++) {
      this.slots[d] -= 1;
      this.crane[d] -= 1;
      this.general[d] -= m.general;
      this.skilled[d] -= m.skilled;
    }
  }
}

interface Option {
  start: number;
  mode: Mode;
  end: number;
}

function better(a: Option, b: Option, rule: PickRule, due: number): boolean {
  const ka = key(a, rule, due);
  const kb = key(b, rule, due);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i];
  return false;
}

function key(o: Option, rule: PickRule, due: number): number[] {
  const crew = o.mode.general + o.mode.skilled;
  if (rule === 'lean' && o.end <= due) return [0, o.mode.wasteMH, o.end, crew, o.mode.skilled];
  return [rule === 'lean' ? 1 : 0, o.end, o.mode.wasteMH, crew, o.mode.skilled];
}

/** 주어진 순서대로 블록을 하나씩 가장 좋은 위치에 배치하는 직렬 스케줄 생성 */
export function serialSchedule(order: Block[], r: Resources, modes: ModeTable, rule: PickRule = 'fast'): Assignments {
  const free = new FreeTable(r);
  const out: Assignments = {};
  let emergencyLeft = r.emergencyMaterials;
  const canRun = r.cranes > 0 && r.workplaces * r.blocksPerWorkplace > 0;
  const limit = order.reduce((s, b) => s + (modes[b.id].at(-1)?.duration ?? 0), 0) + Math.max(0, ...order.map((b) => b.dueDay)) + 1;

  for (const b of order) {
    out[b.id] = emptyAssignment(b.id);
    const ms = modes[b.id];
    if (!canRun || ms.length === 0) continue;
    if (!b.materialReady && emergencyLeft <= 0) continue;

    let best = null as Option | null;
    for (let s = 1; s <= limit; s++) {
      if (best && rule === 'fast' && s > best.end) break;
      if (best && rule === 'lean' && best.end <= b.dueDay && s > b.dueDay) break;
      for (const m of ms) {
        if (!free.fits(s, m)) continue;
        const opt = { start: s, mode: m, end: s + m.duration - 1 };
        if (!best || better(opt, best, rule, b.dueDay)) best = opt;
      }
      if (best && rule === 'lean' && best.end > b.dueDay && s > best.end) break;
    }
    if (!best) continue;

    free.take(best.start, best.mode);
    const emergency = !b.materialReady;
    if (emergency) emergencyLeft--;
    out[b.id] = {
      blockId: b.id,
      startDay: best.start,
      general: best.mode.general,
      skilled: best.mode.skilled,
      crane: true,
      emergency,
    };
  }
  return out;
}
