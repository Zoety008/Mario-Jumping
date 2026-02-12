(() => {
  const game = document.getElementById('game');
  const marioEl = document.getElementById('mario');
  const scoreEl = document.getElementById('score');
  const speedLabel = document.getElementById('speedLabel');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');

  // dynamic game size (recomputed on resize / each frame)
  function getGameSize(){
    return {w: game.clientWidth, h: game.clientHeight};
  }

  // Mario physics
  let mario = {x:80, y:0, w:48, h:48, vy:0}; // y = above ground
  const GROUND = 22;
  const JUMP_V = 700; // px/s
  const GRAV = -2200; // px/s^2

  // Obstacles
  let obstacles = [];
  let spawnTimer = 0;
  let spawnInterval = 1.6; // seconds

  // Speed and score
  let baseSpeed = 300; // px/s
  let speed = baseSpeed;
  let speedIncreaseRate = 8; // px/s per second
  let score = 0;

  let running = true;

  function createObstacle() {
    const gameSize = getGameSize();
    const w = 20 + Math.random() * 40;
    const h = 20 + Math.random() * 60;
    const el = document.createElement('div');
    el.className = 'obstacle';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = (gameSize.w + 20) + 'px';
    game.appendChild(el);
    obstacles.push({el, x: gameSize.w + 20, w, h});
  }

  function updateLabelAnimation() {
    // Make the label animation faster as speed increases (shorter duration)
    const duration = Math.max(0.12, 2 - (speed - baseSpeed) / 120);
    speedLabel.style.animationDuration = duration + 's';
  }

  function tick(t) {
    if (!running) return;
    if (!tick.last) tick.last = t;
    const dt = Math.min(0.05, (t - tick.last) / 1000);
    tick.last = t;

    // increase speed over time
    speed += speedIncreaseRate * dt;
    updateLabelAnimation();

    // update mario physics
    mario.vy += GRAV * dt;
    mario.y += mario.vy * dt;
    if (mario.y < 0) { mario.y = 0; mario.vy = 0; }
    marioEl.style.bottom = (GROUND + mario.y) + 'px';

    // spawn obstacles
    spawnTimer += dt;
    if (spawnTimer > spawnInterval) {
      spawnTimer = 0;
      // reduce interval slightly as time goes
      spawnInterval = 1.0 + Math.max(0.3, 1.6 - speed / 1000);
      createObstacle();
    }

    // move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      o.el.style.left = o.x + 'px';

      // collision
      const marioBox = {x: mario.x, y: mario.y + GROUND, w: mario.w, h: mario.h};
      const obBox = {x: o.x, y: GROUND, w: o.w, h: o.h};
      if (rectsOverlap(marioBox, obBox)) {
        gameOver();
        return;
      }

      if (o.x + o.w < -50) {
        o.el.remove();
        obstacles.splice(i,1);
      }
    }

    // score (faster when speed is higher)
    score += dt * (speed/100);
    scoreEl.textContent = 'Score: ' + Math.floor(score);

    // running animation toggle
    if (mario.y === 0) marioEl.classList.add('running'); else marioEl.classList.remove('running');

    requestAnimationFrame(tick);
  }

  function rectsOverlap(a,b){
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  function jump(){
    if (mario.y === 0) {
      mario.vy = JUMP_V;
    }
  }

  function gameOver(){
    running = false;
    overlay.classList.remove('hidden');
    finalScore.textContent = 'Your score: ' + Math.floor(score);
  }

  function restart(){
    // clean
    for (const o of obstacles) o.el.remove();
    obstacles = [];
    spawnTimer = 0; spawnInterval = 1.6; speed = baseSpeed; score = 0; running = true; overlay.classList.add('hidden');
    mario.y = 0; mario.vy = 0; marioEl.style.bottom = (GROUND + mario.y) + 'px';
    tick.last = null;
    requestAnimationFrame(tick);
  }

  // controls
  // keyboard controls
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); jump(); }
    if (e.key.toLowerCase() === 'r' && !running) restart();
  });

  // pointer/touch controls: tap/click the game area to jump
  game.addEventListener('pointerdown', (e) => { jump(); });
  // fallback for older browsers / desktop mice
  game.addEventListener('click', (e) => { jump(); });

  // on-screen mobile button
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', (e) => { jump(); });
    jumpBtn.addEventListener('click', (e) => { jump(); });
  }

  // overlay / restart handlers (allow tapping overlay or button to restart on mobile)
  const restartBtn = document.getElementById('restartBtn');
  if (restartBtn) {
    restartBtn.addEventListener('pointerdown', (e) => { restart(); });
    restartBtn.addEventListener('click', (e) => { restart(); });
  }

  // tapping the overlay anywhere restarts the game when game is over
  overlay.addEventListener('pointerdown', (e) => { if (!running) restart(); });
  overlay.addEventListener('click', (e) => { if (!running) restart(); });

  // handle window resize (optional adjustments)
  window.addEventListener('resize', () => { tick.last = null; });

  // start
  requestAnimationFrame(tick);

  // expose for debugging
  window._mj = {restart};

})();
