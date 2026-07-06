// Shared story timing between the HTML chapters and the 3D scene.
// Each entry is a chapter section's height in vh; the 3D camera keyframes
// are pinned to the cumulative scroll fraction where each section starts.

export const SECTION_VH = [115, 125, 135, 125, 135, 210];

const TOTAL_VH = SECTION_VH.reduce((a, b) => a + b, 0);
const SCROLLABLE_VH = TOTAL_VH - 100; // scroll progress maxes when the last screen is in view

// Fractions of total scroll where chapters 1..5 begin (chapter 0 begins at 0).
export const STAMPS: number[] = (() => {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < SECTION_VH.length - 1; i++) {
    acc += SECTION_VH[i];
    out.push(acc / SCROLLABLE_VH);
  }
  return out;
})();

// Named story beats, all in scroll-progress space [0..1].
export const BEAT = {
  meet: 0,
  firstTrade: STAMPS[0],
  spiral: STAMPS[1],
  stat: STAMPS[2],
  turn: STAMPS[3],
  features: STAMPS[4],
};
