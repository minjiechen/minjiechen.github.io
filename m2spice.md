---
layout: page
title: PM-SPICE
permalink: /pmspice/
subtitle: Planar magnetics to SPICE netlist conversion tool
full-width: true
css:
  - /assets/css/m2spice.css?v=20261113i
js:
  - /assets/js/m2spice.js?v=20261113i
  - /assets/js/m2spice-plot.js?v=20261113i
  - /assets/js/m2spice-extract.js?v=20261113i
  - /assets/js/m2spice-llg.js?v=20261113i
  - /assets/js/m2spice-dab-sim.js?v=20261113i
  - /assets/js/m2spice-dab-ltspice.js?v=20261113i
  - /assets/js/m2spice-dab.js?v=20261113i
---

<div class="m2spice-page" data-m2spice>
  <section class="m2spice-shell" aria-labelledby="m2spice-title">
    <div class="m2spice-shell-copy">
      <img class="m2spice-icon" src="/assets/img/m2spice/icon.png" alt="" aria-hidden="true">
      <div>
        <p class="m2spice-kicker">Princeton Power Electronics Tool</p>
        <h2 id="m2spice-title">Planar magnetics to SPICE netlist conversion</h2>
        <p>PM-SPICE converts multilayer planar magnetic geometry into a SPICE-compatible equivalent circuit netlist.</p>
      </div>
    </div>
    <div class="m2spice-actions" aria-label="PM-SPICE actions">
      <a class="m2spice-button" href="https://github.com/minjiechen/M2Spice" title="Open source repository" aria-label="Open source repository">
        <i class="fa-brands fa-github" aria-hidden="true"></i>
        <span>Source</span>
      </a>
      <button class="m2spice-button" type="button" data-action="example" title="Load example geometry" aria-label="Load example geometry">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        <span>Example</span>
      </button>
      <button class="m2spice-button" type="button" data-action="clear" title="Clear geometry" aria-label="Clear geometry">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
        <span>Clear</span>
      </button>
      <a class="m2spice-button" href="#usage-example" title="Dual-active-bridge converter with LLG-SPICE magnetics" aria-label="Usage example: DAB converter">
        <i class="fa-solid fa-wave-square" aria-hidden="true"></i>
        <span>Usage Example</span>
      </a>
    </div>
  </section>

  <section class="m2spice-tool m2spice-tool-split" aria-label="PM-SPICE geometry input">
    <form class="m2spice-form" data-form novalidate>
      <div class="m2spice-columns">
        <div class="m2spice-column" aria-labelledby="m2spice-core-heading">
          <div class="m2spice-section-heading">
            <h2 id="m2spice-core-heading">Core Model</h2>
          </div>

          <div class="m2spice-fieldset">
            <div class="m2spice-grid m2spice-grid-2" data-llg-group="block">
              <div class="m2spice-field">
                <label for="m2spice-core-model">Ferrite Model</label>
                <select class="m2spice-input" id="m2spice-core-model" data-llg-mode>
                  <option value="llg" selected>LLG-SPICE nonlinear (LTspice block)</option>
                  <option value="linear">Linear (PM-SPICE netlist)</option>
                </select>
                <span class="m2spice-unit">LLG-SPICE replaces both ferrite plates with Landau-Lifshitz-Gilbert cores</span>
              </div>
            </div>
          </div>

          <div class="m2spice-fieldset">
            <h3>Core Geometry</h3>
            <div class="m2spice-grid m2spice-grid-2" data-field-group="core"></div>
          </div>

          <div data-llg-section hidden>
            <div class="m2spice-fieldset">
              <h3>Core Operating Point</h3>
              <div class="m2spice-grid m2spice-grid-2" data-llg-group="op"></div>
            </div>
          </div>
        </div>

        <div class="m2spice-column" aria-labelledby="m2spice-winding-heading">
          <div class="m2spice-section-heading">
            <h2 id="m2spice-winding-heading">Winding Model</h2>
          </div>

          <div class="m2spice-fieldset">
            <h3>Operating Point</h3>
            <div class="m2spice-grid m2spice-grid-3" data-field-group="operating"></div>
          </div>

          <div class="m2spice-fieldset">
            <h3>Layer Stack and Windings</h3>
            <div class="m2spice-grid m2spice-grid-3" data-field-group="layers"></div>
          </div>
        </div>
      </div>

      <div class="m2spice-action-bar">
        <div class="m2spice-extract-row">
          <button class="m2spice-button is-primary" type="button" data-action="check" title="Check geometry" aria-label="Check geometry">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            <span>Check</span>
          </button>
          <button class="m2spice-button is-primary" type="button" data-action="generate" title="Generate netlist (LLG-SPICE: extracts the core model first)" aria-label="Generate netlist">
            <i class="fa-solid fa-bolt" aria-hidden="true"></i>
            <span>Generate</span>
          </button>
          <progress class="m2spice-progress" data-llg-progress max="1" value="0" hidden></progress>
          <span class="m2spice-progress-text" data-llg-progress-text aria-live="polite"></span>
        </div>
        <div class="m2spice-status-panel">
          <h2>Status</h2>
          <p class="m2spice-status" data-status aria-live="polite">Load the example or enter geometry values to begin.</p>
        </div>
      </div>
    </form>
  </section>

  <section class="m2spice-editor" aria-label="Geometry editor and netlist output">
    <div class="m2spice-panel">
      <div class="m2spice-section-heading">
        <h2>Geometry Text</h2>
        <div class="m2spice-inline-actions">
          <button class="m2spice-button" type="button" data-action="sync-geometry" title="Update text from form" aria-label="Update text from form">
            <i class="fa-solid fa-arrow-down-short-wide" aria-hidden="true"></i>
            <span>Update</span>
          </button>
          <button class="m2spice-button" type="button" data-action="apply-geometry" title="Apply text to form" aria-label="Apply text to form">
            <i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
            <span>Apply</span>
          </button>
        </div>
      </div>
      <textarea class="m2spice-textarea" data-geometry-text spellcheck="false" aria-label="Geometry text"></textarea>
    </div>

    <div class="m2spice-panel">
      <div class="m2spice-section-heading">
        <h2 data-netlist-title>SPICE Netlist</h2>
        <div class="m2spice-inline-actions">
          <button class="m2spice-button" type="button" data-action="copy-netlist" data-linear-only title="Copy netlist" aria-label="Copy netlist">
            <i class="fa-solid fa-copy" aria-hidden="true"></i>
            <span>Copy</span>
          </button>
          <button class="m2spice-button" type="button" data-action="download-netlist" title="Download netlist" aria-label="Download netlist">
            <i class="fa-solid fa-download" aria-hidden="true"></i>
            <span>Download</span>
          </button>
          <button class="m2spice-button" type="button" data-action="llg-download-all" data-llg-only hidden title="Download the .lib and .asy as a zip" aria-label="Download all files as zip">
            <i class="fa-solid fa-file-zipper" aria-hidden="true"></i>
            <span>Download all</span>
          </button>
          <button class="m2spice-button" type="button" data-action="dab-example-ltspice" data-llg-only hidden title="Download the DAB usage example PM-SPICE-DAB (45 deg, 50 to 70 V, 150 kHz) as an LTspice schematic with GaN power stages and its LLG-SPICE transformer and inductor blocks" aria-label="Download the usage example LTspice schematic">
            <i class="fa-solid fa-file-zipper" aria-hidden="true"></i>
            <span>Usage Example</span>
          </button>
        </div>
      </div>
      <div class="m2spice-tabs" role="tablist" aria-label="LTspice block files" data-llg-only hidden>
        <button class="m2spice-tab is-active" type="button" role="tab" aria-selected="true" data-action="llg-tab" data-llg-tab data-tab="asy">Symbol .asy</button>
        <button class="m2spice-tab" type="button" role="tab" aria-selected="false" data-action="llg-tab" data-llg-tab data-tab="lib">Library .lib</button>
      </div>
      <div class="m2spice-symbol" data-llg-symbol hidden></div>
      <textarea class="m2spice-textarea" data-netlist spellcheck="false" aria-label="Generated SPICE netlist" readonly></textarea>
    </div>

    <aside class="m2spice-panel m2spice-results" data-llg-results hidden aria-label="Extracted core model">
      <div class="m2spice-section-heading">
        <h2>Extracted Core Model</h2>
      </div>
      <div class="m2spice-fit-result" data-llg-fit-result hidden></div>
      <figure class="m2spice-preview" data-llg-preview hidden>
        <h3>B-H Loop</h3>
        <p class="m2spice-preview-sub" data-llg-preview-sub></p>
        <div class="m2spice-legend" aria-hidden="true">
          <span><i class="m2spice-key is-nn"></i>MagNet NN (reference)</span>
          <span><i class="m2spice-key is-llg"></i>LLG fit</span>
        </div>
        <div class="m2spice-plot" data-llg-plot></div>
        <details class="m2spice-loop-table">
          <summary>Loop data (129 samples)</summary>
          <div data-llg-table></div>
        </details>
      </figure>
    </aside>
  </section>
</div>

<div class="m2spice-page m2spice-dab" data-dab id="usage-example">
  <section class="m2spice-shell" aria-labelledby="m2spice-dab-title">
    <div class="m2spice-shell-copy">
      <img class="m2spice-icon" src="/assets/img/m2spice/icon.png" alt="" aria-hidden="true">
      <div>
        <p class="m2spice-kicker">Usage Example</p>
        <h2 id="m2spice-dab-title">Dual-active-bridge converter with LLG-SPICE magnetics</h2>
        <p>A 50&nbsp;V to 70&nbsp;V, 150&nbsp;kHz DAB (TI TIDA-010954 board) with a planar ER64 2:2 transformer and an ELP38 series inductor.
          Both cores are Landau-Lifshitz-Gilbert models with (&theta;, &alpha;) extracted from the MagNet neural networks.
          Change the operating point, then simulate.</p>
      </div>
    </div>
    <div class="m2spice-actions" aria-label="Usage example actions">
      <button class="m2spice-button" type="button" data-action="dab-reset" title="Restore the hardware values" aria-label="Restore the hardware values">
        <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
        <span>Reset</span>
      </button>
    </div>
  </section>

  <section class="m2spice-panel m2spice-dab-circuit" aria-label="Converter schematic">
    <div class="m2spice-section-heading">
      <h2>Circuit</h2>
      <p class="m2spice-preview-sub" data-dab-caption></p>
    </div>
    <div class="m2spice-dab-schematic-wrap">
    <svg class="m2spice-dab-schematic" viewBox="-36 0 966 250" role="img" aria-label="Dual-active-bridge schematic: MOSFET full bridge on V1, blocking capacitor, LLG-SPICE transformer and series inductor, MOSFET half bridge, split capacitor on V2">
      <!-- rails -->
      <path class="w" d="M40 30 H210 M40 220 H210 M680 30 H870 M680 220 H870"/>
      <!-- V1 -->
      <path class="w" d="M40 30 V108 M40 142 V220"/>
      <circle class="src" cx="40" cy="125" r="17"/>
      <path class="w thin" d="M40 114 v8 M36 118 h8 M36 133 h8"/>
      <text class="lbl" x="14" y="121" text-anchor="end">V<tspan class="sub" dy="3">1</tspan></text>
      <text class="val" x="14" y="140" text-anchor="end" data-sch="V1">50 V</text>
      <!-- full bridge: legs a and b -->
      <path class="w" d="M110 30 V42 M110 82 V168 M110 208 V220"/>
      <g class="fet" transform="translate(110 62)"><path class="w" d="M0 -20 V-12 H-9 M0 20 V12 H-9 M0 12 V0 H-4 M-14 -14 V14 M-26 0 H-14 M0 -12 H10 V-5 M0 12 H10 V5"/><path class="w" d="M-9 -16 V-8 M-9 -4 V4 M-9 8 V16"/><path class="arrow" d="M-9 0 l6 -3.2 v6.4 z"/><path class="dio" d="M5 5 H15 L10 -4 Z"/><path class="w" d="M5 -5 H15"/></g><text class="swl" x="81" y="66" text-anchor="end">S1</text>
      <g class="fet" transform="translate(110 188)"><path class="w" d="M0 -20 V-12 H-9 M0 20 V12 H-9 M0 12 V0 H-4 M-14 -14 V14 M-26 0 H-14 M0 -12 H10 V-5 M0 12 H10 V5"/><path class="w" d="M-9 -16 V-8 M-9 -4 V4 M-9 8 V16"/><path class="arrow" d="M-9 0 l6 -3.2 v6.4 z"/><path class="dio" d="M5 5 H15 L10 -4 Z"/><path class="w" d="M5 -5 H15"/></g><text class="swl" x="81" y="192" text-anchor="end">S2</text>
      <circle class="dot" cx="110" cy="125" r="3.2"/><text class="node" x="98" y="129" text-anchor="end">a</text>
      <path class="w" d="M210 30 V42 M210 82 V168 M210 208 V220"/>
      <g class="fet" transform="translate(210 62)"><path class="w" d="M0 -20 V-12 H-9 M0 20 V12 H-9 M0 12 V0 H-4 M-14 -14 V14 M-26 0 H-14 M0 -12 H10 V-5 M0 12 H10 V5"/><path class="w" d="M-9 -16 V-8 M-9 -4 V4 M-9 8 V16"/><path class="arrow" d="M-9 0 l6 -3.2 v6.4 z"/><path class="dio" d="M5 5 H15 L10 -4 Z"/><path class="w" d="M5 -5 H15"/></g><text class="swl" x="181" y="66" text-anchor="end">S3</text>
      <g class="fet" transform="translate(210 188)"><path class="w" d="M0 -20 V-12 H-9 M0 20 V12 H-9 M0 12 V0 H-4 M-14 -14 V14 M-26 0 H-14 M0 -12 H10 V-5 M0 12 H10 V5"/><path class="w" d="M-9 -16 V-8 M-9 -4 V4 M-9 8 V16"/><path class="arrow" d="M-9 0 l6 -3.2 v6.4 z"/><path class="dio" d="M5 5 H15 L10 -4 Z"/><path class="w" d="M5 -5 H15"/></g><text class="swl" x="181" y="192" text-anchor="end">S4</text>
      <circle class="dot" cx="210" cy="125" r="3.2"/><text class="node" x="198" y="129" text-anchor="end">b</text>
      <!-- a: hop over leg b, blocking capacitor, primary top; b: primary bottom -->
      <path class="w" d="M110 125 H150 V95 H203 a7 7 0 0 1 14 0 H300 M308 95 H420"/>
      <path class="w" d="M210 125 H250 V160 H420"/>
      <path class="w cap" d="M300 82 V108 M308 82 V108"/>
      <text class="lbl" x="304" y="74" text-anchor="middle">C<tspan class="sub" dy="3">b</tspan></text>
      <path class="arrow" d="M352 95 l-9 -4.5 v9 z"/>
      <text class="lbl i" x="348" y="86" text-anchor="middle">i<tspan class="sub" dy="3">p</tspan></text>
      <text class="lbl" x="270" y="108" text-anchor="middle">+</text>
      <text class="lbl" x="270" y="132" text-anchor="middle">v<tspan class="sub" dy="3">ab</tspan></text>
      <text class="lbl" x="270" y="154" text-anchor="middle">&#8722;</text>
      <!-- transformer -->
      <path class="llg coil" d="M420 95 v5 a9.17 9.17 0 0 1 0 18.33 a9.17 9.17 0 0 1 0 18.33 a9.17 9.17 0 0 1 0 18.34 V160"/>
      <path class="llg core" d="M439 88 V167 M445 88 V167"/>
      <path class="llg coil" d="M464 95 v5 a9.17 9.17 0 0 0 0 18.33 a9.17 9.17 0 0 0 0 18.33 a9.17 9.17 0 0 0 0 18.34 V160"/>
      <circle class="dot" cx="410" cy="102" r="2.6"/><circle class="dot" cx="474" cy="102" r="2.6"/>
      <text class="val" x="442" y="80" text-anchor="middle" data-sch="turns">2:2</text>
      <text class="tag" x="442" y="184" text-anchor="middle">LLG-SPICE</text>
      <text class="val small" x="442" y="198" text-anchor="middle" data-sch="Lm">Lm 70.5 &#181;H</text>
      <!-- secondary top: series inductor to the half-bridge node c -->
      <path class="w" d="M464 95 H520"/>
      <path class="llg coil" d="M520 95 a7.5 7.5 0 0 1 15 0 a7.5 7.5 0 0 1 15 0 a7.5 7.5 0 0 1 15 0 a7.5 7.5 0 0 1 15 0"/>
      <path class="w" d="M580 95 H640 V125 H680"/>
      <text class="lbl" x="550" y="72" text-anchor="middle">L</text>
      <text class="val small" x="550" y="117" text-anchor="middle" data-sch="L">2.90 &#181;H</text>
      <text class="tag" x="550" y="131" text-anchor="middle">LLG-SPICE</text>
      <path class="arrow" d="M601 95 l9 -4.5 v9 z"/>
      <text class="lbl i" x="609" y="86" text-anchor="middle">i<tspan class="sub" dy="3">L</tspan></text>
      <!-- half bridge: leg c -->
      <path class="w" d="M680 30 V42 M680 82 V168 M680 208 V220"/>
      <g class="fet" transform="translate(680 62)"><path class="w" d="M0 -20 V-12 H-9 M0 20 V12 H-9 M0 12 V0 H-4 M-14 -14 V14 M-26 0 H-14 M0 -12 H10 V-5 M0 12 H10 V5"/><path class="w" d="M-9 -16 V-8 M-9 -4 V4 M-9 8 V16"/><path class="arrow" d="M-9 0 l6 -3.2 v6.4 z"/><path class="dio" d="M5 5 H15 L10 -4 Z"/><path class="w" d="M5 -5 H15"/></g><text class="swl" x="651" y="66" text-anchor="end">S5</text>
      <g class="fet" transform="translate(680 188)"><path class="w" d="M0 -20 V-12 H-9 M0 20 V12 H-9 M0 12 V0 H-4 M-14 -14 V14 M-26 0 H-14 M0 -12 H10 V-5 M0 12 H10 V5"/><path class="w" d="M-9 -16 V-8 M-9 -4 V4 M-9 8 V16"/><path class="arrow" d="M-9 0 l6 -3.2 v6.4 z"/><path class="dio" d="M5 5 H15 L10 -4 Z"/><path class="w" d="M5 -5 H15"/></g><text class="swl" x="651" y="192" text-anchor="end">S6</text>
      <circle class="dot" cx="680" cy="125" r="3.2"/><text class="node" x="698" y="129">c</text>
      <!-- secondary bottom to MidHV (m): hop over leg c -->
      <path class="w" d="M464 160 H673 a7 7 0 0 1 14 0 H780"/>
      <!-- split capacitor after the FETs -->
      <path class="w" d="M780 30 V64 M780 72 V178 M780 186 V220"/>
      <path class="w cap" d="M767 64 H793 M767 72 H793 M767 178 H793 M767 186 H793"/>
      <text class="lbl" x="800" y="64">C<tspan class="sub" dy="3">s</tspan></text>
      <text class="lbl" x="800" y="200">C<tspan class="sub" dy="3">s</tspan></text>
      <circle class="dot" cx="780" cy="160" r="3.2"/><text class="node" x="792" y="164">m</text>
      <!-- V2 -->
      <path class="w" d="M870 30 V108 M870 142 V220"/>
      <circle class="src" cx="870" cy="125" r="17"/>
      <path class="w thin" d="M870 114 v8 M866 118 h8 M866 133 h8"/>
      <text class="lbl" x="896" y="121">V<tspan class="sub" dy="3">2</tspan></text>
      <text class="val" x="896" y="140" data-sch="V2">70 V</text>
      <text class="val" x="460" y="238" text-anchor="middle" data-sch="op">150 kHz, &#966; = 45&#176;, D1 = 0.25</text>
    </svg>
    </div>
  </section>

  <section class="m2spice-tool m2spice-dab-tool" aria-label="Converter settings">
    <form class="m2spice-form" data-dab-form novalidate>
      <div class="m2spice-fieldset">
        <h3>Operating Point</h3>
        <div class="m2spice-field m2spice-dab-phase">
          <label for="m2spice-dab-phi">Phase Shift (&#966;)</label>
          <div class="m2spice-dab-phase-row">
            <input type="range" id="m2spice-dab-phi-range" min="0" max="90" step="0.5" value="45" data-dab-phi-range aria-label="Phase shift slider">
            <input class="m2spice-input" id="m2spice-dab-phi" data-dab-field="phi" autocomplete="off" inputmode="decimal">
          </div>
          <span class="m2spice-unit">deg, between the v_ab and v_cm pulse centres (TI cyclo_d2 = &#966; / 360); the plots update when you let go</span>
        </div>
        <div class="m2spice-grid m2spice-grid-3" data-dab-group="op"></div>
      </div>

      <div class="m2spice-extract-row">
        <button class="m2spice-button is-primary" type="button" data-action="dab-simulate" title="Compute the steady state" aria-label="Simulate">
          <i class="fa-solid fa-play" aria-hidden="true"></i>
          <span>Simulate</span>
        </button>
        <button class="m2spice-button is-primary" type="button" data-action="dab-sweep" title="Steady state at phi = 0 to 90 deg" aria-label="Phase sweep">
          <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
          <span>Phase Sweep</span>
        </button>
        <progress class="m2spice-progress" data-dab-progress max="1" value="0" hidden></progress>
        <span class="m2spice-progress-text" data-dab-progress-text aria-live="polite"></span>
      </div>
      <div class="m2spice-status-panel">
        <h2>Status</h2>
        <p class="m2spice-status" data-dab-status aria-live="polite">Press Simulate for the steady-state waveforms.</p>
      </div>
    </form>

  </section>

  <section class="m2spice-panel m2spice-dab-results" data-dab-results hidden aria-label="Simulation results">
    <div class="m2spice-section-heading">
      <h2>Results</h2>
      <div class="m2spice-inline-actions">
        <button class="m2spice-button" type="button" data-action="dab-csv" title="Download the waveforms" aria-label="Download the waveforms as CSV">
          <i class="fa-solid fa-download" aria-hidden="true"></i>
          <span>CSV</span>
        </button>
        <button class="m2spice-button" type="button" data-action="dab-ltspice" title="Download this operating point as an LTspice schematic (PM-SPICE-DAB) with GaN power stages and the LLG-SPICE transformer and inductor blocks" aria-label="Download the LTspice schematic">
          <i class="fa-solid fa-file-zipper" aria-hidden="true"></i>
          <span>LTspice</span>
        </button>
      </div>
    </div>
    <p class="m2spice-preview-sub" data-dab-results-sub></p>
    <div class="m2spice-fit-result" data-dab-summary></div>
    <div class="m2spice-dab-grid">
      <figure class="m2spice-preview">
        <h2>Bridge Voltages</h2>
        <div class="m2spice-legend" aria-hidden="true">
          <span><i class="m2spice-key c-blue"></i>v<sub>ab</sub></span>
          <span><i class="m2spice-key c-green"></i>v<sub>cm</sub> (c to m)</span>
        </div>
        <div class="m2spice-plot" data-dab-plot="v"></div>
      </figure>
      <figure class="m2spice-preview">
        <h2>Currents</h2>
        <div class="m2spice-legend" aria-hidden="true">
          <span><i class="m2spice-key c-red"></i>i<sub>L</sub></span>
          <span><i class="m2spice-key c-blue is-dashed"></i>i<sub>p</sub></span>
          <span><i class="m2spice-key c-copper"></i>i<sub>m</sub> (magnetizing)</span>
        </div>
        <div class="m2spice-plot" data-dab-plot="i"></div>
      </figure>
      <figure class="m2spice-preview">
        <h2>Transformer Core</h2>
        <p class="m2spice-preview-sub" data-dab-plot-sub="tx"></p>
        <div class="m2spice-plot" data-dab-plot="bhT"></div>
      </figure>
      <figure class="m2spice-preview">
        <h2>Inductor Core</h2>
        <p class="m2spice-preview-sub" data-dab-plot-sub="ind"></p>
        <div class="m2spice-plot" data-dab-plot="bhL"></div>
      </figure>
    </div>
    <div class="m2spice-dab-grid">
      <figure class="m2spice-preview">
        <h2>Phase Sweep: Power</h2>
        <p class="m2spice-preview-sub" data-dab-sweep-sub></p>
        <div data-dab-sweep hidden>
          <div class="m2spice-legend" aria-hidden="true">
            <span><i class="m2spice-key c-blue"></i>P<sub>out</sub></span>
            <span><i class="m2spice-key c-green"></i>P<sub>in</sub></span>
          </div>
          <div class="m2spice-plot" data-dab-plot="sweepP"></div>
        </div>
      </figure>
      <figure class="m2spice-preview">
        <h2>Loss Breakdown</h2>
        <p class="m2spice-preview-sub">Modelled losses only: switching (C<sub>oss</sub>, overlap), gate drive and auxiliary power are not included</p>
        <div data-dab-losses></div>
      </figure>
    </div>
  </section>
</div>
