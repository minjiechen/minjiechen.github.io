/* M2Spice LLG-SPICE: the M2Spice MLM ladder with nonlinear Landau-Lifshitz-Gilbert ferrites, as one
 * LTspice block (.lib + .asy symbol). Port of LTspice_LLG/m2spice/m2spice_llg.py.
 *
 * Ferrite mapping (field domain: current = MMF, voltage = volts per turn):
 *   M2Spice Lf = mu0*Ac/(g + Ac*w/(mur*c*d)) = Lgap || Lplate,  Lgap = mu0*Ac/g,  Lplate = mu0*mur*c*d/w
 *   plate -> LLG_CORE N=1, Ae=c*d, le=w (or le = core_le/2 per plate), gap -> linear L in parallel.
 * The core material (Ms, alpha, gamma, Hani_y, Hani_z) comes from the (alpha, theta) extractor in
 * m2spice-extract.js, or is typed in.
 */
(function (root) {
  "use strict";

  const MU0 = 4 * Math.PI * 1e-7;          // M2Spice's mu0 for the ferrite terms
  const LLG_DEFAULTS = { Ms: 3.88e5, alpha: 10, gamma: 1.76e11, Hani_y: 60, Hani_z: 60, mx0: 0, my0: 1, mz0: 0 };
  const LLG_PARAM_ORDER = ["Ms", "alpha", "gamma", "Hani_z", "Hani_y", "mx0", "my0", "mz0"];

  // LLG_CORE subcircuit of LTspice_LLG/model/LLG_core.lib (written by tools/embed_llg_core.py; do not edit)
  // <LLG_CORE>
  const LLG_CORE_LINES = [
    ".subckt LLG_CORE p n params: Ms=3.88e5 alpha=10 gamma=1.76e11 mu0=1.2566e-6",
    "+ Hani_z=60 Hani_y=60 N=1 Ae=7.638e-4 le=19e-3 vac=1",
    "+ mx0=0 my0=1 mz0=0 kn=1e5",
    "",
    ".param pref = {-gamma*mu0/(1+alpha*alpha)}",
    ".param KH   = {N/le}",
    ".param KV   = {N*Ae*mu0*Ms}",
    ".param Lvac = {max(vac*mu0*N*N*Ae/le, 1e-15)}",
    "",
    "* ---- electrical port: sense -> vacuum inductance -> magnetization back-EMF",
    "Vsns p a 0",
    "Lv   a c {Lvac} Rser=0",
    "BvM  c n V={KV}*V(dz)",
    "",
    "* ---- applied field and effective z field",
    "Bh   h  0 V={KH}*I(Vsns)",
    "Bhz  hz 0 V=V(h) + {Hani_z}*V(mz)/sqrt(V(mx)*V(mx)+V(my)*V(my)+V(mz)*V(mz)+1e-30)",
    "",
    "* ---- m x H_eff,  H_eff = (0, Hani_y, hz)",
    "Bcx  cx 0 V=V(my)*V(hz) - V(mz)*{Hani_y}",
    "Bcy  cy 0 V=-V(mx)*V(hz)",
    "Bcz  cz 0 V=V(mx)*{Hani_y}",
    "",
    "* ---- dm/dt = pref*( m x H + alpha * m x (m x H) ) - kn*(|m|^2-1)*m",
    "Bn2  n2 0 V=V(mx)*V(mx)+V(my)*V(my)+V(mz)*V(mz)-1",
    "Bdx  dx 0 V={pref}*(V(cx) + {alpha}*(V(my)*V(cz) - V(mz)*V(cy))) - {kn}*V(n2)*V(mx)",
    "Bdy  dy 0 V={pref}*(V(cy) + {alpha}*(V(mz)*V(cx) - V(mx)*V(cz))) - {kn}*V(n2)*V(my)",
    "Bdz  dz 0 V={pref}*(V(cz) + {alpha}*(V(mx)*V(cy) - V(my)*V(cx))) - {kn}*V(n2)*V(mz)",
    "",
    "* ---- integrators: V(m*) = state",
    "Bix  0 mx I=V(dx)",
    "Cmx  mx 0 1 ic={mx0}",
    "Biy  0 my I=V(dy)",
    "Cmy  my 0 1 ic={my0}",
    "Biz  0 mz I=V(dz)",
    "Cmz  mz 0 1 ic={mz0}",
    "",
    "* ---- monitor",
    "Bb   b 0 V={mu0}*(V(h) + {Ms}*V(mz))",
    ".ends LLG_CORE",
    ""
  ];
  // </LLG_CORE>

  // ------------------------------------------------------------------ formatting
  function g6(x) {
    // Python "%.6g"
    if (x === 0) return Object.is(x, -0) ? "-0" : "0";
    if (!Number.isFinite(x)) return Number.isNaN(x) ? "nan" : (x > 0 ? "inf" : "-inf");
    const [mant, expS] = x.toExponential(5).split("e");
    const X = parseInt(expS, 10);
    const strip = (s) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
    if (X >= -4 && X < 6) return strip(x.toFixed(5 - X));
    return strip(mant) + "e" + (X < 0 ? "-" : "+") + String(Math.abs(X)).padStart(2, "0");
  }

  function pyList(a) {
    return "[" + a.join(", ") + "]";
  }

  // ------------------------------------------------------------------ complex (CPython semantics)
  const C = (re, im) => ({ re, im });
  const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const csub = (a, b) => C(a.re - b.re, a.im - b.im);
  const cadd = (a, b) => C(a.re + b.re, a.im + b.im);
  function cdiv(a, b) {
    // CPython _Py_c_quot
    if (Math.abs(b.re) >= Math.abs(b.im)) {
      const ratio = b.im / b.re;
      const den = b.re + b.im * ratio;
      return C((a.re + a.im * ratio) / den, (a.im - a.re * ratio) / den);
    }
    const ratio = b.re / b.im;
    const den = b.re * ratio + b.im;
    return C((a.re * ratio + a.im) / den, (a.im * ratio - a.re) / den);
  }
  const cexp = (a) => { const l = Math.exp(a.re); return C(l * Math.cos(a.im), l * Math.sin(a.im)); };
  const ONE = C(1, 0);

  // ------------------------------------------------------------------ M2Spice.getImpe
  function impedances(g) {
    const om = 2 * Math.PI * g.f;
    const Z = { Ra: [], La: [], Rb: [], Lb: [], Ls: [] };
    for (let i = 0; i < g.nlayer; i += 1) {
      const delta = Math.sqrt(2 / om / g.mus[i] / g.sigmac[i]);
      const psi = C(1 / delta, 1 / delta);
      const z = C(psi.re / g.sigmac[i], psi.im / g.sigmac[i]);
      const A = cexp(C(-psi.re * g.h[i], -psi.im * g.h[i]));
      const dw = C(g.d / g.w[i], 0);
      const Xa = cdiv(cmul(cmul(dw, z), csub(ONE, A)), cadd(ONE, A));
      const Xb = cdiv(cmul(cmul(cmul(dw, z), C(2, 0)), A), csub(ONE, cmul(A, A)));
      Z.Ra.push(Xa.re); Z.La.push(Xa.im / om);
      Z.Rb.push(Xb.re); Z.Lb.push(Xb.im / om);
      Z.Ls.push(g.mus[i + 1] * g.s[i + 1] * g.d / g.w[i]);
    }
    const wl = g.w[g.w.length - 1];
    Z.Lft = MU0 * g.Ac / (g.gt + g.Ac * wl / (g.mur * g.c * g.d));
    Z.Lfb = MU0 * g.Ac / (g.gb + g.Ac * wl / (g.mur * g.c * g.d));
    Z.Lts = g.mus[0] * g.s[0] * g.d / wl;
    Z.Lplate = MU0 * g.mur * g.c * g.d / wl;
    Z.Lgap_t = g.gt > 0 ? MU0 * g.Ac / g.gt : null;
    Z.Lgap_b = g.gb > 0 ? MU0 * g.Ac / g.gb : null;
    Z.w_core = wl;
    return Z;
  }

  function windingLayers(g) {
    const out = {};
    for (let k = 1; k <= g.nwinding; k += 1) {
      out[k] = [];
      g.lindex.forEach((wi, i) => { if (wi === k) out[k].push(i + 1); });
    }
    return out;
  }

  function windingTurns(g) {
    const t = {};
    const wl = windingLayers(g);
    Object.keys(wl).forEach((k) => {
      const mm = wl[k].map((i) => g.m[i - 1]);
      t[k] = g.wstyle[k - 1] === 1 ? mm[0] : mm.reduce((a, b) => a + b, 0);
    });
    return t;
  }

  function llgCoreGeometry(g, Z, coreArea, coreLe) {
    if (coreArea !== "plate" && coreArea !== "Ac") throw new Error("core_area must be 'plate' or 'Ac'");
    const Ae = coreArea === "plate" ? g.c * g.d : g.Ac;
    if (coreLe) return { Ae, le: coreLe / 2 };
    return { Ae, le: coreArea === "plate" ? Z.w_core : g.Ac * Z.w_core / (g.c * g.d) };
  }

  // ------------------------------------------------------------------ netlist body
  function linkNodes(g) {
    // winding interconnects as node merges (M2Spice's 1f links make LTspice's .ac singular)
    const ren = {};
    const wl = windingLayers(g);
    Object.keys(wl).forEach((ks) => {
      const k = Number(ks);
      const layers = wl[k];
      if (g.wstyle[k - 1] === 1) {
        layers.forEach((i) => { ren["P" + i] = "PortP" + k; ren["N" + i] = "PortN" + k; });
      } else {
        ren["P" + layers[0]] = "PortP" + k;
        ren["N" + layers[layers.length - 1]] = "PortN" + k;
        for (let q = 0; q < layers.length - 1; q += 1) {
          const a = layers[q];
          const b = layers[q + 1];
          ren["N" + a] = ren["P" + b] = "J" + a + "_" + b;
        }
      }
    });
    return ren;
  }

  function ladderLines(g, Z) {
    const ren = linkNodes(g);
    const nd = (n) => ren[n] || n;
    const L = [];
    for (let i = 0; i < g.nlayer; i += 1) {
      const n = i + 1;
      L.push(
        `* layer ${n} (m = ${g.m[i]})`,
        `Le${n} ${nd("N" + n)} ${nd("P" + n)} ${g6(g.m[i] ** 2)} Rser=1f`,
        `Li${n} G Md${n} 1 Rser=1f`,
        `Lg${n} Mg${n} Md${n} ${g6(Z.Lb[i])} Rser=1f`,
        `Rg${n} Mc${n} Mg${n} ${g6(Z.Rb[i])}`,
        `Rt${n} Mc${n} Mt${n} ${g6(Z.Ra[i])}`,
        `Rb${n} Mb${n} Mc${n} ${g6(Z.Ra[i])}`,
        `Lt${n} T${n} Mt${n} ${g6(Z.La[i])} Rser=1f`,
        `Lb${n} Mb${n} B${n} ${g6(Z.La[i])} Rser=1f`,
        `Ls${n} B${n} T${n + 1} ${g6(Z.Ls[i])} Rser=1f`,
        `K${n} Le${n} Li${n} 1`
      );
    }
    L.push("* top spacing", `Ls0 T1 T0 ${g6(Z.Lts)} Rser=1f`);
    L.push("* winding interconnects: layer terminals merged into the port / J<a>_<b> nodes");
    const wl = windingLayers(g);
    Object.keys(wl).forEach((k) => {
      L.push(`*   winding ${k}: layers ${pyList(wl[k])} ${g.wstyle[k - 1] === 1 ? "in parallel" : "in series"}`);
    });
    L.push("* reference for the floating field domain", "Rgnd G 0 1G");
    return L;
  }

  function ferriteLines(g, Z, core, llgName, Ae, le) {
    const Lplate = MU0 * g.mur * Ae / le;
    const nb = g.nlayer + 1;
    const sides = [["t", "T0", Z.Lft, Z.Lgap_t], ["b", "T" + nb, Z.Lfb, Z.Lgap_b]];
    const L = [];
    sides.forEach(([tag, node, Ltot, Lgap]) => {
      const name = tag === "t" ? "top" : "bottom";
      if (core === "linear") {
        L.push(`* ${name} ferrite (linear, M2Spice)`, `Lf${tag} ${node} G ${g6(Ltot)} Rser=1f`);
        return;
      }
      L.push(`* ${name} ferrite: gap || plate`);
      if (Lgap !== null) L.push(`Lgap${tag} ${node} G ${g6(Lgap)} Rser=1f`);
      if (core === "split") {
        L.push(`Lplate${tag} ${node} G ${g6(Lplate)} Rser=1f`);
      } else {
        const args = LLG_PARAM_ORDER.map((p) => `${p}={${p}}`).join(" ");
        L.push(`XF${tag} ${node} G ${llgName} ${args} mu0=1.2566e-6\n+ N=1 Ae=${g6(Ae)} le=${g6(le)} vac=1`);
      }
    });
    return L;
  }

  function llgCoreSubckt(newName) {
    if (!LLG_CORE_LINES.length) throw new Error("LLG_CORE text missing (run tools/embed_llg_core.py)");
    const body = LLG_CORE_LINES.join("\n");
    return body.replace(".subckt LLG_CORE", ".subckt " + newName).replace(".ends LLG_CORE", ".ends " + newName);
  }

  // ------------------------------------------------------------------ outputs
  function safeName(x) {
    const s = String(x || "").trim().replace(/[^A-Za-z0-9_]/g, "");
    return s || "m2s";
  }

  function stamp(date) {
    const d = date || new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function fitLines(fit) {
    if (!fit) return [];
    const op = fit.op;
    return [
      `*   core material from the MagNet NN (alpha, theta) extractor: ${op.material}, ${g6(op.f / 1e3)} kHz,`,
      `*     B_pk ${g6(op.Bpk)} T, ${op.waveform}, ${g6(op.temp)} C -> theta = ${fit.theta.toFixed(3)} deg, `
        + `alpha = ${fit.alpha.toFixed(3)}, Hc = ${fit.Hc.toFixed(3)} A/m, loop RRMSE = ${fit.rrmse.toFixed(4)}`,
      "*     (Hani_z = Hc, Hani_y = Hc*tan(theta)). The current-driven extraction loop does not depend on",
      "*     the initial magnetization; keep M0 = (0, 1, 0) here: a saturated start (0, 0, 1) leaves a dc",
      "*     flux offset under voltage drive."
    ];
  }

  function buildLib(g, llg, opts) {
    // opts: {core: llg|linear|split, coreArea, coreLe, fit, date, by}; returns {sub, pins, text}
    opts = opts || {};
    const core = opts.core || "llg";
    const coreArea = opts.coreArea || "plate";
    const coreLe = opts.coreLe || null;
    const Z = impedances(g);
    const x = safeName(g.x);
    const sub = core === "llg" ? x : `${x}_${core}`;     // the web tool names the LLG block after the component alone
    const llgName = "LLGC_" + x;
    const { Ae, le } = llgCoreGeometry(g, Z, coreArea, coreLe);
    const pins = [];
    for (let k = 1; k <= g.nwinding; k += 1) pins.push("PortP" + k, "PortN" + k);
    const turns = windingTurns(g);
    const bar = "* " + "=".repeat(94);
    const kind = { llg: "LLG_CORE (nonlinear)", linear: "linear (M2Spice original)", split: "linear gap || linear plate" }[core];
    const H = [
      bar,
      `* ${sub} : M2Spice MLM of '${g.x}' with ${kind} ferrites`,
      `* generated ${opts.date || stamp()} by ${opts.by || "the M2Spice web tool (LLG-SPICE)"}`,
      bar,
      `* ${g.nwinding} windings, ${g.nlayer} layers, MLM computed at f = ${g6(g.f)} Hz`
    ];
    const wl = windingLayers(g);
    Object.keys(wl).forEach((k) => {
      H.push(`*   winding ${k}: ports PortP${k}/PortN${k}, layers ${pyList(wl[k])}, `
        + `${g.wstyle[k - 1] === 1 ? "parallel" : "series"}, ${turns[k]} turns`);
    });
    H.push(
      `* ferrites (field domain T0-G top, T${g.nlayer + 1}-G bottom):`,
      `*   M2Spice Lft = ${g6(Z.Lft)} H, Lfb = ${g6(Z.Lfb)} H  (mur = ${g6(g.mur)})`,
      `*   = gap || plate: Lgap_t = ${Z.Lgap_t ? g6(Z.Lgap_t) : "none (gt=0)"}, Lgap_b = `
        + `${Z.Lgap_b ? g6(Z.Lgap_b) : "none (gb=0)"}, Lplate = mu0*mur*c*d/w = ${g6(Z.Lplate)} H`
    );
    if (core === "llg") {
      H.push(
        `*   plate -> LLG_CORE N=1, Ae=${g6(Ae)} m^2, le=${g6(le)} m (core_area = ${coreArea}`
          + `${coreLe ? ", core_le = " + g6(coreLe) + " m" : ""})`,
        "*   the LLG parameters on the .subckt line set the material; mur is not used.",
        ...fitLines(opts.fit),
        "* Simulate with:  .tran <dt> <tstop> <tstart> <dtmax> uic",
        "*                 .options method=gear chgtol=1e-12",
        "* uic is required (the magnetization starts from mx0, my0, mz0).",
        "* Monitor, for an instance XU1: V(xu1:xft:b), V(xu1:xfb:b) [T], V(xu1:xft:h) [A/m],",
        "*   I(xu1:xft:Vsns) = plate MMF [A]; V(xu1:t0) - V(xu1:g) = top-ferrite volts per turn."
      );
    }
    H.push(bar);
    let head = `.subckt ${sub} ${pins.join(" ")}`;
    if (core === "llg") head += "\n+ params: " + LLG_PARAM_ORDER.map((p) => `${p}=${g6(llg[p])}`).join(" ");
    const body = ladderLines(g, Z).concat(ferriteLines(g, Z, core, llgName, Ae, le));
    let text = H.join("\n") + "\n\n" + head + "\n" + body.join("\n") + `\n.ends ${sub}\n`;
    if (core === "llg") {
      text += "\n* ---- LLG core, copied from LTspice_LLG/model/LLG_core.lib (renamed)\n";
      text += llgCoreSubckt(llgName) + "\n";
    }
    return { sub, pins, text };
  }

  function buildAsy(sub, pins, llg, libfile, core) {
    // odd windings on the left, even on the right; P (dot) above N
    const nw = pins.length / 2;
    const rows = Math.floor((nw + 1) / 2);
    const hgt = 64 * rows + 32;
    const top = -Math.floor(hgt / 2);
    const lines = ["Version 4", "SymbolType BLOCK",
      `RECTANGLE Normal -64 ${top} 64 ${top + hgt}`,
      `TEXT 0 ${top + 12} Center 1 ${core === "llg" ? "M2Spice+LLG" : "M2Spice"}`,
      `WINDOW 0 0 ${top - 8} Bottom 2`,
      `WINDOW 3 0 ${top + hgt + 8} Top 2`];
    const pinLines = [];
    let order = 1;
    for (let k = 1; k <= nw; k += 1) {
      const left = k % 2 === 1;
      const r = Math.floor((k - 1) / 2);
      const y = top + 32 + 64 * r;
      const xp = left ? -96 : 96;
      const xe = left ? -64 : 64;
      const just = left ? "LEFT" : "RIGHT";
      ["PortP" + k, "PortN" + k].forEach((nm, j) => {
        const yy = y + 32 * j;
        lines.push(`LINE Normal ${xp} ${yy} ${xe} ${yy}`);
        pinLines.push(`PIN ${xp} ${yy} ${just} 8`, `PINATTR PinName ${nm}`, `PINATTR SpiceOrder ${order}`);
        order += 1;
      });
      const cx = xe + (left ? 8 : -8);
      lines.push(`CIRCLE Normal ${cx - 3} ${y - 3 - 6} ${cx + 3} ${y + 3 - 6}`);
    }
    lines.push("SYMATTR Prefix X", `SYMATTR Value ${sub}`, `SYMATTR ModelFile ${libfile}`);
    if (core === "llg") {
      const p1 = ["Ms", "alpha", "gamma", "Hani_z", "Hani_y"].map((p) => `${p}=${g6(llg[p])}`).join(" ");
      const p2 = ["mx0", "my0", "mz0"].map((p) => `${p}=${g6(llg[p])}`).join(" ");
      lines.push("SYMATTR SpiceLine " + p1, "SYMATTR SpiceLine2 " + p2,
        "SYMATTR Description M2Spice MLM + LLG cores (dot = PortP). Needs .tran ... uic");
    } else {
      lines.push("SYMATTR Description M2Spice MLM, linear core");
    }
    return lines.concat(pinLines).join("\n") + "\n";
  }

  function buildBlock(g, llg, opts) {
    // the library and its symbol (m2spice_llg.py also writes an example testbench; the page does not)
    opts = opts || {};
    const core = opts.core || "llg";
    const lib = buildLib(g, llg, opts);
    const libfile = lib.sub + ".lib";
    const asy = buildAsy(lib.sub, lib.pins, llg, libfile, core);
    return {
      sub: lib.sub,
      files: [
        { name: libfile, kind: "lib", text: lib.text },
        { name: lib.sub + ".asy", kind: "asy", text: asy }
      ]
    };
  }

  // ------------------------------------------------------------------ geometry-text keys
  const LLG_KEYS = ["core", "Ms", "alpha", "gamma", "Hani_y", "Hani_z", "mx0", "my0", "mz0", "core_area", "core_le",
    "fit_material", "fit_f", "fit_Bpk", "fit_waveform", "fit_T"];

  function parseKeyValues(text) {
    // "key = value" lines, '#' comments (as m2spice_llg.read_geometry)
    const out = {};
    String(text).split(/\r?\n/).forEach((raw) => {
      let line = raw.trim();
      if (!line || line[0] === "*" || line[0] === ";") return;
      line = line.split("#", 1)[0].trim();
      const eq = line.indexOf("=");
      if (eq < 0) return;
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
    return out;
  }

  function readLLG(values) {
    // LLG parameters and block options from form/text values; empty -> default
    const errors = [];
    const llg = {};
    Object.keys(LLG_DEFAULTS).forEach((k) => {
      const v = values[k] === undefined || String(values[k]).trim() === "" ? LLG_DEFAULTS[k] : Number(values[k]);
      if (!Number.isFinite(v)) errors.push(`invalid ${k}, please enter a number.`);
      llg[k] = v;
    });
    if (!(llg.Ms > 0)) errors.push("Ms must be positive.");
    if (!(llg.alpha > 0)) errors.push("alpha must be positive.");
    if (!(llg.gamma > 0)) errors.push("gamma must be positive.");
    if (llg.mx0 === 0 && llg.my0 === 0 && llg.mz0 === 0) errors.push("the initial magnetization (mx0, my0, mz0) cannot be zero.");
    const coreArea = String(values.core_area || "plate").replace(/['"]/g, "").trim() || "plate";
    if (coreArea !== "plate" && coreArea !== "Ac") errors.push("core_area must be plate or Ac.");
    let coreLe = null;
    if (values.core_le !== undefined && String(values.core_le).trim() !== "") {
      coreLe = Number(values.core_le);
      if (!(coreLe > 0)) errors.push("core_le must be a positive length in meters (or blank).");
    }
    return { llg, coreArea, coreLe, errors };
  }

  // ------------------------------------------------------------------ zip (store, no compression)
  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeZip(files, date) {
    // files: [{name, text}] -> Uint8Array (.zip, stored)
    const enc = new TextEncoder();
    const d = date || new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = enc.encode(f.text);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
    let o = 0;
    all.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  }

  // ------------------------------------------------------------------ symbol preview
  function escXml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function asySvg(asyText) {
    // draws an LTspice .asy (the subset buildAsy writes: RECTANGLE, LINE, CIRCLE, TEXT, WINDOW, PIN/PINATTR,
    // SYMATTR) as SVG in symbol units (y down, as in LTspice). Pin names go inside the box next to their pin.
    const shapes = [];
    const texts = [];
    const pins = [];
    const attr = {};
    const windows = {};
    let box = null;
    asyText.split(/\r?\n/).forEach((line) => {
      const t = line.trim().split(/\s+/);
      const n = t.slice(1).map(Number);
      if (t[0] === "RECTANGLE") { box = { x1: n[1], y1: n[2], x2: n[3], y2: n[4] }; shapes.push(["rect", box]); }
      else if (t[0] === "LINE") shapes.push(["line", { x1: n[1], y1: n[2], x2: n[3], y2: n[4] }]);
      else if (t[0] === "CIRCLE") shapes.push(["dot", { x1: n[1], y1: n[2], x2: n[3], y2: n[4] }]);
      else if (t[0] === "TEXT") texts.push({ x: n[0], y: n[1], text: t.slice(5).join(" ") });
      else if (t[0] === "WINDOW") windows[t[1]] = { x: n[1], y: n[2], just: t[4] };
      else if (t[0] === "PIN") pins.push({ x: n[0], y: n[1], just: t[3] });
      else if (t[0] === "PINATTR" && t[1] === "PinName" && pins.length) pins[pins.length - 1].name = t.slice(2).join(" ");
      else if (t[0] === "SYMATTR") attr[t[1]] = t.slice(2).join(" ");
    });
    if (!box) return "";
    const xs = [box.x1, box.x2].concat(pins.map((p) => p.x));
    const ys = [box.y1, box.y2].concat(pins.map((p) => p.y), Object.values(windows).map((w) => w.y));
    const pad = 22;
    const x0 = Math.min(...xs) - pad;
    const y0 = Math.min(...ys) - pad;
    const w = Math.max(...xs) - Math.min(...xs) + 2 * pad;
    const h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
    let s = `<svg viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="LTspice symbol ${escXml(attr.Value || "")}">`;
    shapes.forEach(([kind, g]) => {
      if (kind === "rect") s += `<rect class="body" x="${g.x1}" y="${g.y1}" width="${g.x2 - g.x1}" height="${g.y2 - g.y1}"/>`;
      if (kind === "line") s += `<line class="wire" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"/>`;
      if (kind === "dot") s += `<circle class="dot" cx="${(g.x1 + g.x2) / 2}" cy="${(g.y1 + g.y2) / 2}" r="${Math.abs(g.x2 - g.x1) / 2}"/>`;
    });
    pins.forEach((p) => {
      const left = p.x < (box.x1 + box.x2) / 2;
      const tx = left ? box.x1 + 13 : box.x2 - 13;     // clear of the polarity dot at 8 +- 3 from the edge
      s += `<rect class="pin" x="${p.x - 2.5}" y="${p.y - 2.5}" width="5" height="5"/>`
        + `<text class="pin-name" x="${tx}" y="${p.y + 3.5}" text-anchor="${left ? "start" : "end"}">${escXml(p.name || "")}</text>`;
    });
    texts.forEach((t) => { s += `<text class="title" x="${t.x}" y="${t.y + 3}" text-anchor="middle">${escXml(t.text)}</text>`; });
    if (windows["0"]) s += `<text class="inst" x="${windows["0"].x}" y="${windows["0"].y}" text-anchor="middle">X1</text>`;
    if (windows["3"]) s += `<text class="value" x="${windows["3"].x}" y="${windows["3"].y + 10}" text-anchor="middle">${escXml(attr.Value || "")}</text>`;
    return s + "</svg>";
  }

  const api = {
    MU0, LLG_DEFAULTS, LLG_PARAM_ORDER, LLG_KEYS,
    g6, impedances, windingLayers, windingTurns, llgCoreGeometry, linkNodes,
    buildLib, buildAsy, buildBlock,
    parseKeyValues, readLLG, safeName, crc32, makeZip, asySvg
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.M2SpiceLLG = api;

  // ================================================================== page UI (browser only)
  if (!root.document || !root.M2Spice || !root.M2Spice.registerExtension) return;

  const doc = root.document;
  const scriptSrc = (doc.currentScript && doc.currentScript.src) || "";
  const ASSET_BASE = scriptSrc ? scriptSrc.replace(/js\/m2spice-llg\.js(\?.*)?$/, "") : "/assets/";
  const X = () => root.M2SpiceExtract;

  const OP_FIELDS = [
    { key: "fit_material", label: "Ferrite Material", unit: "MagNet neural-network model", type: "select",
      options: ["3C90", "3C94", "3E6", "3F4", "N27", "N30", "N49", "N87"], def: "N49" },
    { key: "fit_f", label: "Core Frequency (f_core)", unit: "Hz; follows f above until you change it", def: "" },
    { key: "fit_Bpk", label: "Peak Flux Density (B_pk)", unit: "T", def: "0.2" },
    { key: "fit_waveform", label: "Flux Waveform", unit: "B(t) shape", type: "select",
      options: [["sine", "Sine"], ["triangle", "Triangle (D = 0.5)"], ["trapezoidal", "Trapezoid"]], def: "sine" },
    // shown in the Layer Stack and Windings group (LLG mode only); it still sets the extraction temperature
    { key: "fit_T", label: "Operating Temperature (T)", unit: "deg C", def: "25", host: "[data-field-group='layers']" }
  ];
  // block option the extractor does not set (the material comes only from the fit). The Geometry Text box stays
  // the original M2Spice geometry; the LLG settings are not written into it.
  // The plate area is always Ac from the geometry (core_area = Ac): B and saturation refer to the Ac section.
  const BLOCK_FIELDS = [
    { key: "core_le", label: "Core Path Length (core_le)", unit: "m, datasheet le; blank = M2Spice plate inductance", def: "" }
  ];
  const CORE_AREA = "Ac";
  const ALL_FIELDS = OP_FIELDS.concat(BLOCK_FIELDS);
  const MATERIAL_KEYS = ["Ms", "alpha", "gamma", "Hani_y", "Hani_z"];

  // material = {Ms, alpha, gamma, Hani_y, Hani_z} from the last extraction; the block always starts demagnetized,
  // M0 = (0, 1, 0) (a saturated start leaves a dc flux offset under voltage drive)
  const ui = { ctx: null, files: null, tab: "asy", fitKey: null, fit: null, material: null, nets: {}, pool: null, running: null, coreFLinked: true };

  function q(sel) { return ui.ctx.page.querySelector(sel); }
  function qa(sel) { return Array.from(ui.ctx.page.querySelectorAll(sel)); }
  function isLLG() { const s = q("[data-llg-mode]"); return !!s && s.value === "llg"; }

  function fieldHtml(f, attrs) {
    const id = "m2spice-llg-" + f.key;
    let input;
    if (f.type === "select") {
      const opts = f.options.map((o) => (Array.isArray(o) ? o : [o, o]))
        .map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
      input = `<select class="m2spice-input" id="${id}" data-llg-field="${f.key}">${opts}</select>`;
    } else {
      input = `<input class="m2spice-input" id="${id}" data-llg-field="${f.key}" autocomplete="off">`;
    }
    return `<div class="m2spice-field"${attrs ? " " + attrs : ""}><label for="${id}">${f.label}</label>${input}`
      + `<span class="m2spice-unit">${f.unit}</span></div>`;
  }

  function llgValues() {
    const v = {};
    qa("[data-llg-field]").forEach((el) => { v[el.dataset.llgField] = el.value.trim(); });
    return v;
  }

  function setLLGValues(values) {
    qa("[data-llg-field]").forEach((el) => {
      if (values[el.dataset.llgField] !== undefined) el.value = values[el.dataset.llgField];
    });
  }

  function resetLLGValues() {
    const v = {};
    ALL_FIELDS.forEach((f) => { v[f.key] = f.def; });
    setLLGValues(v);
    ui.coreFLinked = true;
    syncCoreF();
  }

  // the core frequency follows the analysis frequency f until the user types a different one
  function analysisF() {
    return String(ui.ctx.readForm().f || "").trim();
  }

  function syncCoreF() {
    if (ui.coreFLinked) setLLGValues({ fit_f: analysisF() });
  }

  function updateMode() {
    const on = isLLG();
    qa("[data-llg-section], [data-llg-only]").forEach((el) => { el.hidden = !on; });
    qa("[data-linear-only]").forEach((el) => { el.hidden = on; });
    const title = q("[data-netlist-title]");
    if (title) title.textContent = on ? "LTspice Block" : "SPICE Netlist";
    ui.ctx.netlist.hidden = false;
    if (on && ui.files) showTab(ui.tab);
    else if (on) ui.ctx.netlist.value = "";
    if (!(on && ui.files)) q("[data-llg-symbol]").hidden = true;
    q("[data-llg-preview]").hidden = !(on && ui.fit);
    showResults(on && !!ui.fit);
  }

  // the fit card + B-H loop panel next to the LTspice Block; the output row gets a third column while it shows
  function showResults(on) {
    const panel = q("[data-llg-results]");
    if (!panel) return;
    panel.hidden = !on;
    if (panel.parentElement) panel.parentElement.classList.toggle("has-results", on);
  }

  function showTab(tab) {
    ui.tab = tab;
    qa("[data-llg-tab]").forEach((b) => {
      const sel = b.dataset.tab === tab;
      b.classList.toggle("is-active", sel);
      b.setAttribute("aria-selected", sel ? "true" : "false");
    });
    const f = ui.files && ui.files.files.find((x) => x.kind === tab);
    ui.ctx.netlist.value = f ? f.text : "";
    const sym = q("[data-llg-symbol]");
    if (sym) {
      const show = isLLG() && tab === "asy" && !!f;
      sym.innerHTML = show ? asySvg(f.text)
        + "<p class=\"m2spice-note\">Preview of the .asy symbol: dot = PortP (winding start). Put the .asy and .lib next to your schematic.</p>" : "";
      sym.hidden = !show;
      ui.ctx.netlist.hidden = show;        // the symbol tab shows the drawing only; Copy/Download still give the .asy
    }
  }

  function generateLLG(extracted) {
    const ctx = ui.ctx;
    const res = root.M2Spice.readGeometry(ctx.readForm(), { allowErrors: true });
    const values = Object.assign({}, llgValues(), { core_area: CORE_AREA });
    if (ui.material) MATERIAL_KEYS.forEach((k) => { values[k] = String(ui.material[k]); });
    const o = readLLG(values);          // mx0/my0/mz0 not given -> the demagnetized default (0, 1, 0)
    const errors = res.errors.concat(o.errors);
    if (!ui.material) errors.push("no core model yet: press Generate to extract it.");
    ctx.syncGeometryText();
    if (errors.length) {
      ctx.setStatus(`Find ${errors.length} error${errors.length === 1 ? "" : "s"}:\n${errors.join("\n")}`, "error");
      return;
    }
    ui.files = buildBlock(res.data, o.llg, { core: "llg", coreArea: o.coreArea, coreLe: o.coreLe, fit: ui.fit });
    showTab(ui.tab);
    ctx.setStatus(`LTspice block ${ui.files.sub} generated: ${ui.files.files.map((f) => f.name).join(", ")}.\n`
      + (extracted ? extracted + "\n" : "Core model from the last fit (core operating point unchanged).\n")
      + "Put the .lib and .asy next to your schematic; run .tran with uic.", "good");
  }

  // Generate in LLG mode: check the inputs, extract the core model when the core operating point changed since the
  // last fit, then build the block. A click while extracting cancels.
  async function generateWithFit() {
    const ctx = ui.ctx;
    if (ui.running) { cancelExtraction(); return; }
    const res = root.M2Spice.readGeometry(ctx.readForm(), { allowErrors: true });
    const { op, errors: opErrors } = readOp();
    const errors = res.errors.concat(readLLG(llgValues()).errors, opErrors);
    if (errors.length) {
      ctx.syncGeometryText();
      ctx.setStatus(`Find ${errors.length} error${errors.length === 1 ? "" : "s"}:\n${errors.join("\n")}`, "error");
      return;
    }
    let extracted = "";
    if (!ui.fit || ui.fitKey !== opKey(op)) {
      const fit = await runExtraction(op);
      if (!fit) return;
      extracted = `Core model extracted in ${fit.seconds.toFixed(1)} s: theta = ${fit.theta.toFixed(3)} deg, `
        + `alpha = ${fit.alpha.toFixed(3)}, loop RRMSE = ${fit.rrmse.toFixed(4)}.`;
    }
    generateLLG(extracted);
  }

  function saveBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = doc.createElement("a");
    a.href = url;
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadTab() {
    const f = ui.files && ui.files.files.find((x) => x.kind === ui.tab);
    if (!f) { ui.ctx.setStatus("Generate the LTspice block before downloading.", "error"); return; }
    saveBlob(f.name, new Blob([f.text], { type: "text/plain;charset=utf-8" }));
    ui.ctx.setStatus(`${f.name} download started.`, "good");
  }

  function downloadAll() {
    if (!ui.files) { ui.ctx.setStatus("Generate the LTspice block before downloading.", "error"); return; }
    saveBlob(ui.files.sub + ".zip", new Blob([makeZip(ui.files.files)], { type: "application/zip" }));
    ui.ctx.setStatus(`${ui.files.sub}.zip download started (${ui.files.files.length} files).`, "good");
  }

  // ---------------------------------------------------------------- extraction: worker pool
  function createPool() {
    const n = Math.max(1, Math.min(8, (root.navigator && root.navigator.hardwareConcurrency ? root.navigator.hardwareConcurrency : 4) - 1));
    let workers;
    try {
      workers = Array.from({ length: n }, () => new Worker(ASSET_BASE + "js/m2spice-extract-worker.js"));
    } catch (e) {
      return null;
    }
    let reject = null;
    return {
      size: n,
      run(cases, onCase) {
        return new Promise((resolve, rej) => {
          reject = rej;
          const chunk = 8;
          const results = new Array(cases.length);
          let next = 0;
          let done = 0;
          const feed = (w) => {
            if (next >= cases.length) return;
            const id = next;
            next += chunk;
            w.postMessage({ id, cases: cases.slice(id, id + chunk) });
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
        });
      },
      terminate() {
        workers.forEach((w) => w.terminate());
        if (reject) reject(new Error("cancelled"));
      }
    };
  }

  function runCasesInline(cases, onCase) {
    // fallback without workers (e.g. a page opened from file://): chunks between animation frames
    return new Promise((resolve) => {
      const out = [];
      const step = () => {
        const end = Math.min(out.length + 10, cases.length);
        for (let k = out.length; k < end; k += 1) {
          try { out.push(X().simulateCycle(cases[k])); } catch (e) { out.push({ error: String(e.message || e) }); }
        }
        if (onCase) onCase(out.length, cases.length);
        if (out.length >= cases.length) resolve(out); else setTimeout(step, 0);
      };
      step();
    });
  }

  async function loadNet(mat) {
    if (ui.nets[mat]) return ui.nets[mat];
    const r = await fetch(ASSET_BASE + "m2spice/nn/" + mat + ".json");
    if (!r.ok) throw new Error(`could not load the ${mat} network (${r.status})`);
    ui.nets[mat] = X().prepareNet(await r.json());
    return ui.nets[mat];
  }

  function readOp() {
    const v = llgValues();
    const errors = [];
    let f = v.fit_f === "" ? NaN : Number(v.fit_f);
    if (v.fit_f === "") {
      const fg = Number(String(ui.ctx.readForm().f || "").trim());
      f = fg;
    }
    if (!(f > 0)) errors.push("core frequency must be a positive number (or blank to use f).");
    const Bpk = Number(v.fit_Bpk);
    if (!(Bpk > 0)) errors.push("B_pk must be a positive number in T.");
    const temp = Number(v.fit_T);
    if (!Number.isFinite(temp)) errors.push("temperature must be a number in deg C.");
    return { op: { material: v.fit_material, f, Bpk, waveform: v.fit_waveform, temp, bias: 0 }, errors };
  }

  function setProgress(frac, text) {
    const bar = q("[data-llg-progress]");
    bar.hidden = frac === null;
    if (frac !== null) bar.value = frac;
    q("[data-llg-progress-text]").textContent = text || "";
  }

  function opKey(op) { return JSON.stringify([op.material, op.f, op.Bpk, op.waveform, op.temp]); }

  function cancelExtraction() {
    if (!ui.running) return;
    ui.running.cancelled = true;
    if (ui.pool) { ui.pool.terminate(); ui.pool = null; }
  }

  // returns the fit, or null (failed or cancelled; the status says which)
  async function runExtraction(op) {
    const ctx = ui.ctx;
    const button = q("[data-action='generate']");
    if (!X()) { ctx.setStatus("The extractor script did not load.", "error"); return null; }
    const warn = X().rangeWarnings(op);
    const run = { cancelled: false };
    ui.running = run;
    button.querySelector("span").textContent = "Cancel";
    ctx.setStatus(`Extracting the ${op.material} core model at ${g6(op.f / 1e3)} kHz, ${g6(op.Bpk)} T ${op.waveform}, ${g6(op.temp)} C...`
      + (warn.length ? "\nNote: " + warn.join("; ") + "." : ""), "");
    setProgress(0, "loading the MagNet network");
    try {
      const net = await loadNet(op.material);
      if (!ui.pool) ui.pool = createPool();
      const runCases = ui.pool ? ui.pool.run : runCasesInline;
      const weights = { nn: 0.02, coarse: 0.49, refine: 0.49 };
      const fit = await X().extract(op, net, {
        runCases,
        onProgress: (p) => {
          // stages: "nn", "coarse", "coarse (moved 2x)", "refine", "refine (moved 1x)"; a moved grid restarts its stage bar
          let frac = 0;
          if (p.stage === "nn") frac = weights.nn;
          else if (p.stage.startsWith("coarse")) frac = weights.nn + weights.coarse * p.done / p.n;
          else frac = weights.nn + weights.coarse + weights.refine * Math.min(1, p.done / p.n);
          setProgress(frac, p.stage === "nn" ? "NN loop" : `${p.stage.replace(/^(\w+)/, "$1 grid")} ${p.done}/${p.n}`);
        }
      });
      if (run.cancelled) throw new Error("cancelled");
      ui.fit = fit;
      ui.fitKey = opKey(op);
      ui.material = { Ms: fit.Ms, alpha: fit.alpha, gamma: fit.gamma, Hani_y: fit.Hani_y, Hani_z: fit.Hani_z };
      ui.files = null;
      if (isLLG()) ctx.netlist.value = "";
      showFit(fit, warn);
      setProgress(null, "");
      return fit;
    } catch (e) {
      setProgress(null, "");
      const msg = String((e && e.message) || e);
      ctx.setStatus(msg === "cancelled" ? "Extraction cancelled." : "Extraction failed: " + msg, msg === "cancelled" ? "" : "error");
      if (ui.pool && msg !== "cancelled") { ui.pool.terminate(); ui.pool = null; }
      return null;
    } finally {
      ui.running = null;
      button.querySelector("span").textContent = "Generate";
    }
  }

  // ---------------------------------------------------------------- fit summary + B-H preview
  function showFit(fit, warn) {
    const box = q("[data-llg-fit-result]");
    const rows = [
      ["theta", fit.theta.toFixed(3) + " deg"], ["alpha", fit.alpha.toFixed(3)],
      ["Hc (NN loop)", fit.Hc.toFixed(3) + " A/m"], ["Hani_z = Hc", fit.Hani_z.toFixed(3) + " A/m"],
      ["Hani_y = Hc tan(theta)", fit.Hani_y.toFixed(2) + " A/m"], ["Ms (" + fit.op.material + ")", g6(fit.Ms) + " A/m"],
      ["loop RRMSE", fit.rrmse.toFixed(4)], ["LLG runs", String(fit.runs)]
    ];
    // the search moves its grid past any wall the best point hits, so a wall left here is a real limit
    const notes = [];
    if (fit.edge.limit.length) {
      notes.push(`The best point is at the search limit (${fit.edge.limit.join(", ")}: theta <= 89.95 deg, alpha >= 0.2); `
        + "the LLG model may not reproduce this loop well. Check the B-H preview.");
    }
    if (fit.edge.open.length) {
      notes.push(`The best point is still on the grid edge (${fit.edge.open.join(", ")}) after the search moved the grid; `
        + "the true optimum may lie further out.");
    }
    box.innerHTML = `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
      + notes.map((n) => `<p class="m2spice-note is-warn">${n}</p>`).join("")
      + (warn && warn.length ? `<p class="m2spice-note is-warn">${warn.join("; ")}: the NN is extrapolating.</p>` : "");
    box.hidden = false;
    showResults(true);
    renderPreview(fit);
  }

  function clearMaterial() {
    ui.material = null;
    ui.fit = null;
    ui.fitKey = null;
    q("[data-llg-fit-result]").hidden = true;
    q("[data-llg-preview]").hidden = true;
    showResults(false);
  }

  // axis helpers shared with the usage example (m2spice-plot.js)
  const niceTicks = (lo, hi, n) => root.M2SpicePlot.niceTicks(lo, hi, n);
  const fmtTick = (v) => root.M2SpicePlot.fmtTick(v);

  function renderPreview(fit) {
    const host = q("[data-llg-plot]");
    const op = fit.op;
    q("[data-llg-preview-sub]").textContent = `${op.material}, ${g6(op.f / 1e3)} kHz, ${g6(op.Bpk)} T ${op.waveform}, `
      + `${g6(op.temp)} C. theta ${fit.theta.toFixed(2)} deg, alpha ${fit.alpha.toFixed(2)}, RRMSE ${fit.rrmse.toFixed(3)}`;
    const series = [
      { name: "MagNet NN (reference)", cls: "is-nn", H: fit.nn.H, B: fit.nn.B },
      { name: "LLG fit", cls: "is-llg", H: fit.llg.H, B: fit.llg.B }
    ];
    const W = 360;
    const Hh = 270;
    const m = { l: 46, r: 12, t: 10, b: 36 };
    const allH = series.flatMap((s) => s.H);
    const allB = series.flatMap((s) => s.B);
    const hx = Math.max(...allH.map(Math.abs)) * 1.06;
    const bx = Math.max(...allB.map(Math.abs)) * 1.08;
    const sx = (h) => m.l + (h + hx) / (2 * hx) * (W - m.l - m.r);
    const sy = (b) => m.t + (bx - b) / (2 * bx) * (Hh - m.t - m.b);
    const xt = niceTicks(-hx, hx, 4);
    const yt = niceTicks(-bx, bx, 4);
    let svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="B-H loop: MagNet NN reference and LLG fit">`;
    xt.forEach((v) => { svg += `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${Hh - m.b}"/>`
      + `<text class="tick" x="${sx(v)}" y="${Hh - m.b + 14}" text-anchor="middle">${fmtTick(v)}</text>`; });
    yt.forEach((v) => { svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/>`
      + `<text class="tick" x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${fmtTick(v)}</text>`; });
    svg += `<line class="axis" x1="${sx(0)}" x2="${sx(0)}" y1="${m.t}" y2="${Hh - m.b}"/>`
      + `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    series.forEach((s) => {
      const pts = s.H.map((h, i) => `${sx(h).toFixed(1)},${sy(s.B[i]).toFixed(1)}`);
      pts.push(pts[0]);
      svg += `<polyline class="loop ${s.cls}" points="${pts.join(" ")}"/>`;
    });
    svg += `<text class="label" x="${(m.l + W - m.r) / 2}" y="${Hh - 4}" text-anchor="middle">H (A/m)</text>`
      + `<text class="label" x="12" y="${(m.t + Hh - m.b) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(m.t + Hh - m.b) / 2})">B (T)</text>`
      + "<circle class=\"hover-dot\" r=\"4\" cx=\"-10\" cy=\"-10\"/></svg>";
    host.innerHTML = svg + "<div class=\"m2spice-tooltip\" hidden></div>";
    const el = host.querySelector("svg");
    const tip = host.querySelector(".m2spice-tooltip");
    const dot = host.querySelector(".hover-dot");
    const pick = (ev) => {
      const r = el.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      const py = (ev.clientY - r.top) / r.height * Hh;
      let best = null;
      series.forEach((s) => s.H.forEach((h, i) => {
        const d = (sx(h) - px) ** 2 + (sy(s.B[i]) - py) ** 2;
        if (!best || d < best.d) best = { d, s, i };
      }));
      if (!best || best.d > 30 * 30) { tip.hidden = true; dot.setAttribute("cx", -10); return; }
      const { s, i } = best;
      dot.setAttribute("cx", sx(s.H[i]));
      dot.setAttribute("cy", sy(s.B[i]));
      dot.setAttribute("class", "hover-dot " + s.cls);
      tip.innerHTML = `<strong>${s.name}</strong><br>H ${s.H[i].toFixed(2)} A/m<br>B ${s.B[i].toFixed(4)} T<br><span>sample ${i + 1}/${s.H.length}</span>`;
      tip.hidden = false;
      const left = sx(s.H[i]) / W * r.width;
      tip.style.left = Math.min(Math.max(left, 70), r.width - 70) + "px";
      tip.style.top = (sy(s.B[i]) / Hh * r.height + 12) + "px";
    };
    el.addEventListener("pointermove", pick);
    el.addEventListener("pointerdown", pick);
    el.addEventListener("pointerleave", () => { tip.hidden = true; dot.setAttribute("cx", -10); });
    // table view
    const rowsHtml = fit.nn.H.map((h, i) => `<tr><td>${i + 1}</td><td>${h.toFixed(3)}</td><td>${fit.nn.B[i].toFixed(5)}</td>`
      + `<td>${fit.llg.H[i].toFixed(3)}</td><td>${fit.llg.B[i].toFixed(5)}</td></tr>`).join("");
    q("[data-llg-table]").innerHTML = "<table><thead><tr><th>k</th><th>H NN (A/m)</th><th>B NN (T)</th>"
      + `<th>H LLG (A/m)</th><th>B LLG (T)</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    q("[data-llg-preview]").hidden = false;
  }

  // ---------------------------------------------------------------- extension hooks
  root.M2Spice.registerExtension({
    init(ctx) {
      ui.ctx = ctx;
      const opHost = q("[data-llg-group='op']");
      const blockHost = q("[data-llg-group='block']");
      if (!opHost || !blockHost) return;
      opHost.innerHTML = OP_FIELDS.filter((f) => !f.host).map((f) => fieldHtml(f)).join("");
      OP_FIELDS.filter((f) => f.host).forEach((f) => {
        const host = q(f.host) || opHost;
        host.insertAdjacentHTML("beforeend", fieldHtml(f, host === opHost ? "" : "data-llg-only hidden"));
      });
      blockHost.insertAdjacentHTML("beforeend", BLOCK_FIELDS.map((f) => fieldHtml(f, "data-llg-only hidden")).join(""));
      resetLLGValues();
      const fInput = q("[data-field='f']");
      const coreF = q("[data-llg-field='fit_f']");
      if (fInput) fInput.addEventListener("input", syncCoreF);
      coreF.addEventListener("input", () => {
        const v = coreF.value.trim();
        ui.coreFLinked = v === "" || v === analysisF();
      });
      coreF.addEventListener("change", () => { if (coreF.value.trim() === "") syncCoreF(); });
      // the tooltip sits at a pixel offset in the plot, so a resize would leave it outside a narrower plot
      root.addEventListener("resize", () => qa("[data-llg-plot] .m2spice-tooltip").forEach((t) => { t.hidden = true; }));
      q("[data-llg-mode]").addEventListener("change", () => {
        updateMode();
        ctx.setStatus(isLLG()
          ? "LLG-SPICE mode: set the core operating point and press Generate; it extracts the core model, then writes the LTspice block."
          : "Linear mode: Generate writes the M2Spice SPICE netlist.", "");
      });
      updateMode();
    },
    handleAction(action) {
      if (action === "llg-download-all") { downloadAll(); return true; }
      if (action === "llg-tab") return true;
      if (!isLLG()) return false;
      if (action === "generate") { generateWithFit(); return true; }
      if (action === "download-netlist") { downloadTab(); return true; }
      return false;
    },
    afterAction(action) {
      if (action === "example" || action === "clear") {
        ui.files = null;
        if (action === "clear") {
          resetLLGValues();
          clearMaterial();
        }
        syncCoreF();
        updateMode();
      }
      if (action === "apply-geometry") syncCoreF();      // Apply may change f; the core frequency follows if linked
    }
  });

  doc.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-llg-tab]");
    if (b && ui.ctx) showTab(b.dataset.tab);
  });
})(typeof window !== "undefined" ? window : globalThis);
