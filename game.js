// Sky Flapper — a small flappy-style game in plain JavaScript + canvas.
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Tunables
  const GRAVITY = 1500;      // px/s²
  const FLAP_VELOCITY = -460; // px/s
  const SCROLL_SPEED = 160;  // px/s
  const PIPE_WIDTH = 64;
  const PIPE_GAP = 160;
  const PIPE_SPACING = 220;  // horizontal distance between pipes
  const GROUND_H = 80;

  const BEST_KEY = 'skyflapper.best';
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch {}

  let state;       // 'ready' | 'playing' | 'over'
  let paused = false;
  let bird, pipes, score, groundOffset, clouds, overTime;

  function reset() {
    state = 'ready';
    bird = { x: 110, y: H / 2 - 40, vy: 0, r: 15, angle: 0, wing: 0 };
    pipes = [];
    score = 0;
    groundOffset = 0;
    clouds = Array.from({ length: 5 }, (_, i) => ({
      x: i * 110 + Math.random() * 60,
      y: 40 + Math.random() * 200,
      s: 0.6 + Math.random() * 0.6,
    }));
  }

  function spawnPipe(x) {
    const margin = 60;
    const top = margin + Math.random() * (H - GROUND_H - PIPE_GAP - margin * 2);
    pipes.push({ x, top, passed: false });
  }

  function flap() {
    if (paused) return;
    if (state === 'ready') {
      state = 'playing';
      spawnPipe(W + 40);
    }
    if (state === 'playing') {
      bird.vy = FLAP_VELOCITY;
    } else if (state === 'over' && performance.now() - overTime > 500) {
      reset();
    }
  }

  function gameOver() {
    state = 'over';
    overTime = performance.now();
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
    }
  }

  function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function update(dt) {
    // Clouds drift slowly in every state for a living background.
    for (const c of clouds) {
      c.x -= SCROLL_SPEED * 0.2 * c.s * dt;
      if (c.x < -100) { c.x = W + 50; c.y = 40 + Math.random() * 200; }
    }

    if (state === 'ready') {
      bird.y = H / 2 - 40 + Math.sin(performance.now() / 250) * 8;
      bird.wing += dt * 10;
      groundOffset = (groundOffset + SCROLL_SPEED * dt) % 24;
      return;
    }

    // Bird physics (also runs after game over so it falls to the ground)
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    bird.angle = Math.max(-0.5, Math.min(1.4, bird.vy / 600));
    if (state === 'playing') bird.wing += dt * 14;

    const floor = H - GROUND_H - bird.r;
    if (bird.y > floor) {
      bird.y = floor;
      bird.vy = 0;
      if (state === 'playing') gameOver();
    }
    if (bird.y < bird.r) { bird.y = bird.r; bird.vy = 0; }

    if (state !== 'playing') return;

    groundOffset = (groundOffset + SCROLL_SPEED * dt) % 24;

    for (const p of pipes) {
      p.x -= SCROLL_SPEED * dt;
      if (!p.passed && p.x + PIPE_WIDTH < bird.x) {
        p.passed = true;
        score++;
      }
      const hitTop = circleRectHit(bird.x, bird.y, bird.r - 2, p.x, 0, PIPE_WIDTH, p.top);
      const hitBottom = circleRectHit(bird.x, bird.y, bird.r - 2, p.x, p.top + PIPE_GAP, PIPE_WIDTH, H);
      if (hitTop || hitBottom) gameOver();
    }

    if (pipes.length && pipes[0].x < -PIPE_WIDTH) pipes.shift();
    const last = pipes[pipes.length - 1];
    if (last && last.x < W - PIPE_SPACING) spawnPipe(last.x + PIPE_SPACING);
  }

  // ---------- Drawing ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5ec8f2');
    g.addColorStop(1, '#c9eefc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const c of clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 24 * c.s, c.y - 10 * c.s, 26 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 50 * c.s, c.y, 20 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant hills
    ctx.fillStyle = '#8fd6a0';
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND_H);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, H - GROUND_H - 40 - Math.sin(x / 60) * 18);
    }
    ctx.lineTo(W, H - GROUND_H);
    ctx.fill();
  }

  function drawPipes() {
    for (const p of pipes) {
      drawPipe(p.x, 0, p.top, true);
      drawPipe(p.x, p.top + PIPE_GAP, H - GROUND_H - p.top - PIPE_GAP, false);
    }
  }

  function drawPipe(x, y, h, isTop) {
    const g = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
    g.addColorStop(0, '#7b5cd6');
    g.addColorStop(0.5, '#a58bf0');
    g.addColorStop(1, '#5a3fb0');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, PIPE_WIDTH, h);
    // Cap
    const capH = 22;
    const capY = isTop ? y + h - capH : y;
    ctx.fillRect(x - 5, capY, PIPE_WIDTH + 10, capH);
    ctx.strokeStyle = '#3d2a7d';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, PIPE_WIDTH, h);
    ctx.strokeRect(x - 5, capY, PIPE_WIDTH + 10, capH);
  }

  function drawGround() {
    const y = H - GROUND_H;
    ctx.fillStyle = '#e3c37a';
    ctx.fillRect(0, y, W, GROUND_H);
    ctx.fillStyle = '#6cbf4f';
    ctx.fillRect(0, y, W, 14);
    ctx.fillStyle = '#58a63d';
    for (let x = -groundOffset; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y + 14);
      ctx.lineTo(x + 12, y + 14);
      ctx.lineTo(x + 6, y + 22);
      ctx.fill();
    }
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(state === 'ready' ? 0 : bird.angle);

    // Body
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.r + 3, bird.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b5521a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Belly
    ctx.fillStyle = '#ffd7a8';
    ctx.beginPath();
    ctx.ellipse(-2, 6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing (flaps)
    const wingY = Math.sin(bird.wing) * 6;
    ctx.fillStyle = '#ffb36b';
    ctx.beginPath();
    ctx.ellipse(-6, wingY, 9, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(10, -5, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(25, 3);
    ctx.lineTo(15, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function text(str, x, y, size, align = 'center') {
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.lineWidth = Math.max(3, size / 8);
    ctx.strokeStyle = '#1d2533';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(str, x, y);
  }

  function drawUI() {
    if (state === 'playing' || state === 'over') text(String(score), W / 2, 80, 52);

    if (state === 'ready') {
      text('Sky Flapper', W / 2, 150, 44);
      text('Tap / Space to start', W / 2, 400, 22);
      if (best) text(`Best: ${best}`, W / 2, 435, 18);
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(29,37,51,0.55)';
      ctx.fillRect(60, 200, W - 120, 180);
      text('Game Over', W / 2, 250, 40);
      text(`Score: ${score}   Best: ${best}`, W / 2, 300, 22);
      text('Tap / Space to retry', W / 2, 350, 18);
    }

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, W, H);
      text('Paused', W / 2, H / 2, 40);
    }
  }

  function draw() {
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();
    drawUI();
  }

  // ---------- Loop & input ----------
  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 1 / 30); // clamp to avoid huge jumps
    lastTime = now;
    if (!paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) flap();
    } else if (e.code === 'KeyP' && state === 'playing') {
      paused = !paused;
    }
  });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });

  reset();
  requestAnimationFrame(frame);
})();
