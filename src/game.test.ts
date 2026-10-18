import { describe, expect, it } from "vitest";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import { CELLS, LEVELS, TICK_DT } from "./constants";
import { debug, game } from "./game";
import type { VoluteState } from "./game";

const title: VoluteState = {
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
  aim: 270,
  fireCooldown: 0,
  interlude: 0,
  simTime: 0,
  accumulator: 0,
  emission: true,
  feed: true,
  nextEmitted: null,
  muted: false,
};
const played: string[] = [];
const loops = new Set<string>();
const api = {
  input: {
    value: () => 0,
    pressed: () => false,
    pointer: () => ({ x: 0, y: 0, down: false, device: "mouse", buttons: [] }),
    pointerPressed: () => false,
    pointerSamples: () => [],
  },
  audio: {
    muted: () => false,
    setMuted: () => undefined,
    play: (cue: string) => {
      played.push(cue);
    },
    looping: (cue: string) => loops.has(cue),
    loop: (cue: string) => {
      loops.add(cue);
    },
    stop: (cue: string) => {
      loops.delete(cue);
    },
  },
} as unknown as UpdateApi;
const step = (s: VoluteState, n = 1): VoluteState => {
  for (let i = 0; i < n; i++) s = game.update(s, api, TICK_DT);
  return s;
};

describe("Volute simulation", () => {
  it("poses a level and reports the same seeded train and quota", () => {
    const s = debug.startLevel(title, 1);
    const snap = debug.snapshot(s);
    expect(s.screen).toBe("playing");
    expect(snap.train).toHaveLength(12);
    expect(snap.train[0]?.s).toBe(308);
    expect(snap.train[11]?.s).toBe(0);
    expect(snap.emitted).toBe(12);
    expect(snap.segments).toEqual([{ count: 12, hold: 0 }]);
  });

  it("emits a posed charge and consumes the pose", () => {
    let s = debug.startLevel(title, 1);
    s = debug.poseTrain(s, []);
    s = debug.setNextEmitted(s, "garnet");
    s = step(s);
    expect(s.cores[0]?.charge).toBe("garnet");
    expect(s.nextEmitted).toBeNull();
    expect(s.quotaRemaining).toBe(32);
  });

  it("extracts a three core run created by a fired projectile", () => {
    let s = debug.startLevel(title, 1);
    s = debug.setEmission(s, false);
    s = debug.setFeed(s, false);
    s = debug.poseTrain(s, [
      [4860, "halide", null],
      [4832, "halide", null],
    ]);
    s = debug.setLoaded(s, "halide");
    s = debug.setAim(s, 0);
    s = debug.fire(s);
    s = step(s, 28);
    expect(s.cores).toHaveLength(0);
    expect(s.score).toBe(30);
    expect(played).toContain("extract-1");
  });

  it("spends one cell and resets the channel on intake", () => {
    let s = debug.startLevel(title, 1);
    s = debug.setEmission(s, false);
    s = debug.setFeed(s, false);
    s = debug.poseTrain(s, [[5000, "sulfur", null]]);
    s = step(s);
    expect(s.screen).toBe("setback");
    expect(s.cells).toBe(2);
    expect(s.cores).toHaveLength(0);
    expect(s.pressure).toBe(0);
  });

  it("extracts a run completed by segment catch-up at the next chain step", () => {
    let s = debug.startLevel(title, 1);
    s = debug.setEmission(s, false);
    s = debug.poseTrain(s, [
      [100, "cobalt", null],
      [72, "cobalt", null],
      [43, "cobalt", null],
    ]);
    s = step(s);
    expect(s.cores).toHaveLength(0);
    expect(s.score).toBe(60);
    expect(s.chainStep).toBe(2);
  });

  it("backflow packs cores toward the inlet without reversing their order", () => {
    let s = debug.startLevel(title, 1);
    s = debug.setEmission(s, false);
    s = debug.poseTrain(s, [
      [61, "halide", null],
      [30, "sulfur", null],
      [0, "cobalt", null],
    ]);
    s = debug.grantMachinery(s, "backflow");
    s = step(s, 3);
    expect(s.cores.map((c) => c.s)).toEqual([58, 28, 0]);
  });
});
