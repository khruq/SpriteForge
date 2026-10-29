// SpriteForge - library of ready-made clips. Each entry: [name, category, description, make(sprite) -> clip, options].
// Values are in sprite pixels (x, y), multipliers (sx, sy), degrees (rot) and 0..1 (alpha). y goes up.
const K = pairs => { const out = []; for (let i = 0; i < pairs.length; i += 2) out.push({ t: pairs[i], v: pairs[i + 1] }); return out; };
const T = (prop, ease, ...pairs) => ({ prop, ease, keys: K(pairs) });
const C = (dur, loop, ...tracks) => ({ dur, loop, tracks: tracks.filter(Boolean) });
const both = (ease, ...pairs) => [T("sx", ease, ...pairs), T("sy", ease, ...pairs)];
const fps = s => s.fps || 8;
const frameTrack = (s, dur) => s.frames.length > 1 ? T("frame", "step", ...s.frames.flatMap((_, i) => [i * dur / s.frames.length, i + 1])) : null;

export const CLIP_CATEGORIES = ["Idle", "Move", "Appear", "Disappear", "React", "Items", "Defeat", "Frames"];

export const CLIP_LIBRARY = [
  ["idle", "Idle", "Breathes: a slight stretch up and down", () => C(1.6, true, T("sy", "inOutSine", 0, 1, 0.8, 1.04, 1.6, 1), T("sx", "inOutSine", 0, 1, 0.8, 0.97, 1.6, 1))],
  ["float", "Idle", "Floats up and down", () => C(2.4, true, T("y", "inOutSine", 0, 0, 1.2, 3, 2.4, 0))],
  ["hover", "Idle", "Floats and tilts", () => C(2, true, T("y", "inOutSine", 0, 0, 1, 2, 2, 0), T("rot", "inOutSine", 0, -4, 1, 4, 2, -4))],
  ["sway", "Idle", "Leans left and right", () => C(2, true, T("rot", "inOutSine", 0, -6, 1, 6, 2, -6))],
  ["pendulum", "Idle", "Swings like a hanging sign", () => C(1.6, true, T("rot", "inOutSine", 0, -20, 0.8, 20, 1.6, -20))],
  ["pulse", "Idle", "Grows and shrinks gently", () => C(1, true, ...both("inOutSine", 0, 1, 0.5, 1.08, 1, 1))],
  ["heartbeat", "Idle", "Two quick beats, then a pause", () => C(1.2, true, ...both("outQuad", 0, 1, 0.08, 1.15, 0.2, 1, 0.3, 1.12, 0.45, 1, 1.2, 1))],
  ["wobble", "Idle", "Jelly wobble", () => C(1, true, T("sx", "inOutSine", 0, 1, 0.25, 1.08, 0.5, 0.94, 0.75, 1.04, 1, 1), T("sy", "inOutSine", 0, 1, 0.25, 0.93, 0.5, 1.06, 0.75, 0.97, 1, 1))],
  ["shiver", "Idle", "Shivers from the cold", () => C(0.2, true, T("x", "linear", 0, 0, 0.05, 0.5, 0.1, 0, 0.15, -0.5, 0.2, 0))],
  ["blink", "Idle", "Blinks like a warning light", () => C(0.8, true, T("alpha", "step", 0, 1, 0.4, 0.25))],
  ["glow", "Idle", "Soft opacity pulse", () => C(1.6, true, T("alpha", "inOutSine", 0, 1, 0.8, 0.6, 1.6, 1))],

  ["walk", "Move", "Walking bob; also plays the frames if there are several", s => C(0.5, true, T("y", "outQuad", 0, 0, 0.125, 1, 0.25, 0, 0.375, 1, 0.5, 0), T("rot", "inOutSine", 0, -3, 0.25, 3, 0.5, -3), frameTrack(s, 0.5))],
  ["run", "Move", "Fast bob, leaning forward", s => C(0.3, true, T("y", "outQuad", 0, 0, 0.075, 1.5, 0.15, 0, 0.225, 1.5, 0.3, 0), T("rot", "linear", 0, -8, 0.3, -8), frameTrack(s, 0.3))],
  ["hop", "Move", "Small hops in place", () => C(0.5, true, T("y", "outQuad", 0, 0, 0.22, 4, 0.44, 0, 0.5, 0), T("sy", "outQuad", 0, 1, 0.44, 1, 0.47, 0.88, 0.5, 1))],
  ["bounce", "Move", "Bounces with a squash on landing", () => C(0.6, true, T("y", "outQuad", 0, 0, 0.3, 6, 0.6, 0), T("sy", "outQuad", 0, 0.9, 0.15, 1.08, 0.45, 1, 0.6, 0.9))],
  ["jump", "Move", "One jump: crouch, fly up, land", () => C(0.8, false, T("sy", "outQuad", 0, 1, 0.1, 0.8, 0.2, 1.1, 0.6, 1, 0.7, 0.85, 0.8, 1), T("sx", "outQuad", 0, 1, 0.1, 1.15, 0.2, 0.92, 0.6, 1, 0.7, 1.12, 0.8, 1), T("y", "inOutQuad", 0, 0, 0.15, 0, 0.4, 10, 0.68, 0, 0.8, 0))],
  ["dash", "Move", "Quick dash forward and back", () => C(0.5, false, T("x", "outCubic", 0, 0, 0.15, 8, 0.5, 0), T("sx", "outQuad", 0, 1, 0.1, 1.2, 0.3, 1))],
  ["orbit", "Move", "Circles around its spot", () => C(2, true, T("x", "inOutSine", 0, 0, 0.5, 4, 1, 0, 1.5, -4, 2, 0), T("y", "inOutSine", 0, 4, 0.5, 0, 1, -4, 1.5, 0, 2, 4))],

  ["pop-in", "Appear", "Pops in with an overshoot", () => C(0.4, false, ...both("outBack", 0, 0, 0.4, 1))],
  ["fade-in", "Appear", "Fades in", () => C(0.4, false, T("alpha", "outQuad", 0, 0, 0.4, 1))],
  ["drop-in", "Appear", "Falls from above and bounces", () => C(0.7, false, T("y", "outBounce", 0, 30, 0.7, 0), T("alpha", "linear", 0, 0, 0.1, 1))],
  ["rise-in", "Appear", "Rises from below", () => C(0.5, false, T("y", "outCubic", 0, -10, 0.5, 0), T("alpha", "outQuad", 0, 0, 0.5, 1))],
  ["slide-in-left", "Appear", "Slides in from the left", () => C(0.5, false, T("x", "outCubic", 0, -40, 0.5, 0), T("alpha", "linear", 0, 0, 0.2, 1))],
  ["slide-in-right", "Appear", "Slides in from the right", () => C(0.5, false, T("x", "outCubic", 0, 40, 0.5, 0), T("alpha", "linear", 0, 0, 0.2, 1))],
  ["zoom-in", "Appear", "Zooms in from big", () => C(0.4, false, ...both("outCubic", 0, 2.5, 0.4, 1), T("alpha", "linear", 0, 0, 0.4, 1))],
  ["spin-in", "Appear", "Spins in while growing", () => C(0.6, false, T("rot", "outCubic", 0, -360, 0.6, 0), ...both("outBack", 0, 0, 0.6, 1)), { mid: true }],

  ["pop-out", "Disappear", "Shrinks away", () => C(0.3, false, ...both("inBack", 0, 1, 0.3, 0))],
  ["fadeout", "Disappear", "Fades out while sinking", () => C(0.5, false, T("alpha", "outQuad", 0, 1, 0.5, 0), T("y", "outQuad", 0, 0, 0.5, -6))],
  ["slide-out-left", "Disappear", "Slides out to the left", () => C(0.4, false, T("x", "inCubic", 0, 0, 0.4, -40), T("alpha", "linear", 0, 1, 0.4, 0))],
  ["slide-out-right", "Disappear", "Slides out to the right", () => C(0.4, false, T("x", "inCubic", 0, 0, 0.4, 40), T("alpha", "linear", 0, 1, 0.4, 0))],
  ["spin-out", "Disappear", "Spins away while shrinking", () => C(0.5, false, T("rot", "inCubic", 0, 0, 0.5, 360), ...both("inCubic", 0, 1, 0.5, 0)), { mid: true }],
  ["collect", "Disappear", "Picked up: rises, grows and fades", () => C(0.6, false, T("y", "outCubic", 0, 0, 0.6, 14), ...both("outQuad", 0, 1, 0.6, 1.4), T("alpha", "inQuad", 0, 1, 0.6, 0))],

  ["squash", "React", "Squashes and springs back", () => C(0.3, false, T("sy", "outBack", 0, 0.7, 0.3, 1), T("sx", "outBack", 0, 1.3, 0.3, 1))],
  ["shake", "React", "Shakes left and right", () => C(0.4, false, T("x", "linear", 0, 0, 0.05, -2, 0.15, 2, 0.25, -1.5, 0.35, 1, 0.4, 0))],
  ["hit", "React", "Knocked back with a flash", () => C(0.45, false, T("x", "outQuad", 0, 0, 0.08, -4, 0.45, 0), T("rot", "outQuad", 0, 0, 0.08, -8, 0.45, 0), T("alpha", "step", 0, 1, 0.05, 0.3, 0.1, 1, 0.15, 0.3, 0.2, 1))],
  ["flash", "React", "Blinks three times (invincible)", () => C(0.6, false, T("alpha", "step", 0, 0.2, 0.1, 1, 0.2, 0.2, 0.3, 1, 0.4, 0.2, 0.5, 1))],
  ["tada", "React", "Celebrates: grows, wiggles, settles", () => C(1, false, ...both("outQuad", 0, 1, 0.1, 0.9, 0.3, 1.15, 0.9, 1.15, 1, 1), T("rot", "linear", 0, 0, 0.3, -6, 0.4, 6, 0.5, -6, 0.6, 6, 0.7, -6, 0.8, 6, 0.9, 0))],
  ["yes", "React", "Nods yes", () => C(0.6, false, T("sy", "inOutSine", 0, 1, 0.15, 0.9, 0.3, 1, 0.45, 0.9, 0.6, 1))],
  ["no", "React", "Shakes its head no", () => C(0.6, false, T("x", "inOutSine", 0, 0, 0.1, -2, 0.25, 2, 0.4, -2, 0.5, 1, 0.6, 0))],
  ["attack", "React", "Winds up and lunges forward", () => C(0.6, false, T("x", "inOutQuad", 0, 0, 0.2, -3, 0.3, 8, 0.6, 0), T("rot", "inOutQuad", 0, 0, 0.2, 6, 0.3, -10, 0.6, 0))],
  ["recoil", "React", "Kicks back after a shot", () => C(0.3, false, T("x", "outQuad", 0, 0, 0.05, -4, 0.3, 0), T("sx", "outQuad", 0, 1, 0.05, 0.9, 0.3, 1))],
  ["press", "React", "Button press", () => C(0.2, false, ...both("outQuad", 0, 1, 0.06, 0.92, 0.2, 1))],
  ["attention", "React", "Wiggles to get attention", () => C(0.8, false, T("rot", "linear", 0, 0, 0.1, -12, 0.2, 12, 0.3, -10, 0.4, 10, 0.5, -5, 0.6, 5, 0.8, 0), ...both("outQuad", 0, 1, 0.1, 1.1, 0.8, 1))],
  ["surprise", "React", "Jumps a little in surprise", () => C(0.5, false, T("y", "outQuad", 0, 0, 0.12, 4, 0.5, 0), T("sy", "outBack", 0, 1, 0.12, 1.2, 0.5, 1), T("sx", "outBack", 0, 1, 0.12, 0.9, 0.5, 1))],

  ["spin", "Items", "Turns around forever", () => C(1, true, T("rot", "linear", 0, 0, 1, 360)), { mid: true }],
  ["coin-flip", "Items", "Turns around like a coin", () => C(1, true, T("sx", "inOutSine", 0, 1, 0.5, -1, 1, 1))],
  ["sparkle", "Items", "Twinkles", () => C(1.2, true, ...both("inOutSine", 0, 1, 0.3, 1.2, 0.6, 1, 1.2, 1), T("rot", "inOutSine", 0, 0, 0.3, 15, 0.6, 0, 1.2, 0), T("alpha", "inOutSine", 0, 1, 0.3, 0.7, 0.6, 1, 1.2, 1))],
  ["bob", "Items", "Lying on the ground, bobbing", () => C(1.4, true, T("y", "inOutSine", 0, 0, 0.7, 2, 1.4, 0), ...both("inOutSine", 0, 1, 0.7, 1.05, 1.4, 1))],
  ["ready", "Items", "Ready to use: slow pulse and glow", () => C(1.2, true, ...both("inOutSine", 0, 1, 0.6, 1.06, 1.2, 1), T("alpha", "inOutSine", 0, 1, 0.6, 0.8, 1.2, 1))],

  ["defeat", "Defeat", "Falls over and fades", () => C(0.9, false, T("rot", "outBounce", 0, 0, 0.6, 90), T("alpha", "linear", 0, 1, 0.6, 1, 0.9, 0))],
  ["dissolve", "Defeat", "Flickers away", () => C(0.8, false, T("alpha", "step", 0, 1, 0.1, 0.4, 0.2, 0.9, 0.3, 0.3, 0.4, 0.7, 0.5, 0.15, 0.6, 0.4, 0.7, 0))],
  ["ghost", "Defeat", "Floats up and vanishes", () => C(1.2, false, T("y", "outQuad", 0, 0, 1.2, 16), T("alpha", "linear", 0, 1, 1.2, 0), T("rot", "inOutSine", 0, 0, 0.4, -6, 0.8, 6, 1.2, 0))],
  ["melt", "Defeat", "Melts into the ground", () => C(0.8, false, T("sy", "inQuad", 0, 1, 0.8, 0.05), T("sx", "inQuad", 0, 1, 0.8, 1.6), T("alpha", "linear", 0, 1, 0.6, 1, 0.8, 0))],

  ["frames", "Frames", "Plays the drawn frames at the sprite FPS", s => C(Math.max(0.1, s.frames.length / fps(s)), true, T("frame", "step", ...s.frames.flatMap((_, i) => [i / fps(s), i + 1])))],
  ["frames-once", "Frames", "Plays the drawn frames once", s => C(Math.max(0.1, s.frames.length / fps(s)), false, T("frame", "step", ...s.frames.flatMap((_, i) => [i / fps(s), i + 1])))],
  ["ping-pong", "Frames", "Plays the frames forward, then backward", s => { const seq = s.frames.map((_, i) => i + 1); const all = seq.concat(seq.slice(1, -1).reverse()); return C(Math.max(0.1, all.length / fps(s)), true, T("frame", "step", ...all.flatMap((f, i) => [i / fps(s), f]))); }],
];

export function makeClip(name, sprite) {
  const e = CLIP_LIBRARY.find(x => x[0] === name);
  return e ? JSON.parse(JSON.stringify(e[3](sprite))) : null;
}
