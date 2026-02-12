(() => {
  const game = document.getElementById('game');
  const marioEl = document.getElementById('mario');
  const scoreEl = document.getElementById('score');
  const speedLabel = document.getElementById('speedLabel');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');
  const highScoreEl = document.getElementById('highScore');

  // dynamic game size (recomputed on resize / each frame)
  function getGameSize(){
    return {w: game.clientWidth, h: game.clientHeight};
  }

  // Mario physics
  let mario = {x:80, y:0, w:72, h:72, vy:0}; // y = above ground (match CSS size)
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

  // high scores list (persist in localStorage)
  const HS_KEY = 'mj_highscore_v1'; // legacy single-value key (migration)
  const HS_LIST_KEY = 'mj_highscores_v1';
  let highs = [];
  try {
    const raw = localStorage.getItem(HS_LIST_KEY);
    if (raw) highs = JSON.parse(raw) || [];
    else {
      // migrate legacy single-value high score if present
      const old = parseInt(localStorage.getItem(HS_KEY));
      if (!isNaN(old) && old > 0) highs = [{score: old, name: ''}];
    }
  } catch(e){ highs = []; }

  // normalize highs to objects {score, name}
  highs = highs.map(h => {
    if (h && typeof h === 'object') return { score: Number(h.score)||0, name: String(h.name||'') };
    return { score: Number(h)||0, name: '' };
  });

  function saveHighs(){ try { localStorage.setItem(HS_LIST_KEY, JSON.stringify(highs)); } catch(e){} }

  function updateHighScoreDisplay(){
    const topEntry = highs.length ? highs[0] : null;
    if (!topEntry) {
      highScoreEl.textContent = 'High: 0';
    } else {
      const name = topEntry.name ? topEntry.name : '—';
      highScoreEl.textContent = 'High: ' + Math.floor(topEntry.score) + ' (' + name + ')';
    }
  }
  updateHighScoreDisplay();

  function renderHighScoresList(newScore){
    const container = document.getElementById('highScoresList');
    if (!container) return;
    container.innerHTML = '';
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = 'Top Scores';
    container.appendChild(caption);
    const ol = document.createElement('ol');
    for (let i = 0; i < highs.length; i++){
      const entry = highs[i];
      const li = document.createElement('li');
      const displayName = entry.name ? entry.name : '---';
      li.textContent = Math.floor(entry.score) + '   ' + displayName;
      if (newScore !== undefined && Math.floor(newScore) === Math.floor(entry.score) && entry.name === ''){
        li.classList.add('new');
      }
      ol.appendChild(li);
    }
    container.appendChild(ol);
  }

  // obstacle configuration
  const useVolcanoOnly = true; // set to true to make all obstacles volcanoes

  let running = true;
  let lastScore = 0;

  // sprite animation state (for JS-driven frames)
  const SPRITE_COUNT = 4;
  const SPRITE_W = 72; // px per frame in sprites.svg
  const SPRITE_H = 72;
  let spriteTimer = 0;
  const SPRITE_FRAME_DUR = 0.12; // seconds per frame when running

  function createObstacle() {
    const gameSize = getGameSize();
    const useVolcano = useVolcanoOnly ? true : (Math.random() < 0.28); // ~28% chance to spawn a volcano unless forced
    let w, h;
    const el = document.createElement('div');
    if (useVolcano) {
      el.className = 'obstacle volcano';
      // random volcano sizes so some are easy to jump over and some are taller
      const minH = 36;
      const maxH = 96;
      h = Math.floor(minH + Math.random() * (maxH - minH));
      // make width proportional to height
      w = Math.floor(h * (0.9 + Math.random() * 0.4));
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    } else {
      w = 20 + Math.random() * 40;
      h = 20 + Math.random() * 60;
      el.className = 'obstacle';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    }
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

      // collision (use smaller hitboxes to avoid unfair premature hits)
      // tightened Mario hitbox insets (larger inset -> smaller hitbox)
      const marioHitInsetX = 18;
      const marioHitInsetY = 12;
      const marioBox = {
        x: mario.x + marioHitInsetX,
        y: mario.y + GROUND + marioHitInsetY,
        w: Math.max(8, mario.w - marioHitInsetX * 2),
        h: Math.max(8, mario.h - marioHitInsetY * 2)
      };

      // obstacle hitbox shrink (volcano gets a tighter box)
      const isVolcano = o.el.classList && o.el.classList.contains && o.el.classList.contains('volcano');
      // tightened obstacle hitboxes (volcano smaller hitbox)
      const obInsetX = isVolcano ? 18 : 10;
      const obInsetY = isVolcano ? 12 : 8;
      const obBox = {
        x: o.x + obInsetX,
        y: GROUND + obInsetY,
        w: Math.max(6, o.w - obInsetX * 2),
        h: Math.max(6, o.h - obInsetY * 2)
      };

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

    // running / jumping animation toggle (works with sprite and DOM shapes)
    const isSprite = marioEl.classList.contains('sprite');
    if (isSprite) {
      // JS-driven sprite frames: running cycles frames 0..2, jump shows frame 3
      if (mario.y === 0) {
        spriteTimer += dt;
        const frame = Math.floor(spriteTimer / SPRITE_FRAME_DUR) % (SPRITE_COUNT - 1); // cycle 0..2
        const px = -frame * SPRITE_W;
        marioEl.style.backgroundSize = (SPRITE_W * SPRITE_COUNT) + 'px ' + SPRITE_H + 'px';
        marioEl.style.backgroundPosition = px + 'px 0px';
      } else {
        // in-air: show last frame (jump)
        spriteTimer = 0;
        const px = - (SPRITE_COUNT - 1) * SPRITE_W;
        marioEl.style.animation = 'none';
        marioEl.style.backgroundSize = (SPRITE_W * SPRITE_COUNT) + 'px ' + SPRITE_H + 'px';
        marioEl.style.backgroundPosition = px + 'px 0px';
      }
      // keep class for non-sprite styles
      if (mario.y === 0) marioEl.classList.add('running'); else marioEl.classList.remove('running');
    } else {
      // non-sprite DOM-based shapes (keep previous behavior)
      if (mario.y === 0) {
        marioEl.classList.add('running');
        marioEl.classList.remove('jump');
      } else {
        marioEl.classList.remove('running');
        marioEl.classList.add('jump');
      }
    }

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
    // update highs list and show it
    const s = Math.floor(score);
    lastScore = s;
    // add entry object, then sort by score desc
    highs.push({score: s, name: ''});
    highs.sort((a,b)=>b.score - a.score);
    highs = highs.slice(0,5);
    saveHighs();
    updateHighScoreDisplay();
    renderHighScoresList(s);

    // if the new score made the list and has no name, prompt for a name
    const newIndex = highs.findIndex(e => e.score === s && e.name === '');
    if (newIndex !== -1) {
      // create name input UI
      const container = overlay.querySelector('.overlay-content');
      if (container) {
        const form = document.createElement('div');
        form.id = 'nameEntry';
        form.style.marginTop = '10px';
        const label = document.createElement('div');
        label.textContent = 'Enter name for your score:';
        label.style.fontWeight = '700';
        label.style.marginBottom = '6px';
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 16;
        input.placeholder = 'Your name';
        input.style.padding = '8px';
        input.style.borderRadius = '6px';
        input.style.border = '1px solid #ccc';
        input.style.marginRight = '8px';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.padding = '8px 12px';
        saveBtn.style.borderRadius = '6px';
        saveBtn.style.background = '#2b7a78';
        saveBtn.style.color = '#fff';
        saveBtn.style.border = 'none';
        saveBtn.style.fontWeight = '700';
        const doSave = ()=>{
          const name = input.value.trim() || 'Player';
          highs[newIndex].name = name;
          saveHighs();
          updateHighScoreDisplay();
          renderHighScoresList();
          // remove form
          const f = document.getElementById('nameEntry'); if (f) f.remove();
        };
        saveBtn.addEventListener('click', doSave);
        // allow Enter to save
        input.addEventListener('keydown', (ev)=>{
          if (ev.key === 'Enter') { ev.preventDefault(); doSave(); }
        });
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(saveBtn);
        container.appendChild(form);
        input.focus();
      }
    }
  }

  function restart(){
    // clean
    for (const o of obstacles) o.el.remove();
    obstacles = [];
    spawnTimer = 0; spawnInterval = 1.6; speed = baseSpeed; score = 0; running = true; overlay.classList.add('hidden');
    mario.y = 0; mario.vy = 0; marioEl.style.bottom = (GROUND + mario.y) + 'px';
    tick.last = null;
    requestAnimationFrame(tick);
    // if name entry present but not yet saved, persist it now
    const nameForm = document.getElementById('nameEntry');
    if (nameForm) {
      const input = nameForm.querySelector('input');
      if (input) {
        const val = input.value.trim();
        if (val) {
          // find matching score entry with empty name (use lastScore fallback)
          const idx = highs.findIndex(e => e.score === lastScore && (!e.name || e.name === ''));
          if (idx !== -1) {
            highs[idx].name = val || 'Player';
            saveHighs();
            updateHighScoreDisplay();
          }
        }
      }
      nameForm.remove();
    }
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
