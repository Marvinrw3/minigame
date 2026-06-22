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
};

// ---- Spielzustand ----------------------------------------------------------
const state = {
  score: 0,
  timeLeft: GAME_DURATION,
  running: true,
  time: 0, // Gesamtzeit für Animationen
  mouse: { x: W / 2, y: 300 },
  cast: null, // { x, y, age } — kurzer Auswurf-Effekt beim Klick
  ducks: [], // aktive Enten im Wasser
  rescued: [], // gerettete Mitglieder (für Endscreen, Schritt 4)
  toast: null, // { text, age }
  spawnTimer: 0,
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
  if (!state.running) return;
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
  for (const d of state.ducks) {
    const dist = Math.hypot(d.x - hook.x, d.y - hook.y);
    if (dist < d.radius + CATCH_TOLERANCE && dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }
  if (best) catchDuck(best);
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

// ---- Hilfsfunktionen -------------------------------------------------------
function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// ---- Update ----------------------------------------------------------------
function update(dt) {
  state.time += dt;

  if (state.running) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.running = false;
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
  }

  if (state.cast) {
    state.cast.age += dt;
    if (state.cast.age > 0.4) state.cast = null;
  }
  if (state.toast) {
    state.toast.age += dt;
    if (state.toast.age > 1.8) state.toast = null;
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

function drawLabel(text, cx, cy) {
  ctx.font = "bold 13px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 14;
  const h = 20;
  ctx.fillStyle = "rgba(15,15,15,0.6)";
  roundRect(cx - w / 2, cy - h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = "#fff";
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

function drawTimeUp() {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Zeit abgelaufen", W / 2, H / 2);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawWater();
  for (const d of state.ducks) drawDuck(d);
  drawDock();

  const hook = getHook();
  drawManikin(hook);
  drawCast();
  drawToast();
  drawHUD();

  if (!state.running) drawTimeUp();
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

// Start mit ein paar Enten, damit der See nicht leer ist.
for (let i = 0; i < 3; i++) spawnDuck();
requestAnimationFrame(loop);
