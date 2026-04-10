const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let dots = [], births = 0, deaths = 0, paused = false, speedMult = 3, uidCounter = 0;
const MALE_COLOR = '#3a9e5f', FEM_COLOR = '#d4537e';
const RING_COLOR = '#f5c842', KID_COLOR = '#a78bfa';
const DOT_R = 7, MARRY_DIST = DOT_R * 3, REPRO_DIST = DOT_R * 4;
const AGE_PER_SEC = 0.5, MIN_MARRY_AGE = 18, REPRO_COOLDOWN = 20, ADULT_AGE = 18;
const W = 720, H = 800;

function randBetween(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(randBetween(a, b + 1)); }
function dist(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }

function makeDot(x, y, age, gender, id, parentUid) {
  return {
    uid: uidCounter++,
    id: id ?? randInt(1, 5),
    age, gender,
    deathAge: randBetween(60, 80),
    x: x ?? randBetween(DOT_R+20, W-DOT_R-20),
    y: y ?? randBetween(DOT_R+20, H-DOT_R-20),
    vx: randBetween(-1, 1) || 0.5,
    vy: randBetween(-1, 1) || 0.5,
    cooldown: 0,
    spouseUid: null,
    parentUid: parentUid ?? null,
    alive: true,
  };
}

function addDots(n) {
  for (let i = 0; i < n; i++)
    dots.push(makeDot(null, null, randBetween(15, 45), Math.random() < 0.5 ? 'm' : 'f', null, null));
}
addDots(8);

let lastTime = null;

function step(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.1) * speedMult;
  lastTime = ts;

  if (!paused) {
    const newDots = [];
    const uidMap = new Map(dots.map(d => [d.uid, d]));

    for (const d of dots) {
      if (!d.alive) continue;
      d.age += AGE_PER_SEC * dt;
      if (d.cooldown > 0) d.cooldown -= dt;

      if (d.age >= d.deathAge) {
        d.alive = false; deaths++;
        if (d.spouseUid !== null) {
          const sp = uidMap.get(d.spouseUid);
          if (sp) sp.spouseUid = null;
        }
        continue;
      }

      const isChild = d.age < ADULT_AGE;

      if (isChild && d.parentUid !== null) {
        const parent = uidMap.get(d.parentUid);
        if (parent && parent.alive) {
          const dx = parent.x - d.x, dy = parent.y - d.y;
          const dd = Math.sqrt(dx*dx + dy*dy) || 1;
          const pull = dd > DOT_R * 5 ? 0.12 : 0.02;
          d.vx += (dx/dd)*pull + randBetween(-0.06, 0.06);
          d.vy += (dy/dd)*pull + randBetween(-0.06, 0.06);
        } else {
          d.parentUid = null;
          d.vx += randBetween(-0.15, 0.15);
          d.vy += randBetween(-0.15, 0.15);
        }
      } else if (!isChild && d.spouseUid !== null) {
        const spouse = uidMap.get(d.spouseUid);
        if (spouse && spouse.alive) {
          const dx = spouse.x - d.x, dy = spouse.y - d.y;
          const dd = Math.sqrt(dx*dx + dy*dy) || 1;
          const pull = dd > REPRO_DIST ? 0.08 : 0;
          d.vx += (dx/dd)*pull + randBetween(-0.08, 0.08);
          d.vy += (dy/dd)*pull + randBetween(-0.08, 0.08);
        } else {
          d.spouseUid = null;
          d.vx += randBetween(-0.15, 0.15);
          d.vy += randBetween(-0.15, 0.15);
        }
      } else {
        d.vx += randBetween(-0.15, 0.15);
        d.vy += randBetween(-0.15, 0.15);
      }

      const sp = Math.sqrt(d.vx*d.vx + d.vy*d.vy);
      if (sp > 1.4) { d.vx = d.vx/sp*1.4; d.vy = d.vy/sp*1.4; }
      d.x += d.vx; d.y += d.vy;
      if (d.x < DOT_R) { d.x = DOT_R; d.vx = Math.abs(d.vx); }
      if (d.x > W-DOT_R) { d.x = W-DOT_R; d.vx = -Math.abs(d.vx); }
      if (d.y < DOT_R) { d.y = DOT_R; d.vy = Math.abs(d.vy); }
      if (d.y > H-DOT_R) { d.y = H-DOT_R; d.vy = -Math.abs(d.vy); }
    }

    const alive = dots.filter(d => d.alive);
    const uidMapAlive = new Map(alive.map(d => [d.uid, d]));

    const singles_m = alive.filter(d => d.gender==='m' && d.spouseUid===null && d.age>=MIN_MARRY_AGE);
    const singles_f = alive.filter(d => d.gender==='f' && d.spouseUid===null && d.age>=MIN_MARRY_AGE);
    for (const m of singles_m) {
      for (const f of singles_f) {
        if (m.id === f.id && dist(m, f) < MARRY_DIST) {
          m.spouseUid = f.uid; f.spouseUid = m.uid; break;
        }
      }
    }

    const married_m = alive.filter(d => d.gender==='m' && d.spouseUid!==null && d.cooldown<=0);
    for (const m of married_m) {
      const f = uidMapAlive.get(m.spouseUid);
      if (!f || !f.alive || f.cooldown > 0) continue;
      if (dist(m, f) < REPRO_DIST) {
        const count = randInt(1, 3);
        for (let i = 0; i < count; i++) {
          newDots.push(makeDot(m.x+randBetween(-10,10), m.y+randBetween(-10,10), 0, Math.random()<0.5?'m':'f', m.id, m.uid));
          births++;
        }
        m.cooldown = REPRO_COOLDOWN; f.cooldown = REPRO_COOLDOWN;
      }
    }

    dots = [...alive, ...newDots];
    if (dots.length > 220) dots = dots.slice(dots.length - 220);
  }

  draw();

  const alive = dots.filter(d => d.alive);
  document.getElementById('sPop').textContent = alive.length;
  document.getElementById('sMarried').textContent = Math.floor(alive.filter(d => d.spouseUid !== null).length / 2);
  document.getElementById('sBirth').textContent = births;
  document.getElementById('sDeath').textContent = deaths;

  requestAnimationFrame(step);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const alive = dots.filter(d => d.alive);
  const uidMap = new Map(alive.map(d => [d.uid, d]));

  for (const d of alive) {
    if (d.gender === 'm' && d.spouseUid !== null) {
      const spouse = uidMap.get(d.spouseUid);
      if (spouse) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(spouse.x, spouse.y);
        ctx.strokeStyle = RING_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.stroke();
      }
    }
  }

  for (const d of alive) {
    if (d.age < ADULT_AGE && d.parentUid !== null) {
      const parent = uidMap.get(d.parentUid);
      if (parent && parent.alive) {
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(parent.x, parent.y);
        ctx.strokeStyle = KID_COLOR;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  for (const d of alive) {
    const alpha = Math.max(0.4, 1 - (d.age / d.deathAge) * 0.6);
    const isChild = d.age < ADULT_AGE;
    const r = isChild ? DOT_R * 0.65 : DOT_R;

    ctx.globalAlpha = alpha;

    if (d.spouseUid !== null) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = RING_COLOR;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.fillStyle = d.gender === 'm' ? MALE_COLOR : FEM_COLOR;
    ctx.fill();

    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#fff';
    ctx.font = `${isChild ? 6 : 8}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.id, d.x, d.y);

    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = d.gender === 'm' ? MALE_COLOR : FEM_COLOR;
    ctx.font = '8px sans-serif';
    ctx.fillText(Math.floor(d.age), d.x, d.y - r - 4);
    ctx.globalAlpha = 1;
  }
}

document.getElementById('btnPause').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('btnPause').textContent = paused ? 'Resume' : 'Pause';
});
document.getElementById('btnAdd').addEventListener('click', () => addDots(10));
document.getElementById('speed').addEventListener('input', e => {
  speedMult = +e.target.value;
  document.getElementById('speedVal').textContent = speedMult;
});

requestAnimationFrame(step);