// 🦆 Duck Rescue — Vanilla HTML5 Canvas + JS
// Schritt 1 (Gerüst): Canvas, See-Hintergrund, Manikin mit Angel,
// Maus-Steuerung, 60s-Timer, Score-Anzeige.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---- Layout-Konstanten -----------------------------------------------------
const W = canvas.width; // 800
const H = canvas.height; // 600
const WATER_TOP = 90; // darüber: Himmel/oberes Ufer (später: Sebastian-Gott)
const WATER_BOTTOM = 510; // darunter: Holzsteg, auf dem der Manikin steht
const GAME_DURATION = 60; // Sekunden

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
};

// ---- Spielzustand ----------------------------------------------------------
const state = {
  score: 0,
  timeLeft: GAME_DURATION,
  running: true,
  time: 0, // Gesamtzeit für Wasser-Animation
  mouse: { x: W / 2, y: 300 },
  cast: null, // { x, y, age } — kurzer Auswurf-Effekt beim Klick
};

// ---- Eingabe ---------------------------------------------------------------
// Maus-Position relativ zum (evtl. per CSS skalierten) Canvas berechnen.
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
  state.cast = { x: hook.x, y: hook.y, age: 0 }; // Auswurf auslösen
});

// Haken folgt der Maus, bleibt aber im Wasserbereich.
function getHook() {
  return {
    x: clamp(state.mouse.x, 18, W - 18),
    y: clamp(state.mouse.y, WATER_TOP + 14, WATER_BOTTOM - 8),
  };
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
  }

  if (state.cast) {
    state.cast.age += dt;
    if (state.cast.age > 0.4) state.cast = null;
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

  // Sanfte, animierte Wellenlinien
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
  // Planken-Fugen
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

// Anthropic-Sunburst (stilisierter Stern) — auch später für Sebastian nutzbar.
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
  const baseY = WATER_BOTTOM - 6; // steht vorne am Steg
  const tipX = baseX + 26;
  const tipY = baseY - 58; // Rutenspitze

  // Schatten auf dem Steg
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 8, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper (Claude-Code-Look, Anthropic-Coral)
  ctx.fillStyle = COLOR.anthropic;
  roundRect(baseX - 16, baseY - 34, 32, 38, 9);
  ctx.fill();
  // Kopf
  ctx.beginPath();
  ctx.arc(baseX, baseY - 44, 14, 0, Math.PI * 2);
  ctx.fill();
  // Anthropic-Stern auf der Brust
  drawSunburst(baseX, baseY - 16, 8, "#fff7f2", 8);

  // Angelrute
  ctx.strokeStyle = "#5b3a23";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(baseX + 8, baseY - 24);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Angelschnur zum Haken
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(hook.x, hook.y);
  ctx.stroke();

  // Haken
  ctx.strokeStyle = "#dfe6ea";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hook.x, hook.y - 3, 5, 0.2 * Math.PI, 1.8 * Math.PI);
  ctx.stroke();
}

function drawCast() {
  if (!state.cast) return;
  const t = state.cast.age / 0.4; // 0..1
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - t)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(state.cast.x, state.cast.y, 6 + t * 22, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHUD() {
  // Score links, Timer rechts — als lesbare Pillen.
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

// Canvas roundRect-Pfad (Pfad wird gesetzt; Aufrufer macht fill/stroke).
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawWater();
  drawDock();

  const hook = getHook();
  drawManikin(hook);
  drawCast();
  drawHUD();

  if (!state.running) drawTimeUp();
}

// ---- Spiel-Loop ------------------------------------------------------------
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // dt deckeln (Tab-Wechsel)
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
