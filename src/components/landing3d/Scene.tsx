"use client";

/*
 * Three.js and Canvas objects are intentionally mutable inside animation
 * frames. React's immutability lint rules target render state and therefore do
 * not model these imperative graphics objects correctly.
 */
/* eslint-disable react-hooks/immutability, react-hooks/globals */

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BEAT } from "./story";

type SharedRefs = {
  scrollRef: React.RefObject<number>;
  mouseRef: React.RefObject<{ x: number; y: number }>;
};

/* ------------------------------- helpers ------------------------------- */

// Deterministic RNG so the story looks identical on every scroll direction.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (p: number, a: number, b: number) => THREE.MathUtils.smoothstep(p, a, b);

// How defeated Arjun is: 0 = upright and hopeful, 1 = fully slumped.
function slumpAmount(p: number) {
  const down = smooth(p, BEAT.firstTrade, BEAT.stat); // collapses through the losses
  const recovery = smooth(p, BEAT.turn, BEAT.turn + 0.1); // sits back up at the turn
  return down * (1 - recovery);
}

/* ------------------------------ price paths ------------------------------ */

function genPath(seed: number, anchors: [number, number][], n: number, vol: number) {
  const rng = mulberry32(seed);
  const out = new Float32Array(n);
  let wobble = 0;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let k = 0;
    while (k < anchors.length - 2 && anchors[k + 1][0] < t) k++;
    const [t0, v0] = anchors[k];
    const [t1, v1] = anchors[k + 1];
    const f = clamp01((t - t0) / (t1 - t0));
    wobble += (rng() - 0.5) * vol;
    wobble *= 0.94;
    out[i] = v0 + (v1 - v0) * f + wobble;
  }
  return out;
}

// He pumps a little first (beginner's luck), then it all comes apart.
const LOSS_PATH = genPath(
  7,
  [
    [0, 100],
    [0.12, 112],
    [0.3, 74],
    [0.42, 88],
    [0.62, 41],
    [0.74, 52],
    [1, 16],
  ],
  760,
  2.6
);

// The PaperX practice run: steady, learned, up and to the right.
const WIN_PATH = genPath(
  21,
  [
    [0, 100],
    [0.22, 118],
    [0.34, 109],
    [0.6, 152],
    [0.74, 143],
    [1, 196],
  ],
  420,
  2.0
);

/* ------------------------------ mood colors ------------------------------ */

const MOOD = [
  { t: 0, bg: "#05080d", screen: "#67e8f9", amb: 0.4 },
  { t: BEAT.firstTrade, bg: "#070508", screen: "#f87171", amb: 0.34 },
  { t: BEAT.spiral, bg: "#0b0406", screen: "#ef4444", amb: 0.26 },
  { t: BEAT.stat, bg: "#020203", screen: "#7f1d1d", amb: 0.12 },
  { t: BEAT.turn, bg: "#03100b", screen: "#34d399", amb: 0.42 },
  { t: 1, bg: "#041209", screen: "#34d399", amb: 0.48 },
];

function moodAt(p: number, out: { bg: THREE.Color; screen: THREE.Color; amb: number }) {
  let i = 0;
  while (i < MOOD.length - 2 && MOOD[i + 1].t < p) i++;
  const a = MOOD[i];
  const b = MOOD[i + 1];
  const f = smooth(p, a.t, b.t);
  out.bg.set(a.bg).lerp(new THREE.Color(b.bg), f);
  out.screen.set(a.screen).lerp(new THREE.Color(b.screen), f);
  out.amb = a.amb + (b.amb - a.amb) * f;
}

function Mood() {
  const scroll = useSceneRefs().scrollRef;
  const { scene } = useThree();
  const ambRef = useRef<THREE.AmbientLight>(null);
  const screenLightRef = useRef<THREE.PointLight>(null);
  const tmp = useMemo(
    () => ({ bg: new THREE.Color(), screen: new THREE.Color(), amb: 0.4 }),
    []
  );

  useFrame(() => {
    const p = clamp01(scroll.current ?? 0);
    moodAt(p, tmp);
    (scene.background as THREE.Color | null)?.copy?.(tmp.bg);
    if (scene.fog) scene.fog.color.copy(tmp.bg);
    if (ambRef.current) ambRef.current.intensity = tmp.amb;
    if (screenLightRef.current) {
      screenLightRef.current.color.copy(tmp.screen);
      screenLightRef.current.intensity = 6 + Math.sin(p * 90) * 0.4;
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.4} />
      {/* monitor glow washing over Arjun's face */}
      <pointLight ref={screenLightRef} position={[0, 1.7, 0.15]} distance={7} intensity={6} />
      <directionalLight position={[-7, 7, -5]} intensity={0.5} color="#7d9bc0" />
    </>
  );
}

/* --------------------------- shared refs context --------------------------- */
// Tiny hand-rolled context so deep components can read scroll without prop drilling.

let sceneRefs: SharedRefs = {
  scrollRef: { current: 0 },
  mouseRef: { current: { x: 0, y: 0 } },
};
const useSceneRefs = () => sceneRefs;

/* -------------------------------- textures -------------------------------- */

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function textSprite(label: string, color: string, px = 44, pad = 20): THREE.CanvasTexture {
  const m = makeCanvas(8, 8).getContext("2d")!;
  const font = `700 ${px}px 'Space Mono', ui-monospace, monospace`;
  m.font = font;
  const w = Math.ceil(m.measureText(label).width) + pad * 2;
  const canvas = makeCanvas(w, px * 2);
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillText(label, pad, px + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------ monitor chart ------------------------------ */

function drawChart(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  path: Float32Array,
  count: number,
  color: string,
  fill: string
) {
  ctx.fillStyle = "#04070c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(120,150,170,0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (h / 5) * i);
    ctx.lineTo(w, (h / 5) * i);
    ctx.stroke();
  }
  const start = Math.max(0, count - 150);
  const win = path.subarray(start, Math.max(start + 2, count));
  let min = Infinity;
  let max = -Infinity;
  for (const v of win) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(max - min, 1);
  const px = (i: number) => (i / (win.length - 1)) * w;
  const py = (v: number) => h - ((v - min) / span) * (h * 0.82) - h * 0.09;

  ctx.beginPath();
  ctx.moveTo(px(0), py(win[0]));
  for (let i = 1; i < win.length; i++) ctx.lineTo(px(i), py(win[i]));
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  const last = win[win.length - 1];
  ctx.fillStyle = color;
  ctx.font = "700 22px 'Space Mono', monospace";
  ctx.fillText(last.toFixed(2), 12, 30);
}

function drawWatchlist(ctx: CanvasRenderingContext2D, w: number, h: number, greenBias: number) {
  const rng = mulberry32(99);
  ctx.fillStyle = "#04070c";
  ctx.fillRect(0, 0, w, h);
  const rows = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "SBIN", "TATAMOTORS", "ITC", "WIPRO"];
  ctx.font = "700 20px 'Space Mono', monospace";
  rows.forEach((r, i) => {
    const up = rng() < greenBias;
    const y = 34 + i * 30;
    ctx.fillStyle = "#8fa3b0";
    ctx.fillText(r, 14, y);
    ctx.fillStyle = up ? "#34d399" : "#f87171";
    const pct = ((rng() * 3 + 0.2) * (up ? 1 : -1)).toFixed(2);
    ctx.fillText(`${up ? "+" : ""}${pct}%`, w - 110, y);
  });
}

/* --------------------------------- the desk --------------------------------- */

function TradingDesk() {
  const { scrollRef } = useSceneRefs();
  const chart = useMemo(() => {
    const canvas = makeCanvas(512, 288);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, ctx: canvas.getContext("2d")!, tex };
  }, []);
  const side = useMemo(() => {
    const canvas = makeCanvas(384, 288);
    const ctx = canvas.getContext("2d")!;
    drawWatchlist(ctx, 384, 288, 0.3);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, ctx, tex, phase: { green: false } };
  }, []);
  const frame = useRef(0);

  useFrame(() => {
    const p = clamp01(scrollRef.current ?? 0);
    // redraw at 30fps-ish; texture uploads are cheap at this size but no need for more
    frame.current++;
    if (frame.current % 2 === 0) {
      if (p < BEAT.turn) {
        const count = Math.floor(THREE.MathUtils.mapLinear(p, 0, BEAT.turn, 60, LOSS_PATH.length));
        const falling = p > BEAT.firstTrade * 0.9;
        drawChart(
          chart.ctx, 512, 288, LOSS_PATH, count,
          falling ? "#ef4444" : "#67e8f9",
          falling ? "rgba(239,68,68,0.14)" : "rgba(103,232,249,0.10)"
        );
      } else {
        const count = Math.floor(THREE.MathUtils.mapLinear(p, BEAT.turn, 1, 40, WIN_PATH.length));
        drawChart(chart.ctx, 512, 288, WIN_PATH, count, "#34d399", "rgba(52,211,153,0.14)");
      }
      chart.tex.needsUpdate = true;
    }
    const shouldBeGreen = p >= BEAT.turn;
    if (shouldBeGreen !== side.phase.green) {
      side.phase.green = shouldBeGreen;
      drawWatchlist(side.ctx, 384, 288, shouldBeGreen ? 0.85 : 0.25);
      side.tex.needsUpdate = true;
    }
  });

  const deskMat = <meshStandardMaterial color="#141b23" roughness={0.6} metalness={0.2} />;
  const frameMat = <meshStandardMaterial color="#0a0e13" roughness={0.5} metalness={0.4} />;

  return (
    <group>
      {/* desk top + legs */}
      <mesh position={[0, 1.02, 0.95]}>
        <boxGeometry args={[2.7, 0.07, 1.05]} />
        {deskMat}
      </mesh>
      {[-1.2, 1.2].map((x) =>
        [0.55, 1.35].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.5, z]}>
            <boxGeometry args={[0.08, 1.0, 0.08]} />
            {frameMat}
          </mesh>
        ))
      )}
      {/* center monitor */}
      <group position={[0, 1.5, 1.25]}>
        <mesh>
          <boxGeometry args={[1.05, 0.62, 0.05]} />
          {frameMat}
        </mesh>
        <mesh position={[0, 0, -0.031]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.98, 0.55]} />
          <meshBasicMaterial map={chart.tex} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.42, 0.02]}>
          <boxGeometry args={[0.1, 0.24, 0.06]} />
          {frameMat}
        </mesh>
      </group>
      {/* side monitors */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.02, 1.44, 1.18]} rotation={[0, Math.PI - s * 0.42, 0]}>
          <mesh>
            <boxGeometry args={[0.78, 0.5, 0.05]} />
            {frameMat}
          </mesh>
          <mesh position={[0, 0, 0.031]}>
            <planeGeometry args={[0.72, 0.44]} />
            <meshBasicMaterial map={side.tex} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.36, -0.02]}>
            <boxGeometry args={[0.08, 0.2, 0.06]} />
            {frameMat}
          </mesh>
        </group>
      ))}
      {/* keyboard + mug */}
      <mesh position={[0, 1.07, 0.62]} rotation={[0.06, 0, 0]}>
        <boxGeometry args={[0.7, 0.03, 0.24]} />
        <meshStandardMaterial color="#1c242e" roughness={0.7} />
      </mesh>
      <mesh position={[0.85, 1.12, 0.7]}>
        <cylinderGeometry args={[0.06, 0.05, 0.13, 16]} />
        <meshStandardMaterial color="#31424f" roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ---------------------------------- Arjun ---------------------------------- */

function Trader() {
  const { scrollRef } = useSceneRefs();
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);

  const cloth = <meshStandardMaterial color="#233140" roughness={0.85} />;
  const clothDark = <meshStandardMaterial color="#1a2530" roughness={0.85} />;
  const skin = <meshStandardMaterial color="#a1755c" roughness={0.7} />;

  useFrame(({ clock }) => {
    const p = clamp01(scrollRef.current ?? 0);
    const s = slumpAmount(p);
    const breathe = Math.sin(clock.elapsedTime * 2) * 0.015;
    if (torso.current) torso.current.rotation.x = s * 0.52 + breathe;
    if (head.current) head.current.rotation.x = s * 0.55 + breathe * 2;
    // arms rest on the keyboard, then drop when he gives up
    if (armL.current) armL.current.rotation.x = 0.3 + s * 0.85;
    if (armR.current) armR.current.rotation.x = 0.3 + s * 0.85;
  });

  return (
    <group position={[0, 0, -0.05]}>
      {/* chair */}
      <mesh position={[0, 0.55, -0.55]}>
        <boxGeometry args={[0.56, 0.06, 0.52]} />
        {clothDark}
      </mesh>
      <mesh position={[0, 0.95, -0.82]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[0.54, 0.85, 0.07]} />
        {clothDark}
      </mesh>
      <mesh position={[0, 0.26, -0.55]}>
        <cylinderGeometry args={[0.05, 0.05, 0.55, 10]} />
        <meshStandardMaterial color="#0d1218" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* legs */}
      {[-0.13, 0.13].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.62, -0.3]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.15, 0.13, 0.5]} />
            {cloth}
          </mesh>
          <mesh position={[x, 0.32, -0.06]}>
            <boxGeometry args={[0.13, 0.5, 0.14]} />
            {cloth}
          </mesh>
          <mesh position={[x, 0.05, 0.03]}>
            <boxGeometry args={[0.13, 0.09, 0.28]} />
            {clothDark}
          </mesh>
        </group>
      ))}
      {/* torso pivots at the hips so he can slump */}
      <group ref={torso} position={[0, 0.66, -0.5]}>
        <mesh position={[0, 0.42, 0]}>
          <capsuleGeometry args={[0.21, 0.5, 6, 12]} />
          {cloth}
        </mesh>
        {/* arms reaching for the keyboard */}
        <group ref={armL} position={[-0.28, 0.62, 0.05]}>
          <mesh position={[0, -0.03, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.07, 0.5, 4, 10]} />
            {cloth}
          </mesh>
          <mesh position={[0, -0.03, 0.62]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            {skin}
          </mesh>
        </group>
        <group ref={armR} position={[0.28, 0.62, 0.05]}>
          <mesh position={[0, -0.03, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.07, 0.5, 4, 10]} />
            {cloth}
          </mesh>
          <mesh position={[0, -0.03, 0.62]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            {skin}
          </mesh>
        </group>
        {/* head */}
        <group ref={head} position={[0, 0.94, 0.02]}>
          <mesh>
            <sphereGeometry args={[0.17, 20, 20]} />
            {skin}
          </mesh>
          <mesh position={[0, 0.06, -0.03]}>
            <sphereGeometry args={[0.175, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#10151b" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ----------------------------- portfolio counter ----------------------------- */

function portfolioValue(p: number): { value: number; virtual: boolean } {
  if (p >= BEAT.turn) return { value: 1000000, virtual: true };
  if (p <= BEAT.firstTrade) return { value: 500000, virtual: false };
  const t = clamp01((p - BEAT.firstTrade) / (BEAT.stat - BEAT.firstTrade));
  const v = 14750 + (500000 - 14750) * Math.pow(1 - t, 2.1);
  return { value: Math.round(v / 10) * 10, virtual: false };
}

function PortfolioCounter() {
  const { scrollRef } = useSceneRefs();
  const sprite = useRef<THREE.Sprite>(null);
  const state = useMemo(() => {
    const canvas = makeCanvas(760, 190);
    const ctx = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, ctx, tex, last: "" };
  }, []);

  useFrame(() => {
    const p = clamp01(scrollRef.current ?? 0);
    const { value, virtual } = portfolioValue(p);
    const label = virtual ? "PAPERX VIRTUAL CAPITAL" : "PORTFOLIO VALUE";
    const num = `₹ ${value.toLocaleString("en-IN")}`;
    const key = num + label;
    if (key !== state.last) {
      state.last = key;
      const { ctx } = state;
      const ratio = clamp01(value / 500000);
      const color = virtual ? "#34d399" : ratio > 0.75 ? "#67e8f9" : ratio > 0.35 ? "#fbbf24" : "#ef4444";
      ctx.clearRect(0, 0, 760, 190);
      ctx.font = "700 26px 'Space Mono', monospace";
      ctx.fillStyle = "rgba(160,180,195,0.85)";
      ctx.fillText(label, 12, 40);
      ctx.font = "800 86px 'Space Mono', monospace";
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = color;
      ctx.fillText(num, 10, 135);
      ctx.shadowBlur = 0;
      state.tex.needsUpdate = true;
    }
    if (sprite.current) {
      const mat = sprite.current.material as THREE.SpriteMaterial;
      // hide while the far "90%" stat chapter owns the screen
      mat.opacity = 0.95 - smooth(p, BEAT.stat - 0.07, BEAT.stat - 0.02) * 0.95 + smooth(p, BEAT.turn, BEAT.turn + 0.05) * 0.95;
    }
  });

  return (
    <sprite ref={sprite} position={[0, 2.55, 0.6]} scale={[3.3, 0.82, 1]}>
      <spriteMaterial map={state.tex} transparent depthWrite={false} />
    </sprite>
  );
}

/* ------------------------------- loss popups ------------------------------- */

const LOSSES = [
  "-₹18,400", "-₹32,750", "-₹9,980", "-₹51,200", "-₹27,300", "-₹44,850",
  "-₹12,660", "-₹63,110", "-₹8,340", "-₹38,020", "-₹21,540", "-₹75,000",
];

function LossPopups() {
  const { scrollRef } = useSceneRefs();
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const items = useMemo(() => {
    const rng = mulberry32(4242);
    return LOSSES.map((label, i) => {
      const tex = textSprite(label, "#f87171", 46);
      const aspect = (tex.image as HTMLCanvasElement).width / (tex.image as HTMLCanvasElement).height;
      const start =
        BEAT.firstTrade + 0.02 + (i / LOSSES.length) * (BEAT.stat - BEAT.firstTrade - 0.07);
      return {
        tex,
        aspect,
        start,
        x: (rng() - 0.5) * 3.4,
        y: 1.5 + rng() * 0.7,
        z: 0.4 + rng() * 0.9,
        drift: (rng() - 0.5) * 1.2,
      };
    });
  }, []);

  useFrame(() => {
    const p = clamp01(scrollRef.current ?? 0);
    items.forEach((it, i) => {
      const s = refs.current[i];
      if (!s) return;
      const t = clamp01((p - it.start) / 0.055);
      const mat = s.material as THREE.SpriteMaterial;
      mat.opacity = t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI);
      s.position.set(it.x + it.drift * t, it.y + t * 1.5, it.z);
      const h = 0.42;
      s.scale.set(h * it.aspect, h, 1);
    });
  });

  return (
    <>
      {items.map((it, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el; }}>
          <spriteMaterial map={it.tex} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}

/* ------------------------------ flying money ------------------------------ */

const NOTE_COUNT = 90;

function FlyingMoney() {
  const { scrollRef } = useSceneRefs();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const notes = useMemo(() => {
    const rng = mulberry32(1337);
    return Array.from({ length: NOTE_COUNT }, () => {
      const ang = rng() * Math.PI * 2;
      const speed = 2.5 + rng() * 4;
      return {
        start: BEAT.spiral + rng() * (BEAT.stat - BEAT.spiral - 0.05),
        vx: Math.cos(ang) * speed,
        vz: Math.sin(ang) * speed,
        vy: 2 + rng() * 3.5,
        spin: rng() * 8,
        phase: rng() * Math.PI * 2,
      };
    });
  }, []);

  useFrame(() => {
    const p = clamp01(scrollRef.current ?? 0);
    const m = mesh.current;
    if (!m) return;
    notes.forEach((n, i) => {
      const t = clamp01((p - n.start) / 0.12);
      if (t <= 0 || t >= 1) {
        dummy.scale.setScalar(0);
      } else {
        const tt = t * 1.6;
        dummy.position.set(n.vx * tt, 1.3 + n.vy * tt - 2.6 * tt * tt, 0.5 + n.vz * tt);
        dummy.rotation.set(n.spin * t + n.phase, n.spin * t * 0.7, n.phase);
        dummy.scale.setScalar(1 - t * 0.6);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, NOTE_COUNT]} frustumCulled={false}>
      <boxGeometry args={[0.22, 0.005, 0.1]} />
      <meshStandardMaterial color="#5c9c6e" emissive="#2f7a4b" emissiveIntensity={0.35} roughness={0.7} />
    </instancedMesh>
  );
}

/* --------------------------- backdrop candle sky --------------------------- */

function BackdropCandles({
  falling,
  count,
  seed,
  revealFrom,
  revealTo,
  fadeAt,
  color,
  emissive,
}: {
  falling: boolean;
  count: number;
  seed: number;
  revealFrom: number;
  revealTo: number;
  fadeAt?: number;
  color: string;
  emissive: string;
}) {
  const { scrollRef } = useSceneRefs();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const candles = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => {
      const f = i / (count - 1);
      return {
        x: -17 + f * 34 + (rng() - 0.5) * 1.4,
        y: (falling ? 11 - f * 8.5 : 2.5 + f * 8.5) + (rng() - 0.5) * 1.6,
        z: 9 + rng() * 5,
        h: 1.2 + rng() * 2.2,
        reveal: revealFrom + f * (revealTo - revealFrom),
      };
    });
  }, [count, falling, revealFrom, revealTo, seed]);

  useFrame(() => {
    const p = clamp01(scrollRef.current ?? 0);
    const m = mesh.current;
    if (!m) return;
    candles.forEach((c, i) => {
      let s = smooth(p, c.reveal, c.reveal + 0.03);
      if (fadeAt !== undefined) s *= 1 - smooth(p, fadeAt, fadeAt + 0.06);
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.set(Math.max(s, 0.0001), Math.max(s * c.h, 0.0001), Math.max(s, 0.0001));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.55, 1, 0.55]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.0} roughness={0.4} />
    </instancedMesh>
  );
}

/* --------------------------------- camera --------------------------------- */

const CAM_KEYS = [
  { t: 0, pos: new THREE.Vector3(3.6, 1.9, -3.2), look: new THREE.Vector3(0, 1.35, 0.2) },
  { t: BEAT.firstTrade, pos: new THREE.Vector3(1.15, 2.25, -2.3), look: new THREE.Vector3(0, 1.5, 1.1) },
  { t: BEAT.spiral, pos: new THREE.Vector3(-5.8, 3.6, -5.6), look: new THREE.Vector3(0, 1.4, 0.6) },
  { t: BEAT.stat, pos: new THREE.Vector3(0, 8.2, -13.5), look: new THREE.Vector3(0, 1.1, 0) },
  { t: BEAT.turn, pos: new THREE.Vector3(-3.1, 2.2, -4.0), look: new THREE.Vector3(0, 1.5, 0.5) },
  { t: BEAT.features, pos: new THREE.Vector3(2.8, 2.5, -5.4), look: new THREE.Vector3(0, 1.7, 0) },
  { t: 1, pos: new THREE.Vector3(0, 3.1, -8.8), look: new THREE.Vector3(0, 1.9, 0) },
];

function CameraRig() {
  const { scrollRef, mouseRef } = useSceneRefs();
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const desiredLook = useMemo(() => new THREE.Vector3(), []);
  const currentLook = useMemo(() => new THREE.Vector3(0, 1.35, 0.2), []);

  useFrame(({ camera }) => {
    const p = clamp01(scrollRef.current ?? 0);
    let i = 0;
    while (i < CAM_KEYS.length - 2 && CAM_KEYS[i + 1].t < p) i++;
    const a = CAM_KEYS[i];
    const b = CAM_KEYS[i + 1];
    const f = smooth(p, a.t, b.t);
    desiredPos.lerpVectors(a.pos, b.pos, f);
    desiredLook.lerpVectors(a.look, b.look, f);

    const m = mouseRef.current ?? { x: 0, y: 0 };
    desiredPos.x += m.x * 0.45;
    desiredPos.y += -m.y * 0.3;

    camera.position.lerp(desiredPos, 0.07);
    currentLook.lerp(desiredLook, 0.09);
    camera.lookAt(currentLook);
  });

  return null;
}

/* ---------------------------------- scene ---------------------------------- */

function Platform() {
  return (
    <group>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[7, 7.6, 0.32, 48]} />
        <meshStandardMaterial color="#0a0f15" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.7, 6.9, 64]} />
        <meshBasicMaterial color="#1b4d3c" transparent opacity={0.7} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function Scene({ scrollRef, mouseRef }: SharedRefs) {
  sceneRefs = { scrollRef, mouseRef };
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [3.6, 1.9, -3.2], fov: 46 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05080d"]} />
      <fog attach="fog" args={["#05080d", 14, 46]} />

      <Mood />
      <Platform />
      <TradingDesk />
      <Trader />
      <PortfolioCounter />
      <LossPopups />
      <FlyingMoney />

      {/* red crash raining across the sky during the losses, green dawn after the turn */}
      <BackdropCandles
        falling
        count={34}
        seed={11}
        revealFrom={BEAT.firstTrade + 0.02}
        revealTo={BEAT.stat - 0.04}
        fadeAt={BEAT.turn - 0.04}
        color="#4d1420"
        emissive="#ef4444"
      />
      <BackdropCandles
        falling={false}
        count={34}
        seed={17}
        revealFrom={BEAT.turn + 0.02}
        revealTo={0.96}
        color="#0b4d36"
        emissive="#00e389"
      />

      <Stars radius={90} depth={40} count={1800} factor={2.6} saturation={0} fade speed={0.5} />
      <Grid
        infiniteGrid
        position={[0, -0.32, 0]}
        cellSize={1.2}
        sectionSize={8.4}
        cellThickness={0.5}
        sectionThickness={1}
        cellColor="#0b1b18"
        sectionColor="#123f30"
        fadeDistance={46}
        fadeStrength={2.6}
      />

      <CameraRig />

      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.2} luminanceSmoothing={0.3} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.9} />
      </EffectComposer>
    </Canvas>
  );
}
