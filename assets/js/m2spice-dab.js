/* M2Spice usage example page: DAB converter with LLG-SPICE magnetics (m2spice-dab.md).
 * Operating point -> M2SpiceDAB.simulate in a Web Worker -> summary, waveforms, B-H loops, phase sweep (power), loss
 * breakdown. The magnetics stay at the hardware preset (M2SpiceDAB.DEFAULTS: N27 transformer, N87 inductor), but
 * every operating point gets its own core parameters: after each run, (theta, alpha, Hc) of both cores are
 * re-extracted from the MagNet networks at the simulated flux (M2SpiceDAB.fitCores, on the extractor's worker pool)
 * and the point is simulated again. A newer change cancels a running extraction.
 */
(function (root) {
  "use strict";

  const doc = root.document;
  if (!doc) return;
  const page = doc.querySelector("[data-dab]");
  if (!page || !root.M2SpiceDAB || !root.M2SpicePlot) return;

  const DAB = root.M2SpiceDAB;
  const X = root.M2SpiceExtract;
  const P = root.M2SpicePlot;
  const scriptSrc = (doc.currentScript && doc.currentScript.src) || "";
  const ASSET_BASE = scriptSrc ? scriptSrc.replace(/js\/m2spice-dab\.js(\?.*)?$/, "") : "/assets/";
  const MU0 = 4 * Math.PI * 1e-7;
  const SWEEP_HINT = "Press Phase Sweep for the input and output power at φ = 0 to 90°.";

  // form fields: k = key path in the solver params, s = SI value of one display unit
  const FIELDS = [
    { k: "V1", label: "DC-side Bus (V1)", unit: "V", s: 1 },
    { k: "V2", label: "AC-side Bus (V2)", unit: "V; the secondary sees ±V2/2", s: 1 },
    { k: "f", label: "Switching Frequency (f_sw)", unit: "kHz", s: 1e3 },
    { k: "D1", label: "Inner Shift (D1)", unit: "v_ab pulse = (0.5 − D1) T; 0 = two-level", s: 1 },
    { k: "deadP", label: "Dead Time, Full Bridge", unit: "ns", s: 1e-9 },
    { k: "deadS", label: "Dead Time, Half Bridge", unit: "ns; 0 = hard switching, as built", s: 1e-9 }
  ];

  // core parameters in use: the paper's sets until the first extraction, then the fit of the last operating point
  function paperCores() {
    const c = {};
    DAB.CORES.forEach(({ el }) => {
      const e = DAB.DEFAULTS[el];
      c[el] = { theta: e.theta, alpha: e.alpha, Hc: e.Hc, src: "paper" };
    });
    return c;
  }

  const ui = {
    hasRun: false, last: null, simWorker: null, simSeq: 0, job: 0, fitPool: null, nets: {}, cores: paperCores(),
    sweep: null, sweepPool: null, busy: null, timer: null
  };

  function q(sel) { return page.querySelector(sel); }
  function qa(sel) { return Array.from(page.querySelectorAll(sel)); }
  const g6 = (v) => String(Number(Number(v).toPrecision(6)));
  const fx = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : "–");

  function getPath(o, k) { return k.split(".").reduce((a, p) => (a ? a[p] : undefined), o); }
  function setPath(o, k, v) {
    const parts = k.split(".");
    let a = o;
    for (let i = 0; i < parts.length - 1; i += 1) { a[parts[i]] = a[parts[i]] || {}; a = a[parts[i]]; }
    a[parts[parts.length - 1]] = v;
  }

  // ---------------------------------------------------------------- form
  function fieldHtml(f) {
    const id = "m2spice-dab-" + f.k;
    const input = `<input class="m2spice-input" id="${id}" data-dab-field="${f.k}" autocomplete="off" inputmode="decimal">`;
    return `<div class="m2spice-field"><label for="${id}">${f.label}</label>${input}<span class="m2spice-unit">${f.unit}</span></div>`;
  }

  function fieldEl(k) { return q(`[data-dab-field="${k}"]`); }

  function writeForm(p) {
    FIELDS.forEach((f) => {
      const el = fieldEl(f.k);
      el.value = g6(getPath(p, f.k) / f.s);
    });
    fieldEl("phi").value = g6(p.phi);
    q("[data-dab-phi-range]").value = String(p.phi);
  }

  function readForm() {
    // -> {params, errors}: the operating point from the form, everything else the hardware preset
    const p = DAB.merge({});
    const errors = [];
    FIELDS.concat([{ k: "phi", label: "Phase shift", s: 1 }]).forEach((f) => {
      const el = fieldEl(f.k);
      const raw = el.value.trim();
      const v = Number(raw);
      if (raw === "" || !Number.isFinite(v)) { errors.push(`${f.label}: enter a number.`); el.classList.add("is-invalid"); return; }
      el.classList.remove("is-invalid");
      setPath(p, f.k, v * f.s);
    });
    if (!errors.length) DAB.validate(p).forEach((e) => errors.push(e + "."));
    return { params: p, errors };
  }

  // ---------------------------------------------------------------- live schematic labels
  function updateSchematic() {
    const { params: p, errors } = readForm();
    if (errors.length) return;
    const d = DAB.derive(p);
    const set = (k, t) => { const el = q(`[data-sch="${k}"]`); if (el) el.textContent = t; };
    set("V1", g6(p.V1) + " V");
    set("V2", g6(p.V2) + " V");
    set("turns", `${g6(p.tx.N1)}:${g6(p.tx.N2)}`);
    set("Lm", `Lm ${fx(d.Lm * 1e6, 1)} µH`);
    set("L", `${fx(d.Lind * 1e6, 2)} µH`);
    set("op", `${g6(p.f / 1e3)} kHz, φ = ${g6(p.phi)}°, D1 = ${g6(p.D1)}`);
    q("[data-dab-caption]").textContent = `${g6(p.V1)} V → ${g6(p.V2)} V, ${p.tx.material} transformer, ${p.ind.linear ? "linear" : p.ind.material} inductor`;
  }

  // ---------------------------------------------------------------- status / progress
  function setStatus(text, kind) {
    const el = q("[data-dab-status]");
    el.textContent = text;
    el.classList.toggle("is-good", kind === "good");
    el.classList.toggle("is-error", kind === "error");
  }

  function setProgress(frac, text) {
    const bar = q("[data-dab-progress]");
    bar.hidden = frac === null;
    if (frac !== null) bar.value = frac;
    q("[data-dab-progress-text]").textContent = text || "";
  }

  // ---------------------------------------------------------------- workers
  function newWorker(file) {
    try { return new Worker(ASSET_BASE + "js/" + file); } catch (e) { return null; }
  }

  function createPool(file, max) {
    const n = Math.max(1, Math.min(max || 8, (root.navigator && root.navigator.hardwareConcurrency ? root.navigator.hardwareConcurrency : 4) - 1));
    const workers = [];
    for (let i = 0; i < n; i += 1) {
      const w = newWorker(file);
      if (!w) { workers.forEach((x) => x.terminate()); return null; }
      workers.push(w);
    }
    let reject = null;
    return {
      size: n,
      run(cases, onCase, extra, chunk) {
        return new Promise((resolve, rej) => {
          reject = rej;
          chunk = chunk || 1;
          const results = new Array(cases.length);
          let next = 0;
          let done = 0;
          const feed = (w) => {
            if (next >= cases.length) return;
            const id = next;
            next += chunk;
            w.postMessage(Object.assign({ id, cases: cases.slice(id, id + chunk) }, extra || {}));
          };
          workers.forEach((w) => {
            w.onmessage = (ev) => {
              const { id, results: rs } = ev.data;
              rs.forEach((r, k) => { results[id + k] = r; });
              done += rs.length;
              if (onCase) onCase(done, cases.length);
              if (done >= cases.length) resolve(results);
              else feed(w);
            };
            w.onerror = (ev) => rej(new Error("worker failed: " + (ev.message || "unknown error")));
            feed(w);
          });
          if (!cases.length) resolve([]);
        });
      },
      terminate() {
        workers.forEach((w) => w.terminate());
        if (reject) reject(new Error("cancelled"));
      }
    };
  }

  function simulateOnce(params) {
    // one steady-state run in the dedicated worker (inline where workers are unavailable, e.g. file://)
    return new Promise((resolve, reject) => {
      if (!ui.simWorker) {
        const w = newWorker("m2spice-dab-worker.js");
        ui.simWorker = w || "inline";
        ui.simWaiting = new Map();          // id -> {resolve, reject}: runs answer in order, one handler for all
        if (w) {
          w.onmessage = (ev) => {
            const job = ui.simWaiting.get(ev.data.id);
            if (!job) return;
            ui.simWaiting.delete(ev.data.id);
            const r = ev.data.results[0];
            if (r.error) job.reject(new Error(r.error)); else job.resolve(r);
          };
          w.onerror = (ev) => {
            const err = new Error("worker failed: " + (ev.message || "unknown error"));
            ui.simWaiting.forEach((job) => job.reject(err));
            w.terminate();
            ui.simWorker = null;
          };
        }
      }
      if (ui.simWorker === "inline") {
        setTimeout(() => { try { resolve(DAB.simulate(params)); } catch (e) { reject(e); } }, 0);
        return;
      }
      const id = ++ui.simSeq;
      ui.simWaiting.set(id, { resolve, reject });
      ui.simWorker.postMessage({ id, cases: [params] });
    });
  }

  // ---------------------------------------------------------------- simulate + re-extract
  async function loadNet(mat) {
    if (ui.nets[mat]) return ui.nets[mat];
    const r = await fetch(ASSET_BASE + "m2spice/nn/" + mat + ".json");
    if (!r.ok) throw new Error(`could not load the ${mat} network (${r.status})`);
    ui.nets[mat] = X.prepareNet(await r.json());
    return ui.nets[mat];
  }

  function cancelFit() {
    if (ui.fitPool) { ui.fitPool.terminate(); ui.fitPool = null; }
  }

  function coreText(c) {
    return `\u03b8 ${fx(c.theta, 2)}\u00b0, \u03b1 ${fx(c.alpha, 2)}`;
  }

  async function runSimulation() {
    const { params, errors } = readForm();
    if (errors.length) {
      setStatus(`Find ${errors.length} input error${errors.length === 1 ? "" : "s"}:\n${errors.join("\n")}`, "error");
      return;
    }
    const job = ++ui.job;               // a newer run makes this one stale
    cancelFit();
    const cores = JSON.parse(JSON.stringify(ui.cores));
    setStatus(`Simulating ${g6(params.V1)} \u2192 ${g6(params.V2)} V at \u03c6 = ${g6(params.phi)}\u00b0...`, "");
    let r;
    try {
      r = await simulateOnce(DAB.withCores(params, cores));
    } catch (e) {
      if (job === ui.job) setStatus("Simulation failed: " + String((e && e.message) || e), "error");
      return;
    }
    if (job !== ui.job) return;
    ui.last = r;
    ui.hasRun = true;
    render(r, cores, true);
    setStatus(`Steady state in ${r.metrics.seconds.toFixed(2)} s: P_out = ${fx(r.metrics.Pout, 1)} W. `
      + "Re-extracting the core parameters at this operating point...", "");
    // the operating point's own (theta, alpha, Hc), refined from the last fit
    const t0 = Date.now();
    try {
      const nets = {};
      for (const { el } of DAB.CORES) nets[r.params[el].material] = await loadNet(r.params[el].material);
      if (job !== ui.job) return;
      if (!ui.fitPool) ui.fitPool = createPool("m2spice-extract-worker.js");
      const pool = ui.fitPool;
      const runCases = pool ? (cases, onCase) => pool.run(cases, onCase, null, 8) : runCasesInline;
      const fits = await DAB.fitCores(r, nets, {
        start: cores,
        runCases,
        onProgress: (pr) => {
          if (job !== ui.job) return;
          const k = DAB.CORES.findIndex((c) => c.el === pr.core);
          const frac = (k + (pr.stage === "nn" ? 0 : Math.min(1, pr.done / pr.n))) / DAB.CORES.length;
          setProgress(frac, `${pr.core === "tx" ? "transformer" : "inductor"} core: ${pr.stage === "nn" ? "NN loop" : `${pr.done}/${pr.n}`}`);
        }
      });
      if (job !== ui.job) return;
      Object.keys(fits).forEach((el) => { fits[el].src = "fit"; });
      ui.cores = Object.assign({}, ui.cores, fits);
      const r2 = await simulateOnce(DAB.withCores(params, ui.cores));
      if (job !== ui.job) return;
      ui.last = r2;
      render(r2, ui.cores, false);
      const warn = warnings(r2, ui.cores);
      setStatus(`P_out = ${fx(r2.metrics.Pout, 1)} W, i_L = ${fx(r2.metrics.ILRms, 2)} A rms, transformer B_pk = ${fx(r2.metrics.BpkT * 1e3, 1)} mT. `
        + `Core parameters re-extracted at this operating point in ${((Date.now() - t0) / 1000).toFixed(1)} s `
        + `(transformer ${coreText(ui.cores.tx)}; inductor ${coreText(ui.cores.ind)}).` + (warn.length ? "\n" + warn.join("\n") : ""),
      warn.length ? "" : "good");
    } catch (e) {
      if (job !== ui.job) return;
      const msg = String((e && e.message) || e);
      if (msg !== "cancelled") {
        setStatus("The core parameters could not be re-extracted here (" + msg + "); the results use those of the last operating point.", "error");
      }
      if (ui.fitPool) cancelFit();
    } finally {
      if (job === ui.job) setProgress(null, "");
    }
  }

  function runCasesInline(cases, onCase) {
    // extractor fallback without workers: chunks between timer ticks
    return new Promise((resolve) => {
      const out = [];
      const step = () => {
        const end = Math.min(out.length + 10, cases.length);
        for (let k = out.length; k < end; k += 1) {
          try { out.push(X.simulateCycle(cases[k])); } catch (e) { out.push({ error: String(e.message || e) }); }
        }
        if (onCase) onCase(out.length, cases.length);
        if (out.length >= cases.length) resolve(out); else setTimeout(step, 0);
      };
      step();
    });
  }

  function scheduleRun() {
    // after the first run, edits re-simulate on their own (debounced)
    if (!ui.hasRun) return;
    clearTimeout(ui.timer);
    ui.timer = setTimeout(() => runSimulation(), 350);
  }

  function warnings(r, cores) {
    const m = r.metrics;
    const p = r.params;
    const w = [];
    DAB.CORES.forEach(({ el, name }) => {
      const c = cores && cores[el];
      if (c && c.warnings && c.warnings.length) w.push(`Note (${name} fit): ${c.warnings.join("; ")}; the network is extrapolating.`);
    });
    if (!m.converged) w.push("Warning: no periodic steady state found (shooting residual " + m.ssResidual.toExponential(1) + "); the cores may be saturating, so treat the waveforms as unreliable.");
    if (m.BpkT > 0.8 * MU0 * p.tx.Ms) w.push("Warning: the transformer flux is close to saturation.");
    if (m.BpkL > 0.8 * MU0 * p.ind.Ms && !p.ind.linear) w.push("Warning: the inductor flux is close to saturation.");
    return w;
  }

  // ---------------------------------------------------------------- results
  function render(r, cores, refitting) {
    const m = r.metrics;
    const p = r.params;
    const w = r.wave;
    q("[data-dab-results]").hidden = false;
    q("[data-dab-results-sub]").textContent = `${g6(p.V1)} → ${g6(p.V2)} V, ${g6(p.f / 1e3)} kHz, φ = ${g6(p.phi)}°, D1 = ${g6(p.D1)}; `
      + `steady state in ${m.seconds.toFixed(2)} s (${m.shootIters} Newton iterations${m.shootStages > 1 ? ", voltage continuation" : ""}), `
      + `energy balance ${(100 * m.balance).toFixed(2)} %`;
    const rows = [
      ["Input power", fx(m.Pin, 1) + " W"], ["Output power", fx(m.Pout, 1) + " W"],
      ["Modelled loss", fx(m.Ploss, 2) + " W"], ["Core loss, both cores", fx(m.PcoreT + m.PcoreL, 3) + " W"],
      ["i_L rms / peak", `${fx(m.ILRms, 2)} / ${fx(m.ILPk, 2)} A`], ["i_p rms / peak", `${fx(m.IpRms, 2)} / ${fx(m.IpPk, 2)} A`],
      ["Magnetizing i_m peak", fx(m.ImPk, 3) + " A"], ["B_pk transformer / inductor", `${fx(m.BpkT * 1e3, 1)} / ${fx(m.BpkL * 1e3, 1)} mT`]
    ];
    const warn = warnings(r, refitting ? null : cores);
    q("[data-dab-summary]").innerHTML = `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
      + warn.map((t) => `<p class="m2spice-note is-warn">${t}</p>`).join("");

    const n = w.t.length;
    const tus = Array.from(w.t, (t) => t * 1e6);
    const pick = (a) => Array.from(a);
    const tipT = (unit, digits) => (s, i) => `<strong>${s.name}</strong><br>t ${s.x[i].toFixed(3)} µs<br>${s.y[i].toFixed(digits)} ${unit}`;
    P.linePlot(q('[data-dab-plot="v"]'), {
      aria: "Bridge voltages over two periods", xLabel: "t (µs)", yLabel: "v (V)", ySym: true, xRange: [0, tus[n - 1]],
      series: [{ name: "v_ab", cls: "c-blue", x: tus, y: pick(w.vab), step: true }, { name: "v_cm", cls: "c-green", x: tus, y: pick(w.vcm), step: true }],
      fmt: tipT("V", 2)
    });
    P.linePlot(q('[data-dab-plot="i"]'), {
      aria: "Currents over two periods", xLabel: "t (µs)", yLabel: "i (A)", ySym: true, xRange: [0, tus[n - 1]],
      series: [{ name: "i_L", cls: "c-red", x: tus, y: pick(w.iL) }, { name: "i_p", cls: "c-blue is-dashed", x: tus, y: pick(w.ip) },
        { name: "i_m", cls: "c-copper", x: tus, y: pick(w.im) }],
      fmt: tipT("A", 3)
    });
    const half = Math.floor((n - 1) / 2);          // one period of the two
    const loop = (H, B) => ({ x: Array.from(H.slice(0, half + 1)), y: Array.from(B.slice(0, half + 1), (b) => b * 1e3) });
    const bh = (host, el, H, B, cls) => {
      const lp = loop(H, B);
      const pc = el === "tx" ? m.PcoreT : m.PcoreL;
      const mat = el === "tx" ? p.tx.material : (p.ind.linear ? "linear" : p.ind.material);
      const c = cores[el];
      const src = refitting ? (c.src === "paper" ? "paper set; re-extracting..." : "last point's fit; re-extracting...")
        : (c.src === "paper" ? "paper set" : `fitted at this point, loop RRMSE ${fx(c.rrmse, 3)}`);
      q(`[data-dab-plot-sub="${el}"]`).textContent = `${mat}, ${coreText(c)} (${src}): B_pk ${fx((el === "tx" ? m.BpkT : m.BpkL) * 1e3, 1)} mT, `
        + `core loss ${fx(pc, 3)} W (${fx(pc / ((el === "tx" ? p.tx.Ae * p.tx.le : p.ind.Ae * p.ind.le) * 1e3), 0)} kW/m³)`;
      P.linePlot(q(`[data-dab-plot="${host}"]`), {
        aria: "B-H loop", xLabel: "H (A/m)", yLabel: "B (mT)", xSym: true, ySym: true,
        series: [{ name: el === "tx" ? "Transformer" : "Inductor", cls, x: lp.x, y: lp.y, closed: true }],
        fmt: (s, i) => `<strong>${s.name}</strong><br>H ${s.x[i].toFixed(2)} A/m<br>B ${s.y[i].toFixed(2)} mT`
      });
    };
    bh("bhT", "tx", w.HT, w.BT, "c-blue");
    bh("bhL", "ind", w.HL, w.BL, "c-copper");
    renderLosses(m);
    // a sweep of the same settings keeps its plots with the marker on the new phase; other settings hide it
    const sw = ui.sweep;
    if (sw) {
      if (sameExceptPhi(sw.params, p)) renderSweep(Object.assign({}, sw.params, { phi: p.phi }), sw.phis, sw.res, sw.sec);
      else { q("[data-dab-sweep]").hidden = true; q("[data-dab-sweep-sub]").textContent = SWEEP_HINT; ui.sweep = null; }
    }
  }

  function sameExceptPhi(a, b) {
    return FIELDS.every((f) => getPath(a, f.k) === getPath(b, f.k));
  }

  function renderLosses(m) {
    const items = [
      ["Transformer core", m.PcoreT, "c-blue"], ["Inductor core", m.PcoreL, "c-copper"],
      ["Transformer windings", m.PwindT, "c-sky"], ["Inductor R", m.PwindL, "c-sand"],
      ["Switch conduction (R_on)", m.Pcond, "c-red"], ["AC wiring", m.Pwire, "c-grey"]
    ];
    const tot = items.reduce((a, [, v]) => a + Math.max(v, 0), 0) || 1;
    const bar = items.map(([k, v, c]) => `<span class="${c}" style="width:${(100 * Math.max(v, 0) / tot).toFixed(2)}%" title="${k}: ${fx(v, 3)} W"></span>`).join("");
    const list = items.map(([k, v, c]) => `<li><i class="m2spice-swatch ${c}"></i><span>${k}</span><b>${fx(v, 3)} W</b><em>${fx(100 * v / tot, 1)} %</em></li>`).join("");
    q("[data-dab-losses]").innerHTML = `<div class="m2spice-dab-bar" role="img" aria-label="Loss breakdown">${bar}</div>`
      + `<ul class="m2spice-dab-losslist">${list}<li class="is-total"><i></i><span>Total</span><b>${fx(tot, 2)} W</b><em></em></li></ul>`;
  }

  // ---------------------------------------------------------------- phase sweep
  async function runSweep() {
    if (ui.busy === "sweep") { cancelBusy(); return; }
    if (ui.busy) return;
    const { params, errors } = readForm();
    if (errors.length) { setStatus(`Find ${errors.length} input error${errors.length === 1 ? "" : "s"}:\n${errors.join("\n")}`, "error"); return; }
    const phis = [];
    for (let k = 0; k <= 18; k += 1) phis.push(5 * k);
    ui.busy = "sweep";
    const btn = q("[data-action='dab-sweep'] span");
    btn.textContent = "Cancel";
    setProgress(0, "phase sweep");
    setStatus(`Phase sweep, \u03c6 = 0 to 90\u00b0: ${phis.length} operating points, each with its core parameters re-extracted...`, "");
    const t0 = Date.now();
    try {
      const cases = phis.map((phi) => Object.assign({}, params, { phi }));
      let res;
      // one operating point (simulate, extract both cores, simulate) per worker: as many workers as there are cores
      if (!ui.sweepPool) ui.sweepPool = createPool("m2spice-dab-worker.js", 19);
      if (ui.sweepPool) {
        res = await ui.sweepPool.run(cases, (d, n) => setProgress(d / n, `phase sweep ${d}/${n}`), { fitted: true, start: ui.cores });
      } else {
        res = [];
        const nets = {};
        for (const { el } of DAB.CORES) nets[params[el].material] = await loadNet(params[el].material);
        for (const c of cases) {
          try {
            const o = await DAB.simulateFitted(c, nets, { start: ui.cores });
            res.push({ metrics: o.result.metrics, cores: o.cores });
          } catch (e) {
            res.push({ error: String((e && e.message) || e) });
          }
          setProgress(res.length / cases.length, `phase sweep ${res.length}/${cases.length}`);
        }
      }
      ui.sweep = { params, phis, res, sec: (Date.now() - t0) / 1000 };
      renderSweep(params, phis, res, ui.sweep.sec);
      const bad = res.filter((r) => r.error || !r.metrics.converged).length;
      setStatus(`Phase sweep done in ${((Date.now() - t0) / 1000).toFixed(1)} s.` + (bad ? ` ${bad} point${bad === 1 ? "" : "s"} did not converge.` : ""), bad ? "" : "good");
    } catch (e) {
      const msg = String((e && e.message) || e);
      setStatus(msg === "cancelled" ? "Phase sweep cancelled." : "Phase sweep failed: " + msg, msg === "cancelled" ? "" : "error");
    } finally {
      ui.busy = null;
      btn.textContent = "Phase Sweep";
      setProgress(null, "");
    }
  }

  function renderSweep(params, phis, res, sec) {
    const ok = res.map((r, k) => ({ phi: phis[k], m: r && !r.error && r.metrics.converged ? r.metrics : null })).filter((r) => r.m);
    const box = q("[data-dab-sweep]");
    q("[data-dab-results]").hidden = false;
    box.hidden = false;
    q("[data-dab-sweep-sub]").textContent = `${g6(params.V1)} → ${g6(params.V2)} V, ${g6(params.f / 1e3)} kHz, D1 = ${g6(params.D1)}; `
      + `${ok.length} of ${phis.length} points in ${sec.toFixed(1)} s, each with its own core parameters. The marker is the current \u03c6 (${g6(params.phi)}\u00b0).`;
    const x = ok.map((r) => r.phi);
    const near = ok.reduce((b, r) => (!b || Math.abs(r.phi - params.phi) < Math.abs(b.phi - params.phi) ? r : b), null);
    const tip = (unit) => (s, i) => `<strong>${s.name}</strong><br>φ ${s.x[i]}°<br>${s.y[i].toFixed(unit === "W" ? 2 : 3)} ${unit}`;
    P.linePlot(q('[data-dab-plot="sweepP"]'), {
      aria: "Power against phase shift", xLabel: "φ (deg)", yLabel: "P (W)", xRange: [0, 90],
      series: [{ name: "P_in", cls: "c-green", x, y: ok.map((r) => r.m.Pin) }, { name: "P_out", cls: "c-blue", x, y: ok.map((r) => r.m.Pout) }],
      marks: near ? [{ x: near.phi, y: near.m.Pout, cls: "c-blue" }] : [],
      fmt: tip("W")
    });
  }

  function cancelBusy() {
    if (ui.busy === "sweep" && ui.sweepPool) { ui.sweepPool.terminate(); ui.sweepPool = null; }
    ui.job += 1;                        // a running simulate + re-extract is stale now
    cancelFit();
  }

  // ---------------------------------------------------------------- CSV
  function downloadCsv() {
    const r = ui.last;
    if (!r) { setStatus("Simulate first, then download the waveforms.", "error"); return; }
    const w = r.wave;
    const p = r.params;
    const head = [`# M2Spice usage example: DAB ${p.V1} -> ${p.V2} V, ${p.f / 1e3} kHz, phi ${p.phi} deg, D1 ${p.D1}; two periods, t = 0 at the middle of the positive v_ab pulse`,
      `# cores: transformer ${p.tx.material} theta ${p.tx.theta} alpha ${p.tx.alpha} Hc ${p.tx.Hc}; inductor ${p.ind.material} theta ${p.ind.theta} alpha ${p.ind.alpha} Hc ${p.ind.Hc}`,
      "t_us,v_ab_V,v_cm_V,i_p_A,i_L_A,i_m_A,v_Cb_V,H_tx_A_per_m,B_tx_T,H_L_A_per_m,B_L_T"];
    const lines = [];
    for (let i = 0; i < w.t.length; i += 1) {
      lines.push([w.t[i] * 1e6, w.vab[i], w.vcm[i], w.ip[i], w.iL[i], w.im[i], w.vCb[i], w.HT[i], w.BT[i], w.HL[i], w.BL[i]]
        .map((v) => Number(v.toPrecision(7))).join(","));
    }
    const blob = new Blob([head.concat(lines).join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = url;
    a.download = `dab_${g6(p.V1)}V_${g6(p.V2)}V_${g6(p.f / 1e3)}kHz_phi${g6(p.phi)}.csv`;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`${a.download} download started.`, "good");
  }

  // ---------------------------------------------------------------- init
  function reset() {
    writeForm(DAB.DEFAULTS);
    ui.cores = paperCores();
    qa("[data-dab-field]").forEach((el) => el.classList.remove("is-invalid"));
    updateSchematic();
  }

  function init() {
    q('[data-dab-group="op"]').innerHTML = FIELDS.map(fieldHtml).join("");
    reset();
    q("[data-dab-sweep-sub]").textContent = SWEEP_HINT;
    const range = q("[data-dab-phi-range]");
    const phi = fieldEl("phi");
    range.addEventListener("input", () => { phi.value = range.value; updateSchematic(); });
    range.addEventListener("change", () => { if (ui.hasRun) runSimulation(); });
    phi.addEventListener("input", () => {
      const v = Number(phi.value);
      if (Number.isFinite(v)) range.value = String(Math.max(-90, Math.min(90, v)));
    });
    page.addEventListener("input", (ev) => {
      const el = ev.target.closest("[data-dab-field]");
      if (!el) return;
      updateSchematic();
      scheduleRun();
    });
    page.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && ev.target.closest("[data-dab-field]")) { ev.preventDefault(); runSimulation(); }
    });
    page.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "dab-simulate") runSimulation();
      else if (a === "dab-sweep") runSweep();
      else if (a === "dab-csv") downloadCsv();
      else if (a === "dab-reset") {
        cancelBusy();
        reset();
        setStatus("Restored the hardware values." + (ui.hasRun ? " Simulating..." : " Press Simulate."), "");
        if (ui.hasRun) runSimulation();
      }
    });
  }

  init();
  root.M2SpiceDABPage = { readForm, runSimulation, runSweep, ui };
})(typeof window !== "undefined" ? window : globalThis);
