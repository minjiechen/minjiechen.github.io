/* M2Spice: small SVG line plots (no library), shared by the B-H preview (m2spice-llg.js) and the usage example
 * (m2spice-dab.js). Styles: .m2spice-plot in m2spice.css.
 */
(function (root) {
  "use strict";

  function niceTicks(lo, hi, n) {
    const span = hi - lo;
    const raw = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9 * step; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }

  function fmtTick(v) {
    const a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 1000) return (v / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return String(Number(v.toPrecision(3)));
  }

  function tickText(v) {
    return fmtTick(v).replace("-", "−");     // typographic minus in the line plots
  }

  function extent(series, key, sym, pad) {
    let lo = Infinity;
    let hi = -Infinity;
    series.forEach((s) => s[key].forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
    if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
    if (sym) { const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1; lo = -m; hi = m; }
    const span = hi - lo || Math.abs(hi) || 1;
    return [lo - pad * span, hi + pad * span];
  }

  // linePlot(host, cfg): cfg = {width, height, aria, xLabel, yLabel, xSym, ySym, xRange, yRange,
  //   series: [{name, cls, x, y, step, closed}], marks: [{x, y, cls, label}], fmt(series, i) -> tooltip html}
  // step: zero-order hold (y[i] holds until x[i+1]); closed: polyline back to the first point (loops).
  function linePlot(host, cfg) {
    const W = cfg.width || 420;
    const Hh = cfg.height || 250;
    const m = { l: 50, r: 12, t: 10, b: 36 };
    const series = cfg.series;
    const [x0, x1] = cfg.xRange || extent(series, "x", cfg.xSym, cfg.xSym ? 0.06 : 0);
    const [y0, y1] = cfg.yRange || extent(series, "y", cfg.ySym, 0.08);
    const sx = (v) => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
    const sy = (v) => m.t + (y1 - v) / (y1 - y0) * (Hh - m.t - m.b);
    const xt = niceTicks(x0, x1, cfg.xTicks || 5);
    const yt = niceTicks(y0, y1, cfg.yTicks || 4);
    let svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${cfg.aria || ""}">`;
    xt.forEach((v) => { svg += `<line class="grid" x1="${sx(v)}" x2="${sx(v)}" y1="${m.t}" y2="${Hh - m.b}"/>`
      + `<text class="tick" x="${sx(v)}" y="${Hh - m.b + 14}" text-anchor="middle">${tickText(v)}</text>`; });
    yt.forEach((v) => { svg += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/>`
      + `<text class="tick" x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${tickText(v)}</text>`; });
    if (x0 < 0 && x1 > 0) svg += `<line class="axis" x1="${sx(0)}" x2="${sx(0)}" y1="${m.t}" y2="${Hh - m.b}"/>`;
    if (y0 < 0 && y1 > 0) svg += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    svg += `<rect class="frame" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${Hh - m.t - m.b}"/>`;
    series.forEach((s) => {
      const pts = [];
      for (let i = 0; i < s.x.length; i += 1) {
        if (s.step && i > 0) pts.push(`${sx(s.x[i]).toFixed(1)},${sy(s.y[i - 1]).toFixed(1)}`);
        pts.push(`${sx(s.x[i]).toFixed(1)},${sy(s.y[i]).toFixed(1)}`);
      }
      if (s.closed && pts.length) pts.push(pts[0]);
      svg += `<polyline class="trace ${s.cls || ""}" points="${pts.join(" ")}"/>`;
    });
    (cfg.marks || []).forEach((k) => {
      svg += `<circle class="mark ${k.cls || ""}" r="4.5" cx="${sx(k.x)}" cy="${sy(k.y)}"/>`;
    });
    svg += `<text class="label" x="${(m.l + W - m.r) / 2}" y="${Hh - 4}" text-anchor="middle">${cfg.xLabel || ""}</text>`
      + `<text class="label" x="12" y="${(m.t + Hh - m.b) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(m.t + Hh - m.b) / 2})">${cfg.yLabel || ""}</text>`
      + "<circle class=\"hover-dot\" r=\"4\" cx=\"-10\" cy=\"-10\"/></svg>";
    host.innerHTML = svg + "<div class=\"m2spice-tooltip\" hidden></div>";
    const el = host.querySelector("svg");
    const tip = host.querySelector(".m2spice-tooltip");
    const dot = host.querySelector(".hover-dot");
    const hide = () => { tip.hidden = true; dot.setAttribute("cx", -10); };
    const pick = (ev) => {
      const r = el.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * W;
      const py = (ev.clientY - r.top) / r.height * Hh;
      let best = null;
      series.forEach((s) => {
        for (let i = 0; i < s.x.length; i += 1) {
          const d = (sx(s.x[i]) - px) ** 2 + (sy(s.y[i]) - py) ** 2;
          if (!best || d < best.d) best = { d, s, i };
        }
      });
      if (!best || best.d > 30 * 30) { hide(); return; }
      const { s, i } = best;
      dot.setAttribute("cx", sx(s.x[i]));
      dot.setAttribute("cy", sy(s.y[i]));
      dot.setAttribute("class", "hover-dot " + (s.cls || ""));
      tip.innerHTML = cfg.fmt ? cfg.fmt(s, i) : `<strong>${s.name}</strong><br>${fmtTick(s.x[i])}, ${fmtTick(s.y[i])}`;
      tip.hidden = false;
      const left = sx(s.x[i]) / W * r.width;
      tip.style.left = Math.min(Math.max(left, 80), r.width - 80) + "px";
      tip.style.top = (sy(s.y[i]) / Hh * r.height + 12) + "px";
    };
    el.addEventListener("pointermove", pick);
    el.addEventListener("pointerdown", pick);
    el.addEventListener("pointerleave", hide);
    return { sx, sy };
  }

  const api = { niceTicks, fmtTick, linePlot };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.M2SpicePlot = api;
})(typeof window !== "undefined" ? window : globalThis);
