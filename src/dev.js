// Canal de testes (só em `npm run dev` com ?dev na URL): manda erros, FPS e screenshots
// para o servidor do Vite e recebe comandos. Usado para verificar o jogo num navegador real.
import * as THREE from 'three';

const PAGE = Math.random().toString(36).slice(2, 7); // identifica a aba nos relatórios
const post = (body) => fetch('/__devreport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: PAGE, ...body }) }).catch(() => {});

export function startDev(game) {
  const log = (type, data) => post({ type, t: Date.now(), ...data });
  addEventListener('error', e => log('error', { msg: String(e.message), src: `${e.filename}:${e.lineno}` }));
  addEventListener('unhandledrejection', e => log('error', { msg: String(e.reason?.stack || e.reason) }));
  const origErr = console.error, origWarn = console.warn;
  console.error = (...a) => { log('console.error', { msg: a.map(String).join(' ').slice(0, 2000) }); origErr(...a); };
  console.warn = (...a) => { log('console.warn', { msg: a.map(String).join(' ').slice(0, 500) }); origWarn(...a); };

  const gl = game.r.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  log('boot', {
    ua: navigator.userAgent, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    halfFloat: game.r.halfFloat, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  });

  let autopilot = null;
  const stats = () => {
    const d = game.drone, p = d?.position(new THREE.Vector3());
    const info = game.r.renderer.info;
    return {
      state: game.state, scene: game.sceneDef?.id, touch: game.touch?.visible, src: game.input.lastSource, fps: Math.round(game.fps * 10) / 10, scale: game.r.scale,
      frameMs: +game.stats.frameMs.toFixed(2), phys: game.stats.phys, renderMs: +(game.stats.renderMs||0).toFixed(2), osdMs: +(game.stats.osdMs||0).toFixed(2), physMs: +game.stats.physMs.toFixed(2), steps: game.stats.steps,
      calls: info.render.calls, programs: info.programs?.length, tris: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
      drone: d && { pos: p.toArray().map(v => +v.toFixed(2)), speed: +d.speed().toFixed(2), armed: d.armed, crashed: d.crashed, motors: d.motor.map(m => +m.toFixed(3)), volt: +d.voltage.toFixed(2), ground: +d.groundDist.toFixed(2) },
      sticks: game.input.sticks, signal: +game.signal.toFixed(2), lap: game.lapInfo,
      pad: game.input.padInfo && { model: game.input.padInfo.model, family: game.input.padInfo.family, layout: game.settings.data.input.layout, armSwitch: game.settings.data.input.armSwitch, arm: game.settings.data.input.buttons.arm, reset: game.settings.data.input.buttons.reset, throttleAxis: game.settings.data.input.throttle.index, deadband: game.settings.data.input.deadband, profiles: Object.keys(game.settings.data.input.profiles || {}).length },
    };
  };

  async function run(cmd) {
    switch (cmd.action) {
      case 'load': { const t0 = performance.now(); await game.startScene(cmd.scene); log('loaded', { scene: cmd.scene, ms: Math.round(performance.now() - t0), colliders: game.kit.colliderCount, colTris: game.kit.colTris, meshes: game.kit.meshes.length, summit: game.kit.summit, stair: game.kit.stair }); break; }
      case 'menu': game.toMainMenu(); break;
      case 'resume': if (game.state !== 'flying') game.resume(); break;
      case 'set': game.settings.set(cmd.path, cmd.value); break;
      case 'reload': await game.reloadScene(); if (game.state !== 'flying') game.resume(); break;
      case 'arm': if (!game.drone.armed) game.drone.tryArm(0); break;
      case 'disarm': game.drone.armed = false; break;
      case 'respawn': game.respawn(); break;
      case 'ui': game.ui.show(cmd.screen); if (cmd.tab) { game.ui.tab = cmd.tab; game.ui.renderSettings(); } break;
      case 'hideui': game.ui.hide(); break;
      case 'teleport': {
        const b = game.drone.body;
        b.setTranslation({ x: cmd.pos[0], y: cmd.pos[1], z: cmd.pos[2] }, true);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(cmd.pitch || 0, cmd.yaw || 0, cmd.roll || 0, 'YXZ'));
        b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        const v = cmd.vel || [0, 0, 0];
        b.setLinvel({ x: v[0], y: v[1], z: v[2] }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
        break;
      }
      case 'sticks': game.input.override = cmd.sticks; break;
      case 'release': game.input.override = null; autopilot = null; break;
      case 'autopilot': autopilot = { seq: cmd.seq, t: 0, i: 0 }; break;
      case 'shot':
        // toDataURL falha em alguns Safari antigos: lê os pixels do WebGL e monta um BMP na mão
        game.shotRequest = () => {
          const gl = game.r.renderer.getContext();
          const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
          const px = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let osd = null;
          if (cmd.osd !== false) { try { const oc = document.getElementById('osd'); osd = { d: oc.getContext('2d').getImageData(0, 0, oc.width, oc.height).data, w: oc.width, h: oc.height }; } catch { osd = null; } }
          const rowBytes = Math.ceil(w * 3 / 4) * 4;
          const buf = new Uint8Array(54 + rowBytes * h);
          const dv = new DataView(buf.buffer);
          buf[0] = 66; buf[1] = 77; dv.setUint32(2, buf.length, true); dv.setUint32(10, 54, true);
          dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(26, 1, true); dv.setUint16(28, 24, true); dv.setUint32(34, rowBytes * h, true);
          for (let y = 0; y < h; y++) {
            const oy = osd ? Math.min(osd.h - 1, Math.floor((h - 1 - y) * osd.h / h)) : 0;
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              let r = px[i], g = px[i + 1], b = px[i + 2];
              if (osd) {
                const j = (oy * osd.w + Math.min(osd.w - 1, Math.floor(x * osd.w / w))) * 4;
                const a = osd.d[j + 3] / 255;
                if (a > 0) { r = r * (1 - a) + osd.d[j] * a; g = g * (1 - a) + osd.d[j + 1] * a; b = b * (1 - a) + osd.d[j + 2] * a; }
              }
              const o = 54 + y * rowBytes + x * 3;
              buf[o] = b; buf[o + 1] = g; buf[o + 2] = r;
            }
          }
          let bin = '';
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
          log('shot', { name: cmd.name || 'shot', data: 'data:image/bmp;base64,' + btoa(bin), stats: stats() });
        };
        // aba oculta não tem requestAnimationFrame: desenha um quadro na hora
        if (document.hidden) { game.frame(performance.now()); }
        break;
      case 'stats': log('stats', stats()); break;
      // formulários (conta, presets): preencher, clicar, enviar
      case 'fill': { const el = document.querySelector(cmd.sel); if (el) { el.value = cmd.value; el.dispatchEvent(new Event('input', { bubbles: true })); } else log('error', { msg: 'fill: nada em ' + cmd.sel }); break; }
      case 'click': { const el = document.querySelector(cmd.sel); if (el) el.click(); else log('error', { msg: 'click: nada em ' + cmd.sel }); break; }
      case 'submit': { const f = document.querySelector(cmd.sel); if (f) f.requestSubmit(); else log('error', { msg: 'submit: nada em ' + cmd.sel }); break; }
      case 'probe': { // estado do login com Google (SDK, iframe de autenticação)
        let prep = 'ok';
        try { await game.cloud.backend?.prepareGoogle?.(); } catch (e) { prep = String(e?.code || e?.message || e); }
        await new Promise(r => setTimeout(r, cmd.wait || 2500));
        log('probe', { prep, gapi: typeof window.gapi, iframes: [...document.querySelectorAll('iframe')].map(f => f.src.slice(0, 90)), origin: location.origin });
        break;
      }
      case 'get': log('get', { path: cmd.path, value: cmd.path === 'presets' ? game.settings.data.presets.map(p => p.name) : game.settings.get(cmd.path), user: game.cloud?.user, status: game.cloud?.status }); break;
      case 'wipe': { // "aparelho novo": configurações de fábrica, inclusive presets
        const { DEFAULTS } = await import('./settings.js');
        game.settings.data = structuredClone(DEFAULTS); game.settings.save(); game.settings.emitAll(); break;
      }
      case 'call': await game[cmd.obj][cmd.op](...(cmd.args || [])); break; // ex.: { obj: 'cloud', op: 'deleteAccount' }
      case 'dom': log('dom', { sel: cmd.sel, text: (document.querySelector(cmd.sel)?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, cmd.max || 600) }); break;
      case 'i18n': {
        // troca o idioma, passa por todas as telas e abas e lista os textos sem tradução
        const [{ missingKeys }, { SCHEMA }] = await Promise.all([import('./i18n.js'), import('./settings.js')]);
        game.settings.set('game.lang', cmd.lang || 'en');
        for (const scr of ['main', 'scenes', 'pause', 'help', 'loading']) game.ui.show(scr, { push: false });
        for (const tab of SCHEMA) { game.ui.tab = tab.id; game.ui.show('settings', { push: false }); }
        game.ui.show(cmd.end || 'main', { push: false });
        log('i18n', { lang: cmd.lang || 'en', missing: missingKeys(), htmlLang: document.documentElement.lang, title: document.title });
        break;
      }
      case 'pointer': {
        // toque sintético num elemento (controles na tela); fx/fy = posição relativa −1…1 dentro dele
        const el = document.querySelector(cmd.sel);
        if (!el) { log('error', { msg: 'pointer: nada em ' + cmd.sel }); break; }
        const r = el.getBoundingClientRect();
        const x = r.left + r.width * (0.5 + (cmd.fx || 0) / 2), y = r.top + r.height * (0.5 + (cmd.fy || 0) / 2);
        el.dispatchEvent(new PointerEvent(cmd.type || 'pointerdown', { pointerId: cmd.id ?? 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        break;
      }
      case 'mockpad': {
        // controles simulados para testar mapeamentos e vibração sem hardware
        if (!window.__realGetGamepads) window.__realGetGamepads = navigator.getGamepads.bind(navigator);
        if (cmd.off) { navigator.getGamepads = window.__realGetGamepads; window.__mockPads = null; break; }
        window.__mockPads = cmd.pads.map((p, index) => ({
          id: p.id, index, mapping: p.mapping ?? 'standard', connected: true, timestamp: performance.now(),
          axes: p.axes.slice(),
          buttons: Array.from({ length: p.nbuttons ?? 17 }, (_, i) => ({ pressed: (p.pressed || []).includes(i), value: (p.pressed || []).includes(i) ? 1 : 0, touched: false })),
          vibrationActuator: p.effects ? {
            type: 'dual-rumble', effects: p.effects,
            playEffect: (type, params) => { log('rumble', { pad: p.id.slice(0, 20), effect: type, ...params }); return Promise.resolve('complete'); },
            reset: () => { log('rumble-reset', {}); return Promise.resolve('complete'); },
          } : undefined,
          hapticActuators: p.pulse ? [{ type: 'vibration', pulse: (v, ms) => { log('rumble', { pad: p.id.slice(0, 20), effect: 'pulse', value: v, ms }); return Promise.resolve(true); } }] : undefined,
        }));
        navigator.getGamepads = () => window.__mockPads;
        break;
      }
      case 'padset': {
        // altera eixos/botões de um controle simulado: { i, axes: {idx: v}, pressed: [..] }
        const p = window.__mockPads?.[cmd.i ?? 0];
        if (!p) break;
        for (const [k, v] of Object.entries(cmd.axes || {})) p.axes[Number(k)] = v;
        if (cmd.pressed) p.buttons.forEach((b, i) => { b.pressed = cmd.pressed.includes(i); b.value = b.pressed ? 1 : 0; });
        break;
      }
      case 'hapticdebug': {
        const gp = game.input.gamepad;
        const r = game.haptics.play(1, 1, 100, { force: true });
        log('hapticdebug', { ok: r, hasGp: !!gp, id: gp?.id, act: !!gp?.vibrationActuator, effects: gp?.vibrationActuator?.effects, cfg: { h: game.settings.data.input.haptics, k: game.settings.data.input.hapticStrength }, sameObj: gp === navigator.getGamepads()[0] });
        break;
      }
      case 'script': {
        // roda uma sequência de comandos dentro da página: [{ wait: ms, ...comando }]
        for (const step of cmd.steps) {
          if (step.wait) await new Promise(r => setTimeout(r, step.wait));
          if (step.action) await run(step);
        }
        log('script-done', { name: cmd.name });
        break;
      }
      case 'note': log('note', { label: cmd.label, ...stats() }); break;
      case 'remap': game.ui.remap = { action: cmd.which, base: [...(game.input.gamepad?.axes || [])] }; break;
      case 'pads': log('pads', { pads: [...(navigator.getGamepads?.() || [])].filter(Boolean).map(g => ({ id: g.id, mapping: g.mapping, axes: g.axes.length, buttons: g.buttons.length })) }); break;
      case 'resetsettings': game.settings.resetAll(); break;
      case 'trace': game.drone.trace = []; game.drone.traceMax = cmd.n || 300; setTimeout(() => { log('trace', { name: cmd.name, hz: game.settings.get('world.physicsHz'), data: game.drone.trace }); game.drone.trace = null; }, cmd.ms || 1500); break;
      case 'matvis': {
        // mostra só os meshes cujo material.name casa com cmd.match (regex); '*' = todos
        const re = new RegExp(cmd.match);
        for (const m of game.kit.meshes) m.visible = cmd.match === '*' || re.test(m.material?.name || (m.isInstancedMesh ? 'instanced' : '?'));
        game.kit.chunks.forEach(c => { c.maxDist = cmd.match === '*' ? Infinity : (re.test('instanced') ? Infinity : -1e9); });
        break;
      }
      case 'prop': {
        // ajusta propriedade em todos os materiais: { key, value }
        for (const m of game.kit.meshes) { if (m.material) { m.material[cmd.key] = cmd.value; m.material.needsUpdate = true; } }
        break;
      }
      case 'renderer': { const r = game.r.renderer; r[cmd.key] = cmd.value; break; }
      case 'listmeshes': log('meshes', { list: game.kit.meshes.map(m => [m.material?.name || m.material?.type, m.isInstancedMesh ? 'I' + m.count : 'M', m.geometry.attributes.position.count, m.material?.map?.anisotropy, m.material?.map?.image?.width]) }); break;
      case 'vis': {
        const on = cmd.on !== false;
        if (cmd.target === 'background') game.scene.background = on ? game.sky.background : null;
        if (cmd.target === 'env') game.scene.environment = on ? game.sky.env : null;
        if (cmd.target === 'fog') game.scene.fog.far = on ? game.settings.get('graphics.viewDistance') : 1e6;
        for (const m of game.kit.meshes) {
          const isTerrain = m.material?.name === 'grass' && m.geometry.attributes.splat;
          if (cmd.target === 'terrain' && isTerrain) m.visible = on;
          if (cmd.target === 'batches' && !m.isInstancedMesh && !isTerrain) m.visible = on;
          if (cmd.target === 'instanced' && m.isInstancedMesh) { m.visible = on; m.userData.forceHide = !on; }
        }
        if (cmd.target === 'instanced') game.kit.chunks.forEach(c => { if (c.origMax === undefined) c.origMax = c.maxDist; c.maxDist = on ? c.origMax : -1e9; });
        break;
      }
      case 'bench': {
        const t0 = performance.now(); let n = 0; let worst = 0; let last = performance.now();
        await new Promise(res => {
          const tick = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; n++; if (now - t0 < (cmd.ms || 4000)) requestAnimationFrame(tick); else res(); };
          requestAnimationFrame(tick);
        });
        log('bench', { name: cmd.name, fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), worstMs: +worst.toFixed(1), ...stats() });
        break;
      }
    }
  }

  // piloto automático: [{ dur, throttle, roll, pitch, yaw }] — avança junto com o jogo (dt real do frame)
  game.onFrame = (dt) => {
    if (!autopilot) return;
    const ap = autopilot;
    const step = ap.seq[ap.i];
    if (!step) { game.input.override = null; autopilot = null; log('autopilot-done', stats()); return; }
    game.input.override = { throttle: step.throttle ?? 0.5, roll: step.roll ?? 0, pitch: step.pitch ?? 0, yaw: step.yaw ?? 0 };
    ap.t += dt;
    if (ap.t >= step.dur) {
      ap.t = 0; ap.i++;
      if (step.log) log('ap', { label: step.log, ...stats() });
      if (step.shot) run({ action: 'shot', name: step.shot });
    }
  };

  let busy = false;
  setInterval(async () => {
    if (busy || document.hidden) return; // só a aba visível recebe comandos
    busy = true;
    try {
      const cmds = await (await fetch('/__devcmd')).json();
      for (const c of cmds) { log('got', { action: c.action, name: c.name }); try { await run(c); } catch (e) { log('error', { msg: 'cmd ' + c.action + ': ' + (e.stack || e) }); } }
    } catch { /* servidor fora */ }
    busy = false;
  }, 500);
  setInterval(() => { if (!document.hidden) log('stats', stats()); }, 5000);
  window.__dev = { run, stats };
}
