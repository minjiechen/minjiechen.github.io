/* Web Worker for the M2Spice LLG extractor: runs batches of current-driven LLG_CORE cycles.
 * Message in: {id, cases: [{Ms, alpha, Hani_z, Hani_y, I0, f, sw}]}; out: {id, results: [{H, B} | {error}]}.
 */
/* global importScripts, M2SpiceExtract */
importScripts("m2spice-extract.js");

self.onmessage = (event) => {
  const { id, cases } = event.data;
  const results = cases.map((c) => {
    try {
      return M2SpiceExtract.simulateCycle(c);
    } catch (e) {
      return { error: String((e && e.message) || e) };
    }
  });
  self.postMessage({ id, results });
};
