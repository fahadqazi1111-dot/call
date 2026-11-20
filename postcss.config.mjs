import postcss from "postcss";

/**
 * CALL legacy compatibility pass.
 *
 * Runs AFTER @tailwindcss/postcss and rewrites CSS that older Android
 * WebViews / browsers cannot parse, so the exact same UI renders correctly
 * on older devices (no banner, no visual difference on modern browsers).
 *
 * Handled (all shapes verified against the real compiled output):
 *   1. lab()/lch()/oklab()/oklch() color literals   -> rgb()/rgba()
 *      (Lab-family colors need Chrome/WebView 111+; rgb() works everywhere)
 *   2. color-mix(in oklab, var(--x) N%, transparent) -> rgba(var(--x-rgb), a)
 *      + emits an `--x-rgb` companion next to every color custom property
 *      (color-mix() also needs Chrome/WebView 111+)
 *   3. translate:/scale:/rotate: properties          -> one universal
 *      transform: fallback wrapped in @supports not (translate: 0 0)
 *      (individual transform properties need Chrome/WebView 104+)
 *   4. dvh/svh/lvh viewport units                    -> vh fallbacks wrapped
 *      in @supports not (height: 1dvh) (dynamic viewport units need 108+)
 *
 * Left alone on purpose (they degrade gracefully and are non-critical):
 *   :has(), :where()/:is(), @property, text-wrap: balance.
 */

const UNIVERSAL_TRANSFORM =
  "translate(var(--tw-translate-x, 0), var(--tw-translate-y, 0)) scale(var(--tw-scale-x, 1), var(--tw-scale-y, 1)) rotate(var(--tw-rotate, 0deg))";

const round3 = (n) => String(Math.round(n * 1000) / 1000);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const srgbGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// OKLab (Björn Ottosson) -> linear sRGB
function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// CIE Lab (CSS lab(), D50 white) -> linear sRGB
function cieLabToLinearSrgb(L, a, b) {
  const kappa = 24389 / 27;
  const eps = 216 / 24389;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const fx3 = fx * fx * fx;
  const fy3 = fy * fy * fy;
  const fz3 = fz * fz * fz;
  const Xr = fx3 > eps ? fx3 : (116 * fx - 16) / kappa;
  const Yr = L > kappa * eps ? fy3 : L / kappa;
  const Zr = fz3 > eps ? fz3 : (116 * fz - 16) / kappa;
  // D50 reference white, then Bradford-adapt D50 -> D65
  const X = Xr * 0.9642956764295677;
  const Y = Yr * 1.0;
  const Z = Zr * 0.8251046025104602;
  const X65 = 1.0478112 * X + 0.0228866 * Y - 0.050127 * Z;
  const Y65 = -0.0295904 * X + 1.018892 * Y + 0.0069632 * Z;
  const Z65 = -0.009235 * X + 0.0150436 * Y + 0.9153554 * Z;
  return [
    3.2404542 * X65 - 1.5371385 * Y65 - 0.4985314 * Z65,
    -0.969266 * X65 + 1.8760108 * Y65 + 0.041556 * Z65,
    0.0556434 * X65 - 0.2040259 * Y65 + 1.0572252 * Z65,
  ];
}

function labFamilyToRgb(L, a, b, alpha, isOklab) {
  const lin = isOklab ? oklabToLinearSrgb(L, a, b) : cieLabToLinearSrgb(L, a, b);
  const [r, g, bl] = lin.map((c) => Math.round(clamp01(srgbGamma(c)) * 255));
  return alpha >= 1 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${round3(alpha)})`;
}

const NUM_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)%?$/;
const parseNum = (tok, pctScale) => {
  tok = tok.trim();
  if (!NUM_RE.test(tok)) return null;
  return tok.endsWith("%") ? (parseFloat(tok) / 100) * pctScale : parseFloat(tok);
};
const parseHue = (tok) => (/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(tok) ? parseFloat(tok) : null);

// "oklch" | "oklab" | "lab" | "lch" + raw args -> "rgb(r,g[b])"/"rgba(...)" or null
function colorFuncToRgb(fn, args) {
  const seg = args.split("/");
  const nums = seg[0].trim().split(/\s+/);
  if (nums.length !== 3) return null;
  let alpha = 1;
  if (seg.length > 1) {
    alpha = parseNum(seg[1], 1);
    if (alpha === null) return null;
  }
  if (fn === "oklch") {
    const L = parseNum(nums[0], 1);
    const C = parseNum(nums[1], 0.4);
    const H = parseHue(nums[2]);
    if (L === null || C === null || H === null) return null;
    const rad = (H * Math.PI) / 180;
    return labFamilyToRgb(L, C * Math.cos(rad), C * Math.sin(rad), alpha, true);
  }
  if (fn === "lch") {
    const L = parseNum(nums[0], 100);
    const C = parseNum(nums[1], 150);
    const H = parseHue(nums[2]);
    if (L === null || C === null || H === null) return null;
    const rad = (H * Math.PI) / 180;
    return labFamilyToRgb(L, C * Math.cos(rad), C * Math.sin(rad), alpha, false);
  }
  if (fn === "oklab") {
    const L = parseNum(nums[0], 1);
    const A = parseNum(nums[1], 0.4);
    const B = parseNum(nums[2], 0.4);
    if (L === null || A === null || B === null) return null;
    return labFamilyToRgb(L, A, B, alpha, true);
  }
  if (fn === "lab") {
    const L = parseNum(nums[0], 100);
    const A = parseNum(nums[1], 125);
    const B = parseNum(nums[2], 125);
    if (L === null || A === null || B === null) return null;
    return labFamilyToRgb(L, A, B, alpha, false);
  }
  return null;
}

// Any already-parseable-by-everyone color (hex / rgb() / rgba()) -> "r,g,b"
function colorToTriplet(v) {
  const s = v.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
  }
  const m = s.match(/^rgba?\(([^()]*)\)$/i);
  if (m) {
    const ps = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map((t) => (t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t)));
    if (ps.length >= 3 && ps.slice(0, 3).every((n) => Number.isFinite(n))) {
      return `${Math.round(ps[0])},${Math.round(ps[1])},${Math.round(ps[2])}`;
    }
  }
  return null;
}

function legacyCompat() {
  return {
    postcssPlugin: "call-legacy-compat",
    RootExit(root) {
      // PostCSS re-runs root-modifying sync plugins until a pass makes no
      // changes — every append below MUST be idempotent or compilation hangs.
      const ourBlockExists = (params) =>
        (root.nodes || []).some(
          (n) => n.type === "atrule" && n.params === params && !n.source
        );
      const inKeyframes = (node) => {
        let p = node && node.parent;
        while (p) {
          if (p.type === "atrule" && /-?keyframes$/.test(p.name || "")) return true;
          p = p.parent;
        }
        return false;
      };
      const mediaChain = (node) => {
        const chain = [];
        let p = node && node.parent;
        while (p) {
          if (p.type === "atrule" && p.name === "media") chain.push(p.params);
          p = p.parent;
        }
        return chain.reverse();
      };

      // ---------- pass 1: Lab-family color literals -> rgb()/rgba() ----------
      root.walkDecls((decl) => {
        if (!/(oklch|oklab|lab|lch)\(/i.test(decl.value)) return;
        decl.value = decl.value.replace(
          /\b(oklch|oklab|lab|lch)\(\s*([^()]*)\)/gi,
          (m, fn, args) => colorFuncToRgb(fn.toLowerCase(), args) || m
        );
      });

      // ---------- pass 2: collect color custom props, add -rgb companions ----------
      const rgbTriple = new Map(); // var name -> "r,g,b"
      const alias = new Map(); // var name -> referenced var name
      const colorDecls = []; // { rule, decl } for literal colors
      const aliasDecls = []; // { rule, decl } for var() aliases
      root.walkDecls((decl) => {
        const prop = decl.prop;
        if (!prop.startsWith("--") || prop.endsWith("-rgb")) return;
        if (inKeyframes(decl)) return;
        const t = colorToTriplet(decl.value);
        if (t) {
          rgbTriple.set(prop, t);
          colorDecls.push({ rule: decl.parent, decl });
          return;
        }
        const m = decl.value.trim().match(/^var\(\s*(--[\w-]+)\s*\)$/);
        if (m) {
          alias.set(prop, m[1]);
          aliasDecls.push({ rule: decl.parent, decl });
        }
      });
      const aliasRoot = (name, seen = new Set()) => {
        if (rgbTriple.has(name)) return name;
        const tgt = alias.get(name);
        if (!tgt || seen.has(name)) return null;
        seen.add(name);
        return aliasRoot(tgt, seen);
      };
      for (const { rule, decl } of colorDecls) {
        if (rule.some((n) => n.type === "decl" && n.prop === `${decl.prop}-rgb`)) continue;
        rule.insertAfter(decl, decl.clone({ prop: `${decl.prop}-rgb`, value: rgbTriple.get(decl.prop) }));
      }
      for (const { rule, decl } of aliasDecls) {
        const rootName = aliasRoot(decl.prop);
        if (!rootName) continue;
        if (rule.some((n) => n.type === "decl" && n.prop === `${decl.prop}-rgb`)) continue;
        rule.insertAfter(decl, decl.clone({ prop: `${decl.prop}-rgb`, value: `var(${rootName}-rgb)` }));
      }
      const hasRgb = new Set();
      for (const n of rgbTriple.keys()) hasRgb.add(n);
      for (const n of alias.keys()) if (aliasRoot(n)) hasRgb.add(n);

      // ---------- pass 3: color-mix() -> rgba()/rgb() fallbacks ----------
      root.walkDecls((decl) => {
        if (!decl.value.includes("color-mix(")) return;
        let v = decl.value;
        // color-mix(in oklab, var(--x) 50%, transparent) -> rgba(var(--x-rgb), .5)
        v = v.replace(
          /color-mix\(\s*in\s+[\w-]+\s*,\s*var\(\s*(--[\w-]+)\s*\)\s+([\d.]+)%\s*,\s*transparent\s*\)/gi,
          (m, name, pct) =>
            hasRgb.has(name) ? `rgba(var(${name}-rgb), ${round3(parseFloat(pct) / 100)})` : m
        );
        // color-mix(in oklab, var(--a), var(--b)) -> rgb(var(--a-rgb))
        v = v.replace(
          /color-mix\(\s*in\s+[\w-]+\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*,\s*var\(\s*(--[\w-]+)\s*\)\s*\)/gi,
          (m, n1) => (hasRgb.has(n1) ? `rgb(var(${n1}-rgb))` : m)
        );
        // color-mix(in oklab, #f00 50%, transparent) -> rgba(255,0,0,.5)
        v = v.replace(
          /color-mix\(\s*in\s+[\w-]+\s*,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))\s+([\d.]+)%\s*,\s*transparent\s*\)/gi,
          (m, lit, pct) => {
            const t = colorToTriplet(lit);
            return t ? `rgba(${t}, ${round3(parseFloat(pct) / 100)})` : m;
          }
        );
        decl.value = v;
      });

      // ---------- pass 4: translate/scale/rotate props -> universal transform ----------
      const tEntries = new Map(); // key -> { selector, media, extras[] }
      root.walkRules((rule) => {
        if (inKeyframes(rule)) return;
        const decls = (rule.nodes || []).filter((n) => n.type === "decl");
        const t = decls.find((d) => d.prop === "translate");
        const s = decls.find((d) => d.prop === "scale");
        const r = decls.find((d) => d.prop === "rotate");
        if (!t && !s && !r) return;
        const extras = [];
        const addVarExtras = (val, xName, yName) => {
          if (/\bvar\(/.test(val)) return; // original rule already sets the vars
          const parts = val.trim().split(/\s+/);
          extras.push({ prop: xName, value: parts[0] });
          if (yName) extras.push({ prop: yName, value: parts[1] || parts[0] });
        };
        if (t) addVarExtras(t.value, "--tw-translate-x", "--tw-translate-y");
        if (s) addVarExtras(s.value, "--tw-scale-x", "--tw-scale-y");
        if (r && !/\bvar\(/.test(r.value)) extras.push({ prop: "--tw-rotate", value: r.value.trim() });
        const media = mediaChain(rule);
        const key = `${rule.selector}@@${media.join("|")}@@${extras.map((e) => e.prop + ":" + e.value).join(",")}`;
        if (!tEntries.has(key)) tEntries.set(key, { selector: rule.selector, media, extras });
      });
      if (tEntries.size && !ourBlockExists("not (translate: 0 0)")) {
        const sup = postcss.atRule({ name: "supports", params: "not (translate: 0 0)" });
        const byMedia = new Map();
        for (const e of tEntries.values()) {
          const k = e.media.join(" && ");
          if (!byMedia.has(k)) byMedia.set(k, []);
          byMedia.get(k).push(e);
        }
        for (const [k, entries] of byMedia) {
          let parent = sup;
          if (k) {
            const mediaRule = postcss.atRule({ name: "media", params: k });
            sup.append(mediaRule);
            parent = mediaRule;
          }
          for (const e of entries) {
            const r = postcss.rule({ selector: e.selector });
            for (const ex of e.extras) r.append(postcss.decl({ prop: ex.prop, value: ex.value }));
            r.append(postcss.decl({ prop: "transform", value: UNIVERSAL_TRANSFORM }));
            parent.append(r);
          }
        }
        root.append(sup);
      }

      // ---------- pass 5: dvh/svh/lvh -> vh fallbacks ----------
      const dEntries = new Map(); // key -> { selector, media, prop, value }
      root.walkDecls((decl) => {
        if (
          !decl.value.includes("dvh") &&
          !decl.value.includes("svh") &&
          !decl.value.includes("lvh")
        )
          return;
        if (!/^(min-|max-)?(height|width)$/.test(decl.prop)) return;
        if (inKeyframes(decl)) return;
        const rule = decl.parent;
        if (!rule || rule.type !== "rule") return;
        const media = mediaChain(decl);
        const key = `${rule.selector}@@${media.join("|")}@@${decl.prop}`;
        if (!dEntries.has(key)) {
          dEntries.set(key, {
            selector: rule.selector,
            media,
            prop: decl.prop,
            value: decl.value.replace(/(dvh|svh|lvh)/g, "vh"),
          });
        }
      });
      if (dEntries.size && !ourBlockExists("not (height: 1dvh)")) {
        const sup = postcss.atRule({ name: "supports", params: "not (height: 1dvh)" });
        const byMedia = new Map();
        for (const e of dEntries.values()) {
          const k = e.media.join(" && ");
          if (!byMedia.has(k)) byMedia.set(k, []);
          byMedia.get(k).push(e);
        }
        for (const [k, entries] of byMedia) {
          let parent = sup;
          if (k) {
            const mediaRule = postcss.atRule({ name: "media", params: k });
            sup.append(mediaRule);
            parent = mediaRule;
          }
          for (const e of entries) {
            const r = postcss.rule({ selector: e.selector });
            r.append(postcss.decl({ prop: e.prop, value: e.value }));
            parent.append(r);
          }
        }
        root.append(sup);
      }
    },
  };
}
legacyCompat.postcss = true;

const config = {
  plugins: ["@tailwindcss/postcss", legacyCompat],
};

export default config;
