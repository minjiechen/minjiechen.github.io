/* M2Spice usage example: dual-active-bridge converter with LLG-SPICE magnetics, simulated in the browser.
 *
 * Lumped version of LTspice_LLG/dab_tida/tida_sim.py (the TIDA-010954 board in DC-DC DAB mode):
 *   DC side  full bridge on V1 -> blocking capacitor Cb -> primary (N1 turns)
 *   AC side  half bridge on V2 -> wiring -> series inductor -> secondary (N2) -> MidHV, the midpoint of the split
 *            capacitor (2 Cs in series with the AC loop for the ripple; V2 itself is stiff)
 *   EPS modulation as TI's cyclo_d1 / cyclo_d2: D1 = internal shift (v_ab pulse (0.5 - D1) T wide, centred on
 *   t = 0), phi = 360 D2 = shift of the AC leg centre. Each edge has its dead time; during a dead time the leg
 *   voltage follows the current (ideal diodes, no Coss).
 * Each magnetic element is one LLG_CORE with its gap in series (magnetically), in the port form of LLG_core.lib:
 *   N i = H le + B g / mu0, B = mu0 (H + Ms mz)  ->  H = (N i - Ms mz g) / (le + g)
 *   v = L_mu di/dt + v_M,  L_mu = mu0 N^2 Ae / (le + g),  v_M = mu0 N Ae Ms le / (le + g) dmz/dt
 * dmz/dt comes from the LLG right-hand side (M2SpiceExtract.llgRhs), so there is no algebraic loop.
 * Time stepping: variable-step Gear-2 (BDF2) with Newton, every switching edge on the grid, step <= T / stepsPerT.
 * Steady state: half-wave-symmetric shooting, x(T/2) = S x(0) (Newton with a finite-difference Jacobian), then two
 * periods are recorded. Plain functions, no DOM: runs in the page, in a Web Worker and in Node (tests).
 * Core parameters per operating point (fitCores / simulateFitted): (theta, alpha, Hc) of each core re-extracted
 * from its MagNet network at the simulated flux, same-shape drive as LTspice_LLG/dab/extract_dab.py, 25 degC.
 */
(function (root) {
  "use strict";

  const X = (typeof module !== "undefined" && module.exports) ? require("./m2spice-extract.js") : root.M2SpiceExtract;
  const MU0 = X.MU0;
  const GAMMA = X.GAMMA;

  // the as-built TIDA-010954 board of the paper (tida_config.py, results/design.json, n27_drive_test): 50 -> 70 V,
  // 150 kHz, D1 0.25, 45 deg; FET R_on at 90 degC; N27 / N87 cores as extracted for the paper
  const DEFAULTS = {
    V1: 50, V2: 70, f: 150e3, phi: 45, D1: 0.25,
    deadP: 20e-9, deadS: 0,
    RonP: 3.753e-3,          // LMG2100R026 at 90 degC (two in the primary path)
    RonS: 66.88e-3,          // AC switch = two LMG3656R025 in series, 90 degC
    Cb: 100e-6,
    Cs: 6e-6,                // each half of the AC-side split capacitor (MidHV ripple; 0 = stiff midpoint)
    Lac: 0.32e-6,            // AC-side wiring L (L_LOOP_S)
    Rac: 10.79e-3,           // R_MID + split-capacitor ESR (each half carries i_L / 2)
    tx: {
      material: "N27", Ms: 3.9e5, theta: 89.29375, alpha: 3.33333, Hc: 1.59492,
      N1: 2, N2: 2, Ae: 566e-6, le: 93e-3, gap: 9.90e-6,
      Llk: 5.8e-9,           // leakage, primary side (MLM block, secondary shorted)
      Rw1: 6.87e-3, Rw2: 6.87e-3
    },
    ind: {
      material: "N87", Ms: 3.88e5, theta: 88.74861, alpha: 5.13333, Hc: 2.79483,
      N: 3, Ae: 194e-6, le: 43.7e-3, gap: 742e-6,   // lumped gap for the 2.90 uH of the as-built LLG block
      R: 65e-3,              // R at 150 kHz as fitted in the converter (R_IND_FSW)
      linear: false
    },
    stepsPerT: 4000
  };

  const NX = 10;             // i_p, i_L, v_Cb, m_tx (3), m_ind (3), MidHV ripple v_Cs
  const SYM = [-1, -1, -1, -1, 1, -1, -1, 1, -1, -1];     // half-wave symmetry: x(t + T/2) = SYM * x(t)
  const SCALE = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const SS_TOL = 1e-9;          // shooting residual (A, V, |m|)

  function clone(p) { return JSON.parse(JSON.stringify(p)); }

  function merge(p) {
    const out = clone(DEFAULTS);
    if (!p) return out;
    Object.keys(p).forEach((k) => {
      if (k === "tx" || k === "ind") Object.assign(out[k], p[k] || {});
      else if (p[k] !== undefined) out[k] = p[k];
    });
    return out;
  }

  // ------------------------------------------------------------------ magnetic elements
  function element(e, N) {
    // LLG port constants; small-signal permeability from the static equilibrium of the anisotropy:
    // m ~ (0, 1, mz), mz = H / (Hani_y - Hani_z) -> chi = Ms / (Hani_y - Hani_z)
    const an = X.anisotropy(e.Hc, e.theta);
    const chi = e.Ms / (an.Hani_y - an.Hani_z);
    const Llin = MU0 * N * N * e.Ae / (e.le / (1 + chi) + e.gap);
    const linear = !!e.linear;
    return {
      N, Ae: e.Ae, le: e.le, g: e.gap, Ms: e.Ms, linear, chi, Llin,
      Hani_y: an.Hani_y, Hani_z: an.Hani_z, alpha: e.alpha,
      pref: -GAMMA * MU0 / (1 + e.alpha * e.alpha),
      Lmu: linear ? Llin : MU0 * N * N * e.Ae / (e.le + e.gap),
      KM: linear ? 0 : MU0 * N * e.Ae * e.Ms * e.le / (e.le + e.gap)
    };
  }

  function validate(p) {
    const err = [];
    const pos = (v, name) => { if (!(v > 0) || !Number.isFinite(v)) err.push(name + " must be a positive number"); };
    const nonneg = (v, name) => { if (!(v >= 0) || !Number.isFinite(v)) err.push(name + " must be zero or positive"); };
    pos(p.V1, "V1"); pos(p.V2, "V2"); pos(p.f, "f_sw"); pos(p.Cb, "C_b"); nonneg(p.Cs, "split capacitor");
    if (!(p.D1 >= 0 && p.D1 < 0.5)) err.push("D1 must be in [0, 0.5)");
    if (!(Math.abs(p.phi) <= 180)) err.push("phi must be within +-180 deg");
    nonneg(p.deadP, "DC-side dead time"); nonneg(p.deadS, "AC-side dead time");
    if (p.deadP * p.f >= 0.2 || p.deadS * p.f >= 0.2) err.push("dead times must be below 0.2 T");
    nonneg(p.RonP, "R_on (DC side)"); nonneg(p.RonS, "R_on (AC side)"); nonneg(p.Lac, "AC wiring L"); nonneg(p.Rac, "AC wiring R");
    [["tx", "transformer"], ["ind", "inductor"]].forEach(([k, name]) => {
      const e = p[k];
      pos(e.Ms, name + " Ms"); pos(e.alpha, name + " alpha"); pos(e.Hc, name + " Hc"); pos(e.Ae, name + " Ae");
      pos(e.le, name + " le"); nonneg(e.gap, name + " gap");
      if (!(e.theta > 45 && e.theta < 90)) err.push(name + " theta must be between 45 and 90 deg");
    });
    pos(p.tx.N1, "N1"); pos(p.tx.N2, "N2"); pos(p.ind.N, "inductor turns");
    pos(p.tx.Llk, "transformer leakage (the model needs a nonzero primary L)");
    nonneg(p.tx.Rw1, "primary winding R"); nonneg(p.tx.Rw2, "secondary winding R"); nonneg(p.ind.R, "inductor R");
    return err;
  }

  function derive(params) {
    const p = merge(params);
    const T = element(p.tx, p.tx.N1);
    const L = element(p.ind, p.ind.N);
    const n = p.tx.N2 / p.tx.N1;
    const Lser = p.Lac + L.Llin;                        // AC-side series L (small signal)
    return {
      Lm: T.Llin, Lind: L.Llin, Lser, n,
      LserPri: p.tx.Llk + Lser / (n * n),               // total series L referred to the primary
      muT: 1 + T.chi, muL: 1 + L.chi,
      HaniT: { y: T.Hani_y, z: T.Hani_z }, HaniL: { y: L.Hani_y, z: L.Hani_z },
      gain: (p.V2 / 2) / (n * p.V1)
    };
  }

  function powerSps(params) {
    // closed form for D1 = 0, lossless, linear magnetizing L ignored (tida_config.power_sps)
    const p = merge(params);
    const d = derive(p);
    const ph = p.phi * Math.PI / 180;
    return p.V1 * (p.V2 / 2 / d.n) * ph * (Math.PI - Math.abs(ph)) / (2 * Math.PI * Math.PI * p.f * d.LserPri);
  }

  // ------------------------------------------------------------------ circuit model
  function buildModel(params) {
    const p = merge(params);
    const T = element(p.tx, p.tx.N1);
    const Li = element(p.ind, p.ind.N);
    const n = p.tx.N2 / p.tx.N1;
    const Tp = 1 / p.f;
    const legs = [
      // centre of the high state, dead time, rail, current out of the node = sign * x[idx]
      { tc: p.D1 * Tp / 2, dead: p.deadP, rail: p.V1, idx: 0, sign: 1, hi: "S1", lo: "S2", name: "A" },
      { tc: Tp / 2 - p.D1 * Tp / 2, dead: p.deadP, rail: p.V1, idx: 0, sign: -1, hi: "S3", lo: "S4", name: "B" },
      { tc: p.phi / 360 * Tp, dead: p.deadS, rail: p.V2, idx: 1, sign: 1, hi: "S5", lo: "S6", name: "C" }
    ];
    legs.forEach((g) => { g.s = Math.sin(Math.PI * p.f * g.dead); });
    return {
      p, T, L: Li, n, Tp, legs,
      Lp: p.tx.Llk,
      Rp: 2 * p.RonP + p.tx.Rw1,
      Ls: p.Lac + Li.Lmu,
      Rs: p.RonS + p.tx.Rw2 + p.ind.R + p.Rac,
      Cb: p.Cb,
      Cs2: 2 * p.Cs,
      hmax: Tp / p.stepsPerT
    };
  }

  function legState(g, t, w) {
    // +1 high, -1 low, 0 dead time (gate comparators of tida_sim.bridge_lines)
    const c = Math.cos(w * (t - g.tc));
    if (c > g.s) return 1;
    if (c < -g.s) return -1;
    return 0;
  }

  function fieldOf(e, i, mz) {
    return (e.N * i - e.Ms * mz * e.g) / (e.le + e.g);
  }

  const RELAX = 1e9;
  const I_DEAD = 0.25;      // A, current scale of the dead-time commutation
  const kT = [0, 0, 0];
  const kL = [0, 0, 0];

  const VB = [0, 0];

  function bridgeVoltages(md, st, x, out) {
    // v_ab and the AC leg voltage about V2 / 2 for the gate states st, from the state x (dead-time nodes follow the
    // current, so they are evaluated inside the implicit step like every other stiff term)
    out[0] = legVoltage(md.legs[0], st[0], x) - legVoltage(md.legs[1], st[1], x);
    out[1] = legVoltage(md.legs[2], st[2], x) - md.p.V2 / 2;
    return out;
  }

  function rhs(md, x, st, out) {
    bridgeVoltages(md, st, x, VB);
    const vab = VB[0];
    const vcm = VB[1];
    const T = md.T;
    const L = md.L;
    const n = md.n;
    const ip = x[0];
    const iL = x[1];
    let vMT = 0;
    let vML = 0;
    // a linear element keeps its unused m states at (0, 1, 0) (a fast relaxation, so the shooting Jacobian stays regular)
    if (T.linear) { kT[0] = -RELAX * x[3]; kT[1] = -RELAX * (x[4] - 1); kT[2] = -RELAX * x[5]; } else {
      X.llgRhs(T, fieldOf(T, ip + n * iL, x[5]), x[3], x[4], x[5], kT);
      vMT = T.KM * kT[2];
    }
    if (L.linear) { kL[0] = -RELAX * x[6]; kL[1] = -RELAX * (x[7] - 1); kL[2] = -RELAX * x[8]; } else {
      X.llgRhs(L, fieldOf(L, iL, x[8]), x[6], x[7], x[8], kL);
      vML = L.KM * kL[2];
    }
    const A = (vab - x[2] - md.Rp * ip) / md.Lp;
    const Bv = (vcm - x[9] - md.Rs * iL - vML) / md.Ls;
    const vm = (T.Lmu * (A + n * Bv) + vMT) / (1 + T.Lmu / md.Lp + n * n * T.Lmu / md.Ls);
    out[0] = A - vm / md.Lp;
    out[1] = Bv - n * vm / md.Ls;
    out[2] = ip / md.Cb;
    out[3] = kT[0]; out[4] = kT[1]; out[5] = kT[2];
    out[6] = kL[0]; out[7] = kL[1]; out[8] = kL[2];
    out[9] = md.Cs2 > 0 ? iL / md.Cs2 : -RELAX * x[9];
    return vm;
  }

  // ------------------------------------------------------------------ dense 9 x 9 LU
  function luFactor(a, piv) {
    for (let k = 0; k < NX; k += 1) {
      let pk = k;
      let mx = Math.abs(a[k * NX + k]);
      for (let i = k + 1; i < NX; i += 1) {
        const v = Math.abs(a[i * NX + k]);
        if (v > mx) { mx = v; pk = i; }
      }
      piv[k] = pk;
      if (pk !== k) {
        for (let j = 0; j < NX; j += 1) {
          const t = a[k * NX + j]; a[k * NX + j] = a[pk * NX + j]; a[pk * NX + j] = t;
        }
      }
      const d = a[k * NX + k];
      if (d === 0) throw new Error("singular Newton matrix");
      for (let i = k + 1; i < NX; i += 1) {
        const f = a[i * NX + k] / d;
        a[i * NX + k] = f;
        for (let j = k + 1; j < NX; j += 1) a[i * NX + j] -= f * a[k * NX + j];
      }
    }
  }

  function luSolve(a, piv, b) {
    for (let k = 0; k < NX; k += 1) {
      const pk = piv[k];
      if (pk !== k) { const t = b[k]; b[k] = b[pk]; b[pk] = t; }
      for (let i = k + 1; i < NX; i += 1) b[i] -= a[i * NX + k] * b[k];
    }
    for (let k = NX - 1; k >= 0; k -= 1) {
      for (let j = k + 1; j < NX; j += 1) b[k] -= a[k * NX + j] * b[j];
      b[k] /= a[k * NX + k];
    }
  }

  // ------------------------------------------------------------------ time stepping
  const EPS_FD = [1e-4, 1e-4, 1e-4, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-7, 1e-4];
  const TOL = [1e-9, 1e-9, 1e-9, 1e-12, 1e-12, 1e-12, 1e-12, 1e-12, 1e-12, 1e-9];

  function makeWork() {
    return {
      J: new Float64Array(NX * NX), piv: new Int32Array(NX), f0: new Float64Array(NX), f1: new Float64Array(NX),
      y: new Float64Array(NX), yp: new Float64Array(NX), G: new Float64Array(NX), base: new Float64Array(NX)
    };
  }

  function implicitStep(md, wk, xn, xp, h, hp, st, out) {
    // Gear-2 with variable step (BE when there is no history): y - a1 xn - a2 xp - b h f(y) = 0
    let a1 = 1;
    let a2 = 0;
    let b = 1;
    if (xp) {
      const w = h / hp;
      a1 = (1 + w) * (1 + w) / (1 + 2 * w);
      a2 = -w * w / (1 + 2 * w);
      b = (1 + w) / (1 + 2 * w);
    }
    const { J, piv, f0, f1, y, yp, G, base } = wk;
    for (let i = 0; i < NX; i += 1) {
      base[i] = a1 * xn[i] + (xp ? a2 * xp[i] : 0);
      y[i] = xp ? xn[i] + (xn[i] - xp[i]) * h / hp : xn[i];      // linear predictor
    }
    const jacobian = () => {
      // I - b h Jf at y (finite differences); leaves f(y) in f0
      rhs(md, y, st, f0);
      for (let j = 0; j < NX; j += 1) {
        const e = EPS_FD[j];
        const keep = y[j];
        y[j] = keep + e;
        rhs(md, y, st, f1);
        y[j] = keep;
        for (let i = 0; i < NX; i += 1) J[i * NX + j] = (i === j ? 1 : 0) - b * h * (f1[i] - f0[i]) / e;
      }
      luFactor(J, piv);
    };
    // modified Newton (Jacobian at the predictor), then full Newton from the predictor if that stalls
    let done = false;
    for (let pass = 0; pass < 2 && !done; pass += 1) {
      if (pass === 1) {
        for (let i = 0; i < NX; i += 1) y[i] = xp ? xn[i] + (xn[i] - xp[i]) * h / hp : xn[i];
      }
      jacobian();
      let f = f0;
      for (let it = 0; it < (pass ? 16 : 10) && !done; it += 1) {
        if (it > 0) {
          if (pass) { jacobian(); f = f0; } else { rhs(md, y, st, f1); f = f1; }
        }
        for (let i = 0; i < NX; i += 1) G[i] = -(y[i] - base[i] - b * h * f[i]);
        luSolve(J, piv, G);
        done = true;
        for (let i = 0; i < NX; i += 1) {
          y[i] += G[i];
          if (!(Math.abs(G[i]) <= TOL[i] + 1e-11 * Math.abs(y[i]))) done = false;
        }
      }
    }
    if (!done) return false;              // the caller retries with two half steps
    for (let i = 0; i < NX; i += 1) {
      out[i] = y[i];
      yp[i] = y[i];
    }
    return true;
  }

  function eventTimes(md, t0, t1) {
    // all gate edges in (t0, t1): cos(w (t - tc)) = +-s
    const w = 2 * Math.PI / md.Tp;
    const out = [];
    md.legs.forEach((g) => {
      const a = Math.acos(g.s);
      const b = Math.acos(-g.s);
      const phases = [a, -a, b, -b];
      const k0 = Math.floor((t0 - g.tc) / md.Tp) - 1;
      const k1 = Math.ceil((t1 - g.tc) / md.Tp) + 1;
      for (let k = k0; k <= k1; k += 1) {
        phases.forEach((ph) => {
          const t = g.tc + k * md.Tp + ph / w;
          if (t > t0 + 1e-15 * md.Tp && t < t1 - 1e-15 * md.Tp) out.push(t);
        });
      }
    });
    out.sort((u, v) => u - v);
    const merged = [];
    out.forEach((t) => { if (!merged.length || t - merged[merged.length - 1] > 1e-12 * md.Tp) merged.push(t); });
    return merged;
  }

  function legVoltage(g, st, x) {
    if (st > 0) return g.rail;
    if (st < 0) return 0;
    // dead time: the diode the current flows in sets the node; smoothed over I_DEAD around zero current, so the
    // steady state depends smoothly on the start state (the shooting Newton needs that)
    const i = g.sign * x[g.idx];
    return 0.5 * g.rail * (1 - Math.tanh(i / I_DEAD));
  }

  function integrate(md, x0, t0, t1, rec) {
    // x(t1) from x(t0); rec (optional) collects every step and the turn-on edges
    const w = 2 * Math.PI / md.Tp;
    const wk = makeWork();
    const ev = [t0].concat(eventTimes(md, t0, t1), [t1]);
    let xn = Float64Array.from(x0);
    let xp = null;
    let hp = 0;
    const xnew = new Float64Array(NX);
    let stPrev = md.legs.map((g) => legState(g, t0 - 1e-9 * md.Tp, w));
    let t = t0;
    let st = null;
    const vb = [0, 0];
    const advance = (h, depth) => {
      // one Gear-2 step of h, or two of h/2 (recursively) where Newton does not converge
      if (implicitStep(md, wk, xn, xp, h, hp, st, xnew)) {
        if (!xp) xp = new Float64Array(NX);
        xp.set(xn);
        xn.set(xnew);
        hp = h;
        return;
      }
      if (depth >= 14) throw new Error("the simulation diverged (Newton fails at a step of " + h.toExponential(1) + " s)");
      advance(h / 2, depth + 1);
      advance(h / 2, depth + 1);
    };
    for (let s = 0; s < ev.length - 1; s += 1) {
      const ta = ev[s];
      const tb = ev[s + 1];
      st = md.legs.map((g) => legState(g, 0.5 * (ta + tb), w));
      if (rec && rec.edges) {
        md.legs.forEach((g, k) => {
          if (st[k] !== 0 && st[k] !== stPrev[k]) {
            const i = g.sign * xn[g.idx];
            // soft = the current flows in the incoming switch's diode; with no dead time the node has no time
            // to swing, so the edge is hard either way (tida_sim: v_ds/V2 = 0.93 on the AC leg)
            const vd = i > 0 ? 0 : (i < 0 ? g.rail : NaN);
            const soft = st[k] > 0 ? vd === g.rail : vd === 0;
            rec.edges.push({ t: ta, leg: g.name, sw: st[k] > 0 ? g.hi : g.lo, i, soft, zvs: soft && g.dead > 0 });
          }
        });
      }
      stPrev = st;
      // dead-time intervals get 8x finer steps: the node follows the current there (fixed grid, so the
      // steady state stays a smooth function of the start state)
      const hm = st.some((v) => v === 0) ? md.hmax / 8 : md.hmax;
      const nStep = Math.max(1, Math.ceil((tb - ta) / hm - 1e-9));
      const h = (tb - ta) / nStep;
      for (let k = 0; k < nStep; k += 1) {
        advance(h, 0);
        t = k === nStep - 1 ? tb : ta + (k + 1) * h;
        if (rec) {
          bridgeVoltages(md, st, xn, vb);         // the voltages of the step that ends at t (implicit)
          rec.push(t, xn, vb[0], vb[1]);
        }
      }
    }
    return xn;
  }

  // ------------------------------------------------------------------ steady state (shooting)
  function halfMap(md, x0) {
    const x = integrate(md, x0, 0, md.Tp / 2, null);
    const out = new Float64Array(NX);
    for (let i = 0; i < NX; i += 1) out[i] = SYM[i] * x[i];
    return out;
  }

  function solveDense(A, b) {
    const a = Float64Array.from(A);
    const piv = new Int32Array(NX);
    luFactor(a, piv);
    const x = Float64Array.from(b);
    luSolve(a, piv, x);
    return x;
  }

  function norm(v) {
    let s = 0;
    for (let i = 0; i < NX; i += 1) s = Math.max(s, Math.abs(v[i]) / SCALE[i]);
    return s;
  }

  function residualAt(md, x) {
    // F(x) = S Phi_{T/2}(x) - x, or null where the integration fails
    let Fx;
    try { Fx = halfMap(md, x); } catch (e) { return null; }
    const F = new Float64Array(NX);
    for (let i = 0; i < NX; i += 1) F[i] = Fx[i] - x[i];
    return F;
  }

  function unitM(x) {
    // a start guess with |m| = 1 (the LLG states live on the unit sphere; Newton's own steps are left alone, the
    // |m| guard of the LLG equations keeps them there)
    [3, 6].forEach((k) => {
      const r = Math.hypot(x[k], x[k + 1], x[k + 2]);
      if (r > 0) { x[k] /= r; x[k + 1] /= r; x[k + 2] /= r; } else { x[k + 1] = 1; }
    });
    return x;
  }

  function shoot(md, guess, maxIt, onIter) {
    // F(x0) = S Phi_{T/2}(x0) - x0 = 0: Newton with a finite-difference Jacobian and a backtracking line search
    let x0 = unitM(Float64Array.from(guess));
    const pert = [1e-3, 1e-3, 1e-3, 1e-5, 1e-5, 1e-5, 1e-5, 1e-5, 1e-5, 1e-3];
    let F = residualAt(md, x0);
    if (!F) return { x0, residual: Infinity, iters: 0 };
    let res = norm(F);
    let it = 0;
    for (; it < maxIt && res > SS_TOL; it += 1) {
      const Jm = new Float64Array(NX * NX);
      for (let j = 0; j < NX; j += 1) {
        const xj = Float64Array.from(x0);
        xj[j] += pert[j];
        const Fj = residualAt(md, xj);
        if (!Fj) return { x0, residual: res, iters: it };
        for (let i = 0; i < NX; i += 1) Jm[i * NX + j] = (Fj[i] - F[i]) / pert[j];
      }
      let dx;
      try { dx = solveDense(Jm, F.map((v) => -v)); } catch (e) { break; }
      let lam = 1;
      let accepted = false;
      for (let ls = 0; ls < 8; ls += 1) {
        const x1 = new Float64Array(NX);
        for (let i = 0; i < NX; i += 1) x1[i] = x0[i] + lam * dx[i];
        const F1 = residualAt(md, x1);
        const r1 = F1 ? norm(F1) : Infinity;
        // take a decrease, or the shortest step if it stays finite (a mild increase can still lead out)
        if (r1 < res || (ls === 7 && Number.isFinite(r1))) { x0 = x1; F = F1; res = r1; accepted = true; break; }
        lam *= 0.5;
      }
      if (onIter) onIter(it + 1, res);
      if (!accepted) break;
    }
    return { x0, residual: res, iters: it };
  }

  function steadyState(md, onIter) {
    // direct shooting from the demagnetized start; if it stalls (strong saturation), continuation in the bus
    // voltages (25, 50, 75, 100 %) from the previous stage's solution
    const start = new Float64Array(NX);
    start[4] = 1;                  // demagnetized M0 = (0, 1, 0), as the generated block
    start[7] = 1;
    let ss = shoot(md, start, 30, onIter);
    let stages = 1;
    if (ss.residual > SS_TOL) {
      let x = start;
      let prev = 0;
      for (const sc of [0.25, 0.5, 0.75, 1]) {
        const mds = sc === 1 ? md : buildModel(Object.assign({}, md.p, { V1: md.p.V1 * sc, V2: md.p.V2 * sc }));
        const g = Float64Array.from(x);
        if (prev) [0, 1, 2, 9].forEach((k) => { g[k] *= sc / prev; });
        const r = shoot(mds, g, 15, onIter);
        stages += 1;
        x = r.x0;
        prev = sc;
        if (sc === 1) ss = r.residual < ss.residual ? r : ss;
      }
    }
    return { x0: ss.x0, residual: ss.residual, iters: ss.iters, stages };
  }

  // ------------------------------------------------------------------ run + metrics
  function recorder(md) {
    const T = md.T;
    const L = md.L;
    // vcm = AC leg voltage about V2 / 2 (power); the plotted v_cm (c to MidHV) also subtracts the MidHV ripple vCs
    const r = { t: [], vab: [], vcm: [], ip: [], iL: [], vCb: [], vCs: [], im: [], HT: [], BT: [], HL: [], BL: [], edges: [] };
    r.push = (t, x, vab, vcm) => {
      const im = x[0] + md.n * x[1];
      const HT = fieldOf(T, im, x[5]);
      const HL = fieldOf(L, x[1], x[8]);
      r.t.push(t); r.vab.push(vab); r.vcm.push(vcm); r.ip.push(x[0]); r.iL.push(x[1]); r.vCb.push(x[2]); r.vCs.push(x[9]); r.im.push(im);
      r.HT.push(HT); r.HL.push(HL);
      // linear: B from the small-signal inductance; LLG: B = mu0 (H + Ms mz)
      r.BT.push(T.linear ? T.Llin * im / (T.N * T.Ae) : MU0 * (HT + T.Ms * x[5]));
      r.BL.push(L.linear ? L.Llin * x[1] / (L.N * L.Ae) : MU0 * (HL + L.Ms * x[8]));
    };
    return r;
  }

  function periodStats(r, k0, k1, Tp) {
    // integrals over r[k0..k1] (one period); voltages are held over the step that ends at their index
    let sP = 0; let sO = 0; let sIp = 0; let sIL = 0; let hT = 0; let hL = 0;
    let ipPk = 0; let iLPk = 0; let imPk = 0;
    let bTmin = Infinity; let bTmax = -Infinity; let bLmin = Infinity; let bLmax = -Infinity; let bTsum = 0;
    for (let k = k0 + 1; k <= k1; k += 1) {
      const dt = r.t[k] - r.t[k - 1];
      const ipm = 0.5 * (r.ip[k] + r.ip[k - 1]);
      const iLm = 0.5 * (r.iL[k] + r.iL[k - 1]);
      sP += r.vab[k] * ipm * dt;
      sO += -r.vcm[k] * iLm * dt;
      sIp += (r.ip[k] * r.ip[k] + r.ip[k] * r.ip[k - 1] + r.ip[k - 1] * r.ip[k - 1]) / 3 * dt;
      sIL += (r.iL[k] * r.iL[k] + r.iL[k] * r.iL[k - 1] + r.iL[k - 1] * r.iL[k - 1]) / 3 * dt;
      hT += 0.5 * (r.HT[k] + r.HT[k - 1]) * (r.BT[k] - r.BT[k - 1]);
      hL += 0.5 * (r.HL[k] + r.HL[k - 1]) * (r.BL[k] - r.BL[k - 1]);
      bTsum += 0.5 * (r.BT[k] + r.BT[k - 1]) * dt;
    }
    for (let k = k0; k <= k1; k += 1) {
      ipPk = Math.max(ipPk, Math.abs(r.ip[k])); iLPk = Math.max(iLPk, Math.abs(r.iL[k])); imPk = Math.max(imPk, Math.abs(r.im[k]));
      bTmin = Math.min(bTmin, r.BT[k]); bTmax = Math.max(bTmax, r.BT[k]);
      bLmin = Math.min(bLmin, r.BL[k]); bLmax = Math.max(bLmax, r.BL[k]);
    }
    return {
      Pin: sP / Tp, Pout: sO / Tp, IpRms: Math.sqrt(sIp / Tp), ILRms: Math.sqrt(sIL / Tp),
      IpPk: ipPk, ILPk: iLPk, ImPk: imPk, loopT: hT, loopL: hL,
      BpkT: 0.5 * (bTmax - bTmin), BdcT: bTsum / Tp, BpkL: 0.5 * (bLmax - bLmin)
    };
  }

  function resample(r, k0, k1, t0, nOut, Tspan) {
    // uniform grid over [t0, t0 + Tspan]: currents/fields linear, the bridge voltages zero-order hold;
    // vcm = c to MidHV
    const out = { t: new Float64Array(nOut + 1) };
    const keys = ["ip", "iL", "vCb", "vCs", "im", "HT", "BT", "HL", "BL"];
    keys.concat(["vab", "vcm"]).forEach((k) => { out[k] = new Float64Array(nOut + 1); });
    let k = k0;
    for (let j = 0; j <= nOut; j += 1) {
      const t = t0 + Tspan * j / nOut;
      while (k < k1 - 1 && r.t[k + 1] < t) k += 1;
      const ta = r.t[k];
      const tb = r.t[k + 1];
      const u = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
      out.t[j] = t - t0;
      keys.forEach((key) => { out[key][j] = r[key][k] + u * (r[key][k + 1] - r[key][k]); });
      const kv = u >= 1 ? Math.min(k + 2, k1) : k + 1;
      out.vab[j] = r.vab[kv];
      out.vcm[j] = r.vcm[kv] - out.vCs[j];
    }
    return out;
  }

  function simulate(params, opts) {
    opts = opts || {};
    const p = merge(params);
    const errors = validate(p);
    if (errors.length) throw new Error(errors.join("; "));
    const t0 = Date.now();
    const md = buildModel(p);
    const ss = steadyState(md, opts.onIter);
    const rec = recorder(md);
    rec.push(0, ss.x0, 0, 0);
    const x1 = integrate(md, ss.x0, 0, md.Tp, rec);
    const k1 = rec.t.length - 1;
    integrate(md, x1, md.Tp, 2 * md.Tp, rec);
    // the first stored point has no step voltage: take the one of the period's last step (periodic)
    rec.vab[0] = rec.vab[k1];
    rec.vcm[0] = rec.vcm[k1];
    const kEnd = rec.t.length - 1;
    const st = periodStats(rec, k1, kEnd, md.Tp);
    let ssChange = 0;
    for (let i = 0; i < 3; i += 1) ssChange = Math.max(ssChange, Math.abs(x1[i] - ss.x0[i]));
    const T = md.T;
    const L = md.L;
    const pCoreT = T.Ae * T.le * st.loopT / md.Tp;
    const pCoreL = L.Ae * L.le * st.loopL / md.Tp;
    const pSw = 2 * p.RonP * st.IpRms ** 2 + p.RonS * st.ILRms ** 2;
    const pWindT = p.tx.Rw1 * st.IpRms ** 2 + p.tx.Rw2 * st.ILRms ** 2;
    const pWindL = p.ind.R * st.ILRms ** 2;
    const pWire = p.Rac * st.ILRms ** 2;
    const losses = pCoreT + pCoreL + pSw + pWindT + pWindL + pWire;
    const edges = rec.edges.filter((e) => e.t >= md.Tp - 1e-12 * md.Tp && e.t < 2 * md.Tp - 1e-12 * md.Tp)
      .map((e) => Object.assign({}, e, { t: e.t - md.Tp }));
    const nOut = opts.nOut || 1000;
    const wave = resample(rec, 0, kEnd, 0, 2 * nOut, 2 * md.Tp);
    const d = derive(p);
    return {
      params: p,
      derived: d,
      metrics: {
        Pin: st.Pin, Pout: st.Pout,
        IpRms: st.IpRms, IpPk: st.IpPk, ILRms: st.ILRms, ILPk: st.ILPk, ImPk: st.ImPk,
        BpkT: st.BpkT, BdcT: st.BdcT, BpkL: st.BpkL,
        PcoreT: pCoreT, PcoreL: pCoreL, Pcond: pSw, PwindT: pWindT, PwindL: pWindL, Pwire: pWire,
        Ploss: losses,
        balance: (st.Pin - st.Pout - losses) / Math.max(Math.abs(st.Pin), 1e-9),   // energy check
        PoutSps: p.D1 === 0 ? powerSps(p) : NaN,
        ssResidual: ss.residual, ssChange, shootIters: ss.iters, shootStages: ss.stages,
        converged: ss.residual < 1e-6,
        steps: rec.t.length, seconds: (Date.now() - t0) / 1000
      },
      edges,
      wave
    };
  }

  function sweep(params, phis, onPoint) {
    return phis.map((phi, k) => {
      let r;
      try {
        const s = simulate(Object.assign({}, params, { phi }));
        r = Object.assign({ phi }, s.metrics);
      } catch (e) {
        r = { phi, error: String((e && e.message) || e) };
      }
      if (onPoint) onPoint(k + 1, phis.length);
      return r;
    });
  }

  // ------------------------------------------------------------------ core parameters at the operating point
  const CORES = [
    { el: "tx", wave: "BT", bpk: "BpkT", name: "transformer" },
    { el: "ind", wave: "BL", bpk: "BpkL", name: "inductor" }
  ];
  const FIT_TEMP = 25;           // degC, as the paper's DAB extractions (tida_config.TEMP)

  async function fitCores(result, nets, opts) {
    // result = simulate(...); nets = {material: prepareNet(...)}; opts = {start: {tx, ind} ({theta, alpha}),
    // runCases, onProgress({core, stage, done, n})}. One period of each core's B(t) -> shape + B_pk -> extraction,
    // refining around opts.start (the fit of the previous operating point). Returns {tx, ind}: fit summaries.
    opts = opts || {};
    const p = result.params;
    const half = Math.floor((result.wave.t.length - 1) / 2);
    const out = {};
    for (const c of CORES) {
      const e = p[c.el];
      if (e.linear) continue;
      const shape = X.shapeKnots(Array.from(result.wave[c.wave].slice(0, half)));
      const op = { material: e.material, f: p.f, Bpk: result.metrics[c.bpk], shape, temp: FIT_TEMP, bias: 0 };
      const st = (opts.start && opts.start[c.el]) || { theta: e.theta, alpha: e.alpha };
      const fit = await X.extract(op, nets[e.material], {
        start: st,
        runCases: opts.runCases,
        onProgress: opts.onProgress ? (pr) => opts.onProgress(Object.assign({ core: c.el }, pr)) : null
      });
      out[c.el] = {
        theta: fit.theta, alpha: fit.alpha, Hc: fit.Hc, rrmse: fit.rrmse, Bpk: op.Bpk, f: op.f,
        segments: fit.segments, runs: fit.runs, seconds: fit.seconds, warnings: X.rangeWarnings(op)
      };
    }
    return out;
  }

  function withCores(params, cores) {
    // params with each core's (theta, alpha, Hc) replaced by cores[el]
    const p = merge(params);
    CORES.forEach((c) => {
      const f = cores && cores[c.el];
      if (f) Object.assign(p[c.el], { theta: f.theta, alpha: f.alpha, Hc: f.Hc });
    });
    return p;
  }

  async function simulateFitted(params, nets, opts) {
    // the operating point with its own core parameters: simulate (opts.start cores, else params), re-extract both
    // cores at that flux, simulate again
    opts = opts || {};
    const r0 = simulate(withCores(params, opts.start));
    const cores = await fitCores(r0, nets, opts);
    return { result: simulate(withCores(params, cores)), cores, first: r0 };
  }

  const api = { DEFAULTS, merge, validate, derive, powerSps, element, buildModel, simulate, sweep,
    CORES, fitCores, withCores, simulateFitted };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.M2SpiceDAB = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
