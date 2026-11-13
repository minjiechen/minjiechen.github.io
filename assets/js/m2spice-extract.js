/* M2Spice LLG-SPICE: (alpha, theta) extraction from the MagNet neural network, in the browser.
 *
 * Port of LTSPICE_EXTRACTOR (RRMSE_Dec_LTspice.py / LTSPICE_FIT.py, ltspice_io.py, ML_Transformer.py):
 *  1. MagNet transformer: B(t) of the operating point -> H(t) (the reference loop).
 *  2. LLG_CORE driven by H = H_amp * sine/triangle/trapezoid from M = (0, 0, Ms); cycle 8 of the run.
 *  3. Loop RRMSE over a theta-alpha grid (Hani_z = Hc, Hani_y = Hc * tan(theta)), coarse then refined.
 * Any other periodic flux shape (op.shape from shapeKnots, e.g. a converter's B(t)) uses the same-shape drive of
 * LTspice_LLG/dab/extract_dab.py: the network's B(t) and the LLG drive H(t) share the shape. Its cycle is picked by
 * time, and a loop with inner loops (more than one rise and fall) is scored per monotonic segment.
 * Plain functions, no DOM: runs in the page, in a Web Worker and in Node (tests).
 */
(function (root) {
  "use strict";

  const MU0 = 4 * Math.PI * 1e-7;
  const GAMMA = 1.759e11;
  const KN = 1e5;                  // |m| drift guard of LLG_core.lib
  const N_MODEL = 129;             // waveform samples of the NN and of the RRMSE loops
  const GRID_PER_CYCLE = 10000;    // uniform output grid of ltspice_io.py
  const CYCLE_PICK = 8;
  const MATERIALS = {              // Ms [A/m], RRMSE_Dec_LTspice.MATERIAL_PROPERTIES
    "3C90": 3.74e5, "3C94": 3.82e5, "3E6": 3.50e5, "3F4": 3.90e5,
    N27: 3.90e5, N30: 3.66e5, N49: 4.14e5, N87: 3.88e5
  };
  const WAVE_SW = { sine: 1, triangle: 2, trapezoidal: 3 };
  // the extraction grids of the journal Table II runs (README of LTSPICE_EXTRACTOR)
  // A stage whose best point lands on a grid wall moves the grid (same size, re-centered on the best point) and
  // tries again, until the best is inside the grid, at a physical limit (LIMITS) or after maxMoves moves.
  const COARSE = { thetaMin: 78, thetaMax: 89, alphaMin: 8, alphaMax: 24, pts: 25, maxMoves: 6 };
  const FINE = { thetaSpan: 0.6, alphaSpan: 2, pts: 25, maxMoves: 6 };
  const LIMITS = { thetaMin: 30, thetaMax: 89.95, alphaMin: 0.2, alphaMax: 200 };

  // ------------------------------------------------------------------ small numerics
  function linspace(a, b, n) {
    // numpy.linspace(a, b, n): a + k*step, last point exactly b
    const out = new Array(n);
    if (n === 1) { out[0] = a; return out; }
    const step = (b - a) / (n - 1);
    for (let k = 0; k < n; k += 1) out[k] = a + k * step;
    out[n - 1] = b;
    return out;
  }

  function mean(x) {
    let s = 0;
    for (let i = 0; i < x.length; i += 1) s += x[i];
    return s / x.length;
  }

  function interp(xq, xp, fp, left, right) {
    // numpy.interp for increasing xp (left/right: values outside the range)
    const n = xp.length;
    if (xq < xp[0]) return left === undefined ? fp[0] : left;
    if (xq > xp[n - 1]) return right === undefined ? fp[n - 1] : right;
    if (xq === xp[n - 1]) return fp[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xp[mid] <= xq) lo = mid; else hi = mid;
    }
    const dx = xp[hi] - xp[lo];
    if (dx === 0) return fp[lo];
    return fp[lo] + (fp[hi] - fp[lo]) * (xq - xp[lo]) / dx;
  }

  function resampleToN(x, n) {
    // RRMSE_Dec_LTspice.resample_to_N: periodic samples, endpoint=False on both grids
    if (x.length === n) return Array.from(x);
    const L = x.length;
    const uOld = new Array(L);
    for (let i = 0; i < L; i += 1) uOld[i] = i / L;
    const out = new Array(n);
    for (let j = 0; j < n; j += 1) out[j] = interp(j / n, uOld, x);
    return out;
  }

  function roll(x, shift) {
    // numpy.roll(x, shift)
    const n = x.length;
    const out = new Array(n);
    for (let i = 0; i < n; i += 1) out[(((i + shift) % n) + n) % n] = x[i];
    return out;
  }

  function argmax(x) {
    let k = 0;
    for (let i = 1; i < x.length; i += 1) if (x[i] > x[k]) k = i;
    return k;
  }

  // ------------------------------------------------------------------ operating-point waveform
  function sawtoothHalf(x) {
    // scipy.signal.sawtooth(x, width=0.5), float64 as in scipy (x = 2*pi*f*t)
    const tw = 2 * Math.PI;
    let tm = x % tw;
    if (tm < 0) tm += tw;
    return tm < 0.5 * tw ? tm / (Math.PI * 0.5) - 1 : (Math.PI * 1.5 - tm) / (Math.PI * 0.5);
  }

  function pairwiseSum32(x, lo, n) {
    // numpy's float32 pairwise summation (np.mean of a float32 array)
    const fr = Math.fround;
    if (n < 8) {
      let s = 0;
      for (let i = 0; i < n; i += 1) s = fr(s + x[lo + i]);
      return s;
    }
    if (n <= 128) {
      const r = new Array(8);
      for (let j = 0; j < 8; j += 1) r[j] = x[lo + j];
      let i;
      for (i = 8; i < n - (n % 8); i += 8) {
        for (let j = 0; j < 8; j += 1) r[j] = fr(r[j] + x[lo + i + j]);
      }
      let s = fr(fr(fr(r[0] + r[1]) + fr(r[2] + r[3])) + fr(fr(r[4] + r[5]) + fr(r[6] + r[7])));
      for (; i < n; i += 1) s = fr(s + x[lo + i]);
      return s;
    }
    let n2 = Math.floor(n / 2);
    n2 -= n2 % 8;
    return fr(pairwiseSum32(x, lo, n2) + pairwiseSum32(x, lo + n2, n - n2));
  }

  function generateBWaveform(f, amp, n, waveform) {
    // RRMSE_Dec_LTspice.generate_B_waveform, float32 as in the original. Bit-exact matters: the
    // reference loop is rolled to start at argmax(B), and the triangle has two near-equal peak samples.
    const fr = Math.fround;
    const w = fr(2 * Math.PI * f);
    const B = new Array(n);
    for (let k = 0; k < n; k += 1) {
      const x = fr(w * fr(k * (1 / f / n)));
      let v;
      if (waveform === "triangle") v = fr(amp * sawtoothHalf(x));
      else if (waveform === "trapezoidal") v = Math.max(fr(-amp), Math.min(fr(amp), fr(2 * amp * sawtoothHalf(x))));
      else v = fr(fr(amp) * fr(Math.sin(x)));
      B[k] = v;
    }
    const m = fr(pairwiseSum32(B, 0, n) / n);
    for (let k = 0; k < n; k += 1) B[k] = fr(B[k] - m);
    return B;
  }

  // ------------------------------------------------------------------ arbitrary periodic shapes (same-shape drive)
  const N_KNOTS = 128;

  function shapeKnots(y) {
    // extract_dab.knots_of: one period of y (any length), rotated to start at its minimum, normalized to [-1, 1],
    // on N_KNOTS uniform phases plus the closing point (value -1 at phase 1)
    const n = y.length;
    let k0 = 0;
    for (let i = 1; i < n; i += 1) if (y[i] < y[k0]) k0 = i;
    const r = new Array(n);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i += 1) {
      r[i] = y[(i + k0) % n];
      lo = Math.min(lo, r[i]);
      hi = Math.max(hi, r[i]);
    }
    if (!(hi > lo)) throw new Error("the waveform has no swing");
    const v = new Array(N_KNOTS + 1);
    for (let k = 0; k < N_KNOTS; k += 1) {
      const u = k / N_KNOTS * n;
      const i = Math.floor(u);
      const a = r[i];
      const b = i + 1 < n ? r[i + 1] : r[0];
      v[k] = 2 * (a + (u - i) * (b - a) - lo) / (hi - lo) - 1;
    }
    v[N_KNOTS] = -1;
    return v;
  }

  function shapeAt(v, ph) {
    // the knots at phase ph (periodic), linear between uniform knots
    const u = (ph - Math.floor(ph)) * (v.length - 1);
    const i = Math.min(Math.floor(u), v.length - 2);
    return v[i] + (u - i) * (v[i + 1] - v[i]);
  }

  function shapeWaveform(v, amp, n) {
    const B = new Array(n);
    for (let k = 0; k < n; k += 1) B[k] = amp * shapeAt(v, k / n);
    const m = mean(B);
    for (let k = 0; k < n; k += 1) B[k] -= m;
    return B;
  }

  function turningPoints(B) {
    // indices of the turns of a closed loop that starts at its minimum (index 0): a rise or fall counts once it
    // exceeds 2 % of the peak-to-peak value, so flats and sampling ripple do not split a branch
    const n = B.length;
    const eps = 0.02 * (Math.max(...B) - Math.min(...B));
    const turns = [0];
    let up = true;
    let ext = 0;
    for (let i = 1; i <= n; i += 1) {
      const b = B[i % n];
      if (up) {
        if (b > B[ext]) ext = i % n;
        else if (B[ext] - b > eps) { turns.push(ext); up = false; ext = i % n; }
      } else if (b < B[ext]) ext = i % n;
      else if (b - B[ext] > eps) { turns.push(ext); up = true; ext = i % n; }
    }
    return turns.filter((t, k) => k === 0 || t > turns[k - 1]);
  }

  function segmentRrmse(Bref, Href, Bcmp, Hcmp, turns, nb) {
    // loop error for loops with inner loops: H on a common B grid within each monotonic segment (between turning
    // points of the reference, the same samples in both loops), pooled over the segments
    nb = nb || 200;
    const n = Bref.length;
    const bounds = turns.concat([n]);
    const span = Math.max(...Bref) - Math.min(...Bref);
    let se = 0;
    let sr = 0;
    let covered = 0;
    let want = 0;
    for (let s = 0; s < bounds.length - 1; s += 1) {
      const idx = [];
      for (let i = bounds[s]; i <= bounds[s + 1]; i += 1) idx.push(i % n);
      const seg = (B, H) => {
        const pts = idx.map((i) => [B[i], H[i]]).sort((a, b) => a[0] - b[0]);
        const Bs = [];
        const Hs = [];
        pts.forEach(([b, h]) => { if (!Bs.length || b > Bs[Bs.length - 1]) { Bs.push(b); Hs.push(h); } });
        return { Bs, Hs };
      };
      const r = seg(Bref, Href);
      const c = seg(Bcmp, Hcmp);
      if (r.Bs.length < 2 || c.Bs.length < 2) continue;
      const lo = Math.max(r.Bs[0], c.Bs[0]);
      const hi = Math.min(r.Bs[r.Bs.length - 1], c.Bs[c.Bs.length - 1]);
      const m = Math.max(20, Math.round(nb * (r.Bs[r.Bs.length - 1] - r.Bs[0]) / span));
      want += m;
      if (!(hi > lo)) continue;
      linspace(lo, hi, m).forEach((b) => {
        const hr = interp(b, r.Bs, r.Hs);
        const hc = interp(b, c.Bs, c.Hs);
        se += (hr - hc) ** 2;
        sr += hr ** 2;
        covered += 1;
      });
    }
    if (covered < 0.5 * want) return NaN;
    return Math.sqrt(se) / Math.max(Math.sqrt(sr), 1e-12);
  }

  // ------------------------------------------------------------------ MagNet transformer (B -> H)
  function decodeTensor(t) {
    const bin = typeof atob === "function" ? atob(t.data) : Buffer.from(t.data, "base64").toString("binary");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const f32 = new Float32Array(bytes.buffer);
    return { shape: t.shape, data: Float64Array.from(f32) };
  }

  function prepareNet(doc) {
    const T = {};
    Object.entries(doc.tensors).forEach(([k, v]) => { T[k] = decodeTensor(v); });
    const d = doc.dim;
    // positional encoding as ML_Transformer.PositionalEncoder(max_len=130), rebuilt (not the stored one)
    const pe = [];
    for (let pos = 0; pos < doc.pe_len; pos += 1) {
      const row = new Float64Array(d);
      for (let i = 0; i < d; i += 2) {
        const div = Math.fround(Math.exp(Math.fround(i * Math.fround(-Math.log(10000.0) / d))));
        row[i] = Math.sin(pos * div);
        if (i + 1 < d) row[i + 1] = Math.cos(pos * div);
      }
      pe.push(row);
    }
    return { T, pe, d, heads: doc.heads, norm: doc.norm, material: doc.material };
  }

  function linear(T, name, x) {
    const W = T[name + ".weight"];
    const b = T[name + ".bias"];
    const nOut = W.shape[0];
    const nIn = W.shape[1];
    const y = new Float64Array(nOut);
    for (let o = 0; o < nOut; o += 1) {
      let s = b.data[o];
      const off = o * nIn;
      for (let i = 0; i < nIn; i += 1) s += W.data[off + i] * x[i];
      y[o] = s;
    }
    return y;
  }

  function tanhV(x) {
    const y = new Float64Array(x.length);
    for (let i = 0; i < x.length; i += 1) y[i] = Math.tanh(x[i]);
    return y;
  }

  function addV(a, b) {
    const y = new Float64Array(a.length);
    for (let i = 0; i < a.length; i += 1) y[i] = a[i] + b[i];
    return y;
  }

  function layerNorm(T, name, x) {
    const n = x.length;
    let mu = 0;
    for (let i = 0; i < n; i += 1) mu += x[i];
    mu /= n;
    let v = 0;
    for (let i = 0; i < n; i += 1) v += (x[i] - mu) * (x[i] - mu);
    v /= n;
    const inv = 1 / Math.sqrt(v + 1e-5);
    const g = T[name + ".weight"].data;
    const b = T[name + ".bias"].data;
    const y = new Float64Array(n);
    for (let i = 0; i < n; i += 1) y[i] = (x[i] - mu) * inv * g[i] + b[i];
    return y;
  }

  function feedForward(T, prefix, x) {
    const h = linear(T, prefix + ".linear1", x);
    for (let i = 0; i < h.length; i += 1) if (h[i] < 0) h[i] = 0;
    return linear(T, prefix + ".linear2", h);
  }

  function inProj(T, name, x, part, d) {
    // rows [part*d, (part+1)*d) of nn.MultiheadAttention.in_proj (0 = q, 1 = k, 2 = v)
    const W = T[name + ".in_proj_weight"].data;
    const b = T[name + ".in_proj_bias"].data;
    const y = new Float64Array(d);
    for (let o = 0; o < d; o += 1) {
      const r = part * d + o;
      let s = b[r];
      for (let i = 0; i < d; i += 1) s += W[r * d + i] * x[i];
      y[o] = s;
    }
    return y;
  }

  function attend(T, name, q, K, V, nKeys, heads, d) {
    // one query against keys/values 0..nKeys-1, nn.MultiheadAttention semantics, then out_proj
    const hd = d / heads;
    const scale = 1 / Math.sqrt(hd);
    const ctx = new Float64Array(d);
    const w = new Float64Array(nKeys);
    for (let h = 0; h < heads; h += 1) {
      const o = h * hd;
      let mx = -Infinity;
      for (let j = 0; j < nKeys; j += 1) {
        let s = 0;
        for (let i = 0; i < hd; i += 1) s += q[o + i] * K[j][o + i];
        w[j] = s * scale;
        if (w[j] > mx) mx = w[j];
      }
      let z = 0;
      for (let j = 0; j < nKeys; j += 1) { w[j] = Math.exp(w[j] - mx); z += w[j]; }
      for (let j = 0; j < nKeys; j += 1) {
        const a = w[j] / z;
        for (let i = 0; i < hd; i += 1) ctx[o + i] += a * V[j][o + i];
      }
    }
    return linear(T, name + ".out_proj", ctx);
  }

  function nnPredictH(net, B, f, temp, bias) {
    // ML_Transformer.BH_Transformer: B(t) [T] -> H(t) [A/m]. The decoder is causal, so its
    // autoregressive loop is run incrementally (position t only sees tgt[0..t]).
    const { T, pe, d, heads, norm } = net;
    const N = B.length;
    const fr = Math.fround;
    const v3 = [
      (fr(Math.log10(f)) - norm[2]) / norm[3],
      (fr(temp) - norm[4]) / norm[5],
      (fr(bias) - norm[6]) / norm[7]
    ];
    // encoder
    const xs = [];
    for (let t = 0; t < N; t += 1) {
      const bn = (fr(B[t]) - norm[0]) / norm[1];
      let x = linear(T, "encoder_input_layer.2", tanhV(linear(T, "encoder_input_layer.0", [bn])));
      xs.push(addV(x, pe[t]));
    }
    const EL = "encoder.layers.0";
    const Ke = xs.map((x) => inProj(T, EL + ".self_attn", x, 1, d));
    const Ve = xs.map((x) => inProj(T, EL + ".self_attn", x, 2, d));
    const mem = xs.map((x) => {
      const sa = attend(T, EL + ".self_attn", inProj(T, EL + ".self_attn", x, 0, d), Ke, Ve, N, heads, d);
      let y = layerNorm(T, EL + ".norm1", addV(x, sa));
      y = layerNorm(T, EL + ".norm2", addV(y, feedForward(T, EL, y)));
      const cat = new Float64Array(d + 3);
      cat.set(y, 0);
      cat[d] = v3[0]; cat[d + 1] = v3[1]; cat[d + 2] = v3[2];
      let p = tanhV(linear(T, "projector.0", cat));
      p = tanhV(linear(T, "projector.2", p));
      return linear(T, "projector.4", p);
    });
    // decoder
    const DL = "decoder.layers.0";
    const Kc = mem.map((m) => inProj(T, DL + ".multihead_attn", m, 1, d));
    const Vc = mem.map((m) => inProj(T, DL + ".multihead_attn", m, 2, d));
    const Ks = [];
    const Vs = [];
    const H = new Array(N);
    let tgt = 0.1;
    for (let t = 0; t < N; t += 1) {
      let y = linear(T, "decoder_input_layer.2", tanhV(linear(T, "decoder_input_layer.0", [tgt])));
      y = addV(y, pe[t]);
      Ks.push(inProj(T, DL + ".self_attn", y, 1, d));
      Vs.push(inProj(T, DL + ".self_attn", y, 2, d));
      const sa = attend(T, DL + ".self_attn", inProj(T, DL + ".self_attn", y, 0, d), Ks, Vs, t + 1, heads, d);
      let z = layerNorm(T, DL + ".norm1", addV(y, sa));
      const ca = attend(T, DL + ".multihead_attn", inProj(T, DL + ".multihead_attn", z, 0, d), Kc, Vc, N, heads, d);
      z = layerNorm(T, DL + ".norm2", addV(z, ca));
      z = layerNorm(T, DL + ".norm3", addV(z, feedForward(T, DL, z)));
      const out = linear(T, "linear_mapping.2", tanhV(linear(T, "linear_mapping.0", z)))[0];
      tgt = fr(out);
      H[t] = tgt * norm[9] + norm[8];
    }
    return H;
  }

  function nnLoop(net, op) {
    // the reference loop of RRMSE_Dec_LTspice: B waveform, rolled to start at B_max, NN, rolled back
    const B = op.shape ? shapeWaveform(op.shape, op.Bpk, N_MODEL) : generateBWaveform(op.f, op.Bpk, N_MODEL, op.waveform);
    const sh = argmax(B);
    const Hr = nnPredictH(net, roll(B, -sh), op.f, op.temp, op.bias || 0);
    return { B: B.map(Number), H: roll(Hr, sh) };
  }

  // ------------------------------------------------------------------ LLG_CORE, current driven
  function drive(sw, I0, f, t) {
    // ltspice_io._drive
    if (sw === 1) return I0 * Math.sin(2 * Math.PI * f * t);
    const ph = t * f - Math.floor(t * f);
    const tri = ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph;
    return I0 * (sw === 2 ? tri : Math.max(-1, Math.min(1, 2 * tri)));
  }

  function llgRhs(p, H, mx, my, mz, out) {
    // LLG_core.lib: dm/dt = pref*(m x Heff + alpha*m x (m x Heff)) - kn*(|m|^2-1)*m,
    // Heff = (0, Hani_y, H + Hani_z*mz/|m|)
    const r2 = mx * mx + my * my + mz * mz;
    const hz = H + p.Hani_z * mz / Math.sqrt(r2 + 1e-30);
    const cx = my * hz - mz * p.Hani_y;
    const cy = -mx * hz;
    const cz = mx * p.Hani_y;
    const n2 = r2 - 1;
    out[0] = p.pref * (cx + p.alpha * (my * cz - mz * cy)) - KN * n2 * mx;
    out[1] = p.pref * (cy + p.alpha * (mz * cx - mx * cz)) - KN * n2 * my;
    out[2] = p.pref * (cz + p.alpha * (mx * cy - my * cx)) - KN * n2 * mz;
  }

  function simulateCycle(c) {
    // ltspice_io.run_ltspice_bh_cycle + run_llg_many post-processing:
    // c = {Ms, alpha, Hani_z, Hani_y, I0, f, sw, shape?, gamma?, mu0?, m0?}; returns {H, B} (129 points, B zero-mean)
    // c.shape (shapeKnots): H = I0 * shape(f t), and cycle CYCLE_PICK is the time window [7 T, 8 T) (phase 0 = the
    // shape's minimum), since such a shape may cross zero more than once per period
    const gamma = c.gamma || GAMMA;
    const mu0 = c.mu0 || MU0;
    const sw = c.sw || 1;
    const p = { pref: -gamma * mu0 / (1 + c.alpha * c.alpha), alpha: c.alpha, Hani_y: c.Hani_y, Hani_z: c.Hani_z };
    const T = 1 / c.f;
    const dt = T / GRID_PER_CYCLE;
    // RK4 sub-steps per grid step: keep (rate * h) <= 0.25 for the fastest LL mode
    const heff = Math.hypot(c.Hani_y, Math.abs(c.I0) + Math.abs(c.Hani_z));
    const rate = Math.abs(p.pref) * Math.sqrt(1 + c.alpha * c.alpha) * heff + 2 * KN;
    const nsub = Math.max(1, Math.ceil(rate * dt / 0.25));
    const h = dt / nsub;
    const nCyc = CYCLE_PICK + 0.5;           // the cycle-8 window ends by 8.25 periods for all drives
    const n = Math.ceil(nCyc * GRID_PER_CYCLE);
    const Hg = new Float64Array(n + 1);
    const Bg = new Float64Array(n + 1);
    const m0 = c.m0 || [0, 0, 1];
    let mx = m0[0];
    let my = m0[1];
    let mz = m0[2];
    const k1 = [0, 0, 0];
    const k2 = [0, 0, 0];
    const k3 = [0, 0, 0];
    const k4 = [0, 0, 0];
    const drv = c.shape ? (tt) => c.I0 * shapeAt(c.shape, tt * c.f) : (tt) => drive(sw, c.I0, c.f, tt);
    Hg[0] = drv(0);
    Bg[0] = mu0 * (Hg[0] + c.Ms * mz);
    let t = 0;
    for (let k = 1; k <= n; k += 1) {
      for (let s = 0; s < nsub; s += 1) {
        const ha = drv(t);
        const hm = drv(t + 0.5 * h);
        const hb = drv(t + h);
        llgRhs(p, ha, mx, my, mz, k1);
        llgRhs(p, hm, mx + 0.5 * h * k1[0], my + 0.5 * h * k1[1], mz + 0.5 * h * k1[2], k2);
        llgRhs(p, hm, mx + 0.5 * h * k2[0], my + 0.5 * h * k2[1], mz + 0.5 * h * k2[2], k3);
        llgRhs(p, hb, mx + h * k3[0], my + h * k3[1], mz + h * k3[2], k4);
        mx += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        my += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        mz += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
        t = (k - 1) * dt + (s + 1) * h;
      }
      t = k * dt;
      Hg[k] = drv(t);
      Bg[k] = mu0 * (Hg[k] + c.Ms * mz);
    }
    if (!Number.isFinite(mz)) throw new Error("LLG integration diverged");
    if (c.shape) {
      const a = (CYCLE_PICK - 1) * GRID_PER_CYCLE;
      const H1 = Array.from(Hg.subarray(a, a + GRID_PER_CYCLE));
      const B1 = Array.from(Bg.subarray(a, a + GRID_PER_CYCLE));
      const mb = mean(B1);
      for (let i = 0; i < B1.length; i += 1) B1[i] -= mb;
      return { H: resampleToN(H1, N_MODEL), B: resampleToN(B1, N_MODEL) };
    }
    // plecs_io.extract_full_cycle_by_rising_zero(H, t, B, cycle_index=8)
    const idx = [];
    for (let k = 0; k < n && idx.length <= CYCLE_PICK; k += 1) {
      if (Math.sign(Hg[k]) <= 0 && Math.sign(Hg[k + 1]) > 0) idx.push(k);
    }
    if (idx.length <= CYCLE_PICK) throw new Error("not enough zero crossings");
    const a = idx[CYCLE_PICK - 1] + 1;
    const b = idx[CYCLE_PICK] + 1;
    const H1 = Array.from(Hg.subarray(a, b));
    const B1 = Array.from(Bg.subarray(a, b));
    const mb = mean(B1);
    for (let i = 0; i < B1.length; i += 1) B1[i] -= mb;
    return { H: resampleToN(H1, N_MODEL), B: resampleToN(B1, N_MODEL) };
  }

  // ------------------------------------------------------------------ loop error, Hc, anisotropy
  function splitBranches(B, H) {
    const asc = { B: [], H: [] };
    const des = { B: [], H: [] };
    for (let i = 0; i < B.length; i += 1) {
      const dB = i === 0 ? 0 : B[i] - B[i - 1];
      const tgt = dB >= 0 ? asc : des;
      tgt.B.push(B[i]);
      tgt.H.push(H[i]);
    }
    return [asc, des];
  }

  function rrmseOnCommonB(ref, cmp, nb) {
    nb = nb || 200;
    const minOf = (x) => x.reduce((m, v) => Math.min(m, v), Infinity);
    const maxOf = (x) => x.reduce((m, v) => Math.max(m, v), -Infinity);
    const Bmin = Math.max(minOf(ref.B), minOf(cmp.B));
    const Bmax = Math.min(maxOf(ref.B), maxOf(cmp.B));
    if (!(Number.isFinite(Bmin) && Number.isFinite(Bmax)) || Bmax <= Bmin) return NaN;
    const grid = linspace(Bmin, Bmax, nb);
    const interpH = (br) => {
      const order = br.B.map((_, i) => i).sort((i, j) => br.B[i] - br.B[j]);
      const Bm = [];
      const Hm = [];
      order.forEach((i, k) => {
        if (k === 0 || br.B[i] !== br.B[order[k - 1]]) { Bm.push(br.B[i]); Hm.push(br.H[i]); }
      });
      return grid.map((x) => interp(x, Bm, Hm, NaN, NaN));
    };
    const Hr = interpH(ref);
    const Hc = interpH(cmp);
    let cnt = 0;
    let se = 0;
    let sr = 0;
    for (let i = 0; i < nb; i += 1) {
      if (Number.isFinite(Hr[i]) && Number.isFinite(Hc[i])) {
        cnt += 1;
        se += (Hr[i] - Hc[i]) ** 2;
        sr += Hr[i] ** 2;
      }
    }
    if (cnt < nb * 0.5) return NaN;
    return Math.sqrt(se) / Math.max(Math.sqrt(sr), 1e-12);
  }

  function loopRrmse(Bref, Href, Bcmp, Hcmp) {
    const [ra, rd] = splitBranches(Bref, Href);
    const [ca, cd] = splitBranches(Bcmp, Hcmp);
    const ea = rrmseOnCommonB(ra, ca);
    const ed = rrmseOnCommonB(rd, cd);
    if (Number.isNaN(ea) && Number.isNaN(ed)) return NaN;
    if (Number.isNaN(ea)) return ed;
    if (Number.isNaN(ed)) return ea;
    return 0.5 * (ea + ed);
  }

  function computeHc(B, H) {
    const n = B.length;
    const dB = new Array(n);
    for (let i = 0; i < n; i += 1) {
      if (i === 0) dB[i] = B[1] - B[0];
      else if (i === n - 1) dB[i] = B[n - 1] - B[n - 2];
      else dB[i] = (B[i + 1] - B[i - 1]) / 2;
    }
    const cross = (sel, test) => {
      const idx = [];
      for (let i = 0; i < n; i += 1) if (sel(dB[i])) idx.push(i);
      for (let k = 0; k < idx.length - 1; k += 1) {
        const i1 = idx[k];
        const i2 = idx[k + 1];
        if (test(B[i1], B[i2])) return H[i1] + (H[i2] - H[i1]) * (-B[i1]) / (B[i2] - B[i1]);
      }
      return NaN;
    };
    const hp = cross((d) => d > 0, (b1, b2) => b1 <= 0 && 0 < b2);
    const hn = cross((d) => d < 0, (b1, b2) => b1 >= 0 && 0 > b2);
    if (Number.isFinite(hp) && Number.isFinite(hn)) return 0.5 * (Math.abs(hp) + Math.abs(hn));
    if (Number.isFinite(hp)) return Math.abs(hp);
    if (Number.isFinite(hn)) return Math.abs(hn);
    return NaN;
  }

  function anisotropy(Hc, thetaDeg) {
    // RRMSE_Dec_LTspice.compute_anisotropy: Hani_z = Hc, Hani_y = Hc*tan(theta)
    const th = thetaDeg * Math.PI / 180;
    const c = Math.cos(th);
    const Hk = Math.abs(c) >= 1e-6 ? Hc / c : Hc * 1000;
    return { Hani_z: Hc, Hani_y: Hk * Math.sin(th) };
  }

  // ------------------------------------------------------------------ extraction
  function gridCases(ref, thetas, alphas) {
    const cases = [];
    thetas.forEach((th, j) => {
      const an = anisotropy(ref.Hc, th);
      alphas.forEach((al, i) => {
        const c = { j, i, Ms: ref.Ms, alpha: al, Hani_z: an.Hani_z, Hani_y: an.Hani_y, I0: ref.Hamp, f: ref.f, sw: ref.sw };
        if (ref.shape) c.shape = ref.shape;
        cases.push(c);
      });
    });
    return cases;
  }

  function runCasesLocal(cases, onCase) {
    return Promise.resolve(cases.map((c, k) => {
      let r;
      try { r = simulateCycle(c); } catch (e) { r = { error: String(e.message || e) }; }
      if (onCase) onCase(k + 1, cases.length);
      return r;
    }));
  }

  async function evalGrid(ref, thetas, alphas, runCases, stage, onProgress) {
    const cases = gridCases(ref, thetas, alphas);
    const sims = await runCases(cases, (done, n) => onProgress && onProgress({ stage, done, n }));
    const Err = thetas.map(() => alphas.map(() => NaN));
    let best = null;
    cases.forEach((c, k) => {
      const s = sims[k];
      if (!s || s.error) return;
      const e = ref.turns ? segmentRrmse(ref.B, ref.H, s.B, s.H, ref.turns) : loopRrmse(ref.B, ref.H, s.B, s.H);
      Err[c.j][c.i] = e;
      if (Number.isFinite(e) && (!best || e < best.err)) best = { j: c.j, i: c.i, err: e, sim: s };
    });
    if (!best) throw new Error("no valid LLG run in the " + stage + " grid");
    return { thetas, alphas, Err, best, theta: thetas[best.j], alpha: alphas[best.i] };
  }

  function windowAround(theta, alpha, halfTh, halfAl) {
    // [theta, alpha] window of the given half-spans centered on a point, slid inward where it would cross LIMITS
    const slide = (c, half, lo, hi) => {
      let a = c - half;
      let b = c + half;
      if (b > hi) { a -= b - hi; b = hi; }
      if (a < lo) { b = Math.min(hi, b + lo - a); a = lo; }
      return [a, b];
    };
    const [thLo, thHi] = slide(theta, halfTh, LIMITS.thetaMin, LIMITS.thetaMax);
    const [alLo, alHi] = slide(alpha, halfAl, LIMITS.alphaMin, LIMITS.alphaMax);
    return { thLo, thHi, alLo, alHi };
  }

  function walls(g) {
    // grid walls the best point of g lies on, split into ones the search can move past and physical limits
    const nT = g.thetas.length - 1;
    const nA = g.alphas.length - 1;
    const eps = 1e-9;
    const open = [];
    const limit = [];
    const add = (on, atLimit, name) => { if (on) (atLimit ? limit : open).push(name); };
    add(g.best.j === 0, g.thetas[0] <= LIMITS.thetaMin + eps, "theta low");
    add(g.best.j === nT, g.thetas[nT] >= LIMITS.thetaMax - eps, "theta high");
    add(g.best.i === 0, g.alphas[0] <= LIMITS.alphaMin + eps, "alpha low");
    add(g.best.i === nA, g.alphas[nA] >= LIMITS.alphaMax - eps, "alpha high");
    return { open, limit };
  }

  async function searchStage(ref, win, pts, maxMoves, stage, runCases, onProgress) {
    // evaluate a pts x pts grid; while the best point sits on a wall that is not a physical limit, re-center a
    // same-size grid on it (this extends the range past that wall) and evaluate again
    const halfTh = (win.thHi - win.thLo) / 2;
    const halfAl = (win.alHi - win.alLo) / 2;
    let best = null;
    let moves = 0;
    let grids = 0;
    for (;;) {
      const label = moves ? `${stage} (moved ${moves}x)` : stage;
      const g = await evalGrid(ref, linspace(win.thLo, win.thHi, pts), linspace(win.alLo, win.alHi, pts), runCases, label, onProgress);
      grids += 1;
      const improved = !best || g.best.err <= best.best.err;   // ties go to the newer grid, where the point is inside
      if (improved) best = g;
      const w = walls(best);
      if (!w.open.length || !improved || moves >= maxMoves) return { g: best, moves, grids, open: w.open, limit: w.limit };
      win = windowAround(best.theta, best.alpha, halfTh, halfAl);
      moves += 1;
    }
  }

  async function extract(op, net, opts) {
    // op = {material, f, Bpk, waveform | shape, temp, bias}; net = prepareNet(weights json)
    // opts = {runCases(cases, onCase) -> Promise<[{H,B}|{error}]>, onProgress({stage, done, n}), coarse, fine,
    //         start: {theta, alpha}}: with start (a fit of a nearby operating point), only the refine stage runs,
    //         centred there; it moves its grid as far as the best point needs
    opts = opts || {};
    const runCases = opts.runCases || runCasesLocal;
    const onProgress = opts.onProgress;
    const coarse = Object.assign({}, COARSE, opts.coarse || {});
    const fine = Object.assign({}, FINE, opts.fine || {});
    if (!(op.material in MATERIALS)) throw new Error("unknown material " + op.material);
    const t0 = Date.now();
    const loop = nnLoop(net, op);
    const Hc = computeHc(loop.B, loop.H);
    if (!Number.isFinite(Hc)) throw new Error("the NN loop has no valid coercive field");
    const Hamp = 0.5 * (Math.max(...loop.H) - Math.min(...loop.H));
    const ref = { B: loop.B, H: loop.H, Hc, Hamp, Ms: MATERIALS[op.material], f: op.f, sw: WAVE_SW[op.waveform] || 1 };
    if (op.shape) {
      ref.shape = op.shape;
      const turns = turningPoints(loop.B);
      if (turns.length > 2) ref.turns = turns;        // inner loops; one rise and one fall keeps loopRrmse
    }
    if (onProgress) onProgress({ stage: "nn", done: 1, n: 1 });

    const s1 = opts.start ? null : await searchStage(ref, { thLo: coarse.thetaMin, thHi: coarse.thetaMax, alLo: coarse.alphaMin, alHi: coarse.alphaMax },
      coarse.pts, coarse.maxMoves, "coarse", runCases, onProgress);
    const g1 = s1 ? s1.g : null;
    const c0 = g1 || opts.start;
    const s2 = await searchStage(ref, windowAround(c0.theta, c0.alpha, fine.thetaSpan, fine.alphaSpan),
      fine.pts, opts.start ? Math.max(fine.maxMoves, 12) : fine.maxMoves, "refine", runCases, onProgress);
    const g2 = s2.g;
    const an = anisotropy(Hc, g2.theta);
    return {
      op: Object.assign({}, op),
      Ms: ref.Ms,
      gamma: GAMMA,
      Hc,
      Hamp,
      theta: g2.theta,
      alpha: g2.alpha,
      Hani_z: an.Hani_z,
      Hani_y: an.Hani_y,
      rrmse: g2.best.err,
      coarseBest: g1 ? { theta: g1.theta, alpha: g1.alpha, rrmse: g1.best.err } : null,
      moves: { coarse: s1 ? s1.moves : 0, refine: s2.moves },
      grids: (s1 ? s1.grids : 0) + s2.grids,
      runs: (s1 ? s1.grids * coarse.pts * coarse.pts : 0) + s2.grids * fine.pts * fine.pts,
      segments: ref.turns ? ref.turns.length : 2,
      // walls the final best point still touches: "open" = the search gave up (move cap or no gain),
      // "limit" = a physical limit of the search (theta near 90 deg or alpha at its floor/ceiling)
      edge: { open: s2.open, limit: s2.limit },
      nn: loop,
      llg: g2.best.sim,
      coarse: g1 ? { thetas: g1.thetas, alphas: g1.alphas, Err: g1.Err } : null,
      fine: { thetas: g2.thetas, alphas: g2.alphas, Err: g2.Err },
      seconds: (Date.now() - t0) / 1000
    };
  }

  // MagNet training ranges (approximate, for a warning only)
  function rangeWarnings(op) {
    const w = [];
    if (op.f < 50e3 || op.f > 500e3) w.push("f is outside the MagNet range (50-500 kHz)");
    if (op.Bpk < 0.01 || op.Bpk > 0.3) w.push("B_pk is outside the MagNet range (about 0.01-0.3 T)");
    if (op.temp < 25 || op.temp > 90) w.push("T is outside the MagNet range (25-90 C)");
    return w;
  }

  const api = {
    MU0, GAMMA, KN, N_MODEL, MATERIALS, WAVE_SW, COARSE, FINE,
    linspace, resampleToN, roll, generateBWaveform, shapeKnots, shapeWaveform, turningPoints, segmentRrmse,
    prepareNet, nnPredictH, nnLoop,
    drive, llgRhs, simulateCycle,
    splitBranches, rrmseOnCommonB, loopRrmse, computeHc, anisotropy,
    gridCases, runCasesLocal, extract, rangeWarnings
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.M2SpiceExtract = api;
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : globalThis));
