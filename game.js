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
const MAX_DUCKS = 7; // gleichzeitig im Wasser
const SPAWN_INTERVAL = 0.9; // Sekunden zwischen Spawns
const DUCK_POINTS = 10; // Punkte pro geretteter Ente
const DUCK_RADIUS = 16; // Körperradius
const CATCH_TOLERANCE = 14; // zusätzlicher Fang-Radius um den Haken

// Giftige Floater (Strafmechanik) — echte Tool-Namen aus plan/spielkonzept.md
const POISON_NAMES = [
  "caveman", "council", "grill-me", "nano-banana", "firecrawl", "n8n",
  "meta-ads", "playwright", "superpowers", "claude-ads", "claude-seo",
];
const MAX_FLOATERS = 3; // gleichzeitig im Wasser
const FLOATER_SPAWN_INTERVAL = 2.2; // Sekunden zwischen Floater-Spawns
const FLOATER_PENALTY = 15; // Minuspunkte normaler Floater
const CAVEMAN_PENALTY = 30; // Minuspunkte caveman (härtere Strafe)
const FLOATER_RADIUS = 15;
const CAVEMAN_RADIUS = 20;

// Gewitter / Sicht-Debuff bei Fehlfang
const STORM_DURATION = 1.2; // Sekunden
const STORM_DARK = 0.36; // Abdunkelung 0..1
const CAVEMAN_STORM_DURATION = 3.6; // caveman: länger
const CAVEMAN_STORM_DARK = 0.72; // caveman: dunkler

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
  // Quak-Sound folgt in Schritt 5.
}

function showToast(text) {
  state.toast = { text, age: 0 };
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

// Donner-Sound (relativer Pfad). Abspielen erfolgt im Klick-Kontext = User-Geste.
const donnerSound = new Audio("assets/donner.mp3");
function playDonner() {
  donnerSound.currentTime = 0;
  donnerSound.play().catch(() => {});
}

function catchFloater(f) {
  state.floaters = state.floaters.filter((x) => x !== f);
  const heavy = f.isCaveman;
  state.score -= heavy ? CAVEMAN_PENALTY : FLOATER_PENALTY;
  startStorm(heavy);
  playDonner();
  emitMissCatch({ name: f.name, heavy }); // Schritt 5: Sebastians Feuer-Reaktion
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
  const speed = 26 + Math.random() * 22;
  state.floaters.push({
    name,
    isCaveman,
    x: fromLeft ? -30 : W + 30,
    y: WATER_TOP + 46 + Math.random() * (WATER_BOTTOM - WATER_TOP - 76),
    vx: fromLeft ? speed : -speed,
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

    // Giftige Floater bewegen + Nachschub
    for (const f of state.floaters) f.x += f.vx * dt;
    state.floaters = state.floaters.filter((f) => f.x > -50 && f.x < W + 50);
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
}

// ---- Zeichnen --------------------------------------------------------------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, WATER_TOP);
  g.addColorStop(0, COLOR.skyTop);
  g.addColorStop(1, COLOR.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, WATER_TOP);
}

function drawWater() {
  const g = ctx.createLinearGradient(0, WATER_TOP, 0, WATER_BOTTOM);
  g.addColorStop(0, COLOR.waterTop);
  g.addColorStop(1, COLOR.waterBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, WATER_TOP, W, WATER_BOTTOM - WATER_TOP);

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
  ctx.fillRect(0, WATER_BOTTOM, W, H - WATER_BOTTOM);
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

function drawSunburst(x, y, r, color, rays = 8) {
  ctx.save();
  ctx.translate(x, y);
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
  ctx.fillStyle = "rgba(217,119,87,0.94)";
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
  drawSky();
  drawWater();
  for (const f of state.floaters) drawFloater(f);
  for (const d of state.ducks) drawDuck(d);
  drawDock();

  const hook = getHook();
  drawManikin(hook);
  drawCast();
  drawStorm(); // Blitz + Sicht-Debuff über dem Spielfeld
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

requestAnimationFrame(loop); // Render-Loop läuft; Timer/Spawns erst ab "playing"
