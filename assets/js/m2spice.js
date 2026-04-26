(function (root) {
  "use strict";

  const fieldGroups = {
    operating: [
      { key: "f", label: "Analysis Frequency (f)", unit: "Hz" },
      { key: "mur", label: "Relative Permeability of the Core (mur)", unit: "1" },
      { key: "x", label: "Name of the Component (x)", unit: "blank, or one word" }
    ],
    layers: [
      { key: "nlayer", label: "Total Number of Layers (nlayer)", unit: "1" },
      { key: "h", label: "Layer Thickness (h)", unit: "meters" },
      { key: "sigmac", label: "Layer Conductivities (sigmac)", unit: "S/m" },
      { key: "s", label: "Spacing Thickness (s)", unit: "meters" },
      { key: "mus", label: "Spacing Permeabilities (mus)", unit: "H/m" },
      { key: "w", label: "Core Window Width (w)", unit: "meters" },
      { key: "m", label: "Number of Turns on Each Layer (m)", unit: "1" }
    ],
    core: [
      { key: "nwinding", label: "Number of Windings (nwinding)", unit: "1" },
      { key: "wstyle", label: "Connection Style of Each Winding (wstyle)", unit: "0=series, 1=parallel" },
      { key: "lindex", label: "Belongings of Each Layer to Windings (lindex)", unit: "winding index" },
      { key: "gt", label: "Core Gap Length on the Top Side (gt)", unit: "meters" },
      { key: "gb", label: "Core Gap Length on the Bottom Side (gb)", unit: "meters" },
      { key: "Ac", label: "Effective Core Area (Ac)", unit: "meter^2" },
      { key: "d", label: "Effective Winding Length per Turn (d)", unit: "meters" },
      { key: "c", label: "Thickness of the Top and Bottom Core (c)", unit: "meters" }
    ]
  };

  const fieldOrder = [
    "f",
    "mur",
    "nlayer",
    "h",
    "sigmac",
    "s",
    "mus",
    "w",
    "m",
    "nwinding",
    "wstyle",
    "lindex",
    "gt",
    "gb",
    "Ac",
    "d",
    "c",
    "x"
  ];

  const exampleGeometry = {
    f: "800000",
    mur: "1000",
    nlayer: "10",
    h: "[0.071e-3,0.071e-3,0.071e-3,0.071e-3,0.071e-3,0.071e-3,0.071e-3,0.071e-3,0.071e-3,0.071e-3]",
    sigmac: "[5.8e7,5.8e7,5.8e7,5.8e7,5.8e7,5.8e7,5.8e7,5.8e7,5.8e7,5.8e7]",
    s: "[0.2e-3,0.2e-3,0.12e-3,0.10e-3,0.14e-3,0.10e-3,0.14e-3,0.10e-3,0.12e-3,0.2e-3,0.2e-3]",
    mus: "[1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6,1.2e-6]",
    w: "[3e-3,3e-3,3e-3,3e-3,3e-3,3e-3,3e-3,3e-3,3e-3,3e-3]",
    m: "[1,2,2,1,1,1,1,2,2,1]",
    nwinding: "3",
    wstyle: "[0,1,0]",
    lindex: "[2,1,1,2,2,2,2,3,3,2]",
    gt: "0.33e-4",
    gb: "0.33e-4",
    Ac: "19.9e-6",
    d: "17.5e-3",
    c: "1.1e-3",
    x: "example"
  };

  const mu0 = 4 * Math.PI * 1e-7;

  function complex(re, im) {
    return { re, im };
  }

  function cAdd(a, b) {
    return complex(a.re + b.re, a.im + b.im);
  }

  function cSub(a, b) {
    return complex(a.re - b.re, a.im - b.im);
  }

  function cMul(a, b) {
    return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }

  function cScale(a, scalar) {
    return complex(a.re * scalar, a.im * scalar);
  }

  function cDiv(a, b) {
    const denominator = b.re * b.re + b.im * b.im;
    return complex((a.re * b.re + a.im * b.im) / denominator, (a.im * b.re - a.re * b.im) / denominator);
  }

  function cExp(a) {
    const magnitude = Math.exp(a.re);
    return complex(magnitude * Math.cos(a.im), magnitude * Math.sin(a.im));
  }

  function parseScalar(raw, label, errors) {
    const value = Number(String(raw).trim());
    if (!Number.isFinite(value)) {
      errors.push(`invalid ${label}, please enter a number.`);
      return NaN;
    }
    return value;
  }

  function parseInteger(raw, label, errors) {
    const value = Number(String(raw).trim());
    if (!Number.isInteger(value)) {
      errors.push(`invalid ${label}, please enter an integer.`);
      return NaN;
    }
    return value;
  }

  function parseList(raw, label, integerOnly, errors) {
    const source = String(raw).trim();
    if (!source.startsWith("[") || !source.endsWith("]")) {
      errors.push(`invalid ${label}, please enter values in brackets.`);
      return [];
    }

    const body = source.slice(1, -1).trim();
    if (!body) {
      return [];
    }

    return body.split(",").map((entry) => {
      const value = Number(entry.trim());
      if (!Number.isFinite(value) || (integerOnly && !Number.isInteger(value))) {
        errors.push(`invalid ${label}, please enter ${integerOnly ? "integer" : "numeric"} values.`);
        return NaN;
      }
      return value;
    });
  }

  function sanitizeComponentName(name) {
    const clean = String(name || "").replace(/[\r\n\s]/g, "");
    return clean ? `_${clean}` : "";
  }

  function readGeometry(raw, options) {
    const errors = [];
    const data = {
      f: parseScalar(raw.f, "analysis frequency (f)", errors),
      mur: parseScalar(raw.mur, "relative permeability (mur)", errors),
      nlayer: parseInteger(raw.nlayer, "total number of layers (nlayer)", errors),
      h: parseList(raw.h, "layer thickness (h)", false, errors),
      sigmac: parseList(raw.sigmac, "layer conductivity (sigmac)", false, errors),
      s: parseList(raw.s, "spacing thickness (s)", false, errors),
      mus: parseList(raw.mus, "spacing permeability (mus)", false, errors),
      w: parseList(raw.w, "core window width (w)", false, errors),
      m: parseList(raw.m, "turns on each layer (m)", true, errors),
      nwinding: parseInteger(raw.nwinding, "number of windings (nwinding)", errors),
      wstyle: parseList(raw.wstyle, "winding style (wstyle)", true, errors),
      lindex: parseList(raw.lindex, "layer belongings (lindex)", true, errors),
      gt: parseScalar(raw.gt, "top gap length (gt)", errors),
      gb: parseScalar(raw.gb, "bottom gap length (gb)", errors),
      Ac: parseScalar(raw.Ac, "effective core area (Ac)", errors),
      d: parseScalar(raw.d, "effective winding length (d)", errors),
      c: parseScalar(raw.c, "top and bottom core thickness (c)", errors),
      x: String(raw.x || "")
    };

    if (!errors.length) {
      validateGeometry(data, errors);
    }

    if (errors.length && (!options || !options.allowErrors)) {
      const error = new Error(errors.join("\n"));
      error.errors = errors;
      throw error;
    }

    return { data, errors };
  }

  function validateGeometry(data, errors) {
    if (!(data.f > 0)) errors.push("analysis frequency (f) must be positive.");
    if (!(data.mur > 0)) errors.push("relative permeability (mur) must be positive.");
    if (!(data.nlayer > 0)) errors.push("total number of layers (nlayer) must be positive.");
    if (!(data.nwinding > 0)) errors.push("number of windings (nwinding) must be positive.");
    if (!(data.Ac > 0)) errors.push("effective core area (Ac) must be positive.");
    if (!(data.d > 0)) errors.push("effective winding length (d) must be positive.");
    if (!(data.c > 0)) errors.push("top and bottom core thickness (c) must be positive.");

    if (data.nlayer !== data.h.length) errors.push("_nlayer_ mismatch with _h_.");
    if (data.nlayer !== data.sigmac.length) errors.push("_nlayer_ mismatch with _sigmac_.");
    if (data.nlayer !== data.s.length - 1) errors.push("_nlayer_ mismatch with _s_; spacing has one more value than conductive layers.");
    if (data.nlayer !== data.mus.length - 1) errors.push("_nlayer_ mismatch with _mus_; spacing permeability has one more value than conductive layers.");
    if (data.nlayer !== data.w.length) errors.push("_nlayer_ mismatch with _w_.");
    if (data.nlayer !== data.lindex.length) errors.push("_nlayer_ mismatch with _lindex_.");
    if (data.nlayer !== data.m.length) errors.push("_nlayer_ mismatch with _m_.");
    if (data.nwinding !== data.wstyle.length) errors.push("_nwinding_ mismatch with _wstyle_.");
    if (data.lindex.length && data.nwinding !== Math.max(...data.lindex)) errors.push("_nwinding_ mismatch with _lindex_.");

    if (data.h.some((value) => !(value > 0))) errors.push("all layer thickness values (h) must be positive.");
    if (data.sigmac.some((value) => !(value > 0))) errors.push("all layer conductivity values (sigmac) must be positive.");
    if (data.s.some((value) => value < 0)) errors.push("all spacing values (s) must be nonnegative.");
    if (data.mus.some((value) => !(value > 0))) errors.push("all spacing permeability values (mus) must be positive.");
    if (data.w.some((value) => !(value > 0))) errors.push("all core window width values (w) must be positive.");
    if (data.m.some((value) => !(value > 0))) errors.push("all turn values (m) must be positive integers.");
    if (data.wstyle.some((value) => value !== 0 && value !== 1)) errors.push("winding style (wstyle) values must be 0 or 1.");
    if (data.lindex.some((value) => value < 1 || value > data.nwinding)) errors.push("layer belonging (lindex) values must map to existing windings.");

    for (let winding = 1; winding <= data.nwinding; winding += 1) {
      if (!data.lindex.includes(winding)) {
        errors.push(`winding ${winding} has no assigned layers.`);
      }
    }
  }

  function calculateImpedances(data) {
    const omega = data.f * 2 * Math.PI;
    const ra = [];
    const la = [];
    const rb = [];
    const lb = [];
    const ls = [];
    let lastIndex = 0;

    for (let i = 0; i < data.nlayer; i += 1) {
      lastIndex = i;
      const delta = Math.sqrt(2 / omega / data.mus[i] / data.sigmac[i]);
      const psi = complex(1 / delta, 1 / delta);
      const z = cScale(psi, 1 / data.sigmac[i]);
      const a = cExp(cScale(psi, -data.h[i]));
      const za = cMul(z, cDiv(cSub(complex(1, 0), a), cAdd(complex(1, 0), a)));
      const zb = cMul(z, cDiv(cScale(a, 2), cSub(complex(1, 0), cMul(a, a))));
      const xa = cScale(za, data.d / data.w[i]);
      const xb = cScale(zb, data.d / data.w[i]);

      ra.push(xa.re);
      la.push(xa.im / omega);
      rb.push(xb.re);
      lb.push(xb.im / omega);
      ls.push(data.mus[i + 1] * data.s[i + 1] * data.d / data.w[i]);
    }

    const ferriteDenominatorBottom = data.gb + (data.Ac * data.w[lastIndex]) / (data.mur * data.c * data.d);
    const ferriteDenominatorTop = data.gt + (data.Ac * data.w[lastIndex]) / (data.mur * data.c * data.d);

    return {
      ra,
      la,
      rb,
      lb,
      ls,
      lfb: (mu0 * data.Ac) / ferriteDenominatorBottom,
      lft: (mu0 * data.Ac) / ferriteDenominatorTop,
      lts: data.mus[0] * data.s[0] * data.d / data.w[lastIndex]
    };
  }

  function fixed(value, digits) {
    return Number(value).toFixed(digits);
  }

  function windingConnectionName(style) {
    return style === 1 ? "Parallel" : "Series";
  }

  function generateNetlist(data, options) {
    const impedance = calculateImpedances(data);
    const component = sanitizeComponentName(data.x);
    const now = options && options.date ? options.date : new Date();
    const dateText = typeof now === "string" ? now : now.toLocaleString();
    const generatedBy = options && options.user ? options.user : "M2Spice web tool";
    const lines = [];

    lines.push("");
    lines.push("******************************************************************");
    lines.push(`*****        ${dateText} by ${generatedBy}          *****`);
    lines.push("******************************************************************");
    lines.push("");
    lines.push("******************************************************************");
    lines.push("******* Comprehensive  Summary of the Magnetic Structure  ********");
    lines.push("******* Please double check the geometry information and  ********");
    lines.push("**** use the external Port Name to interface with your circuit ***");
    lines.push("******************************************************************");
    lines.push("");
    lines.push(`* The name of the component is: ${component}.`);
    lines.push("");
    lines.push(`* This planar structure has ${data.nwinding} windings and ${data.nlayer} layers.`);
    lines.push("");
    lines.push(`* This netlist is generated for ${data.f} Hz operation.`);

    for (let windingIndex = 0; windingIndex < data.nwinding; windingIndex += 1) {
      const style = data.wstyle[windingIndex];
      lines.push("");
      lines.push(`* >>>> Winding ${windingIndex + 1} >>>> `);
      lines.push(`* ${style === 0 ? " " : ""}-> All layers in winding ${windingIndex + 1} are ${windingConnectionName(style)} Connected; `);
      lines.push(`* -> Its external Port Name: PortP${windingIndex + 1}${component}, PortN${windingIndex + 1}${component}`);

      let totalTurn = 0;
      for (let layerIndex = 0; layerIndex < data.nlayer; layerIndex += 1) {
        if (data.lindex[layerIndex] === windingIndex + 1) {
          lines.push(`* --> Includes Layer ${layerIndex + 1}`);
          lines.push(`* ---> h ${fixed(data.h[layerIndex] * 1e6, 2)}um, w ${fixed(data.w[layerIndex] * 1e3, 2)}mm, turns ${data.m[layerIndex]}, s above ${fixed(data.s[layerIndex] * 1e3, 2)}mm, s below ${fixed(data.s[layerIndex + 1] * 1e3, 2)}mm`);
          totalTurn += data.m[layerIndex];
        }
      }
      lines.push(`* -> Winding ${windingIndex + 1} has ${totalTurn} total turns;`);
    }

    lines.push("******************************************************************");
    lines.push("");
    lines.push("******************************************************************");
    lines.push("*****                   Netlist Starts                    ********");
    lines.push("******************************************************************");

    for (let index = 0; index < data.nlayer; index += 1) {
      lines.push("");
      lines.push(`*NetList for Layer ${index + 1}`);
      lines.push(`Le${index + 1}${component} N${index + 1}${component} P${index + 1}${component} ${data.m[index] ** 2} Rser=1f`);
      lines.push(`Li${index + 1}${component} G${component} Md${index + 1}${component} 1 Rser=1f`);
      lines.push(`Lg${index + 1}${component} Mg${index + 1}${component} Md${index + 1}${component} ${fixed(impedance.lb[index] * 1e12, 2)}p Rser=1f`);
      lines.push(`Rg${index + 1}${component} Mc${index + 1}${component} Mg${index + 1}${component} ${fixed(impedance.rb[index] * 1e6, 2)}u`);
      lines.push(`Rt${index + 1}${component} Mc${index + 1}${component} Mt${index + 1}${component} ${fixed(impedance.ra[index] * 1e6, 2)}u`);
      lines.push(`Rb${index + 1}${component} Mb${index + 1}${component} Mc${index + 1}${component} ${fixed(impedance.ra[index] * 1e6, 2)}u`);
      lines.push(`Lt${index + 1}${component} T${index + 1}${component} Mt${index + 1}${component} ${fixed(impedance.la[index] * 1e12, 2)}p Rser=1f`);
      lines.push(`Lb${index + 1}${component} Mb${index + 1}${component} B${index + 1}${component} ${fixed(impedance.la[index] * 1e12, 2)}p Rser=1f`);
      lines.push(`Ls${index + 1}${component} B${index + 1}${component} T${index + 2}${component} ${fixed(impedance.ls[index] * 1e9, 2)}n  Rser=1f`);
      lines.push(`K${index + 1}${component} Le${index + 1}${component} Li${index + 1}${component} 1`);
    }

    lines.push("");
    lines.push("*NetList for Top and Bottom Ferrites, as well as the First Spacing on Top Side");
    lines.push(`Lft${component} T0${component} G${component} ${fixed(impedance.lft * 1e9, 2)}n Rser=1f`);
    lines.push(`Lfb${component} T${data.nlayer + 1}${component} G${component} ${fixed(impedance.lfb * 1e9, 2)}n Rser=1f`);
    lines.push(`Ls0${component} T1${component} T0${component} ${fixed(impedance.lts * 1e9, 2)}n Rser=1f`);
    lines.push("");
    lines.push("*NetList for Winding Interconnects");
    lines.push("*A few 1f ohm resistors are used as short interconnects");

    for (let windingIndex = 0; windingIndex < data.nwinding; windingIndex += 1) {
      const style = data.wstyle[windingIndex];
      lines.push("");
      lines.push(`* -> Winding ${windingIndex + 1} is ${windingConnectionName(style)} Connected`);

      if (style === 1) {
        for (let layerIndex = 0; layerIndex < data.nlayer; layerIndex += 1) {
          if (data.lindex[layerIndex] === windingIndex + 1) {
            lines.push(`* -->Include layer ${layerIndex + 1}`);
            lines.push(`RexP${layerIndex + 1}${component} PortP${windingIndex + 1}${component} P${layerIndex + 1}${component}    1f`);
            lines.push(`RexN${layerIndex + 1}${component} PortN${windingIndex + 1}${component} N${layerIndex + 1}${component}    1f`);
          }
        }
      } else {
        const seriesLayers = [];
        for (let layerIndex = 0; layerIndex < data.nlayer; layerIndex += 1) {
          if (data.lindex[layerIndex] === windingIndex + 1) {
            lines.push(`* -->Include layer ${layerIndex + 1}`);
            seriesLayers.push(layerIndex + 1);
          }
        }
        lines.push(`RexP${seriesLayers[0]}${component} PortP${windingIndex + 1}${component} P${seriesLayers[0]}${component}    1f`);
        lines.push(`RexN${seriesLayers[seriesLayers.length - 1]}${component} PortN${windingIndex + 1}${component} N${seriesLayers[seriesLayers.length - 1]}${component}    1f`);
        for (let index = 0; index < seriesLayers.length - 1; index += 1) {
          lines.push(`RexM${seriesLayers[index]}${component} N${seriesLayers[index]}${component} P${seriesLayers[index + 1]}${component}      1f`);
        }
      }
    }

    lines.push("");
    lines.push("*One 1G ohm resistor is used to ground the floating domain");
    lines.push(`Rgnd${component} G${component} 0  1G`);
    lines.push("");
    lines.push("");
    lines.push("******************************************************************");
    lines.push("*****                   Netlist Ends                      ********");
    lines.push("******************************************************************");

    return lines.join("\n");
  }

  function geometryToText(values) {
    return fieldOrder.map((key) => `${key} = ${values[key] || ""}`).join("\n");
  }

  function parseGeometryText(text) {
    const parsed = {};
    String(text).split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && fieldOrder.includes(match[1])) {
        parsed[match[1]] = match[2];
      }
    });
    return parsed;
  }

  function initDom() {
    const page = root.document && root.document.querySelector("[data-m2spice]");
    if (!page) return;

    const status = page.querySelector("[data-status]");
    const geometryText = page.querySelector("[data-geometry-text]");
    const netlist = page.querySelector("[data-netlist]");

    function setStatus(message, type) {
      status.textContent = message;
      status.classList.toggle("is-good", type === "good");
      status.classList.toggle("is-error", type === "error");
    }

    function createFields() {
      Object.entries(fieldGroups).forEach(([group, fields]) => {
        const container = page.querySelector(`[data-field-group="${group}"]`);
        if (!container) return;

        fields.forEach((field) => {
          const wrap = root.document.createElement("div");
          const id = `m2spice-${field.key}`;
          wrap.className = "m2spice-field";
          wrap.innerHTML = [
            `<label for="${id}">${field.label}</label>`,
            `<input class="m2spice-input" id="${id}" name="${field.key}" data-field="${field.key}" autocomplete="off">`,
            `<span class="m2spice-unit">${field.unit}</span>`
          ].join("");
          container.appendChild(wrap);
        });
      });
    }

    function getInputs() {
      return Array.from(page.querySelectorAll("[data-field]"));
    }

    function readForm() {
      return getInputs().reduce((values, input) => {
        values[input.dataset.field] = input.value.trim();
        return values;
      }, {});
    }

    function fillForm(values) {
      getInputs().forEach((input) => {
        input.value = values[input.dataset.field] || "";
      });
    }

    function syncGeometryText() {
      geometryText.value = geometryToText(readForm());
    }

    function checkGeometry() {
      const raw = readForm();
      const result = readGeometry(raw, { allowErrors: true });
      syncGeometryText();
      if (result.errors.length) {
        setStatus(`Find ${result.errors.length} geometry error${result.errors.length === 1 ? "" : "s"}:\n${result.errors.join("\n")}`, "error");
        return false;
      }

      setStatus("Geometry is correct. Generate the netlist when ready.", "good");
      return true;
    }

    function generateFromForm() {
      const raw = readForm();
      const result = readGeometry(raw, { allowErrors: true });
      syncGeometryText();
      if (result.errors.length) {
        setStatus(`Find ${result.errors.length} geometry error${result.errors.length === 1 ? "" : "s"}:\n${result.errors.join("\n")}`, "error");
        return;
      }

      netlist.value = generateNetlist(result.data);
      setStatus("Netlist generated successfully.", "good");
    }

    function applyGeometryText() {
      const parsed = parseGeometryText(geometryText.value);
      fillForm(Object.assign({}, readForm(), parsed));
      checkGeometry();
    }

    function loadExample() {
      fillForm(exampleGeometry);
      syncGeometryText();
      netlist.value = "";
      setStatus("Example geometry loaded.", "good");
    }

    function clearAll() {
      fillForm({});
      geometryText.value = "";
      netlist.value = "";
      setStatus("Geometry cleared.", "");
    }

    function downloadNetlist() {
      if (!netlist.value.trim()) {
        setStatus("Generate a netlist before downloading.", "error");
        return;
      }

      const result = readGeometry(readForm(), { allowErrors: true });
      const component = sanitizeComponentName(result.data.x).replace(/^_/, "") || "m2spice";
      const blob = new Blob([netlist.value], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = root.document.createElement("a");
      link.href = url;
      link.download = `${component}-netlist.txt`;
      root.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("Netlist download started.", "good");
    }

    async function copyNetlist() {
      if (!netlist.value.trim()) {
        setStatus("Generate a netlist before copying.", "error");
        return;
      }

      if (root.navigator && root.navigator.clipboard) {
        await root.navigator.clipboard.writeText(netlist.value);
      } else {
        netlist.removeAttribute("readonly");
        netlist.select();
        root.document.execCommand("copy");
        netlist.setAttribute("readonly", "");
      }
      setStatus("Netlist copied.", "good");
    }

    createFields();
    fillForm(exampleGeometry);
    syncGeometryText();

    page.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      if (action === "example") loadExample();
      if (action === "clear") clearAll();
      if (action === "check") checkGeometry();
      if (action === "generate") generateFromForm();
      if (action === "sync-geometry") syncGeometryText();
      if (action === "apply-geometry") applyGeometryText();
      if (action === "download-netlist") downloadNetlist();
      if (action === "copy-netlist") {
        copyNetlist().catch(() => setStatus("Unable to copy the netlist in this browser.", "error"));
      }
    });
  }

  const api = {
    exampleGeometry,
    parseGeometryText,
    geometryToText,
    readGeometry,
    calculateImpedances,
    generateNetlist
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.M2Spice = api;

  if (root.document) {
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", initDom);
    } else {
      initDom();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
