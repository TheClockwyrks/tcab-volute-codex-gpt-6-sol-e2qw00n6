import type { Game, RenderApi, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import {
  ACTIONS,
  AIM_START,
  AIM_TURN_RATE,
  BACKFLOW_SPEED,
  BINDINGS,
  BORE_RADIUS,
  CELLS,
  CATCHUP_SPEED,
  CHAIN_RESET,
  CHANNEL,
  CHARGE_IDS,
  CHOKE_FEED_MULTIPLIER,
  CLEAR_SCORE,
  CORE_RADIUS,
  CUES,
  DANGER_S,
  EXTRACT_CUES,
  FIELD_H,
  FIELD_W,
  FIRE_COOLDOWN,
  INJECTOR_X,
  INJECTOR_Y,
  INTAKE_S,
  INTERLUDE,
  LEVEL_COUNT,
  LEVELS,
  MACHINERY_DURATIONS,
  MACHINERY_KINDS,
  MARK_INTERVAL,
  MIN_RUN,
  PATH_LENGTH,
  PRESSURE_BLEED,
  PRESSURE_DROP_PER_CORE,
  PRESSURE_FREE,
  PRESSURE_MAX,
  PRESSURE_MIN,
  PRESSURE_RISE_PER_CORE,
  PROJECTILE_SPEED,
  RECOIL,
  RECOIL_HOLD,
  SCORE_PER_CORE,
  SCREENS,
  SEEDED_CORES,
  SEEDED_HEAD_S,
  SPACING,
  STRIKE_DISTANCE,
  TICK_DT,
  TITLE_TEXT,
  VOLUTE_DEBUG_VERSION,
} from "./constants";
import type { ChargeId, MachineryKind, ScreenName } from "./constants";

export type { ChargeId, MachineryKind, ScreenName };
export interface CoreState {
  readonly charge: ChargeId;
  readonly s: number;
  readonly mark: MachineryKind | null;
}
export interface SegmentState {
  readonly count: number;
  readonly hold: number;
}
export interface ProjectileState {
  readonly charge: ChargeId;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}
export interface MachineryState {
  readonly kind: MachineryKind;
  readonly remaining: number;
}
export interface VoluteState {
  readonly screen: ScreenName;
  readonly score: number;
  readonly level: number;
  readonly cells: number;
  readonly quotaRemaining: number;
  readonly pressure: number;
  readonly chainStep: number;
  readonly chainTimer: number;
  readonly machinery: MachineryState | null;
  readonly cores: readonly CoreState[];
  readonly segments: readonly SegmentState[];
  readonly projectiles: readonly ProjectileState[];
  readonly loaded: ChargeId | null;
  readonly queued: ChargeId | null;
  readonly aim: number;
  readonly fireCooldown: number;
  readonly interlude: number;
  readonly simTime: number;
  readonly accumulator: number;
  readonly emission: boolean;
  readonly feed: boolean;
  readonly nextEmitted: ChargeId | null;
  readonly muted: boolean;
}

type ReadState = DeepReadonly<VoluteState>;
type Pose = (state: ReadState) => VoluteState;
type TrainPose = readonly (readonly [number, ChargeId, MachineryKind | null])[];
export interface VoluteDebugApi {
  readonly version: number;
  reset: Pose;
  reconcile: Pose;
  snapshot(state: ReadState): ReturnType<typeof snapshot>;
  setScreen(state: ReadState, name: ScreenName): VoluteState;
  setLevel(state: ReadState, level: number): VoluteState;
  setScore(state: ReadState, n: number): VoluteState;
  setCells(state: ReadState, n: number): VoluteState;
  setChainStep(state: ReadState, k: number): VoluteState;
  startLevel(state: ReadState, level: number): VoluteState;
  poseTrain(state: ReadState, cores: TrainPose): VoluteState;
  clearTrain: Pose;
  setLoaded(state: ReadState, charge: ChargeId): VoluteState;
  setQueued(state: ReadState, charge: ChargeId): VoluteState;
  setAim(state: ReadState, angleDegrees: number): VoluteState;
  fire: Pose;
  setPressure(state: ReadState, value: number): VoluteState;
  setQuotaRemaining(state: ReadState, n: number): VoluteState;
  setEmission(state: ReadState, enabled: boolean): VoluteState;
  setNextEmitted(state: ReadState, charge: ChargeId | null): VoluteState;
  setFeed(state: ReadState, enabled: boolean): VoluteState;
  grantMachinery(
    state: ReadState,
    kind: Exclude<MachineryKind, "bore">,
  ): VoluteState;
  pause: Pose;
  resume: Pose;
}

export const BACKGROUND = "#081219";
const COLORS: Record<ChargeId, string> = {
  halide: "#6fe4dc",
  sulfur: "#f9c55b",
  cobalt: "#6e9fff",
  garnet: "#ee7098",
  olivine: "#a9dc75",
};
const spriteNames = [
  ...CHARGE_IDS.map((c) => `core-${c}`),
  ...MACHINERY_KINDS.map((m) => `mark-${m}`),
  "injector-base",
  "injector-barrel",
  "intake-maw",
  "channel-plate",
  "hud-cell",
  "hud-pressure",
];
const sheets = { recoil: 4, swallow: 6, flash: 6 } as const;
const particleNames = ["extraction", "bore", "swallow", "pickup"] as const;
const sprites: Record<string, ImageBitmap> = {};
const frames: Record<string, ImageBitmap[]> = {};
const systems: Record<string, ParticleSystem> = {};
type Effect = {
  kind: string;
  x: number;
  y: number;
  age: number;
  tint?: string;
  player?: ParticleCanvasPlayer;
};
let effects: Effect[] = [];
let effectDelta = 0;
let lastRenderTime = 0;

function assertNumber(
  n: number,
  name: string,
  min = -Infinity,
  max = Infinity,
  integer = false,
): void {
  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    throw new RangeError(`${name}: ${String(n)}`);
}
function assertOne<T extends string>(
  v: T,
  choices: readonly T[],
  name: string,
): void {
  if (!choices.includes(v)) throw new RangeError(`${name}: ${String(v)}`);
}
const norm = (angle: number): number => ((angle % 360) + 360) % 360;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
const random = <T>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)]!;
const clone = (s: ReadState): VoluteState => ({
  ...s,
  cores: s.cores.map((c) => ({ ...c })),
  segments: s.segments.map((g) => ({ ...g })),
  projectiles: s.projectiles.map((p) => ({ ...p })),
  machinery: s.machinery && { ...s.machinery },
});
function titleState(s?: ReadState): VoluteState {
  return {
    screen: "title",
    score: 0,
    level: 1,
    cells: CELLS,
    quotaRemaining: LEVELS[0]!.quota,
    pressure: 0,
    chainStep: 1,
    chainTimer: 0,
    machinery: null,
    cores: [],
    segments: [],
    projectiles: [],
    loaded: null,
    queued: null,
    aim: AIM_START,
    fireCooldown: 0,
    interlude: 0,
    simTime: 0,
    accumulator: 0,
    emission: s?.emission ?? true,
    feed: s?.feed ?? true,
    nextEmitted: null,
    muted: s?.muted ?? false,
  };
}
const markAt = (index: number): MachineryKind | null =>
  index % MARK_INTERVAL === 0
    ? MACHINERY_KINDS[(index / MARK_INTERVAL - 1) % MACHINERY_KINDS.length]!
    : null;
function chargeDraw(s: ReadState, level = s.level): ChargeId {
  const distinct = [...new Set(s.cores.map((c) => c.charge))];
  return random(distinct.length ? distinct : LEVELS[level - 1]!.charges);
}
function startLevel(s: ReadState, level: number): VoluteState {
  assertNumber(level, "level", 1, LEVEL_COUNT, true);
  const charges = LEVELS[level - 1]!.charges;
  const cores: CoreState[] = Array.from({ length: SEEDED_CORES }, (_, i) => ({
    s: SEEDED_HEAD_S - i * SPACING,
    charge: random(charges),
    mark: markAt(i + 1),
  }));
  return {
    ...clone(s),
    screen: "playing",
    level,
    quotaRemaining: LEVELS[level - 1]!.quota - SEEDED_CORES,
    pressure: 0,
    chainStep: 1,
    chainTimer: 0,
    machinery: null,
    cores,
    segments: [{ count: SEEDED_CORES, hold: 0 }],
    projectiles: [],
    loaded: random(charges),
    queued: random(charges),
    fireCooldown: 0,
    interlude: 0,
    accumulator: 0,
    nextEmitted: null,
  };
}
function point(s: number): { x: number; y: number; fx: number; fy: number } {
  if (s <= 0) return { ...CHANNEL[0]!, fx: 1, fy: 0 };
  for (let i = CHANNEL.length - 2; i >= 0; i--) {
    const a = CHANNEL[i]!,
      b = CHANNEL[i + 1]!;
    const distance = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    const origin = CHANNEL.slice(0, i).reduce(
      (v, p, j) =>
        v +
        Math.abs(CHANNEL[j + 1]!.x - p.x) +
        Math.abs(CHANNEL[j + 1]!.y - p.y),
      0,
    );
    if (s >= origin) {
      const fx = (b.x - a.x) / distance,
        fy = (b.y - a.y) / distance;
      return { x: a.x + fx * (s - origin), y: a.y + fy * (s - origin), fx, fy };
    }
  }
  return { ...CHANNEL[0]!, fx: 1, fy: 0 };
}
const feedSpeed = (s: ReadState): number =>
  LEVELS[s.level - 1]!.feedSpeed *
  (1 + s.pressure / PRESSURE_MAX) *
  (s.machinery?.kind === "choke" ? CHOKE_FEED_MULTIPLIER : 1);
const danger = (s: ReadState): boolean =>
  (s.cores[0]?.s ?? -Infinity) >= DANGER_S;
function segmentIndex(s: ReadState, i: number): number {
  let end = 0;
  for (let j = 0; j < s.segments.length; j++) {
    end += s.segments[j]!.count;
    if (i < end) return j;
  }
  return Math.max(0, s.segments.length - 1);
}
function snapshot(s: ReadState) {
  return {
    version: VOLUTE_DEBUG_VERSION,
    screen: s.screen,
    score: s.score,
    level: s.level,
    cells: s.cells,
    quotaRemaining: s.quotaRemaining,
    emitted: LEVELS[s.level - 1]!.quota - s.quotaRemaining,
    pressure: s.pressure,
    feedSpeed: feedSpeed(s),
    chainStep: s.chainStep,
    chainTimer: s.chainTimer,
    interlude: s.interlude,
    danger: danger(s),
    train: s.cores.map((c, i) => ({
      s: c.s,
      x: point(c.s).x,
      y: point(c.s).y,
      charge: c.charge,
      mark: c.mark,
      segment: segmentIndex(s, i),
    })),
    segments: s.segments.map((g) => ({ ...g })),
    injector: {
      aim: s.aim,
      cooldown: s.fireCooldown,
      loaded: s.loaded,
      queued: s.queued,
    },
    projectiles: s.projectiles.map((p) => ({ ...p })),
    machinery: s.machinery && { ...s.machinery },
    emission: s.emission,
    feed: s.feed,
    nextEmitted: s.nextEmitted,
    muted: s.muted,
    simTime: s.simTime,
  };
}
function reconcile(s: ReadState): VoluteState {
  const groups: SegmentState[] = [];
  let count = 0;
  for (let i = 0; i < s.cores.length; i++) {
    if (i && Math.abs(s.cores[i - 1]!.s - s.cores[i]!.s - SPACING) > 1e-6) {
      groups.push({ count, hold: s.segments[groups.length]?.hold ?? 0 });
      count = 0;
    }
    count++;
  }
  if (count) groups.push({ count, hold: s.segments[groups.length]?.hold ?? 0 });
  return { ...clone(s), segments: groups };
}
function fire(s: ReadState): VoluteState {
  const loaded = s.loaded ?? chargeDraw(s);
  return {
    ...clone(s),
    projectiles: [
      ...s.projectiles.map((p) => ({ ...p })),
      { charge: loaded, x: INJECTOR_X, y: INJECTOR_Y, angle: s.aim },
    ],
    loaded: s.queued ?? chargeDraw(s),
    queued: chargeDraw(s),
    fireCooldown: FIRE_COOLDOWN,
  };
}
export const debug: VoluteDebugApi = {
  version: VOLUTE_DEBUG_VERSION,
  reset: titleState,
  reconcile,
  snapshot,
  setScreen: (s, name) => {
    assertOne(name, SCREENS, "screen");
    return { ...clone(s), screen: name };
  },
  setLevel: (s, level) => {
    assertNumber(level, "level", 1, LEVEL_COUNT, true);
    return { ...clone(s), level };
  },
  setScore: (s, score) => {
    assertNumber(score, "score", 0, Infinity, true);
    return { ...clone(s), score };
  },
  setCells: (s, cells) => {
    assertNumber(cells, "cells", 0, CELLS, true);
    return { ...clone(s), cells };
  },
  setChainStep: (s, chainStep) => {
    assertNumber(chainStep, "chainStep", 1, Infinity, true);
    return { ...clone(s), chainStep, chainTimer: CHAIN_RESET };
  },
  startLevel,
  poseTrain: (s, data) => {
    const cores = data
      .map(([arc, charge, mark]) => {
        assertNumber(arc, "s", -Infinity, PATH_LENGTH);
        assertOne(charge, CHARGE_IDS, "charge");
        if (mark !== null) assertOne(mark, MACHINERY_KINDS, "mark");
        return { s: arc, charge, mark };
      })
      .sort((a, b) => b.s - a.s);
    return reconcile({ ...clone(s), cores, segments: [] });
  },
  clearTrain: (s) => ({
    ...clone(s),
    cores: [],
    segments: [],
    projectiles: [],
  }),
  setLoaded: (s, loaded) => {
    assertOne(loaded, CHARGE_IDS, "loaded");
    return { ...clone(s), loaded };
  },
  setQueued: (s, queued) => {
    assertOne(queued, CHARGE_IDS, "queued");
    return { ...clone(s), queued };
  },
  setAim: (s, angle) => {
    assertNumber(angle, "angle");
    return { ...clone(s), aim: norm(angle) };
  },
  fire: (s) => fire({ ...s, fireCooldown: 0 }),
  setPressure: (s, pressure) => {
    assertNumber(pressure, "pressure", PRESSURE_MIN, PRESSURE_MAX);
    return { ...clone(s), pressure };
  },
  setQuotaRemaining: (s, quotaRemaining) => {
    assertNumber(quotaRemaining, "quotaRemaining", 0, Infinity, true);
    return { ...clone(s), quotaRemaining };
  },
  setEmission: (s, emission) => {
    if (typeof emission !== "boolean") throw new TypeError("emission");
    return { ...clone(s), emission };
  },
  setNextEmitted: (s, nextEmitted) => {
    if (nextEmitted !== null) assertOne(nextEmitted, CHARGE_IDS, "nextEmitted");
    return { ...clone(s), nextEmitted };
  },
  setFeed: (s, feed) => {
    if (typeof feed !== "boolean") throw new TypeError("feed");
    return { ...clone(s), feed };
  },
  grantMachinery: (s, kind) => {
    if ((kind as MachineryKind) === "bore" || !MACHINERY_KINDS.includes(kind))
      throw new RangeError("machinery");
    return {
      ...clone(s),
      machinery: { kind, remaining: MACHINERY_DURATIONS[kind] },
    };
  },
  pause: (s) => ({ ...clone(s), screen: "paused" }),
  resume: (s) => ({ ...clone(s), screen: "playing" }),
};

function emit(s: VoluteState): VoluteState {
  if (
    !s.emission ||
    s.quotaRemaining <= 0 ||
    s.machinery?.kind === "backflow" ||
    (s.cores[s.cores.length - 1]?.s ?? SPACING) < SPACING
  )
    return s;
  const index = LEVELS[s.level - 1]!.quota - s.quotaRemaining + 1;
  const core: CoreState = {
    s: 0,
    charge: s.nextEmitted ?? chargeDraw(s),
    mark: markAt(index),
  };
  return reconcile({
    ...s,
    cores: [...s.cores, core],
    quotaRemaining: s.quotaRemaining - 1,
    nextEmitted: null,
  });
}
function addEffect(kind: string, x: number, y: number, tint?: string): void {
  effects.push({ kind, x, y, age: 0, tint });
}
function remove(
  s: VoluteState,
  indices: number[],
  front: number,
  bore = false,
): VoluteState {
  const taken = new Set(indices);
  const cores = s.cores.filter((_, i) => !taken.has(i)).map((c) => ({ ...c }));
  const groups: { start: number; end: number }[] = [];
  for (let i = 0; i < cores.length; i++) {
    if (cores[i]!.s >= front) continue;
    if (
      i === 0 ||
      cores[i - 1]!.s - cores[i]!.s !== SPACING ||
      cores[i - 1]!.s >= front
    )
      groups.push({ start: i, end: i });
    else groups[groups.length - 1]!.end = i;
  }
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!,
      tail = cores[g.end]!.s,
      behind = groups[i + 1];
    const room = Math.min(
      tail,
      behind ? tail - cores[behind.start]!.s - SPACING : RECOIL,
    );
    const moved = clamp(room, 0, RECOIL);
    for (let j = g.start; j <= g.end; j++)
      cores[j] = { ...cores[j]!, s: cores[j]!.s - moved };
  }
  const next = reconcile({
    ...s,
    cores,
    pressure: clamp(
      s.pressure - indices.length * PRESSURE_DROP_PER_CORE,
      PRESSURE_MIN,
      PRESSURE_MAX,
    ),
  });
  if (groups.length) {
    let cursor = 0;
    const segments = next.segments.map((g) => {
      const group = groups.some(
        (part) => cursor >= part.start && cursor <= part.end,
      );
      cursor += g.count;
      return { ...g, hold: group ? RECOIL_HOLD : g.hold };
    });
    return {
      ...next,
      segments,
      score:
        next.score +
        (bore ? SCORE_PER_CORE * indices.length * next.chainStep : 0),
    };
  }
  if (bore)
    return {
      ...next,
      score: next.score + SCORE_PER_CORE * indices.length * next.chainStep,
    };
  return next;
}
function extraction(
  s: VoluteState,
  start: number,
  end: number,
  merge: boolean,
  cues: Set<string>,
): VoluteState {
  const run = s.cores.slice(start, end + 1),
    k = merge ? s.chainStep + 1 : 1;
  const front = run[0]!.s;
  let next = remove(
    { ...s, chainStep: k, chainTimer: CHAIN_RESET },
    Array.from({ length: end - start + 1 }, (_, i) => i + start),
    front,
  );
  next = { ...next, score: next.score + SCORE_PER_CORE * run.length * k };
  cues.add(EXTRACT_CUES[Math.min(k, EXTRACT_CUES.length) - 1]!);
  for (const core of run) {
    const p = point(core.s);
    addEffect("extraction", p.x, p.y, COLORS[core.charge]);
    addEffect("flash", p.x, p.y, COLORS[core.charge]);
  }
  for (const core of run)
    if (core.mark) {
      cues.add(CUES.machinery);
      const p = point(core.s);
      addEffect("pickup", p.x, p.y);
      if (core.mark === "bore") {
        const ids = next.cores.flatMap((c, i) => {
          const q = point(c.s);
          return Math.hypot(q.x - p.x, q.y - p.y) <= BORE_RADIUS ? [i] : [];
        });
        addEffect("bore", p.x, p.y);
        if (ids.length) next = remove(next, ids, next.cores[ids[0]!]!.s, true);
      } else
        next = {
          ...next,
          machinery: {
            kind: core.mark,
            remaining: MACHINERY_DURATIONS[core.mark],
          },
        };
    }
  return next;
}
function runAt(
  s: VoluteState,
  index: number,
  merge: boolean,
  cues: Set<string>,
): VoluteState {
  if (!s.cores[index]) return s;
  const charge = s.cores[index]!.charge,
    seg = segmentIndex(s, index);
  let a = index,
    b = index;
  while (
    a > 0 &&
    segmentIndex(s, a - 1) === seg &&
    s.cores[a - 1]!.charge === charge
  )
    a--;
  while (
    b + 1 < s.cores.length &&
    segmentIndex(s, b + 1) === seg &&
    s.cores[b + 1]!.charge === charge
  )
    b++;
  return b - a + 1 >= MIN_RUN ? extraction(s, a, b, merge, cues) : s;
}
function advanceTrain(s: VoluteState, cues: Set<string>): VoluteState {
  if (!s.feed || !s.cores.length) return s;
  if (s.machinery?.kind === "backflow") {
    const cores = s.cores.map((c) => ({ ...c }));
    for (let i = cores.length - 1; i >= 0; i--) {
      const c = cores[i]!;
      if (c.s < 0) continue;
      const floor = i + 1 < cores.length ? cores[i + 1]!.s + SPACING : 0;
      cores[i] = { ...c, s: Math.max(floor, c.s - BACKFLOW_SPEED * TICK_DT) };
    }
    return reconcile({ ...s, cores });
  }
  let next = s,
    offset = 0;
  const original = s.segments.map((g) => ({ ...g }));
  for (let gi = 0; gi < original.length; gi++) {
    const count = original[gi]!.count,
      hold = original[gi]!.hold;
    if (offset >= next.cores.length) break;
    const cores = next.cores.map((c) => ({ ...c }));
    let travel =
      hold > 0 ? 0 : (gi === 0 ? feedSpeed(next) : CATCHUP_SPEED) * TICK_DT;
    if (gi > 0 && offset > 0)
      travel = Math.min(
        travel,
        cores[offset - 1]!.s - cores[offset]!.s - SPACING,
      );
    for (let j = offset; j < Math.min(offset + count, cores.length); j++)
      cores[j] = { ...cores[j]!, s: cores[j]!.s + Math.max(0, travel) };
    next = reconcile({ ...next, cores });
    const beforeExtraction = next.cores.length;
    if (
      gi > 0 &&
      offset > 0 &&
      Math.abs(next.cores[offset - 1]!.s - next.cores[offset]!.s - SPACING) <
        1e-6 &&
      next.cores[offset - 1]!.charge === next.cores[offset]!.charge
    )
      next = runAt(next, offset, true, cues);
    offset += count - (beforeExtraction - next.cores.length);
  }
  return next;
}
function projectiles(s: VoluteState, cues: Set<string>): VoluteState {
  let next = s;
  const flying: ProjectileState[] = [];
  for (const shot of s.projectiles) {
    const rad = (shot.angle * Math.PI) / 180,
      moved = {
        ...shot,
        x: shot.x + Math.cos(rad) * PROJECTILE_SPEED * TICK_DT,
        y: shot.y + Math.sin(rad) * PROJECTILE_SPEED * TICK_DT,
      };
    if (moved.x < 0 || moved.x > FIELD_W || moved.y < 0 || moved.y > FIELD_H)
      continue;
    let hit = -1,
      dist = Infinity;
    for (let i = 0; i < next.cores.length; i++) {
      const q = point(next.cores[i]!.s),
        d = Math.hypot(q.x - moved.x, q.y - moved.y);
      if (d <= STRIKE_DISTANCE && d < dist) {
        hit = i;
        dist = d;
      }
    }
    if (hit < 0) {
      flying.push(moved);
      continue;
    }
    cues.add(CUES.seat);
    const struck = next.cores[hit]!,
      q = point(struck.s),
      ahead = (moved.x - q.x) * q.fx + (moved.y - q.y) * q.fy > 0;
    const p = struck.s - (ahead ? 0 : SPACING);
    const inserted: CoreState = { s: p, charge: moved.charge, mark: null };
    const cores = next.cores.map((c) => ({
      ...c,
      s: c.s <= p ? c.s - SPACING : c.s,
    }));
    const at = ahead ? hit : hit + 1;
    cores.splice(at, 0, inserted);
    next = reconcile({ ...next, cores });
    next = runAt(next, at, false, cues);
  }
  return { ...next, projectiles: flying };
}
function tick(s: VoluteState, cues: Set<string>): VoluteState {
  let next: VoluteState = {
    ...s,
    fireCooldown: Math.max(0, s.fireCooldown - TICK_DT),
    chainTimer: Math.max(0, s.chainTimer - TICK_DT),
    chainStep:
      s.chainTimer > 0 && s.chainTimer - TICK_DT <= 0 ? 1 : s.chainStep,
    machinery:
      s.machinery && s.machinery.remaining > TICK_DT
        ? { ...s.machinery, remaining: s.machinery.remaining - TICK_DT }
        : null,
    segments: s.segments.map((g) => ({
      ...g,
      hold: Math.max(0, g.hold - TICK_DT),
    })),
  };
  next = advanceTrain(next, cues);
  next = projectiles(next, cues);
  const count = next.cores.length;
  next = {
    ...next,
    pressure: clamp(
      next.pressure +
        (count > PRESSURE_FREE
          ? (count - PRESSURE_FREE) * PRESSURE_RISE_PER_CORE
          : -PRESSURE_BLEED) *
          TICK_DT,
      PRESSURE_MIN,
      PRESSURE_MAX,
    ),
  };
  if ((next.cores[0]?.s ?? -Infinity) >= INTAKE_S) {
    cues.add(CUES.intake);
    cues.add(CUES.cellLost);
    addEffect("swallow", point(INTAKE_S).x, point(INTAKE_S).y);
    addEffect("swallow-animation", point(INTAKE_S).x, point(INTAKE_S).y);
    const cells = next.cells - 1;
    return {
      ...next,
      cells,
      screen: cells <= 0 ? "gameover" : "setback",
      cores: [],
      segments: [],
      projectiles: [],
      pressure: 0,
      machinery: null,
      chainStep: 1,
      chainTimer: 0,
      quotaRemaining: LEVELS[next.level - 1]!.quota - SEEDED_CORES,
      interlude: cells <= 0 ? 0 : INTERLUDE,
      accumulator: 0,
    };
  }
  if (!next.cores.length && next.quotaRemaining === 0) {
    cues.add(CUES.levelClear);
    return {
      ...next,
      score: next.score + CLEAR_SCORE,
      screen: next.level === LEVEL_COUNT ? "victory" : "cleared",
      interlude: next.level === LEVEL_COUNT ? 0 : INTERLUDE,
      accumulator: 0,
    };
  }
  return emit(next);
}

function playCues(api: UpdateApi, cues: Set<string>): void {
  for (const cue of cues) api.audio.play(cue);
}
function music(s: ReadState, api: UpdateApi): void {
  const cue =
    s.screen === "playing"
      ? danger(s)
        ? CUES.dangerLoop
        : CUES.hallLoop
      : null;
  for (const bed of [CUES.hallLoop, CUES.dangerLoop])
    if (bed !== cue && api.audio.looping(bed)) api.audio.stop(bed);
  if (cue && !api.audio.looping(cue)) api.audio.loop(cue);
}
function update(state: ReadState, api: UpdateApi, dt: number): VoluteState {
  let s: VoluteState = {
    ...clone(state),
    simTime: state.simTime + Math.max(0, dt),
    muted: api.audio.muted(),
  };
  if (api.input.pressed("mute")) {
    api.audio.setMuted(!api.audio.muted());
    s = { ...s, muted: api.audio.muted() };
  }
  const pointer = api.input.pointer(),
    pressed = api.input.pointerPressed();
  const inside =
    pointer.x >= 0 &&
    pointer.x <= FIELD_W &&
    pointer.y >= 0 &&
    pointer.y <= FIELD_H;
  if (
    s.screen === "title" ||
    s.screen === "gameover" ||
    s.screen === "victory"
  ) {
    if (api.input.pressed("confirm") || (pressed && inside))
      s =
        s.screen === "title"
          ? startLevel({ ...s, score: 0, cells: CELLS }, 1)
          : titleState(s);
  } else if (s.screen === "paused") {
    if (api.input.pressed("pause")) s = { ...s, screen: "playing" };
  } else if (s.screen === "cleared" || s.screen === "setback") {
    const left = s.interlude - Math.max(0, dt);
    s =
      left <= 0
        ? startLevel(s, s.screen === "cleared" ? s.level + 1 : s.level)
        : { ...s, interlude: left };
  } else if (s.screen === "playing") {
    if (api.input.pressed("pause"))
      s = { ...s, screen: "paused", accumulator: 0 };
    else {
      if (
        api.input.pointerSamples().length &&
        !(pointer.x === INJECTOR_X && pointer.y === INJECTOR_Y)
      )
        s = {
          ...s,
          aim: norm(
            (Math.atan2(pointer.y - INJECTOR_Y, pointer.x - INJECTOR_X) * 180) /
              Math.PI,
          ),
        };
      const turn = api.input.value("right") - api.input.value("left");
      if (turn) s = { ...s, aim: norm(s.aim + turn * AIM_TURN_RATE * dt) };
      const cues = new Set<string>();
      if (api.input.pressed("b")) {
        s = { ...s, loaded: s.queued, queued: s.loaded };
        cues.add(CUES.swap);
      }
      if (api.input.pressed("a") || (pressed && inside)) {
        if (s.fireCooldown > 0) cues.add(CUES.denied);
        else {
          s = fire(s);
          cues.add(CUES.fire);
        }
      }
      playCues(api, cues);
      let accum = s.accumulator + Math.max(0, dt);
      while (accum + 1e-9 >= TICK_DT && s.screen === "playing") {
        const tickCues = new Set<string>();
        s = tick(s, tickCues);
        playCues(api, tickCues);
        music(s, api);
        accum -= TICK_DT;
      }
      s = { ...s, accumulator: s.screen === "playing" ? accum : 0 };
    }
  }
  music(s, api);
  effectDelta = Math.max(0, dt);
  return s;
}

function image(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
): void {
  const im = sprites[name];
  if (im)
    ctx.drawImage(
      im,
      x - (w ?? im.width) / 2,
      y - (h ?? im.height) / 2,
      w ?? im.width,
      h ?? im.height,
    );
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 18,
  color = "#d9e8e6",
  align: CanvasTextAlign = "left",
): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "#0b1b24e8";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#62838a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = "#23454b";
  ctx.fillRect(x + 8, y + 8, w - 16, 2);
}
function hall(ctx: CanvasRenderingContext2D, s: ReadState): void {
  ctx.fillStyle = "#0d1a21";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.strokeStyle = "#172c34";
  ctx.lineWidth = 1;
  for (let x = 0; x < FIELD_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_H);
    ctx.stroke();
  }
  for (let y = 0; y < FIELD_H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD_W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#31434a";
  ctx.lineWidth = 36;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  CHANNEL.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = "#16272f";
  ctx.lineWidth = 30;
  ctx.stroke();
  for (let arc = 0; arc <= PATH_LENGTH; arc += 32) {
    const p = point(arc);
    image(ctx, "channel-plate", p.x, p.y, 30, 30);
  }
  ctx.strokeStyle = "#7b6343";
  ctx.lineWidth = 2;
  ctx.beginPath();
  CHANNEL.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  for (const c of s.cores) {
    const p = point(c.s);
    image(ctx, `core-${c.charge}`, p.x, p.y);
    if (c.mark) image(ctx, `mark-${c.mark}`, p.x, p.y);
  }
  image(
    ctx,
    "intake-maw",
    CHANNEL[CHANNEL.length - 1]!.x,
    CHANNEL[CHANNEL.length - 1]!.y,
  );
  if (s.machinery?.kind === "sightline") {
    const r = (s.aim * Math.PI) / 180;
    const dx = Math.cos(r),
      dy = Math.sin(r);
    const exits = [
      dx > 0
        ? (FIELD_W - INJECTOR_X) / dx
        : dx < 0
          ? -INJECTOR_X / dx
          : Infinity,
      dy > 0
        ? (FIELD_H - INJECTOR_Y) / dy
        : dy < 0
          ? -INJECTOR_Y / dy
          : Infinity,
    ];
    let reach = Math.min(...exits);
    for (const core of s.cores) {
      const p = point(core.s),
        vx = p.x - INJECTOR_X,
        vy = p.y - INJECTOR_Y;
      const along = vx * dx + vy * dy;
      const across = vx * vx + vy * vy - along * along;
      if (along < 0 || across > CORE_RADIUS * CORE_RADIUS) continue;
      reach = Math.min(
        reach,
        along - Math.sqrt(CORE_RADIUS * CORE_RADIUS - across),
      );
    }
    ctx.strokeStyle = "#d8f4a280";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(INJECTOR_X, INJECTOR_Y);
    ctx.lineTo(INJECTOR_X + dx * reach, INJECTOR_Y + dy * reach);
    ctx.stroke();
  }
  image(ctx, "injector-base", INJECTOR_X, INJECTOR_Y);
  ctx.save();
  ctx.translate(INJECTOR_X, INJECTOR_Y);
  ctx.rotate((s.aim * Math.PI) / 180);
  image(ctx, "injector-barrel", 15, 0);
  ctx.restore();
  if (s.loaded) image(ctx, `core-${s.loaded}`, INJECTOR_X, INJECTOR_Y, 22, 22);
  for (const p of s.projectiles) image(ctx, `core-${p.charge}`, p.x, p.y);
}
function hud(ctx: CanvasRenderingContext2D, s: ReadState): void {
  panel(ctx, 264, 148, 398, 56);
  text(ctx, `SCORE ${String(s.score).padStart(5, "0")}`, 279, 172, 16);
  text(ctx, `LEVEL ${s.level}/${LEVEL_COUNT}`, 500, 172, 16);
  text(ctx, "CELLS", 278, 194, 12, "#8aabb0");
  for (let i = 0; i < s.cells; i++)
    image(ctx, "hud-cell", 336 + i * 24, 186, 20, 20);
  image(ctx, "hud-pressure", 463, 186, 20, 20);
  ctx.fillStyle = "#23434b";
  ctx.fillRect(480, 182, 160, 8);
  ctx.fillStyle = s.pressure >= 70 ? "#ef7990" : "#efc775";
  ctx.fillRect(480, 182, (160 * s.pressure) / PRESSURE_MAX, 8);
  text(ctx, "LOAD", 304, 270, 13, "#8aabb0");
  if (s.loaded) image(ctx, `core-${s.loaded}`, 340, 294);
  text(ctx, "NEXT", 584, 270, 13, "#8aabb0");
  if (s.queued) image(ctx, `core-${s.queued}`, 620, 294);
  if (danger(s)) {
    ctx.fillStyle = "#e8546670";
    ctx.fillRect(0, 0, FIELD_W, 8);
    text(ctx, "INTAKE WARNING", FIELD_W / 2, 254, 20, "#ff8890", "center");
  }
}
function overlay(ctx: CanvasRenderingContext2D, s: ReadState): void {
  if (s.screen === "playing") return;
  ctx.fillStyle = "#061117ca";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  if (s.screen === "title") {
    text(ctx, TITLE_TEXT, FIELD_W / 2, 190, 78, "#f5d58b", "center");
    text(
      ctx,
      "THE GEOTHERMAL PUMP HALL",
      FIELD_W / 2,
      226,
      18,
      "#94bec2",
      "center",
    );
    text(
      ctx,
      "AIM  MOUSE / A D       FIRE  CLICK / SPACE",
      FIELD_W / 2,
      303,
      17,
      "#d9e8e6",
      "center",
    );
    text(
      ctx,
      "SWAP  X      PAUSE  ESC / P      MUTE  M",
      FIELD_W / 2,
      335,
      17,
      "#d9e8e6",
      "center",
    );
    text(
      ctx,
      "PRESS ENTER, SPACE OR CLICK TO START",
      FIELD_W / 2,
      406,
      20,
      "#f5d58b",
      "center",
    );
  } else if (s.screen === "paused") {
    text(ctx, "PAUSED", FIELD_W / 2, 274, 48, "#f5d58b", "center");
    text(ctx, "ESC OR P TO RESUME", FIELD_W / 2, 315, 18, "#d9e8e6", "center");
  } else if (s.screen === "cleared") {
    text(
      ctx,
      `LEVEL ${s.level} CLEAR`,
      FIELD_W / 2,
      272,
      42,
      "#f5d58b",
      "center",
    );
    text(ctx, `SCORE ${s.score}`, FIELD_W / 2, 313, 20, "#d9e8e6", "center");
  } else if (s.screen === "setback") {
    text(ctx, "CELL SPENT", FIELD_W / 2, 272, 42, "#ef8292", "center");
    text(
      ctx,
      `${s.cells} CELLS REMAIN`,
      FIELD_W / 2,
      313,
      20,
      "#d9e8e6",
      "center",
    );
  } else {
    text(
      ctx,
      s.screen === "victory" ? "HALL CLEARED" : "RUN ENDED",
      FIELD_W / 2,
      247,
      46,
      s.screen === "victory" ? "#f5d58b" : "#ef8292",
      "center",
    );
    text(
      ctx,
      `FINAL SCORE ${s.score}  •  LEVEL ${s.level}`,
      FIELD_W / 2,
      297,
      19,
      "#d9e8e6",
      "center",
    );
    text(
      ctx,
      "PRESS ENTER, SPACE OR CLICK",
      FIELD_W / 2,
      370,
      18,
      "#d9e8e6",
      "center",
    );
  }
}
function render(state: ReadState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  hall(ctx, state);
  if (
    state.screen !== "title" &&
    state.screen !== "gameover" &&
    state.screen !== "victory"
  )
    hud(ctx, state);
  const delta = state.simTime === lastRenderTime ? 0 : effectDelta;
  lastRenderTime = state.simTime;
  effects = effects.filter((e) => e.age < 0.65);
  for (const effect of effects) {
    effect.age += delta;
    if (effect.kind === "flash" || effect.kind === "swallow-animation") {
      const frame = Math.min(5, Math.floor(effect.age / 0.055));
      const im = frames[effect.kind === "flash" ? "flash" : "swallow"]?.[frame];
      if (im) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - effect.age / 0.35);
        ctx.drawImage(im, effect.x - im.width / 2, effect.y - im.height / 2);
        if (effect.kind === "flash" && effect.tint) {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = effect.tint;
          ctx.fillRect(
            effect.x - im.width / 2,
            effect.y - im.height / 2,
            im.width,
            im.height,
          );
        }
        ctx.restore();
      }
      continue;
    }
    const system = systems[effect.kind];
    if (!system) continue;
    if (!effect.player) {
      const viewport = api.viewport();
      const placed: ParticleSystem = {
        ...system,
        field: { width: ctx.canvas.width, height: ctx.canvas.height },
        emitters: system.emitters.map((em) => ({
          ...em,
          particle:
            effect.kind === "extraction" && effect.tint
              ? {
                  ...em.particle,
                  colorGradient: [
                    { at: 0, color: "#ffffff" },
                    { at: 0.25, color: effect.tint },
                    { at: 1, color: effect.tint },
                  ],
                }
              : em.particle,
          position: [
            viewport.offsetX + effect.x * viewport.scale,
            ctx.canvas.height - viewport.offsetY - effect.y * viewport.scale,
            0,
          ],
        })),
      };
      effect.player = new ParticleCanvasPlayer(placed, ctx, {
        clear: false,
        pixelRadius: 3 * viewport.scale,
        composite: "lighter",
      });
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    effect.player.update(delta);
    ctx.restore();
  }
  if (state.fireCooldown > 0 && state.screen === "playing") {
    const index = Math.min(
      3,
      Math.floor(((FIRE_COOLDOWN - state.fireCooldown) / FIRE_COOLDOWN) * 4),
    );
    const im = frames.recoil?.[index];
    if (im) {
      ctx.save();
      ctx.translate(INJECTOR_X, INJECTOR_Y);
      ctx.rotate((state.aim * Math.PI) / 180);
      ctx.drawImage(im, -7, -10);
      ctx.restore();
    }
  }
  overlay(ctx, state);
}

export const game: Game<VoluteState, VoluteDebugApi> = {
  async initialize(api) {
    for (const action of ACTIONS)
      api.input.register(action, { keys: [...BINDINGS[action]] });
    await Promise.all(
      spriteNames.map(async (name) => {
        sprites[name] = await api.assets.loadImage(`sprites/${name}.png`);
      }),
    );
    await Promise.all(
      Object.entries(sheets).flatMap(([name, count]) =>
        Array.from({ length: count }, async (_, i) => {
          const im = await api.assets.loadImage(`sheets/${name}-${i}.png`);
          (frames[name] ??= [])[i] = im;
        }),
      ),
    );
    await Promise.all(
      particleNames.map(async (name) => {
        const blob = await api.assets.load(`particles/${name}/system.json`);
        systems[name] = JSON.parse(await blob.text()) as ParticleSystem;
      }),
    );
    await Promise.all(
      Object.values(CUES).map(async (cue) => {
        await api.audio.load(cue, `audio/${cue}.wav`);
      }),
    );
    const register = (
      name: string,
      source: (s: ReadState) => string | number | boolean,
    ) => api.diagnostics.register(name, source);
    register("screen", (s) => s.screen);
    register("level/score", (s) => `${s.level} / ${s.score}`);
    register("cells/quota", (s) => `${s.cells} / ${s.quotaRemaining}`);
    register(
      "pressure/feed",
      (s) => `${s.pressure.toFixed(1)} / ${feedSpeed(s).toFixed(1)}`,
    );
    register("chain", (s) => s.chainStep);
    register(
      "cores/head",
      (s) => `${s.cores.length} / ${s.cores[0]?.s.toFixed(1) ?? "-"}`,
    );
    register("segments", (s) => s.segments.length);
    register("danger", danger);
    register(
      "injector",
      (s) =>
        `${s.loaded ?? "-"}/${s.queued ?? "-"} ${s.aim.toFixed(1)} ${s.fireCooldown.toFixed(2)}`,
    );
    register("projectiles", (s) => s.projectiles.length);
    register("machinery", (s) =>
      s.machinery
        ? `${s.machinery.kind} ${s.machinery.remaining.toFixed(1)}`
        : "-",
    );
    return [titleState(), debug];
  },
  update,
  render,
};
