(function () {
  const defaults = {
    duty: 0.4,
    phases: 4,
    turns: 1,
    dualRL: 1000000,
    dualRC: 200000,
    matrixLS: 0.000001,
    matrixLM: -0.0000001,
    transformerLl: 0.0000007,
    transformerLmu: 0.0000003
  };

  const fields = {
    duty: "coupmag-duty",
    phases: "coupmag-phases",
    turns: "coupmag-turns",
    dualRL: "coupmag-dual-rl",
    dualRC: "coupmag-dual-rc",
    matrixLS: "coupmag-matrix-ls",
    matrixLM: "coupmag-matrix-lm",
    transformerLl: "coupmag-transformer-ll",
    transformerLmu: "coupmag-transformer-lmu"
  };

  const outputMap = {
    boost: "boost",
    overlap: "overlap",
    compression: "compression",
    beta: "beta",
    alpha: "alpha",
    rho: "rho",
    dualRLValue: "dual.RL",
    dualRCValue: "dual.RC",
    dualLl: "dual.Ll",
    dualLmu: "dual.Lmu",
    dualLS: "dual.LS",
    dualLM: "dual.LM",
    dualLL: "dual.LL",
    dualLC: "dual.LC",
    dualLLStar: "dual.LLStar",
    dualLCStar: "dual.LCStar",
    dualLoss: "dual.Loss",
    dualLpss: "dual.Lpss",
    dualLotr: "dual.Lotr",
    dualLptr: "dual.Lptr",
    dualRippleRatio: "dual.rippleRatio",
    dualPhiL: "dual.phiL",
    dualPhiC: "dual.phiC",
    matrixRL: "matrix.RL",
    matrixRC: "matrix.RC",
    matrixLl: "matrix.Ll",
    matrixLmu: "matrix.Lmu",
    matrixLSValue: "matrix.LS",
    matrixLMValue: "matrix.LM",
    matrixLL: "matrix.LL",
    matrixLC: "matrix.LC",
    matrixLLStar: "matrix.LLStar",
    matrixLCStar: "matrix.LCStar",
    matrixLoss: "matrix.Loss",
    matrixLpss: "matrix.Lpss",
    matrixLotr: "matrix.Lotr",
    matrixLptr: "matrix.Lptr",
    matrixRippleRatio: "matrix.rippleRatio",
    matrixPhiL: "matrix.phiL",
    matrixPhiC: "matrix.phiC",
    transformerRL: "transformer.RL",
    transformerRC: "transformer.RC",
    transformerLlValue: "transformer.Ll",
    transformerLmuValue: "transformer.Lmu",
    transformerLS: "transformer.LS",
    transformerLM: "transformer.LM",
    transformerLL: "transformer.LL",
    transformerLC: "transformer.LC",
    transformerLLStar: "transformer.LLStar",
    transformerLCStar: "transformer.LCStar",
    transformerLoss: "transformer.Loss",
    transformerLpss: "transformer.Lpss",
    transformerLotr: "transformer.Lotr",
    transformerLptr: "transformer.Lptr",
    transformerRippleRatio: "transformer.rippleRatio",
    transformerPhiL: "transformer.phiL",
    transformerPhiC: "transformer.phiC"
  };

  const root = document.querySelector("[data-coupmag]");

  if (!root) {
    return;
  }

  const getInput = (key) => document.getElementById(fields[key]);
  const nearlyZero = (value) => Math.abs(value) < 1e-15;
  const square = (value) => value * value;

  function readNumber(key) {
    const input = getInput(key);
    const value = input ? Number(input.value) : NaN;
    return Number.isFinite(value) ? value : NaN;
  }

  function divide(numerator, denominator) {
    if (nearlyZero(denominator)) {
      if (nearlyZero(numerator)) {
        return NaN;
      }
      return numerator > 0 ? Infinity : -Infinity;
    }
    return numerator / denominator;
  }

  function formatNumber(value) {
    if (value === Infinity) {
      return "infinite";
    }

    if (value === -Infinity) {
      return "-infinite";
    }

    if (!Number.isFinite(value)) {
      return "--";
    }

    const absValue = Math.abs(value);

    if (absValue !== 0 && (absValue < 0.001 || absValue >= 100000)) {
      return value.toExponential(6);
    }

    return Number(value.toPrecision(7)).toString();
  }

  function setOutput(name, value) {
    root.querySelectorAll(`[data-output="${name}"]`).forEach((node) => {
      node.textContent = formatNumber(value);
    });
  }

  function setAllOutputs(values) {
    Object.entries(outputMap).forEach(([name, path]) => {
      const value = path.split(".").reduce((current, part) => {
        return current && Object.prototype.hasOwnProperty.call(current, part) ? current[part] : NaN;
      }, values);
      setOutput(name, value);
    });
  }

  function computeGlobal(values, warnings) {
    const { duty: D, phases: M, turns: N } = values;

    if (!(D > 0 && D < 1)) {
      warnings.push("Duty ratio must be between 0 and 1.");
    }

    if (!(M >= 2 && Number.isInteger(M))) {
      warnings.push("Number of phases must be an integer greater than 1.");
    }

    if (!(N > 0)) {
      warnings.push("Number of turns must be positive.");
    }

    const DM = D * M;
    const k = Math.floor(DM);
    const boost = divide((1 - D) * D * M, (DM - k) * (1 + k - DM));
    const compression = divide(1, boost);

    return { DM, k, boost, compression };
  }

  function computeDual(values, global) {
    const { duty: D, phases: M, turns: N, dualRL: RL, dualRC: RC } = values;
    const { k } = global;
    const beta = divide(RC, RL);
    const shared = RL + M * RC;
    const n2 = square(N);

    return {
      RL,
      RC,
      Ll: divide(n2, shared),
      Lmu: divide(n2 * (M - 1) * RC, RL * shared),
      LS: divide(n2 * (RL + (M - 1) * RC), RL * shared),
      LM: divide(-n2 * RC, RL * shared),
      LL: divide(1, RL),
      LC: divide(1, RC),
      LLStar: divide(n2 * (RL + (M - 1) * RC), RL * shared),
      LCStar: divide(n2, RL / M + RC),
      Loss: divide((1 - D) * D * M * n2, shared * (k + 1 - D * M) * (D * M - k)),
      Lpss: divide(
        n2 * (1 - D),
        -square(k) * RC / D / M - k * RC / D / M + 2 * k * RC - D * M * RC + RC - D * RL + RL
      ),
      Lotr: divide(n2, M * shared),
      Lptr: divide(n2, shared),
      rippleRatio: divide(
        -square(k) * beta / D / M - k * beta / D / M + 2 * k * beta - D * M * beta + beta - D + 1,
        (1 - D) * (1 + M * beta)
      ),
      phiL: divide(N, M * shared),
      phiC: divide(N, shared)
    };
  }

  function computeMatrix(values, global) {
    const { duty: D, phases: M, turns: N, matrixLS: LS, matrixLM: LM } = values;
    const { k } = global;
    const n2 = square(N);
    const alpha = divide(-LM, LS);
    const coefficient =
      (M - 2 * k - 2) +
      (k * (k + 1)) / (M * D) +
      (D * M * (M - 2 * k - 1) + k * (k + 1)) / (M * (1 - D));
    const RL = divide(n2, LS - LM);
    const RC = divide(-n2 * LM, (LS - LM) * (LS + (M - 1) * LM));
    const Ll = LS + (M - 1) * LM;

    return {
      RL,
      RC,
      Ll,
      Lmu: -(M - 1) * LM,
      LS,
      LM,
      LL: divide(1, RL),
      LC: divide(1, RC),
      LLStar: LS,
      LCStar: M * Ll,
      Loss: divide((1 - D) * D * M * Ll, (D * M - k) * (1 + k - D * M)),
      Lpss: divide((LS - LM) * Ll, LS + coefficient * LM),
      Lotr: divide(Ll, M),
      Lptr: Ll,
      rippleRatio: divide(1 - coefficient * alpha, 1 + alpha),
      phiL: divide(Ll, M * N),
      phiC: divide(Ll, N)
    };
  }

  function computeTransformer(values, global) {
    const { duty: D, phases: M, turns: N, transformerLl: Ll, transformerLmu: Lmu } = values;
    const { k } = global;
    const n2 = square(N);
    const rho = divide(Lmu, Ll);
    const shared = (M - 1) * Ll + M * Lmu;

    return {
      RL: divide(n2 * (M - 1), shared),
      RC: divide(n2 * Lmu, Ll * shared),
      Ll,
      Lmu,
      LS: Ll + Lmu,
      LM: divide(-Lmu, M - 1),
      LL: divide(1, divide(n2 * (M - 1), shared)),
      LC: divide(1, divide(n2 * Lmu, Ll * shared)),
      LLStar: Ll + Lmu,
      LCStar: M * Ll,
      Loss: divide((1 - D) * D * M * Ll, (D * M - k) * (1 + k - D * M)),
      Lpss: divide(
        D * M * Ll * (1 - D) * shared,
        D * M * (1 - D) * (M - 1) * Ll + (D * M * (1 - D * M) - square(k) - k + 2 * D * M * k) * Lmu
      ),
      Lotr: divide(Ll, M),
      Lptr: Ll,
      rippleRatio: divide(
        D * M * (1 - D) * (M - 1) + (D * M * (1 - D * M) - square(k) - k + 2 * D * M * k) * rho,
        D * M * (1 - D) * (M - 1 + M * rho)
      ),
      phiL: divide(Ll, M * N),
      phiC: divide(Ll, N)
    };
  }

  function update() {
    const values = Object.fromEntries(Object.keys(fields).map((key) => [key, readNumber(key)]));
    const warnings = [];
    const global = computeGlobal(values, warnings);

    const results = {
      boost: global.boost,
      overlap: global.k,
      compression: global.compression,
      beta: divide(values.dualRC, values.dualRL),
      alpha: divide(-values.matrixLM, values.matrixLS),
      rho: divide(values.transformerLmu, values.transformerLl),
      dual: computeDual(values, global),
      matrix: computeMatrix(values, global),
      transformer: computeTransformer(values, global)
    };

    setAllOutputs(results);

    const status = document.getElementById("coupmag-status");
    if (status) {
      status.textContent = warnings[0] || "";
    }
  }

  function loadValues(values) {
    Object.entries(values).forEach(([key, value]) => {
      const input = getInput(key);
      if (input) {
        input.value = value;
      }
    });
    update();
  }

  function clearValues() {
    Object.keys(fields).forEach((key) => {
      const input = getInput(key);
      if (input) {
        input.value = "";
      }
    });
    update();
  }

  root.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", update);
  });

  root.querySelector('[data-action="example"]')?.addEventListener("click", () => loadValues(defaults));
  root.querySelector('[data-action="clear"]')?.addEventListener("click", clearValues);

  root.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      root.querySelectorAll("[data-tab]").forEach((button) => {
        button.setAttribute("aria-selected", button === tab ? "true" : "false");
      });
      root.querySelectorAll("[data-panel]").forEach((panel) => {
        panel.hidden = panel.getAttribute("data-panel") !== target;
      });
    });
  });

  update();
})();
