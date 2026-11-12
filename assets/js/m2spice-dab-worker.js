/* Web Worker for the M2Spice usage example: DAB steady-state runs (m2spice-dab-sim.js).
 * Message in: {id, cases: [params]}, plus {waves: false} for metrics only, or {fitted: true, start} for operating
 * points with their own core parameters (simulateFitted: re-extraction from the MagNet networks, which this worker
 * loads itself; start = the cores to refine from).
 * Out: {id, results: [{metrics, edges, wave, derived, params} | {metrics, params, cores} | {error}]}.
 */
/* global importScripts, M2SpiceDAB, M2SpiceExtract */
importScripts("m2spice-extract.js", "m2spice-dab-sim.js");

const BASE = self.location.href.replace(/js\/m2spice-dab-worker\.js(\?.*)?$/, "");
const nets = {};

async function loadNet(mat) {
  if (!nets[mat]) {
    const r = await fetch(BASE + "m2spice/nn/" + mat + ".json");
    if (!r.ok) throw new Error(`could not load the ${mat} network (${r.status})`);
    nets[mat] = M2SpiceExtract.prepareNet(await r.json());
  }
  return nets[mat];
}

self.onmessage = async (event) => {
  const { id, cases, waves, fitted, start } = event.data;
  const results = [];
  for (const c of cases) {
    try {
      if (fitted) {
        const ns = {};
        for (const m of [c.tx.material, c.ind.material]) ns[m] = await loadNet(m);
        const r = await M2SpiceDAB.simulateFitted(c, ns, { start });
        results.push({ metrics: r.result.metrics, params: { phi: c.phi }, cores: r.cores });
      } else {
        const r = M2SpiceDAB.simulate(c);
        results.push(waves === false ? { metrics: r.metrics, params: { phi: r.params.phi } } : r);
      }
    } catch (e) {
      results.push({ error: String((e && e.message) || e) });
    }
  }
  self.postMessage({ id, results });
};
