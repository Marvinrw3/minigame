// 🦆 Duck Rescue — Vanilla HTML5 Canvas + JS
// Schritt 1 (Gerüst): Canvas, See, Manikin mit Angel, Maus-Steuerung, 60s-Timer, Score.
// Schritt 2 (Enten): Mitglieder spawnen + schwimmen, Namen überm Kopf,
//   Fang-Logik → +Punkte + Toast "Danke für die Rettung, [Name]", Rettungs-Liste.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---- Layout-Konstanten -----------------------------------------------------
const W = canvas.width; // 800
const H = canvas.height; // 600
const WATER_TOP = 90; // darüber: Himmel/oberes Ufer (später: Sebastian-Gott)
const WATER_BOTTOM = 510; // darunter: Holzsteg, auf dem der Manikin steht
const GAME_DURATION = 60; // Sekunden

// ---- Balancing (später anpassbar) ------------------------------------------
const MAX_DUCKS = 8; // gleichzeitig im Wasser
const SPAWN_INTERVAL = 0.8; // Sekunden zwischen Spawns
const DUCK_POINTS = 10; // Punkte pro geretteter Ente
const DUCK_RADIUS = 16; // Körperradius
const CATCH_TOLERANCE = 14; // zusätzlicher Fang-Radius um den Haken
const DUCK_LOST_PENALTY = 5; // Abzug, wenn ein Tool eine Ente schnappt

// Giftige Floater (Strafmechanik) — echte Tool-/Skill-Namen aus Marvins Setup
const POISON_NAMES = [
  "caveman", "council", "grill-me", "nano-banana", "firecrawl", "n8n",
  "meta-ads", "playwright", "superpowers", "claude-ads", "claude-seo",
  "supabase", "vercel", "canva", "elevenlabs", "airtable", "apify",
  "context7", "impeccable", "mcp-builder",
];
const MAX_FLOATERS = 4; // gleichzeitig im Wasser
const FLOATER_SPAWN_INTERVAL = 1.8; // Sekunden zwischen Floater-Spawns
const FLOATER_PENALTY = 15; // Minuspunkte normaler Floater
const CAVEMAN_PENALTY = 30; // Minuspunkte caveman (härtere Strafe)
const FLOATER_RADIUS = 15;
const CAVEMAN_RADIUS = 20;
const FLOATER_SPEED = 44; // Jagd-Tempo: Floater steuern auf die nächste Ente zu

// Gewitter / Sicht-Debuff bei Fehlfang
const STORM_DURATION = 1.2; // Sekunden
const STORM_DARK = 0.36; // Abdunkelung 0..1
const CAVEMAN_STORM_DURATION = 3.6; // caveman: länger
const CAVEMAN_STORM_DARK = 0.72; // caveman: dunkler

// Juice: Screenshake (px) + Abklingen
const SHAKE_CATCH = 3;
const SHAKE_MISS = 7;
const SHAKE_CAVEMAN = 14;
const SHAKE_DECAY = 45; // px/s

// ---- Farben (Anthropic-/Claude-Code-Look) ----------------------------------
const COLOR = {
  anthropic: "#D97757",
  anthropicDark: "#B85C3C",
  skyTop: "#bfe3f2",
  skyBottom: "#9ecfe6",
  waterTop: "#3f97c2",
  waterBottom: "#1f6088",
  dock: "#8a5a3b",
  dockDark: "#6f4630",
  line: "#e8e8e8",
  duck: "#f6c945",
  duckDark: "#e0b227",
  beak: "#e8852b",
  poison: "#2f8f3f",
  poisonGlow: "60,200,80",
  caveman: "#5a1d6e",
  cavemanGlow: "150,50,190",
};

// ---- Spielzustand ----------------------------------------------------------
const state = {
  score: 0,
  timeLeft: GAME_DURATION,
  phase: "start", // "start" | "playing" | "ended"
  time: 0, // Gesamtzeit für Animationen
  mouse: { x: W / 2, y: 300 },
  cast: null, // { x, y, age } — kurzer Auswurf-Effekt beim Klick
  ducks: [], // aktive Enten im Wasser
  floaters: [], // giftige Tools im Wasser
  rescued: [], // gerettete Mitglieder (für Endscreen, Schritt 4)
  toast: null, // { text, age }
  storm: null, // { age, duration, intensity, boltX, heavy }
  particles: [], // kleine Effekt-Partikel
  shakeMag: 0, // aktuelle Screenshake-Stärke (px)
  sebastian: { mood: "neutral", timer: 0, heavy: false }, // Gott-Stimmung
  spawnTimer: 0,
  floaterSpawnTimer: 1.0,
};

// ---- Mitglieder-"Deck" (ohne Wiederholung ausgeben) ------------------------
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
let deck = shuffle(MEMBERS.slice());
let deckIndex = 0;
function nextMember() {
  if (deckIndex >= deck.length) {
    deck = shuffle(MEMBERS.slice());
    deckIndex = 0;
  }
  return deck[deckIndex++];
}

// ---- Eingabe ---------------------------------------------------------------
function toCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (W / rect.width),
    y: (e.clientY - rect.top) * (H / rect.height),
  };
}

canvas.addEventListener("mousemove", (e) => {
  state.mouse = toCanvasCoords(e);
});

canvas.addEventListener("mousedown", (e) => {
  if (state.phase !== "playing") return;
  state.mouse = toCanvasCoords(e);
  const hook = getHook();
  state.cast = { x: hook.x, y: hook.y, age: 0 }; // Auswurf
  tryCatch(hook);
});

// Haken folgt der Maus, bleibt aber im Wasserbereich.
function getHook() {
  return {
    x: clamp(state.mouse.x, 18, W - 18),
    y: clamp(state.mouse.y, WATER_TOP + 14, WATER_BOTTOM - 8),
  };
}

// ---- Fang-Logik ------------------------------------------------------------
function tryCatch(hook) {
  let best = null;
  let bestDist = Infinity;
  let bestKind = null;
  for (const d of state.ducks) {
    const dist = Math.hypot(d.x - hook.x, d.y - hook.y);
    if (dist < d.radius + CATCH_TOLERANCE && dist < bestDist) {
      best = d;
      bestDist = dist;
      bestKind = "duck";
    }
  }
  for (const f of state.floaters) {
    const dist = Math.hypot(f.x - hook.x, f.y - hook.y);
    if (dist < f.radius + CATCH_TOLERANCE && dist < bestDist) {
      best = f;
      bestDist = dist;
      bestKind = "floater";
    }
  }
  if (best) (bestKind === "duck" ? catchDuck : catchFloater)(best);
}

function catchDuck(d) {
  state.ducks = state.ducks.filter((x) => x !== d);
  state.score += DUCK_POINTS;
  if (!state.rescued.some((m) => m.name === d.member.name)) {
    state.rescued.push(d.member);
  }
  showToast("Danke für die Rettung, " + d.member.name);
  playQuak();
  spawnParticles(d.x, d.y, "#ffe27a", 10, 90);
  addShake(SHAKE_CATCH);
  emitRescue({ name: d.member.name }); // Sebastian strahlt
}

function showToast(text, color = "rgba(217,119,87,0.94)") {
  state.toast = { text, age: 0, color };
}

// Nächste Ente zu einem Floater (für die Jagd-Logik)
function nearestDuck(f) {
  let best = null;
  let bestD = Infinity;
  for (const d of state.ducks) {
    const dist = Math.hypot(d.x - f.x, d.y - f.y);
    if (dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

// Ente von einem Tool geschnappt → verloren (kleiner Abzug + Hinweis)
function loseDuck(d) {
  state.ducks = state.ducks.filter((x) => x !== d);
  state.score = Math.max(0, state.score - DUCK_LOST_PENALTY);
  showToast("Zu spät! " + d.member.name + " wurde geschnappt.", "rgba(90,100,112,0.95)");
  spawnParticles(d.x, d.y, "#7b8794", 8, 70);
  addShake(SHAKE_CATCH);
}

// Zentraler Fehlfang-Hook — Schritt 5 (Sebastian wird sauer/spuckt Feuer)
// hängt sich hier per onMissCatch(...) an, ohne diese Logik anzufassen.
const missCatchListeners = [];
function onMissCatch(fn) {
  missCatchListeners.push(fn);
}
function emitMissCatch(info) {
  for (const fn of missCatchListeners) fn(info);
}

// Rescue-Hook — Sebastian strahlt bei jeder Rettung (analog zum Fehlfang-Hook).
const rescueListeners = [];
function onRescue(fn) {
  rescueListeners.push(fn);
}
function emitRescue(info) {
  for (const fn of rescueListeners) fn(info);
}

// Sounds (relative Pfade). Abspielen im Klick-Kontext = User-Geste. Lautstärken dezent.
const donnerSound = new Audio("assets/donner.mp3");
donnerSound.volume = 0.55;
const quakSound = new Audio("assets/quak.mp3");
quakSound.volume = 0.5;
function playDonner() {
  donnerSound.currentTime = 0;
  donnerSound.play().catch(() => {});
}
function playQuak() {
  quakSound.currentTime = 0;
  quakSound.play().catch(() => {});
}

// Partikel + Screenshake (leichtes Juice)
function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 30,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0.8,
      size: 2 + Math.random() * 2.5,
      color,
    });
  }
}
function addShake(m) {
  state.shakeMag = Math.max(state.shakeMag, m);
}

function catchFloater(f) {
  state.floaters = state.floaters.filter((x) => x !== f);
  const heavy = f.isCaveman;
  state.score -= heavy ? CAVEMAN_PENALTY : FLOATER_PENALTY;
  startStorm(heavy);
  playDonner();
  spawnParticles(f.x, f.y, heavy ? "#cf7bff" : "#9bff7a", heavy ? 18 : 12, 120);
  addShake(heavy ? SHAKE_CAVEMAN : SHAKE_MISS);
  emitMissCatch({ name: f.name, heavy }); // Sebastian wird sauer + speit Feuer
}

function startStorm(heavy) {
  state.storm = {
    age: 0,
    duration: heavy ? CAVEMAN_STORM_DURATION : STORM_DURATION,
    intensity: heavy ? CAVEMAN_STORM_DARK : STORM_DARK,
    heavy,
    boltX: 120 + Math.random() * (W - 240),
  };
}

// ---- Spawning --------------------------------------------------------------
function spawnDuck() {
  const fromLeft = Math.random() < 0.5;
  const speed = 28 + Math.random() * 26;
  const y = WATER_TOP + 46 + Math.random() * (WATER_BOTTOM - WATER_TOP - 76);
  state.ducks.push({
    member: nextMember(),
    x: fromLeft ? -30 : W + 30,
    y,
    vx: fromLeft ? speed : -speed,
    radius: DUCK_RADIUS,
    phase: Math.random() * Math.PI * 2,
  });
}

function spawnFloater() {
  const name = POISON_NAMES[Math.floor(Math.random() * POISON_NAMES.length)];
  const isCaveman = name === "caveman";
  const fromLeft = Math.random() < 0.5;
  const drift = 26 + Math.random() * 22;
  state.floaters.push({
    name,
    isCaveman,
    x: fromLeft ? -30 : W + 30,
    y: WATER_TOP + 46 + Math.random() * (WATER_BOTTOM - WATER_TOP - 76),
    vx: fromLeft ? drift : -drift, // Drift, falls keine Ente zum Jagen da ist
    speed: (isCaveman ? FLOATER_SPEED + 6 : FLOATER_SPEED) + Math.random() * 8,
    radius: isCaveman ? CAVEMAN_RADIUS : FLOATER_RADIUS,
    phase: Math.random() * Math.PI * 2,
  });
}

// ---- Hilfsfunktionen -------------------------------------------------------
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// ---- Update ----------------------------------------------------------------
function update(dt) {
  state.time += dt;

  if (state.phase === "playing") {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endGame();
    }

    // Enten bewegen
    for (const d of state.ducks) d.x += d.vx * dt;
    state.ducks = state.ducks.filter((d) => d.x > -50 && d.x < W + 50);

    // Nachschub
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.ducks.length < MAX_DUCKS) {
      spawnDuck();
      state.spawnTimer = SPAWN_INTERVAL;
    }

    // Giftige Floater JAGEN die nächste Ente (Hunting)
    for (const f of state.floaters) {
      const target = nearestDuck(f);
      if (target) {
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        f.x += (dx / d) * f.speed * dt;
        f.y += (dy / d) * f.speed * dt;
      } else {
        f.x += f.vx * dt; // kein Ziel: weiterdriften
      }
    }
    state.floaters = state.floaters.filter((f) => f.x > -60 && f.x < W + 60);

    // Erwischt ein Floater eine Ente, ist sie verloren
    const eaten = new Set();
    for (const f of state.floaters) {
      for (const d of state.ducks) {
        if (!eaten.has(d) && Math.hypot(f.x - d.x, f.y - d.y) < f.radius + d.radius) {
          eaten.add(d);
        }
      }
    }
    for (const d of eaten) loseDuck(d);

    state.floaterSpawnTimer -= dt;
    if (state.floaterSpawnTimer <= 0 && state.floaters.length < MAX_FLOATERS) {
      spawnFloater();
      state.floaterSpawnTimer = FLOATER_SPAWN_INTERVAL;
    }
  }

  if (state.cast) {
    state.cast.age += dt;
    if (state.cast.age > 0.4) state.cast = null;
  }
  if (state.toast) {
    state.toast.age += dt;
    if (state.toast.age > 1.8) state.toast = null;
  }
  if (state.storm) {
    state.storm.age += dt;
    if (state.storm.age > state.storm.duration) state.storm = null;
  }

  // Partikel bewegen (mit leichter Schwerkraft)
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    p.life -= dt;
  }
  if (state.particles.length) {
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  // Screenshake abklingen
  if (state.shakeMag > 0) {
    state.shakeMag = Math.max(0, state.shakeMag - SHAKE_DECAY * dt);
  }

  // Sebastian: Stimmung kurz halten, dann zurück zu neutral
  if (state.sebastian.timer > 0) {
    state.sebastian.timer -= dt;
    if (state.sebastian.timer <= 0) state.sebastian.mood = "neutral";
  }
}

// ---- Zeichnen --------------------------------------------------------------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, WATER_TOP);
  g.addColorStop(0, COLOR.skyTop);
  g.addColorStop(1, COLOR.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(-30, -30, W + 60, WATER_TOP + 30);
}

function drawWater() {
  const g = ctx.createLinearGradient(0, WATER_TOP, 0, WATER_BOTTOM);
  g.addColorStop(0, COLOR.waterTop);
  g.addColorStop(1, COLOR.waterBottom);
  ctx.fillStyle = g;
  ctx.fillRect(-30, WATER_TOP, W + 60, WATER_BOTTOM - WATER_TOP);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  for (let row = 0; row < 7; row++) {
    const baseY = WATER_TOP + 40 + row * 62;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const y = baseY + Math.sin(x * 0.03 + state.time * 1.3 + row) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawDock() {
  ctx.fillStyle = COLOR.dock;
  ctx.fillRect(-30, WATER_BOTTOM, W + 60, H - WATER_BOTTOM + 30);
  ctx.strokeStyle = COLOR.dockDark;
  ctx.lineWidth = 3;
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, WATER_BOTTOM);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, WATER_BOTTOM + 1.5);
  ctx.lineTo(W, WATER_BOTTOM + 1.5);
  ctx.stroke();
}

function drawDuck(d) {
  const dir = d.vx >= 0 ? 1 : -1;
  const bob = Math.sin(state.time * 2 + d.phase) * 2.5;
  const x = d.x;
  const y = d.y + bob;

  // Kielwasser
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.ellipse(x - dir * 14, y + 9, 17, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper
  ctx.fillStyle = COLOR.duck;
  ctx.beginPath();
  ctx.ellipse(x, y, 17, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Schwanz
  ctx.beginPath();
  ctx.moveTo(x - dir * 14, y - 4);
  ctx.lineTo(x - dir * 25, y - 9);
  ctx.lineTo(x - dir * 14, y + 2);
  ctx.closePath();
  ctx.fill();

  // Kopf
  const hx = x + dir * 12;
  const hy = y - 9;
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fill();

  // Schnabel
  ctx.fillStyle = COLOR.beak;
  ctx.beginPath();
  ctx.moveTo(hx + dir * 6, hy - 1);
  ctx.lineTo(hx + dir * 15, hy + 1);
  ctx.lineTo(hx + dir * 6, hy + 4);
  ctx.closePath();
  ctx.fill();

  // Auge
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(hx + dir * 3, hy - 2, 1.7, 0, Math.PI * 2);
  ctx.fill();

  // Name überm Kopf
  drawLabel(d.member.name, x, y - 27);
}

function drawFloater(f) {
  const bob = Math.sin(state.time * 2 + f.phase) * 2.5;
  const x = f.x;
  const y = f.y + bob;
  const r = f.radius;
  const glowCol = f.isCaveman ? COLOR.cavemanGlow : COLOR.poisonGlow;

  // giftiges Glühen
  const glow = ctx.createRadialGradient(x, y, 2, x, y, r * 2.3);
  glow.addColorStop(0, `rgba(${glowCol},0.55)`);
  glow.addColorStop(1, `rgba(${glowCol},0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Körper (Giftklecks)
  ctx.fillStyle = f.isCaveman ? COLOR.caveman : COLOR.poison;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // aufsteigende Bläschen ("Blubbern")
  const bubbleCol = f.isCaveman ? "220,170,245" : "190,255,170";
  for (let i = 0; i < 3; i++) {
    const t = (state.time * 0.6 + f.phase + i * 0.34) % 1;
    const by = y + r * 0.5 - t * (r * 1.5);
    const ba = (1 - t) * 0.55;
    ctx.fillStyle = `rgba(${bubbleCol},${ba})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin((t + i) * 6) * r * 0.4, by, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Name (giftig getönt)
  drawLabel(f.name, x, y - r - 14, f.isCaveman ? "#ecc8ff" : "#c9ffb0");
}

// Sebastian-"Gott"/Meister am oberen Ufer — gezeichnete Figur (KEIN Foto, DSGVO):
// mächtige Aura, doppelter Anthropic-Sunburst, Heiligenschein-Ring, Wolkenthron.
const SEB = { x: W / 2, y: 54 };

function drawCloud(cx, cy, color, scale = 1) {
  ctx.fillStyle = color;
  const puffs = [
    [-26, 6, 0.9], [-12, -2, 1.15], [4, -5, 1.25],
    [20, -2, 1.05], [32, 7, 0.85], [2, 9, 1.35],
  ];
  for (const [dx, dy, s] of puffs) {
    ctx.beginPath();
    ctx.arc(cx + dx * scale, cy + dy * scale, 15 * s * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFire(x, y, heavy) {
  const len = heavy ? 96 : 54;
  const spread = heavy ? 19 : 12;
  const n = heavy ? 20 : 12;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const fy = y + p * len + Math.sin(state.time * 22 + i) * 2;
    const fx = x + Math.sin(state.time * 16 + i * 1.7) * spread * (0.3 + p);
    const r = (1 - p) * (heavy ? 9 : 6) + 2;
    ctx.fillStyle = p < 0.4 ? "#fff2b0" : p < 0.7 ? "#ff9a3c" : "#e8442a";
    ctx.globalAlpha = 0.85 * (1 - p * 0.5);
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSebastian() {
  const s = state.sebastian;
  const mood = s.mood;
  const t = state.time;
  const cx = SEB.x;
  const cy = SEB.y + Math.sin(t * 1.2) * 2; // sanftes göttliches Schweben
  const happy = mood === "happy";
  const angry = mood === "angry";

  // 1) Göttliche Aura (großer weicher Schein)
  const auraR = 122 + (happy ? 18 : 0) + Math.sin(t * 3) * 4;
  const auraCol = angry ? "120,40,40" : happy ? "255,200,120" : "240,160,90";
  const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraR);
  aura.addColorStop(0, `rgba(${auraCol},${angry ? 0.34 : 0.42})`);
  aura.addColorStop(1, `rgba(${auraCol},0)`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
  ctx.fill();

  // 2) Mächtiger Sunburst-Heiligenschein (zwei rotierte Lagen)
  const pulse = 1 + Math.sin(t * 4) * (happy ? 0.1 : 0.04);
  const rayOuter = angry ? "#9a4a2a" : happy ? "#ffc070" : "#ee9a4f";
  const rayInner = angry ? "#7a3520" : happy ? "#ffe6a8" : "#f6b260";
  ctx.globalAlpha = angry ? 0.6 : 0.92;
  drawSunburst(cx, cy, 66 * pulse, rayOuter, 12, t * 0.15);
  drawSunburst(cx, cy, 46 * pulse, rayInner, 12, Math.PI / 12 - t * 0.15);
  ctx.globalAlpha = 1;

  // 3) Goldener Heiligenschein-Ring hinter dem Kopf
  ctx.strokeStyle = angry ? "rgba(180,140,90,0.5)" : "rgba(255,214,140,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 34, 0, Math.PI * 2);
  ctx.stroke();

  // 4) Wolken-Thron (breit, geschichtet)
  drawCloud(cx, cy + 40, angry ? "#3f4751" : "#dfe7ee", 1.7);
  drawCloud(cx, cy + 30, angry ? "#566270" : "#f3f7fb", 1.25);

  // 5) Kopf (groß)
  ctx.fillStyle = "#f4d9b8";
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2a2a2a";
  if (angry) {
    // zusammengekniffene Augen + finstere Brauen
    ctx.fillRect(cx - 13, cy - 2, 8, 3);
    ctx.fillRect(cx + 5, cy - 2, 8, 3);
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 10);
    ctx.lineTo(cx - 5, cy - 5);
    ctx.moveTo(cx + 14, cy - 10);
    ctx.lineTo(cx + 5, cy - 5);
    ctx.stroke();
    // offener Mund + Feuer
    ctx.fillStyle = "#3a1a10";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 11, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    drawFire(cx, cy + 15, s.heavy);
  } else {
    // freundliche Augen
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 3, 2.7, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy - 3, 2.7, 0, Math.PI * 2);
    ctx.fill();
    // Mund: strahlendes Lächeln bei Rettung, sonst sanft
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (happy) {
      ctx.arc(cx, cy + 4, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    } else {
      ctx.arc(cx, cy + 6, 6, 0.2 * Math.PI, 0.8 * Math.PI);
    }
    ctx.stroke();
  }

  // 6) Dezentes Meister-Label
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = angry ? "#f0c89a" : "#ffe1a6";
  ctx.fillText("✦ SEBASTIAN ✦", cx, cy + 66);
  ctx.shadowBlur = 0;
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLabel(text, cx, cy, textColor = "#fff") {
  ctx.font = "bold 13px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 14;
  const h = 20;
  ctx.fillStyle = "rgba(15,15,15,0.6)";
  roundRect(cx - w / 2, cy - h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 1);
}

function drawSunburst(x, y, r, color, rays = 8, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  for (let i = 0; i < rays; i++) {
    ctx.rotate((Math.PI * 2) / rays);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.16, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.16, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawManikin(hook) {
  const baseX = clamp(hook.x, 60, W - 60);
  const baseY = WATER_BOTTOM - 6;
  const tipX = baseX + 26;
  const tipY = baseY - 58;

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 8, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOR.anthropic;
  roundRect(baseX - 16, baseY - 34, 32, 38, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(baseX, baseY - 44, 14, 0, Math.PI * 2);
  ctx.fill();
  drawSunburst(baseX, baseY - 16, 8, "#fff7f2", 8);

  ctx.strokeStyle = "#5b3a23";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(baseX + 8, baseY - 24);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(hook.x, hook.y);
  ctx.stroke();

  ctx.strokeStyle = "#dfe6ea";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hook.x, hook.y - 3, 5, 0.2 * Math.PI, 1.8 * Math.PI);
  ctx.stroke();
}

function drawCast() {
  if (!state.cast) return;
  const t = state.cast.age / 0.4;
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(state.cast.x, state.cast.y, 6 + t * 22, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStorm() {
  if (!state.storm) return;
  const s = state.storm;
  const t = s.age / s.duration;

  // Sicht-Debuff: Bildschirm abdunkeln, letzte 40 % ausfaden
  let dark = s.intensity;
  if (t > 0.6) dark *= Math.max(0, 1 - (t - 0.6) / 0.4);
  ctx.fillStyle = `rgba(6,10,24,${dark})`;
  ctx.fillRect(0, 0, W, H);

  // Blitz: heller Flash + Zacke kurz am Anfang
  if (s.age < 0.18) {
    const f = 1 - s.age / 0.18;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * f})`;
    ctx.fillRect(0, 0, W, H);
    drawBolt(s.boltX);
    if (s.heavy) drawBolt(W - s.boltX);
  } else if (s.heavy && Math.random() < 0.06) {
    // caveman: vereinzelt nachzuckende Blitze
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0, 0, W, H);
    drawBolt(120 + Math.random() * (W - 240));
  }
}

function drawBolt(startX) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#bcd8ff";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  let x = startX;
  let y = 0;
  ctx.moveTo(x, y);
  while (y < WATER_BOTTOM) {
    y += 36 + Math.random() * 30;
    x += (Math.random() - 0.5) * 64;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawToast() {
  if (!state.toast) return;
  const t = state.toast;
  const fade = t.age > 1.4 ? Math.max(0, 1 - (t.age - 1.4) / 0.4) : 1;
  ctx.globalAlpha = fade;
  ctx.font = "bold 18px system-ui, sans-serif";
  const w = ctx.measureText(t.text).width + 28;
  const x = W / 2 - w / 2;
  const y = 56;
  ctx.fillStyle = t.color || "rgba(217,119,87,0.94)";
  roundRect(x, y, w, 34, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t.text, W / 2, y + 18);
  ctx.globalAlpha = 1;
}

function drawHUD() {
  drawPill(14, 12, "Score: " + state.score, "left");
  const secs = Math.ceil(state.timeLeft);
  drawPill(W - 14, 12, "Zeit: " + secs + "s", "right");
}

function drawPill(x, y, text, align) {
  ctx.font = "bold 18px system-ui, sans-serif";
  const padX = 14;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 32;
  const px = align === "right" ? x - w : x;
  ctx.fillStyle = "rgba(15,15,15,0.55)";
  roundRect(px, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, px + padX, y + h / 2 + 1);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function render() {
  ctx.clearRect(0, 0, W, H);

  // Screenshake nur aufs Spielfeld (HUD/Overlay bleiben ruhig)
  let sx = 0;
  let sy = 0;
  if (state.shakeMag > 0.1) {
    sx = (Math.random() - 0.5) * 2 * state.shakeMag;
    sy = (Math.random() - 0.5) * 2 * state.shakeMag;
  }
  ctx.save();
  ctx.translate(sx, sy);

  drawSky();
  drawWater();
  for (const f of state.floaters) drawFloater(f);
  for (const d of state.ducks) drawDuck(d);
  drawDock();
  drawSebastian(); // Gott am oberen Ufer (speit ggf. Feuer nach unten)

  const hook = getHook();
  drawManikin(hook);
  drawCast();
  drawParticles();

  ctx.restore();

  drawStorm(); // Vollbild-Blitz + Sicht-Debuff, ohne Shake
  drawToast();
  drawHUD();
}

// ---- Spiel-Loop ------------------------------------------------------------
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ---- Spielzustand & UI-Overlays --------------------------------------------
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");

function startGame() {
  state.score = 0;
  state.timeLeft = GAME_DURATION;
  state.ducks = [];
  state.floaters = [];
  state.rescued = [];
  state.toast = null;
  state.storm = null;
  state.cast = null;
  state.particles = [];
  state.shakeMag = 0;
  state.sebastian.mood = "neutral";
  state.sebastian.timer = 0;
  state.spawnTimer = 0;
  state.floaterSpawnTimer = 1.0;
  deck = shuffle(MEMBERS.slice()); // Mitglieder-Deck neu mischen
  deckIndex = 0;
  for (let i = 0; i < 3; i++) spawnDuck();
  spawnFloater();
  state.phase = "playing";
  startScreen.classList.add("hidden");
  endScreen.classList.add("hidden");
}

function endGame() {
  state.phase = "ended";
  document.getElementById("finalScore").textContent =
    "Endpunktzahl: " + state.score;

  const list = document.getElementById("rescuedList");
  list.innerHTML = "";
  if (state.rescued.length === 0) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Diesmal niemand gerettet — versuch es nochmal!";
    list.appendChild(p);
  } else {
    for (const m of state.rescued) {
      const item = document.createElement("div");
      item.className = "rescued-item";
      const name = document.createElement("span");
      name.className = "r-name";
      name.textContent = m.name;
      const role = document.createElement("span");
      role.className = "r-role";
      role.textContent = m.rolle;
      item.append(name, role);
      list.appendChild(item);
    }
  }
  endScreen.classList.remove("hidden");
}

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);

// Sebastian reagiert: strahlt bei Rettung, wird sauer + speit Feuer bei Fehlfang.
onRescue(() => {
  state.sebastian.mood = "happy";
  state.sebastian.timer = 0.8;
  state.sebastian.heavy = false;
});
onMissCatch((info) => {
  state.sebastian.mood = "angry";
  state.sebastian.timer = info.heavy ? 1.0 : 0.7;
  state.sebastian.heavy = info.heavy;
});

requestAnimationFrame(loop); // Render-Loop läuft; Timer/Spawns erst ab "playing"
