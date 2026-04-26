---
layout: page
title: CoupMag Expert
subtitle: Coupled magnetics model calculator for multiphase PWM converters
full-width: true
css:
  - /assets/css/coupmagexpert.css
js:
  - /assets/js/coupmagexpert.js
head-extra:
  - coupmagexpert-mathjax.html
---

<div class="coupmag-page" data-coupmag>
  <section class="coupmag-shell" aria-labelledby="coupmag-title">
    <div>
      <p class="coupmag-kicker">Princeton Power Electronics Tool</p>
      <h2 id="coupmag-title">Coupled magnetics expert calculator</h2>
      <p>CoupMag Expert evaluates equivalent inductance-dual, inductance-matrix, and multiwinding-transformer parameters for multiphase PWM converter designs.</p>
    </div>
    <div class="coupmag-actions">
      <button class="coupmag-button" type="button" data-action="example" title="Load example values" aria-label="Load example values">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        <span>Example</span>
      </button>
      <button class="coupmag-button" type="button" data-action="clear" title="Clear values" aria-label="Clear values">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
        <span>Clear</span>
      </button>
    </div>
  </section>

  <section class="coupmag-section" aria-labelledby="operating-point">
    <div class="coupmag-section-heading">
      <h2 id="operating-point">Operating Point</h2>
      <p>Interleaving terms are derived from the duty ratio, phase count, and turns per winding.</p>
    </div>
    <div class="coupmag-grid coupmag-grid-3">
      <div class="coupmag-field">
        <label for="coupmag-duty">Duty Ratio \(D\)</label>
        <input id="coupmag-duty" type="number" min="0" max="1" step="0.01" value="0.4" inputmode="decimal">
      </div>
      <div class="coupmag-field">
        <label for="coupmag-phases">Number of Phases \(M\)</label>
        <input id="coupmag-phases" type="number" min="2" step="1" value="4" inputmode="numeric">
      </div>
      <div class="coupmag-field">
        <label for="coupmag-turns">Turns per Winding \(N\)</label>
        <input id="coupmag-turns" type="number" min="0" step="1" value="1" inputmode="decimal">
      </div>
      <div class="coupmag-metric">
        <span>Interleaving Boosting Inductance \(1/\delta\)</span>
        <strong data-output="boost">--</strong>
      </div>
      <div class="coupmag-metric">
        <span>Number of Overlapped Phases \(k\)</span>
        <strong data-output="overlap">--</strong>
      </div>
      <div class="coupmag-metric">
        <span>Interleaving Ripple Compression \(\delta\)</span>
        <strong data-output="compression">--</strong>
      </div>
    </div>
    <p class="coupmag-status" id="coupmag-status" aria-live="polite"></p>
  </section>

  <section class="coupmag-section" aria-labelledby="design-parameters">
    <div class="coupmag-section-heading">
      <h2 id="design-parameters">Design Parameters</h2>
      <p>Use reluctance in H^-1 and inductance in H. Flux-per-current outputs are reported in Wb/A.</p>
    </div>
    <div class="coupmag-method-grid">
      <div class="coupmag-method-panel is-dual">
        <h3>Inductance Dual Model</h3>
        <div class="coupmag-field">
          <label for="coupmag-dual-rl">\(\mathcal{R}_L\) <span class="coupmag-unit-label">H^-1</span></label>
          <input id="coupmag-dual-rl" type="number" step="any" value="1000000" inputmode="decimal">
        </div>
        <div class="coupmag-field">
          <label for="coupmag-dual-rc">\(\mathcal{R}_C\) <span class="coupmag-unit-label">H^-1</span></label>
          <input id="coupmag-dual-rc" type="number" step="any" value="200000" inputmode="decimal">
        </div>
        <div class="coupmag-ratio">
          <span>\(\beta = \mathcal{R}_C/\mathcal{R}_L\)</span>
          <strong data-output="beta">--</strong>
        </div>
      </div>
      <div class="coupmag-method-panel is-matrix">
        <h3>Inductance Matrix Model</h3>
        <div class="coupmag-field">
          <label for="coupmag-matrix-ls">\(L_S\) <span class="coupmag-unit-label">H</span></label>
          <input id="coupmag-matrix-ls" type="number" step="any" value="0.000001" inputmode="decimal">
        </div>
        <div class="coupmag-field">
          <label for="coupmag-matrix-lm">\(L_M\) <span class="coupmag-unit-label">H</span></label>
          <input id="coupmag-matrix-lm" type="number" step="any" value="-0.0000001" inputmode="decimal">
        </div>
        <div class="coupmag-ratio">
          <span>\(\alpha = -L_M/L_S\)</span>
          <strong data-output="alpha">--</strong>
        </div>
      </div>
      <div class="coupmag-method-panel is-transformer">
        <h3>Multiwinding Transformer Model</h3>
        <div class="coupmag-field">
          <label for="coupmag-transformer-ll">\(L_l\) <span class="coupmag-unit-label">H</span></label>
          <input id="coupmag-transformer-ll" type="number" step="any" value="0.0000007" inputmode="decimal">
        </div>
        <div class="coupmag-field">
          <label for="coupmag-transformer-lmu">\(L_\mu\) <span class="coupmag-unit-label">H</span></label>
          <input id="coupmag-transformer-lmu" type="number" step="any" value="0.0000003" inputmode="decimal">
        </div>
        <div class="coupmag-ratio">
          <span>\(\rho = L_\mu/L_l\)</span>
          <strong data-output="rho">--</strong>
        </div>
      </div>
    </div>
  </section>

  <section class="coupmag-section" aria-labelledby="model-explorer">
    <div class="coupmag-section-heading">
      <h2 id="model-explorer">Model Explorer</h2>
      <p>Static equations remain visible beside the live numerical results for each modeling view.</p>
    </div>

    <div class="coupmag-tabbar" role="tablist" aria-label="Coupled magnetics models">
      <button class="coupmag-tab" type="button" role="tab" aria-selected="true" aria-controls="coupmag-panel-dual" data-tab="dual">
        <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
        <span>Inductance Dual</span>
      </button>
      <button class="coupmag-tab" type="button" role="tab" aria-selected="false" aria-controls="coupmag-panel-matrix" data-tab="matrix">
        <i class="fa-solid fa-table-cells" aria-hidden="true"></i>
        <span>Inductance Matrix</span>
      </button>
      <button class="coupmag-tab" type="button" role="tab" aria-selected="false" aria-controls="coupmag-panel-transformer" data-tab="transformer">
        <i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i>
        <span>Transformer</span>
      </button>
    </div>

    <article class="coupmag-panel" id="coupmag-panel-dual" role="tabpanel" data-panel="dual">
      <div class="coupmag-panel-grid">
        <div class="coupmag-model-media">
          <div class="coupmag-equation-block">
            $$
            N^2
            \begin{bmatrix}
            \frac{di_1}{dt} \\
            \frac{di_2}{dt} \\
            \vdots \\
            \frac{di_M}{dt}
            \end{bmatrix}
            =
            \begin{bmatrix}
            \mathcal{R}_L + \mathcal{R}_C & \mathcal{R}_C & \ldots & \mathcal{R}_C \\
            \mathcal{R}_C & \mathcal{R}_L + \mathcal{R}_C & \ldots & \mathcal{R}_C \\
            \vdots & \vdots & \ddots & \vdots \\
            \mathcal{R}_C & \ldots & \mathcal{R}_C & \mathcal{R}_L + \mathcal{R}_C
            \end{bmatrix}
            \begin{bmatrix}
            v_1 \\
            v_2 \\
            \vdots \\
            v_M
            \end{bmatrix}
            $$
          </div>
          <figure class="coupmag-figure">
            <img src="/assets/img/coupmagexpert/idmodel.jpg" alt="Inductance dual lumped circuit model">
          </figure>
        </div>
        <div class="coupmag-output-grid">
          <div class="coupmag-table-wrap">
            <table class="coupmag-table">
              <caption>Model Parameters</caption>
              <tbody>
                <tr><th>\(\mathcal{R}_L\)</th><td><span class="coupmag-equation">\(\mathcal{R}_L\)</span></td><td class="coupmag-value" data-output="dualRLValue" data-unit="H^-1">--</td></tr>
                <tr><th>\(\mathcal{R}_C\)</th><td><span class="coupmag-equation">\(\mathcal{R}_C\)</span></td><td class="coupmag-value" data-output="dualRCValue" data-unit="H^-1">--</td></tr>
                <tr><th>\(L_l\)</th><td><span class="coupmag-equation">\(L_l = \frac{N^2}{\mathcal{R}_L + M\mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="dualLl" data-unit="H">--</td></tr>
                <tr><th>\(L_\mu\)</th><td><span class="coupmag-equation">\(L_\mu = \frac{N^2(M-1)\mathcal{R}_C}{\mathcal{R}_L(\mathcal{R}_L + M\mathcal{R}_C)}\)</span></td><td class="coupmag-value" data-output="dualLmu" data-unit="H">--</td></tr>
                <tr><th>\(L_S\)</th><td><span class="coupmag-equation">\(L_S = \frac{N^2(\mathcal{R}_L + (M-1)\mathcal{R}_C)}{\mathcal{R}_L(\mathcal{R}_L + M\mathcal{R}_C)}\)</span></td><td class="coupmag-value" data-output="dualLS" data-unit="H">--</td></tr>
                <tr><th>\(L_M\)</th><td><span class="coupmag-equation">\(L_M = \frac{-N^2\mathcal{R}_C}{\mathcal{R}_L(\mathcal{R}_L + M\mathcal{R}_C)}\)</span></td><td class="coupmag-value" data-output="dualLM" data-unit="H">--</td></tr>
                <tr><th>\(L_L\)</th><td><span class="coupmag-equation">\(L_L = \frac{1}{\mathcal{R}_L}\)</span></td><td class="coupmag-value" data-output="dualLL" data-unit="H">--</td></tr>
                <tr><th>\(L_C\)</th><td><span class="coupmag-equation">\(L_C = \frac{1}{\mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="dualLC" data-unit="H">--</td></tr>
                <tr><th>\(L_L^*\)</th><td><span class="coupmag-equation">\(L_L^* = \frac{N^2(\mathcal{R}_L + (M-1)\mathcal{R}_C)}{\mathcal{R}_L(\mathcal{R}_L + M\mathcal{R}_C)}\)</span></td><td class="coupmag-value" data-output="dualLLStar" data-unit="H">--</td></tr>
                <tr><th>\(L_C^*\)</th><td><span class="coupmag-equation">\(L_C^* = \frac{N^2}{\mathcal{R}_L/M + \mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="dualLCStar" data-unit="H">--</td></tr>
              </tbody>
            </table>
          </div>
          <div class="coupmag-table-wrap">
            <table class="coupmag-table">
              <caption>Converter Quantities</caption>
              <tbody>
                <tr><th>\(L_{oss}\)</th><td><span class="coupmag-equation">\(\frac{(1-D)DMN^2}{(\mathcal{R}_L + M\mathcal{R}_C)(k + 1 - DM)(DM - k)}\)</span></td><td class="coupmag-value" data-output="dualLoss" data-unit="H">--</td></tr>
                <tr><th>\(L_{pss}\)</th><td><span class="coupmag-equation">\(\frac{N^2(1-D)}{-\frac{k^2\mathcal{R}_C}{DM}-\frac{k\mathcal{R}_C}{DM}+2k\mathcal{R}_C-DM\mathcal{R}_C+\mathcal{R}_C-D\mathcal{R}_L+\mathcal{R}_L}\)</span></td><td class="coupmag-value" data-output="dualLpss" data-unit="H">--</td></tr>
                <tr><th>\(L_{otr}\)</th><td><span class="coupmag-equation">\(\frac{N^2}{M(\mathcal{R}_L + M\mathcal{R}_C)}\)</span></td><td class="coupmag-value" data-output="dualLotr" data-unit="H">--</td></tr>
                <tr><th>\(L_{ptr}\)</th><td><span class="coupmag-equation">\(\frac{N^2}{\mathcal{R}_L + M\mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="dualLptr" data-unit="H">--</td></tr>
                <tr><th>\(L_{ptr}/L_{pss}\)</th><td><span class="coupmag-equation">\(\frac{-\frac{k^2\beta}{DM}-\frac{k\beta}{DM}+2k\beta-DM\beta+\beta-D+1}{(1-D)(1+M\beta)}\)</span></td><td class="coupmag-value" data-output="dualRippleRatio">--</td></tr>
                <tr><th>\(\Phi_{L,DC}/I_{out}\)</th><td><span class="coupmag-equation">\(\frac{N}{M(\mathcal{R}_L + M\mathcal{R}_C)}\)</span></td><td class="coupmag-value" data-output="dualPhiL" data-unit="Wb/A">--</td></tr>
                <tr><th>\(\Phi_{C,DC}/I_{out}\)</th><td><span class="coupmag-equation">\(\frac{N}{\mathcal{R}_L + M\mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="dualPhiC" data-unit="Wb/A">--</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>

    <article class="coupmag-panel" id="coupmag-panel-matrix" role="tabpanel" data-panel="matrix" hidden>
      <div class="coupmag-panel-grid">
        <div class="coupmag-model-media">
          <div class="coupmag-equation-block">
            $$
            \begin{bmatrix}
            v_1 \\
            v_2 \\
            \vdots \\
            v_M
            \end{bmatrix}
            =
            \begin{bmatrix}
            L_S & L_M & \ldots & L_M \\
            L_M & L_S & \ldots & L_M \\
            \vdots & \vdots & \ddots & \vdots \\
            L_M & \ldots & L_M & L_S
            \end{bmatrix}
            \begin{bmatrix}
            \frac{di_1}{dt} \\
            \frac{di_2}{dt} \\
            \vdots \\
            \frac{di_M}{dt}
            \end{bmatrix}
            $$
          </div>
          <figure class="coupmag-figure">
            <img src="/assets/img/coupmagexpert/immodel.jpg" alt="Inductance matrix lumped circuit model">
          </figure>
        </div>
        <div class="coupmag-output-grid">
          <div class="coupmag-table-wrap">
            <table class="coupmag-table">
              <caption>Model Parameters</caption>
              <tbody>
                <tr><th>\(\mathcal{R}_L\)</th><td><span class="coupmag-equation">\(\mathcal{R}_L = \frac{N^2}{L_S - L_M}\)</span></td><td class="coupmag-value" data-output="matrixRL" data-unit="H^-1">--</td></tr>
                <tr><th>\(\mathcal{R}_C\)</th><td><span class="coupmag-equation">\(\mathcal{R}_C = \frac{-N^2L_M}{(L_S - L_M)(L_S + (M-1)L_M)}\)</span></td><td class="coupmag-value" data-output="matrixRC" data-unit="H^-1">--</td></tr>
                <tr><th>\(L_l\)</th><td><span class="coupmag-equation">\(L_l = L_S + (M-1)L_M\)</span></td><td class="coupmag-value" data-output="matrixLl" data-unit="H">--</td></tr>
                <tr><th>\(L_\mu\)</th><td><span class="coupmag-equation">\(L_\mu = -(M-1)L_M\)</span></td><td class="coupmag-value" data-output="matrixLmu" data-unit="H">--</td></tr>
                <tr><th>\(L_S\)</th><td><span class="coupmag-equation">\(L_S\)</span></td><td class="coupmag-value" data-output="matrixLSValue" data-unit="H">--</td></tr>
                <tr><th>\(L_M\)</th><td><span class="coupmag-equation">\(L_M\)</span></td><td class="coupmag-value" data-output="matrixLMValue" data-unit="H">--</td></tr>
                <tr><th>\(L_L\)</th><td><span class="coupmag-equation">\(L_L = \frac{1}{\mathcal{R}_L}\)</span></td><td class="coupmag-value" data-output="matrixLL" data-unit="H">--</td></tr>
                <tr><th>\(L_C\)</th><td><span class="coupmag-equation">\(L_C = \frac{1}{\mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="matrixLC" data-unit="H">--</td></tr>
                <tr><th>\(L_L^*\)</th><td><span class="coupmag-equation">\(L_L^* = L_S\)</span></td><td class="coupmag-value" data-output="matrixLLStar" data-unit="H">--</td></tr>
                <tr><th>\(L_C^*\)</th><td><span class="coupmag-equation">\(L_C^* = M(L_S + (M-1)L_M)\)</span></td><td class="coupmag-value" data-output="matrixLCStar" data-unit="H">--</td></tr>
              </tbody>
            </table>
          </div>
          <div class="coupmag-table-wrap">
            <table class="coupmag-table">
              <caption>Converter Quantities</caption>
              <tbody>
                <tr><th>\(L_{oss}\)</th><td><span class="coupmag-equation">\(\frac{(1-D)DM(L_S + (M-1)L_M)}{(DM-k)(1+k-DM)}\)</span></td><td class="coupmag-value" data-output="matrixLoss" data-unit="H">--</td></tr>
                <tr><th>\(L_{pss}\)</th><td><span class="coupmag-equation">\(\frac{(L_S-L_M)(L_S+(M-1)L_M)}{L_S + \left(M-2k-2+\frac{k(k+1)}{MD}+\frac{MD(M-2k-1)+k(k+1)}{M(1-D)}\right)L_M}\)</span></td><td class="coupmag-value" data-output="matrixLpss" data-unit="H">--</td></tr>
                <tr><th>\(L_{otr}\)</th><td><span class="coupmag-equation">\(\frac{L_S + (M-1)L_M}{M}\)</span></td><td class="coupmag-value" data-output="matrixLotr" data-unit="H">--</td></tr>
                <tr><th>\(L_{ptr}\)</th><td><span class="coupmag-equation">\(L_S + (M-1)L_M\)</span></td><td class="coupmag-value" data-output="matrixLptr" data-unit="H">--</td></tr>
                <tr><th>\(L_{ptr}/L_{pss}\)</th><td><span class="coupmag-equation">\(\frac{1-\left(M-2k-2+\frac{k(k+1)}{MD}+\frac{MD(M-2k-1)+k(k+1)}{M(1-D)}\right)\alpha}{1+\alpha}\)</span></td><td class="coupmag-value" data-output="matrixRippleRatio">--</td></tr>
                <tr><th>\(\Phi_{L,DC}/I_{out}\)</th><td><span class="coupmag-equation">\(\frac{L_S+(M-1)L_M}{MN}\)</span></td><td class="coupmag-value" data-output="matrixPhiL" data-unit="Wb/A">--</td></tr>
                <tr><th>\(\Phi_{C,DC}/I_{out}\)</th><td><span class="coupmag-equation">\(\frac{L_S+(M-1)L_M}{N}\)</span></td><td class="coupmag-value" data-output="matrixPhiC" data-unit="Wb/A">--</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>

    <article class="coupmag-panel" id="coupmag-panel-transformer" role="tabpanel" data-panel="transformer" hidden>
      <div class="coupmag-panel-grid">
        <div class="coupmag-model-media">
          <div class="coupmag-equation-block">
            $$
            \begin{bmatrix}
            v_1 \\
            v_2 \\
            \vdots \\
            v_M
            \end{bmatrix}
            =
            \begin{bmatrix}
            L_\mu + L_l & -\frac{1}{M-1}L_\mu & \ldots & -\frac{1}{M-1}L_\mu \\
            -\frac{1}{M-1}L_\mu & L_\mu + L_l & \ldots & -\frac{1}{M-1}L_\mu \\
            \vdots & \vdots & \ddots & \vdots \\
            -\frac{1}{M-1}L_\mu & -\frac{1}{M-1}L_\mu & \ldots & L_\mu + L_l
            \end{bmatrix}
            \begin{bmatrix}
            \frac{di_1}{dt} \\
            \frac{di_2}{dt} \\
            \vdots \\
            \frac{di_M}{dt}
            \end{bmatrix}
            $$
          </div>
          <figure class="coupmag-figure">
            <img src="/assets/img/coupmagexpert/mwmodel.jpg" alt="Multiwinding transformer lumped circuit model">
          </figure>
        </div>
        <div class="coupmag-output-grid">
          <div class="coupmag-table-wrap">
            <table class="coupmag-table">
              <caption>Model Parameters</caption>
              <tbody>
                <tr><th>\(\mathcal{R}_L\)</th><td><span class="coupmag-equation">\(\mathcal{R}_L = \frac{N^2(M-1)}{(M-1)L_l + ML_\mu}\)</span></td><td class="coupmag-value" data-output="transformerRL" data-unit="H^-1">--</td></tr>
                <tr><th>\(\mathcal{R}_C\)</th><td><span class="coupmag-equation">\(\mathcal{R}_C = \frac{N^2L_\mu}{L_l((M-1)L_l + ML_\mu)}\)</span></td><td class="coupmag-value" data-output="transformerRC" data-unit="H^-1">--</td></tr>
                <tr><th>\(L_l\)</th><td><span class="coupmag-equation">\(L_l\)</span></td><td class="coupmag-value" data-output="transformerLlValue" data-unit="H">--</td></tr>
                <tr><th>\(L_\mu\)</th><td><span class="coupmag-equation">\(L_\mu\)</span></td><td class="coupmag-value" data-output="transformerLmuValue" data-unit="H">--</td></tr>
                <tr><th>\(L_S\)</th><td><span class="coupmag-equation">\(L_S = L_\mu + L_l\)</span></td><td class="coupmag-value" data-output="transformerLS" data-unit="H">--</td></tr>
                <tr><th>\(L_M\)</th><td><span class="coupmag-equation">\(L_M = -\frac{1}{M-1}L_\mu\)</span></td><td class="coupmag-value" data-output="transformerLM" data-unit="H">--</td></tr>
                <tr><th>\(L_L\)</th><td><span class="coupmag-equation">\(L_L = \frac{1}{\mathcal{R}_L}\)</span></td><td class="coupmag-value" data-output="transformerLL" data-unit="H">--</td></tr>
                <tr><th>\(L_C\)</th><td><span class="coupmag-equation">\(L_C = \frac{1}{\mathcal{R}_C}\)</span></td><td class="coupmag-value" data-output="transformerLC" data-unit="H">--</td></tr>
                <tr><th>\(L_L^*\)</th><td><span class="coupmag-equation">\(L_L^* = L_\mu + L_l\)</span></td><td class="coupmag-value" data-output="transformerLLStar" data-unit="H">--</td></tr>
                <tr><th>\(L_C^*\)</th><td><span class="coupmag-equation">\(L_C^* = ML_l\)</span></td><td class="coupmag-value" data-output="transformerLCStar" data-unit="H">--</td></tr>
              </tbody>
            </table>
          </div>
          <div class="coupmag-table-wrap">
            <table class="coupmag-table">
              <caption>Converter Quantities</caption>
              <tbody>
                <tr><th>\(L_{oss}\)</th><td><span class="coupmag-equation">\(\frac{(1-D)DML_l}{(DM-k)(1+k-DM)}\)</span></td><td class="coupmag-value" data-output="transformerLoss" data-unit="H">--</td></tr>
                <tr><th>\(L_{pss}\)</th><td><span class="coupmag-equation">\(\frac{DM(1-D)((M-1)L_l + ML_\mu)L_l}{DM(1-D)(M-1)L_l + (DM(1-DM)-k^2-k+2DMk)L_\mu}\)</span></td><td class="coupmag-value" data-output="transformerLpss" data-unit="H">--</td></tr>
                <tr><th>\(L_{otr}\)</th><td><span class="coupmag-equation">\(\frac{L_l}{M}\)</span></td><td class="coupmag-value" data-output="transformerLotr" data-unit="H">--</td></tr>
                <tr><th>\(L_{ptr}\)</th><td><span class="coupmag-equation">\(L_l\)</span></td><td class="coupmag-value" data-output="transformerLptr" data-unit="H">--</td></tr>
                <tr><th>\(L_{ptr}/L_{pss}\)</th><td><span class="coupmag-equation">\(\frac{DM(1-D)(M-1)+(DM(1-DM)-k^2-k+2DMk)\rho}{DM(1-D)(M-1+M\rho)}\)</span></td><td class="coupmag-value" data-output="transformerRippleRatio">--</td></tr>
                <tr><th>\(\Phi_{L,DC}/I_{out}\)</th><td><span class="coupmag-equation">\(\frac{L_l}{MN}\)</span></td><td class="coupmag-value" data-output="transformerPhiL" data-unit="Wb/A">--</td></tr>
                <tr><th>\(\Phi_{C,DC}/I_{out}\)</th><td><span class="coupmag-equation">\(\frac{L_l}{N}\)</span></td><td class="coupmag-value" data-output="transformerPhiC" data-unit="Wb/A">--</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>
  </section>

  <p class="coupmag-credit">
    Original CoupL v1.0 calculator designed by <a href="https://github.com/seungjaeryanlee">Seungjae Ryan Lee</a> with <a href="https://ee.princeton.edu/people/haoran-li">Haoran Li</a>, <a href="https://ee.princeton.edu/people/daniel-zhou">Daniel Zhou</a>, and <a href="https://ee.princeton.edu/people/minjie-chen">Minjie Chen</a>.
  </p>
</div>
