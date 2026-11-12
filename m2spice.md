---
layout: page
title: M2Spice
subtitle: Planar magnetics to SPICE netlist conversion tool
full-width: true
css:
  - /assets/css/m2spice.css
js:
  - /assets/js/m2spice.js
  - /assets/js/m2spice-plot.js
  - /assets/js/m2spice-extract.js
  - /assets/js/m2spice-llg.js
---

<div class="m2spice-page" data-m2spice>
  <section class="m2spice-shell" aria-labelledby="m2spice-title">
    <div class="m2spice-shell-copy">
      <img class="m2spice-icon" src="/assets/img/m2spice/icon.png" alt="" aria-hidden="true">
      <div>
        <p class="m2spice-kicker">Princeton Power Electronics Tool</p>
        <h2 id="m2spice-title">Planar magnetics to SPICE netlist conversion</h2>
        <p>M2Spice converts multilayer planar magnetic geometry into a SPICE-compatible equivalent circuit netlist.</p>
      </div>
    </div>
    <div class="m2spice-actions" aria-label="M2Spice actions">
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
      <a class="m2spice-button" href="/m2spice-dab/" title="Dual-active-bridge converter with LLG-SPICE magnetics" aria-label="Usage example: DAB converter">
        <i class="fa-solid fa-wave-square" aria-hidden="true"></i>
        <span>Usage Example</span>
      </a>
    </div>
  </section>

  <section class="m2spice-tool" aria-label="M2Spice geometry input">
    <form class="m2spice-form" data-form novalidate>
      <div class="m2spice-section-heading">
        <h2>Geometry</h2>
      </div>

      <div class="m2spice-fieldset">
        <h3>Operating Point</h3>
        <div class="m2spice-grid m2spice-grid-3" data-field-group="operating"></div>
      </div>

      <div class="m2spice-fieldset">
        <h3>Layer Stack</h3>
        <div class="m2spice-grid m2spice-grid-2" data-field-group="layers"></div>
      </div>

      <div class="m2spice-fieldset">
        <h3>Windings and Core</h3>
        <div class="m2spice-grid m2spice-grid-3" data-field-group="core"></div>
      </div>

      <div class="m2spice-fieldset">
        <h3>Core Model</h3>
        <div class="m2spice-grid m2spice-grid-3" data-llg-group="block">
          <div class="m2spice-field">
            <label for="m2spice-core-model">Ferrite Model</label>
            <select class="m2spice-input" id="m2spice-core-model" data-llg-mode>
              <option value="linear">Linear (M2Spice netlist)</option>
              <option value="llg">LLG-SPICE nonlinear (LTspice block)</option>
            </select>
            <span class="m2spice-unit">LLG-SPICE replaces both ferrite plates with Landau-Lifshitz-Gilbert cores</span>
          </div>
        </div>
      </div>

      <div data-llg-section hidden>
        <div class="m2spice-fieldset">
          <h3>Core Operating Point</h3>
          <div class="m2spice-grid m2spice-grid-3" data-llg-group="op"></div>
        </div>
      </div>

      <div class="m2spice-extract-row">
        <button class="m2spice-button is-primary" type="button" data-action="llg-extract" data-llg-only hidden title="Fit the LLG core to the MagNet loop" aria-label="Extract parameters">
          <i class="fa-solid fa-wave-square" aria-hidden="true"></i>
          <span>Extract Parameters</span>
        </button>
        <button class="m2spice-button is-primary" type="button" data-action="check" title="Check geometry" aria-label="Check geometry">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <span>Check</span>
        </button>
        <button class="m2spice-button is-primary" type="button" data-action="generate" title="Generate netlist" aria-label="Generate netlist">
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
      <div data-llg-only hidden>
        <div class="m2spice-fit-result" data-llg-fit-result hidden></div>
      </div>
    </form>

    <aside class="m2spice-side" aria-label="B-H loop preview and design guide">

      <figure class="m2spice-preview" data-llg-preview hidden>
        <h2>B-H Loop</h2>
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

      <figure class="m2spice-guide">
        <img src="/assets/img/m2spice/multiwinding.gif" alt="M2Spice multilayer winding geometry guide">
        <figcaption>Design guide for winding layer indices, spacing, and core geometry.</figcaption>
      </figure>
    </aside>
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
          <button class="m2spice-button" type="button" data-action="copy-netlist" title="Copy netlist" aria-label="Copy netlist">
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
        </div>
      </div>
      <div class="m2spice-tabs" role="tablist" aria-label="LTspice block files" data-llg-only hidden>
        <button class="m2spice-tab is-active" type="button" role="tab" aria-selected="true" data-action="llg-tab" data-llg-tab data-tab="lib">Library .lib</button>
        <button class="m2spice-tab" type="button" role="tab" aria-selected="false" data-action="llg-tab" data-llg-tab data-tab="asy">Symbol .asy</button>      </div>
      <div class="m2spice-symbol" data-llg-symbol hidden></div>
      <textarea class="m2spice-textarea" data-netlist spellcheck="false" aria-label="Generated SPICE netlist" readonly></textarea>
    </div>
  </section>
</div>
