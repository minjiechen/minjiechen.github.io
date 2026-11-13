/* M2Spice usage example: the DAB as an LTspice schematic (.asc) with the M2Spice+LLG blocks as symbols.
 *
 * The circuit is the paper's LTspice model, LTspice_LLG/dab_tida/tida_sim.deck("llg"), as built: EPS gates as sine
 * comparators (D2 ramps up over the first cycles, so the flux starts centred), the power stages (by default the
 * behavioural GaN FETs of DAB_GaN.lib: LMG2100 on the DC side, LMG3656R025 on the AC side; switches: "ideal" gives
 * tida_sim's ideal switches with R_on, a reverse-conduction diode and Coss each), blocking capacitor, the transformer and inductor blocks of
 * site/assets/m2spice/dab/ (tools/build_dab_ltspice.py), AC wiring, split capacitor, and tida_sim's start-up damper on
 * MidHV. The operating point and each core's (theta, alpha, Hc) come from the page's last run; the schematic keeps
 * them as .param values and instance parameters, so they can be edited in LTspice.
 * Plain functions, no DOM: the page zips the result with the block files, the tests run it in Node + LTspice.
 */
(function (root) {
  "use strict";

  const GAMMA = 1.76e11;
  const BLOCKS = { tx: "DAB_TX_LLG", ind: "DAB_L_LLG" };
  // blocks published next to the page (assets/m2spice/dab/)
  const BLOCK_FILES = ["DAB_TX_LLG.lib", "DAB_TX_LLG.asy", "DAB_L_LLG.lib", "DAB_L_LLG.asy"];
  const GAN_LIB = "DAB_GaN.lib";             // behavioural GaN power stages (the default switches), next to the blocks
  // tida_config values the page does not carry
  const BOARD = {
    CossP: 881e-12, CossS: 0.85e-9,          // LMG2100R026 / LMG3656R025 Coss(tr)
    VrevP: 2.0, VrevS: 1.8,                  // reverse-conduction drop
    RdP: 20e-3, RdS: 80e-3,                  // its slope
    esr: 5e-3,                               // each split-capacitor half
    RindBlock: 13.52e-3,                     // copper R inside the inductor block at 150 kHz (the rest of ind.R is wiring)
    Ncyc: 80, Nramp: 20, Nfade: 30, steps: 2000
  };

  function num(x) {
    // short SPICE number with an engineering suffix
    if (x === 0) return "0";
    const units = [[1e-15, "f"], [1e-12, "p"], [1e-9, "n"], [1e-6, "u"], [1e-3, "m"], [1, ""], [1e3, "k"], [1e6, "Meg"]];
    const a = Math.abs(x);
    let u = units[0];
    units.forEach((c) => { if (a >= c[0] * 0.9999999) u = c; });
    return String(Number((x / u[0]).toPrecision(6))) + u[1];
  }

  function g6(x) {
    // "%g" with 6 digits, exponent without "+" (1.76e11)
    const v = Number(Number(x).toPrecision(6));
    const a = Math.abs(v);
    if (v !== 0 && (a >= 1e6 || a < 1e-4)) return v.toExponential().replace(/\.?0+e/, "e").replace("e+", "e");
    return String(v);
  }

  function coreParams(e) {
    // LLG instance parameters (Hani_z = Hc, Hani_y = Hc tan(theta), as M2SpiceExtract.anisotropy)
    const th = e.theta * Math.PI / 180;
    return { Ms: e.Ms, alpha: e.alpha, gamma: GAMMA, Hani_z: e.Hc, Hani_y: e.Hc / Math.cos(th) * Math.sin(th) };
  }

  function spiceLines(e) {
    // two short lines under the symbol (LTspice joins SpiceLine and SpiceLine2 on the instance line)
    const c = coreParams(e);
    return {
      SpiceLine: `Ms=${g6(c.Ms)} alpha=${g6(c.alpha)} gamma=${g6(c.gamma)}`,
      SpiceLine2: `Hani_z=${g6(c.Hani_z)} Hani_y=${g6(c.Hani_y)} mx0=0 my0=1 mz0=0`
    };
  }

  // ------------------------------------------------------------------ drawing
  function sheet() {
    const L = [];
    return {
      wire(pts) { for (let i = 1; i < pts.length; i += 1) L.push(`WIRE ${pts[i - 1][0]} ${pts[i - 1][1]} ${pts[i][0]} ${pts[i][1]}`); },
      flag(x, y, name) { L.push(`FLAG ${x} ${y} ${name}`); },
      sym(type, x, y, rot, attrs, windows) {
        L.push(`SYMBOL ${type} ${x} ${y} ${rot}`);
        (windows || []).forEach((w) => L.push("WINDOW " + w));
        Object.keys(attrs).forEach((k) => L.push(`SYMATTR ${k} ${attrs[k]}`));
      },
      text(x, y, str, size, align) { L.push(`TEXT ${x} ${y} ${align || "Left"} ${size || 2} ${str}`); },
      lines: L
    };
  }

  const HIDE = ["0 0 0 Invisible 2", "3 0 0 Invisible 2"];

  // one bridge leg at column X: high switch rail -> node, low switch node -> 0, each with an antiparallel diode and
  // Coss; the midpoint wire is split at yTap (the node's tap). gHi / gLo = gate nets.
  function leg(s, X, yTop, yBot, names, model, diode, coss, gHi, gLo, yTap) {
    const yHi = yTop + 80;           // high switch B / node
    const yLo = yBot - 80;           // low switch A / node
    const sw = ["0 24 8 Left 2", "3 0 0 Invisible 2"];
    s.sym("sw", X, yTop - 16, "R0", { InstName: names[0], Value: model }, sw);
    s.sym("sw", X, yBot - 96, "R0", { InstName: names[1], Value: model }, sw);
    s.sym("diode", X + 64, yHi, "R180", { InstName: "D_" + names[0], Value: diode }, HIDE);
    s.sym("diode", X + 64, yBot, "R180", { InstName: "D_" + names[1], Value: diode }, HIDE);
    s.sym("cap", X + 80, yTop + 8, "R0", { InstName: "Coss_" + names[0], Value: coss }, HIDE);
    s.sym("cap", X + 80, yBot - 72, "R0", { InstName: "Coss_" + names[1], Value: coss }, HIDE);
    s.wire([[X + 48, yTop + 16], [X + 48, yTop]]);
    s.wire([[X + 96, yTop + 8], [X + 96, yTop]]);
    s.wire([[X + 96, yHi - 8], [X + 96, yHi], [X + 48, yHi], [X, yHi]]);
    s.wire([[X + 48, yLo + 16], [X + 48, yLo]]);
    s.wire([[X + 96, yLo + 8], [X + 96, yLo], [X + 48, yLo], [X, yLo]]);
    s.wire([[X + 96, yBot - 8], [X + 96, yBot]]);
    s.wire([[X, yHi], [X, yTap], [X, yLo]]);
    // gates: NC+ to the gate net, NC- to ground
    s.wire([[X - 48, yTop + 64], [X - 80, yTop + 64]]);
    s.flag(X - 80, yTop + 64, gHi);
    s.flag(X - 48, yTop + 16, "0");
    s.wire([[X - 48, yBot - 16], [X - 80, yBot - 16]]);
    s.flag(X - 80, yBot - 16, gLo);
    s.flag(X - 48, yBot - 64, "0");
  }

  // the same leg with GaN power stages (DAB_GaN.lib, nmos symbol as a subcircuit: D, IN, S): the FET carries its own
  // reverse conduction and Coss, IN is the logic gate net
  function ganLeg(s, X, yTop, yBot, names, model, ron, gHi, gLo, yTap) {
    const fet = ["0 56 32 Left 2", "3 56 72 Invisible 2", "39 56 64 Left 1"];
    s.sym("nmos", X - 48, yTop, "R0", { InstName: names[0], Prefix: "X", Value: model, SpiceLine: "Ron=" + ron }, fet);
    s.sym("nmos", X - 48, yBot - 96, "R0", { InstName: names[1], Prefix: "X", Value: model, SpiceLine: "Ron=" + ron }, fet);
    s.wire([[X, yTop + 96], [X, yTap], [X, yBot - 96]]);
    s.wire([[X - 48, yTop + 80], [X - 80, yTop + 80]]);
    s.flag(X - 80, yTop + 80, gHi);
    s.wire([[X - 48, yBot - 16], [X - 80, yBot - 16]]);
    s.flag(X - 80, yBot - 16, gLo);
  }

  // ------------------------------------------------------------------ schematic
  function buildSchematic(p, opts) {
    // p: the solver params of the run (M2SpiceDAB.merge + withCores); opts {Lind, switches: "gan" (default) | "ideal"}.
    // Returns {name, text}.
    opts = opts || {};
    const gan = opts.switches !== "ideal";
    const B = BOARD;
    const s = sheet();
    const yT = 0;
    const yB = 320;
    const xA = 224;                  // legs A, B (DC side), C (AC side)
    const xB = 448;
    const xC = 1760;
    const yA = 128;                  // node a, primary dot, secondary path to c
    const yb = 176;                  // node b (tap); the primary PortN1 is at y = 224
    const xT = 912;                  // transformer block (pins at +-144)
    const xL = 1392;                 // inductor block (pins at +-128)
    const xS = 1984;                 // split capacitor
    const xV2 = 2208;

    s.text(xT, -192, ";PM-SPICE-DAB", 4, "Center");

    // ---- DC side: V1, legs A and B
    s.sym("voltage", 0, 112, "R0", { InstName: "V1", Value: "{V1}" }, ["0 24 16 Left 2", "3 24 96 Left 2"]);
    // the ideal legs tap the rails at X, X + 48 (diode) and X + 96 (Coss); a GaN leg only at X
    const taps = (y) => gan ? [[xA, y], [xB, y]] : [[xA, y], [xA + 48, y], [xA + 96, y], [xB, y], [xB + 48, y], [xB + 96, y]];
    s.wire([[0, 128], [0, yT]].concat(taps(yT)));
    s.wire([[0, 208], [0, yB]].concat(taps(yB)));
    s.flag(0, yT, "vin");
    s.flag(0, yB, "0");
    if (gan) {
      ganLeg(s, xA, yT, yB, ["S1", "S2"], "GAN_P", "{RonP}", "g1", "g2", yA);
      ganLeg(s, xB, yT, yB, ["S3", "S4"], "GAN_P", "{RonP}", "g3", "g4", yb);
    } else {
      leg(s, xA, yT, yB, ["S1", "S2"], "SWP", "DP", "{CossP}", "g1", "g2", yA);
      leg(s, xB, yT, yB, ["S3", "S4"], "SWP", "DP", "{CossP}", "g3", "g4", yb);
    }
    s.flag(xA, yA, "a");
    s.flag(xB, yb, "b");

    // ---- blocking capacitor (R270: pin A on the left, so I(Cb) = i_p into the primary dot) and transformer
    s.wire([[xA, yA], [576, yA]]);
    s.sym("cap", 576, yA + 16, "R270", { InstName: "Cb", Value: num(p.Cb) }, ["0 32 32 VTop 2", "3 0 32 VBottom 2"]);
    s.wire([[640, yA], [xT - 144, yA]]);
    s.wire([[xB, yb], [xT - 176, yb], [xT - 176, yA + 96], [xT - 144, yA + 96]]);
    s.sym(BLOCKS.tx, xT, yA + 48, "R0", Object.assign({ InstName: "XT" }, spiceLines(p.tx)));
    s.text(xT, -64, `;Transformer ${p.tx.material}, ${g6(p.tx.N1)}:${g6(p.tx.N2)}`, 2, "Center");

    // ---- secondary: inductor block, AC wiring, half bridge
    s.wire([[xT + 144, yA], [xL - 128, yA]]);
    s.wire([[xT + 144, yA + 96], [xT + 176, yA + 96]]);
    s.flag(xT + 176, yA + 96, "m");
    s.sym(BLOCKS.ind, xL, yA, "R0", Object.assign({ InstName: "XL" }, spiceLines(p.ind)));
    s.text(xL, -64, `;Series inductor ${p.ind.material}`, 2, "Center");
    if (gan) {
      // the node between the two blocks sees only inductances; the ~1 ns GaN edges cut the time step to ~1e-25 s,
      // where its voltage chatters by +-800 V. 100k across XL fixes the conditioning (~10 mW, no extra state).
      const yR = yB - 48;
      s.wire([[xL - 128, yA], [xL - 128, yR], [xL - 40, yR]]);
      s.sym("res", xL + 56, yR - 16, "R90", { InstName: "Rdmp", Value: "100k" }, ["0 0 56 VBottom 2", "3 32 56 VTop 2"]);
      s.wire([[xL + 40, yR], [xL + 128, yR], [xL + 128, yA]]);
    }
    const Rw = Math.max(p.ind.R - B.RindBlock, 0) + Math.max(p.Rac - B.esr / 2, 0);
    s.wire([[xL + 128, yA], [xL + 160, yA]]);
    s.sym("ind", xL + 256, yA - 16, "R90", { InstName: "Lw", Value: num(p.Lac), SpiceLine: "Rser=" + num(Rw) },
      ["0 5 56 VBottom 2", "3 32 56 VTop 2", "39 56 56 VTop 1"]);
    s.wire([[xL + 240, yA], [xC, yA]]);
    s.flag(xC, yA, "c");

    const tapsC = (y) => gan ? [[xC, y], [xS, y], [xV2, y]] : [[xC, y], [xC + 48, y], [xC + 96, y], [xS, y], [xV2, y]];
    s.wire(tapsC(yT));
    s.wire(tapsC(yB));
    s.flag(xV2, yT, "vh");
    s.flag(xV2, yB, "0");
    if (gan) ganLeg(s, xC, yT, yB, ["S5", "S6"], "GAN_S", "{RonS}", "g5", "g6", yA);
    else leg(s, xC, yT, yB, ["S5", "S6"], "SWS", "DS", "{CossS}", "g5", "g6", yA);
    // split capacitor, both halves charged to V2/2
    const cs = ["0 24 8 Left 2", "3 24 56 Left 2", "39 24 80 Left 1"];
    s.sym("cap", xS - 16, 48, "R0", { InstName: "Cs1", Value: num(p.Cs), SpiceLine: `Rser=${num(B.esr)} IC={V2/2}` }, cs);
    s.sym("cap", xS - 16, 208, "R0", { InstName: "Cs2", Value: num(p.Cs), SpiceLine: `Rser=${num(B.esr)} IC={V2/2}` }, cs);
    s.wire([[xS, yT], [xS, 48]]);
    s.wire([[xS, 112], [xS, 160], [xS, 208]]);
    s.wire([[xS, 272], [xS, yB]]);
    s.wire([[xS, 160], [xS - 48, 160]]);
    s.flag(xS - 48, 160, "m");
    s.sym("voltage", xV2, 112, "R0", { InstName: "V2", Value: "{V2}" }, ["0 24 16 Left 2", "3 24 96 Left 2"]);
    s.wire([[xV2, 128], [xV2, yT]]);
    s.wire([[xV2, 208], [xV2, yB]]);
    // ---- gate drive: EPS sine comparators (TI cyclo_d1 / cyclo_d2), t = 0 at the middle of the positive v_ab pulse
    const yG = yB + 176;
    s.text(0, yG - 48, ";Gate Drive (EPS)", 2);
    const gates = [
      ["B1", "g1", "V=cos(2*pi*f*time-pi*D1)-sdp"], ["B2", "g2", "V=-cos(2*pi*f*time-pi*D1)-sdp"],
      ["B3", "g3", "V=-cos(2*pi*f*time+pi*D1)-sdp"], ["B4", "g4", "V=cos(2*pi*f*time+pi*D1)-sdp"],
      ["B5", "g5", "V=cos(2*pi*f*time-2*pi*V(d2))-sds"], ["B6", "g6", "V=-cos(2*pi*f*time-2*pi*V(d2))-sds"],
      ["B7", "d2", "V=phi/360*if(time<Tr,0.5*(1-cos(pi*time/Tr)),1)"]
    ];
    gates.forEach(([inst, node, expr], k) => {
      const x = 96 + (k % 4) * 544;
      const y = yG + Math.floor(k / 4) * 160;
      s.sym("bv", x, y, "R0", { InstName: inst, Value: expr }, ["0 24 40 Left 2", "3 24 72 Left 2"]);
      s.wire([[x, y + 16], [x - 48, y + 16]]);
      s.flag(x - 48, y + 16, node);
      s.flag(x, y + 96, "0");
    });
    s.text(96 + 2 * 544 + 24, yG + 160 + 112, ";D2 = phi/360, ramped up over the first Tr", 2);

    // ---- start-up damper (tida_sim.damper_lines): damps the split-capacitor ringing during the ramp, then fades out
    const yD = yG + 400;
    s.text(0, yD - 48, ";Start-up", 2);
    s.sym("voltage", 96, yD, "R0", { InstName: "Vmref", Value: "{V2/2}" }, ["0 24 16 Left 2", "3 24 96 Left 2"]);
    s.wire([[96, yD + 16], [48, yD + 16]]);
    s.flag(48, yD + 16, "mref");
    s.flag(96, yD + 96, "0");
    s.sym("bi", 640, yD + 16, "R0", { InstName: "Bdmp", Value: "I=(V(m)-V(mref))/Z0*if(time<Tr,1,if(time<Tf,0.5*(1+cos(pi*(time-Tr)/(Tf-Tr))),0))" },
      ["0 24 24 Left 2", "3 24 56 Left 2"]);
    s.wire([[640, yD + 16], [592, yD + 16]]);
    s.flag(592, yD + 16, "m");
    s.wire([[640, yD + 96], [592, yD + 96]]);
    s.flag(592, yD + 96, "mref");

    // ---- directives
    const Lser = p.Lac + (opts.Lind || 2.9e-6);
    const z0 = Math.sqrt(Lser / (2 * p.Cs));
    const yS = yD + 208;
    const dirs = [
      `.param V1=${g6(p.V1)} V2=${g6(p.V2)} f=${num(p.f)} phi=${g6(p.phi)} D1=${g6(p.D1)} deadP=${num(p.deadP)} deadS=${num(p.deadS)}`,
      `.param Ncyc=${B.Ncyc} Nsave=2 Tr=${B.Nramp}/f Tf=${B.Nramp + B.Nfade}/f Z0=${g6(z0)}`,
      ".param sdp=sin(pi*f*deadP) sds=sin(pi*f*deadS)"
    ].concat(gan ? [
      `.param RonP=${num(p.RonP)} RonS=${num(p.RonS)}`,
      `.lib ${GAN_LIB}`
    ] : [
      `.param CossP=${num(B.CossP)} CossS=${num(B.CossS)}`,
      `.model SWP SW(Ron=${num(p.RonP)} Roff=1Meg Vt=0 Vh=-2m)`,
      `.model SWS SW(Ron=${num(p.RonS)} Roff=10Meg Vt=0 Vh=-2m)`,
      `.model DP D(Ron=${num(B.RdP)} Roff=1Meg Vfwd=${g6(B.VrevP)})`,
      `.model DS D(Ron=${num(B.RdS)} Roff=10Meg Vfwd=${g6(B.VrevS)})`
    ]).concat([
      `.tran 0 {Ncyc/f} {(Ncyc-Nsave)/f} {1/(${B.steps}*f)} uic`,
      ".options method=gear chgtol=1e-12 reltol=1e-4 plotwinsize=0 numdgt=15",
      ".meas TRAN P_in AVG -V(vin)*I(V1) FROM {(Ncyc-1)/f} TO {Ncyc/f}",
      ".meas TRAN P_out AVG V(vh)*I(V2) FROM {(Ncyc-1)/f} TO {Ncyc/f}",
      ".meas TRAN IL_rms RMS I(Lw) FROM {(Ncyc-1)/f} TO {Ncyc/f}",
      ".meas TRAN Ip_rms RMS I(Cb) FROM {(Ncyc-1)/f} TO {Ncyc/f}"
    ]);
    s.text(0, yS, "!" + dirs.join("\\n"), 2);

    const head = ["Version 4", "SHEET 1 2400 1920"];
    return { name: "PM-SPICE-DAB.asc", text: head.concat(s.lines).join("\n") + "\n" };
  }

  const api = { BLOCKS, BLOCK_FILES, GAN_LIB, BOARD, buildSchematic, coreParams, num, g6 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.M2SpiceDABLTspice = api;
})(typeof window !== "undefined" ? window : globalThis);
