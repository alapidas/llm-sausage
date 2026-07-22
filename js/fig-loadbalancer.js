/* fig-loadbalancer — requests stream through the gateway to model servers. */
'use strict';

Figures.register('fig-loadbalancer', (container, kit) => {
  const level = kit.level();
  const NOVICE = level === 'novice';
  const DEEP = level === 'deep';

  const ARIA = NOVICE
    ? 'Requests arriving as dots that pause at a front desk to be checked — some are turned away — before being sent to whichever helper computer has a free hand.'
    : (DEEP
      ? 'Requests streaming through an API gateway that authenticates and validates them before a load balancer spreads the survivors across a fleet of model servers, each server showing its queue depth and health, with a draining server pulled from rotation.'
      : 'Requests streaming through an API gateway that authenticates and validates them before a load balancer spreads the survivors across a fleet of model servers.');

  const cv = kit.makeCanvas(container, { aspect: 0.62, maxHeight: 380,
    ariaLabel: ARIA });

  let rate = NOVICE ? 3 : 6; // requests per second
  if (!NOVICE) {
    const controls = kit.makeControls(container);
    kit.makeSlider(controls, {
      label: 'Incoming requests', min: 2, max: 22, step: 1, value: rate,
      format: v => v.toFixed(0) + '/s',
      onInput: v => { rate = v; },
    });
  }

  const NSERV = NOVICE ? 3 : 6;
  const CAPACITY = 8;             // jobs per server before the bar is "full"
  const servers = [];
  for (let i = 0; i < NSERV; i++) servers.push({ jobs: [], health: 'up', healthT: 0 }); // jobs = remaining seconds
  const dots = [];
  const COLORS = [PAL.blue, PAL.green, PAL.purple, PAL.teal, PAL.yellow, PAL.blueDark];
  let colorIdx = 0;
  let spawnAcc = 0;
  let mineTimer = 1.2;            // countdown to spawn "your" orange request
  let mineAlive = false;
  let nRouted = 0, nRefused = 0;
  let drainAcc = 0;              // deep: time since last replica pulled from rotation

  const D_APPROACH = 1.0, D_CHECK = 0.28, D_ROUTE = 0.75, D_REJECT = 0.7;

  function layout() {
    const w = cv.w, h = cv.h;
    const narrow = w < 460;
    const sw = Math.min(w * 0.24, 128);          // server box width
    const sx = w - sw - 8;                        // server box x
    const top = 26, bottom = 12;
    const sh = Math.min(34, (h - top - bottom) / NSERV - 6);
    const gap = (h - top - bottom - NSERV * sh) / (NSERV - 1);
    const gwW = Math.min(w * 0.2, 96);
    const gw = {
      x: w * (narrow ? 0.3 : 0.34), y: h * 0.5,
      w: gwW, h: Math.min(h * 0.5, 150),
    };
    return { w, h, narrow, gw, sx, sw, sh, top, gap };
  }

  function serverY(L, i) { return L.top + i * (L.sh + L.gap) + L.sh / 2; }

  function pickServer() {
    if (DEEP) {
      // load balancer skips replicas that fail their readiness check
      const up = [];
      for (let i = 0; i < NSERV; i++) if (servers[i].health === 'up') up.push(i);
      if (up.length >= 2) {
        const a = up[Math.floor(Math.random() * up.length)];
        let b = up[Math.floor(Math.random() * up.length)];
        if (b === a) b = up[(up.indexOf(a) + 1) % up.length];
        return servers[a].jobs.length <= servers[b].jobs.length ? a : b;
      } else if (up.length === 1) return up[0];
    }
    // power of two choices: sample two servers, take the less loaded one
    const a = Math.floor(Math.random() * NSERV);
    let b = Math.floor(Math.random() * NSERV);
    if (b === a) b = (b + 1) % NSERV;
    return servers[a].jobs.length <= servers[b].jobs.length ? a : b;
  }

  function spawn(mine) {
    dots.push({
      phase: 'approach', t: 0,
      yJit: (Math.random() * 2 - 1),         // -1..1, entry lane offset
      color: mine ? PAL.orange : COLORS[colorIdx++ % COLORS.length],
      mine: !!mine,
      reject: !mine && Math.random() < 0.09,
      server: 0,
    });
    if (mine) mineAlive = true;
  }

  function step(dt) {
    spawnAcc += dt * rate;
    while (spawnAcc >= 1 && dots.length < 140) { spawnAcc -= 1; spawn(false); }
    if (!mineAlive) {
      mineTimer -= dt;
      if (mineTimer <= 0) spawn(true);
    }
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.t += dt;
      if (d.phase === 'approach' && d.t >= D_APPROACH) {
        d.phase = 'check'; d.t = 0;
      } else if (d.phase === 'check' && d.t >= D_CHECK) {
        if (d.reject) { d.phase = 'bounce'; d.t = 0; nRefused++; }
        else { d.phase = 'route'; d.t = 0; d.server = pickServer(); }
      } else if (d.phase === 'route' && d.t >= D_ROUTE) {
        servers[d.server].jobs.push(1.2 + Math.random() * 1.6);
        nRouted++;
        if (d.mine) { mineAlive = false; mineTimer = 7; }
        dots.splice(i, 1);
      } else if (d.phase === 'bounce' && d.t >= D_REJECT) {
        dots.splice(i, 1);
      }
    }
    for (const s of servers) {
      for (let j = s.jobs.length - 1; j >= 0; j--) {
        s.jobs[j] -= dt;
        if (s.jobs[j] <= 0) s.jobs.splice(j, 1);
      }
    }
    if (DEEP) {
      // occasionally pull a healthy replica out of rotation; it drains, then
      // its readiness check passes again and it rejoins the pool
      for (const s of servers) {
        if (s.health === 'drain') {
          s.healthT -= dt;
          if (s.healthT <= 0 && s.jobs.length === 0) s.health = 'up';
        }
      }
      drainAcc += dt;
      if (drainAcc > 5) {
        drainAcc = 0;
        const up = servers.filter(s => s.health === 'up');
        if (up.length > 1) {
          const s = up[Math.floor(Math.random() * up.length)];
          s.health = 'drain'; s.healthT = 2.6;
        }
      }
    }
  }

  function dotPos(L, d) {
    const gw = L.gw;
    const checkX = gw.x - gw.w / 2;              // left edge of gateway
    const laneY = gw.y + d.yJit * gw.h * 0.32;
    if (d.phase === 'approach') {
      const p = kit.ease.out(kit.clamp(d.t / D_APPROACH, 0, 1));
      return { x: kit.lerp(-8, checkX - 5, p), y: kit.lerp(laneY, gw.y + d.yJit * gw.h * 0.3, p) };
    }
    if (d.phase === 'check') return { x: checkX - 5, y: gw.y + d.yJit * gw.h * 0.3 };
    if (d.phase === 'bounce') {
      const p = kit.clamp(d.t / D_REJECT, 0, 1);
      return { x: checkX - 5 - p * 55, y: gw.y + d.yJit * gw.h * 0.3 + p * p * 60 };
    }
    // route: curve from gateway right edge to server left edge
    const p = kit.ease.inOut(kit.clamp(d.t / D_ROUTE, 0, 1));
    const x0 = gw.x + gw.w / 2, y0 = gw.y;
    const x1 = L.sx - 4, y1 = serverY(L, d.server);
    const mx = (x0 + x1) / 2;
    const u = 1 - p;
    return {
      x: u * u * x0 + 2 * u * p * mx + p * p * x1,
      y: u * u * y0 + 2 * u * p * y0 + p * p * y1,
    };
  }

  function draw() {
    const { ctx, w, h } = cv;
    ctx.clearRect(0, 0, w, h);
    const L = layout();
    const gw = L.gw;

    // faint route lines gateway -> servers
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i < NSERV; i++) {
      ctx.beginPath();
      ctx.moveTo(gw.x + gw.w / 2, gw.y);
      ctx.lineTo(L.sx - 4, serverY(L, i));
      ctx.stroke();
    }

    // gateway box
    kit.roundedRect(ctx, gw.x - gw.w / 2, gw.y - gw.h / 2, gw.w, gw.h, 9);
    ctx.fillStyle = PAL.graySoft; ctx.fill();
    ctx.strokeStyle = PAL.faint; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = PAL.ink;
    ctx.font = '600 12px ' + PAL.sans;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(NOVICE ? 'front desk' : 'gateway', gw.x, gw.y - (L.narrow ? 0 : 22));
    if (!L.narrow) {
      ctx.fillStyle = PAL.faint;
      ctx.font = '11px ' + PAL.sans;
      if (NOVICE) {
        ctx.fillText('checks your', gw.x, gw.y + 2);
        ctx.fillText('request', gw.x, gw.y + 18);
      } else {
        ctx.fillText('auth · limits', gw.x, gw.y + 2);
        ctx.fillText('validate · route', gw.x, gw.y + 18);
      }
    }

    // checkpoint dashed line at gateway entrance
    ctx.strokeStyle = PAL.faint;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(gw.x - gw.w / 2 - 5, gw.y - gw.h / 2);
    ctx.lineTo(gw.x - gw.w / 2 - 5, gw.y + gw.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // servers with load bars
    for (let i = 0; i < NSERV; i++) {
      const y = serverY(L, i) - L.sh / 2;
      const drain = DEEP && servers[i].health === 'drain';
      kit.roundedRect(ctx, L.sx, y, L.sw, L.sh, 6);
      ctx.fillStyle = PAL.bg; ctx.fill();
      ctx.strokeStyle = drain ? PAL.red : PAL.faint; ctx.lineWidth = 1.2; ctx.stroke();
      const load = kit.clamp(servers[i].jobs.length / CAPACITY, 0, 1);
      const barW = L.sw - 12, barH = 5;
      const bx = L.sx + 6, by = y + L.sh - barH - 5;
      kit.roundedRect(ctx, bx, by, barW, barH, 2.5);
      ctx.fillStyle = PAL.graySoft; ctx.fill();
      if (load > 0) {
        kit.roundedRect(ctx, bx, by, Math.max(3, barW * load), barH, 2.5);
        ctx.fillStyle = load < 0.55 ? PAL.green : (load < 0.85 ? PAL.yellow : PAL.red);
        ctx.fill();
      }
      if (L.sh >= 26) {
        ctx.fillStyle = PAL.faint;
        ctx.font = '11px ' + PAL.mono;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(NOVICE ? (L.narrow ? 'h' + (i + 1) : 'helper ' + (i + 1))
                            : (L.narrow ? 's' + (i + 1) : 'server ' + (i + 1)), bx, y + 13);
        if (DEEP) {
          ctx.textAlign = 'right';
          ctx.fillStyle = drain ? PAL.redDark : PAL.faint;
          ctx.fillText(drain ? 'drain' : 'q' + servers[i].jobs.length, L.sx + L.sw - 6, y + 13);
          ctx.textAlign = 'left';
        }
      }
    }

    // dots
    for (const d of dots) {
      const p = dotPos(L, d);
      const r = d.mine ? 5.5 : 3.6;
      let alpha = 1;
      if (d.phase === 'bounce') alpha = 1 - d.t / D_REJECT;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = (d.phase === 'bounce') ? PAL.red : d.color;
      ctx.fill();
      if (d.mine) {
        ctx.strokeStyle = PAL.inkStrong; ctx.lineWidth = 1.2; ctx.stroke();
      }
      // auth-check flash: expanding ring while at the checkpoint
      if (d.phase === 'check') {
        const f = d.t / D_CHECK;
        ctx.globalAlpha = alpha * (1 - f);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2 + f * 7, 0, Math.PI * 2);
        ctx.strokeStyle = d.reject ? PAL.red : (d.mine ? PAL.orange : PAL.blue);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (d.mine && d.phase !== 'bounce') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = PAL.orange;
        ctx.font = '600 11px ' + PAL.sans;
        ctx.textAlign = 'center';
        ctx.fillText('you', p.x, p.y - 10);
      }
      ctx.globalAlpha = 1;
    }

    // counters
    ctx.fillStyle = PAL.faint;
    ctx.font = '11px ' + PAL.mono;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(NOVICE
      ? 'sent on ' + nRouted + '   turned away ' + nRefused
      : 'routed ' + nRouted + '   refused ' + nRefused, 8, 16);
  }

  cv.onResize(draw);
  const loop = kit.animLoop(dt => { step(dt); draw(); });
  const CAP = NOVICE
    ? 'The front desk checks every request as it arrives — a red dot is turned away — then sends ' +
      'the rest to whichever helper computer has a free hand. The orange dot is your request.'
    : (DEEP
      ? 'The front door of an inference service: the gateway authenticates and validates each ' +
        'request (red dots are refused), then a load balancer spreads the survivors across a ' +
        'fleet of model servers. Each server shows its queue depth (q&hairsp;N) and its health &mdash; ' +
        'a replica that fails its readiness check is marked <em>drain</em>, pulled from rotation, and ' +
        'rejoins once its queue empties. The orange dot is your request.'
      : 'The front door of an inference service: the gateway authenticates and validates each ' +
        'request (red dots are refused), then a load balancer spreads the survivors across a ' +
        'fleet of model servers. Each bar shows a server&rsquo;s current load, not a hard limit &mdash; ' +
        'a busy fleet answers a little slower rather than turning requests away. The orange dot is your request.');
  kit.caption(container, CAP);
  return loop;
});
