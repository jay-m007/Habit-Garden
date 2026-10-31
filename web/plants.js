// Draws each plant as SVG from a few numbers. Only presentation attributes are used (no CSS), so the same
// drawing can be turned into a picture for the share image.
const NS = "http://www.w3.org/2000/svg";
const BASE_X = 60, BASE_Y = 102; // where the stem leaves the soil

export const POT_COLORS = [
  { body: "#d8805f", rim: "#e89a7b", shade: "#b9674a" },
  { body: "#e2a64f", rim: "#efbd70", shade: "#c28a37" },
  { body: "#7fb7a4", rim: "#98cdba", shade: "#639b88" },
  { body: "#a596d6", rim: "#bbaee6", shade: "#8779bd" },
  { body: "#e58aa0", rim: "#f0a3b6", shade: "#c96d85" },
  { body: "#79a4d8", rim: "#94bbe9", shade: "#5f89bd" },
];

function node(tag, attrs, kids) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  for (const c of kids || []) e.appendChild(c);
  return e;
}

// mix two #rrggbb colours; t is how much of b to use
function mix(a, b, t) {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const c = (i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0");
  return "#" + c(0) + c(1) + c(2);
}

const DRY = "#b2a46a";
const DRYNESS = { happy: 0, thirsty: 0.28, wilting: 0.6 };
const LEAN = { happy: 0, thirsty: -7, wilting: -17 };
const HEIGHT = [0, 17, 32, 47, 60, 72];

function leaf(x, y, angle, len, wid, fill) {
  return node("path", { d: `M0 0Q${len * 0.5} ${-wid} ${len} 0Q${len * 0.5} ${wid} 0 0Z`, transform: `translate(${x} ${y}) rotate(${angle})`, fill });
}

function stem(topX, topY, color, width) {
  const midX = BASE_X + (topX - BASE_X) * 0.2 + 2;
  return node("path", { d: `M${BASE_X} ${BASE_Y}Q${midX} ${(BASE_Y + topY) / 2} ${topX} ${topY}`, stroke: color, "stroke-width": width, "stroke-linecap": "round", fill: "none" });
}

function petals(cx, cy, n, len, wid, fill, rot) {
  const g = node("g", { transform: `translate(${cx} ${cy})` });
  for (let i = 0; i < n; i++) g.appendChild(node("ellipse", { cx: 0, cy: -len * 0.75, rx: wid, ry: len * 0.5, fill, transform: `rotate(${rot + (360 / n) * i})` }));
  return g;
}

const SPECIES = {
  sunflower(stage, c) {
    const h = HEIGHT[stage] * (stage === 5 ? 0.86 : 1), topY = BASE_Y - h, g = node("g");
    g.appendChild(stem(BASE_X, topY, c.stem, 4));
    const pairs = [0, 1, 2, 3, 3, 4][stage];
    for (let i = 0; i < pairs; i++) {
      const y = BASE_Y - 8 - i * (h / (pairs + 1));
      g.appendChild(leaf(BASE_X, y, -150 + i * 6, 18 + (i % 2) * 4, 8, c.leaf));
      g.appendChild(leaf(BASE_X, y - 4, -30 - i * 6, 18 + ((i + 1) % 2) * 4, 8, c.leaf2));
    }
    if (stage === 3) {
      g.appendChild(node("circle", { cx: BASE_X, cy: topY - 3, r: 7, fill: c.leaf }));
      g.appendChild(node("path", { d: `M${BASE_X - 6} ${topY - 6}L${BASE_X} ${topY - 15}L${BASE_X + 6} ${topY - 6}Z`, fill: "#f2c43d" }));
    } else if (stage >= 4) {
      const r = stage === 5 ? 1.12 : 1;
      if (stage === 5) g.appendChild(petals(BASE_X, topY - 6, 14, 21, 5, mix("#f6c445", "#e8a21c", 0.35), 6));
      g.appendChild(petals(BASE_X, topY - 6, 12, 19 * r, 5.5, c.petal || "#f7cd4d", 0));
      g.appendChild(node("circle", { cx: BASE_X, cy: topY - 6, r: 7.5 * r, fill: "#7a4a2a" }));
      g.appendChild(node("circle", { cx: BASE_X, cy: topY - 6, r: 3.5 * r, fill: "#5b3519" }));
    }
    return g;
  },

  tulip(stage, c) {
    const h = HEIGHT[stage], topY = BASE_Y - h * 0.95, g = node("g");
    const blades = [0, 1, 2, 2, 3, 3][stage];
    for (let i = 0; i < blades; i++) {
      const dir = i % 2 ? 1 : -1, lift = 56 + i * 9 + stage * 3;
      g.appendChild(node("path", { d: `M${BASE_X} ${BASE_Y}Q${BASE_X + dir * 12} ${BASE_Y - lift * 0.55} ${BASE_X + dir * (10 + i * 5)} ${BASE_Y - lift * (0.3 + stage * 0.08)}Q${BASE_X + dir * 3} ${BASE_Y - lift * 0.35} ${BASE_X} ${BASE_Y}Z`, fill: i ? c.leaf2 : c.leaf }));
    }
    if (stage >= 1) g.appendChild(stem(BASE_X, topY, c.stem, 3.5));
    const col = c.petal || "#ec5b7a", dark = mix(col, "#7a1030", 0.25);
    if (stage === 3) g.appendChild(node("path", { d: `M${BASE_X} ${topY + 3}Q${BASE_X - 9} ${topY - 6} ${BASE_X} ${topY - 17}Q${BASE_X + 9} ${topY - 6} ${BASE_X} ${topY + 3}Z`, fill: col }));
    if (stage >= 4) {
      const s = stage === 5 ? 1.3 : 1.05;
      g.appendChild(node("path", { d: `M${BASE_X} ${topY + 4}Q${BASE_X - 14 * s} ${topY - 2} ${BASE_X - 12 * s} ${topY - 17 * s}Q${BASE_X - 5 * s} ${topY - 10 * s} ${BASE_X} ${topY - 18 * s}Q${BASE_X + 5 * s} ${topY - 10 * s} ${BASE_X + 12 * s} ${topY - 17 * s}Q${BASE_X + 14 * s} ${topY - 2} ${BASE_X} ${topY + 4}Z`, fill: dark }));
      g.appendChild(node("path", { d: `M${BASE_X} ${topY + 4}Q${BASE_X - 9 * s} ${topY - 2} ${BASE_X - 7 * s} ${topY - 15 * s}Q${BASE_X} ${topY - 8 * s} ${BASE_X + 7 * s} ${topY - 15 * s}Q${BASE_X + 9 * s} ${topY - 2} ${BASE_X} ${topY + 4}Z`, fill: col }));
    }
    return g;
  },

  fern(stage, c) {
    const g = node("g");
    const fronds = [0, 1, 3, 5, 7, 9][stage];
    for (let i = 0; i < fronds; i++) {
      const t = fronds === 1 ? 0 : i / (fronds - 1) - 0.5; // -0.5 .. 0.5
      const reach = 20 + stage * 7 - Math.abs(t) * 16;
      const tx = BASE_X + t * (34 + stage * 9), ty = BASE_Y - reach * (1.3 - Math.abs(t) * 0.5);
      const cx = BASE_X + t * 12, cy = BASE_Y - reach * 1.1;
      g.appendChild(node("path", { d: `M${BASE_X} ${BASE_Y}Q${cx} ${cy} ${tx} ${ty}`, stroke: c.stem, "stroke-width": 2.4, "stroke-linecap": "round", fill: "none" }));
      const n = 3 + Math.floor(stage * 0.9);
      for (let k = 1; k <= n; k++) {
        const u = k / (n + 1);
        const px = (1 - u) * (1 - u) * BASE_X + 2 * (1 - u) * u * cx + u * u * tx;
        const py = (1 - u) * (1 - u) * BASE_Y + 2 * (1 - u) * u * cy + u * u * ty;
        const size = (7 + stage) * (1 - u * 0.55);
        g.appendChild(leaf(px, py, -90 + t * 40 - 62, size, 2.8, k % 2 ? c.leaf : c.leaf2));
        g.appendChild(leaf(px, py, -90 + t * 40 + 62 + 180, size, 2.8, k % 2 ? c.leaf2 : c.leaf));
      }
    }
    return g;
  },

  cactus(stage, c) {
    const g = node("g"), h = [0, 14, 26, 38, 48, 58][stage], w = 11 + stage * 0.9;
    const col = mix("#4f9d6a", c.dry, c.k), dark = mix("#3d8556", c.dry, c.k);
    const body = (x, bottom, top, ww, fill) => node("path", { d: `M${x - ww} ${bottom}L${x - ww} ${top + ww}Q${x - ww} ${top} ${x} ${top}Q${x + ww} ${top} ${x + ww} ${top + ww}L${x + ww} ${bottom}Z`, fill });
    g.appendChild(body(BASE_X, BASE_Y, BASE_Y - h, w, col));
    g.appendChild(node("path", { d: `M${BASE_X} ${BASE_Y}L${BASE_X} ${BASE_Y - h + 2}`, stroke: dark, "stroke-width": 1.6, fill: "none" }));
    g.appendChild(node("path", { d: `M${BASE_X - w * 0.5} ${BASE_Y}L${BASE_X - w * 0.5} ${BASE_Y - h + 5}M${BASE_X + w * 0.5} ${BASE_Y}L${BASE_X + w * 0.5} ${BASE_Y - h + 5}`, stroke: dark, "stroke-width": 1, fill: "none", opacity: 0.6 }));
    for (let i = 0; i < Math.min(stage, 4) * 2; i++) {
      const y = BASE_Y - 8 - (i >> 1) * (h / 5), x = BASE_X + (i % 2 ? w * 0.75 : -w * 0.75);
      g.appendChild(node("path", { d: `M${x} ${y}l${i % 2 ? 3 : -3} -2`, stroke: "#f3ead0", "stroke-width": 1.2, "stroke-linecap": "round" }));
    }
    if (stage >= 3) {
      const ah = stage * 6;
      const arm = (side) => {
        const ax = BASE_X + side * (w + 7), ay = BASE_Y - h * 0.38;
        g.appendChild(node("path", { d: `M${BASE_X + side * (w - 1)} ${ay + 4}L${ax - side * 1} ${ay + 4}`, stroke: col, "stroke-width": 7, "stroke-linecap": "round", fill: "none" }));
        g.appendChild(body(ax, ay + 6, ay - ah, 4.6, col));
      };
      arm(-1);
      if (stage >= 4) arm(1);
    }
    if (stage >= 4) {
      const fx = BASE_X, fy = BASE_Y - h - 1, fcol = c.petal || "#ef6f9a";
      g.appendChild(petals(fx, fy, 6, stage === 5 ? 9 : 7.5, 2.8, fcol, 0));
      g.appendChild(node("circle", { cx: fx, cy: fy, r: 2.2, fill: "#ffd45e" }));
      if (stage === 5) {
        g.appendChild(petals(BASE_X - w - 7, BASE_Y - h * 0.38 - 4 * 6 - 2, 5, 6, 2.2, fcol, 10));
        g.appendChild(node("circle", { cx: BASE_X - w - 7, cy: BASE_Y - h * 0.38 - 4 * 6 - 2, r: 1.6, fill: "#ffd45e" }));
      }
    }
    return g;
  },

  lavender(stage, c) {
    const g = node("g"), spikes = [0, 1, 3, 4, 5, 7][stage];
    for (let i = 0; i < spikes; i++) {
      const t = spikes === 1 ? 0 : i / (spikes - 1) - 0.5;
      const topX = BASE_X + t * (26 + stage * 5), topY = BASE_Y - (28 + stage * 8) * (1 - Math.abs(t) * 0.45);
      g.appendChild(node("path", { d: `M${BASE_X + t * 3} ${BASE_Y}Q${BASE_X + t * 14} ${(BASE_Y + topY) / 2} ${topX} ${topY}`, stroke: c.stem, "stroke-width": 2.2, "stroke-linecap": "round", fill: "none" }));
      if (stage >= 2) g.appendChild(leaf(BASE_X + t * 3, BASE_Y - 4, -90 + t * 70 - 26, 16, 2.2, c.leaf));
      if (stage >= 2) g.appendChild(leaf(BASE_X + t * 3, BASE_Y - 4, -90 + t * 70 + 26, 16, 2.2, c.leaf2));
      if (stage >= 3) {
        const n = stage === 3 ? 3 : stage === 4 ? 6 : 8, col = c.petal || "#9a7bd8";
        for (let k = 0; k < n; k++) {
          const y = topY + k * 4.2;
          g.appendChild(node("ellipse", { cx: topX - 2.2, cy: y, rx: 2.2, ry: 3, fill: k % 2 ? col : mix(col, "#ffffff", 0.2) }));
          g.appendChild(node("ellipse", { cx: topX + 2.2, cy: y + 2, rx: 2.2, ry: 3, fill: k % 2 ? mix(col, "#ffffff", 0.2) : col }));
        }
        g.appendChild(node("ellipse", { cx: topX, cy: topY - 3, rx: 2, ry: 3.4, fill: col }));
      } else {
        g.appendChild(node("circle", { cx: topX, cy: topY, r: 2.2, fill: c.leaf2 }));
      }
    }
    return g;
  },

  bonsai(stage, c) {
    const g = node("g"), h = [0, 12, 24, 36, 44, 50][stage];
    const trunk = "#7b5638";
    if (stage >= 1) {
      g.appendChild(node("path", { d: `M${BASE_X - 3} ${BASE_Y}Q${BASE_X - 8} ${BASE_Y - h * 0.5} ${BASE_X + 2} ${BASE_Y - h}L${BASE_X + 5} ${BASE_Y - h}Q${BASE_X - 2} ${BASE_Y - h * 0.5} ${BASE_X + 4} ${BASE_Y}Z`, fill: trunk }));
    }
    if (stage >= 3) g.appendChild(node("path", { d: `M${BASE_X} ${BASE_Y - h * 0.55}Q${BASE_X + 14} ${BASE_Y - h * 0.65} ${BASE_X + 21} ${BASE_Y - h * 0.9}`, stroke: trunk, "stroke-width": 3, fill: "none", "stroke-linecap": "round" }));
    const top = BASE_Y - h;
    const puffs = [
      [0, 0, 11, 1], [-13, 6, 8, 2], [14, 4, 8, 2], [-6, -8, 8, 3], [8, -9, 7, 3], [22, -4 + (stage >= 3 ? -0 : 0), 7, 4], [-21, 1, 6, 5],
    ];
    puffs.forEach(([dx, dy, r, from]) => {
      if (stage < from - (stage >= 4 ? 1 : 0) && !(stage === 1 && from === 1)) return;
      const sc = stage === 1 ? 0.55 : stage === 2 ? 0.8 : 1;
      const px = BASE_X + 2 + dx * sc, py = top + dy * sc;
      g.appendChild(node("circle", { cx: px, cy: py, r: r * sc, fill: from % 2 ? c.leaf : c.leaf2 }));
    });
    if (stage >= 4) {
      const bl = c.petal || "#f5a3c0";
      [[-4, -6], [10, -10], [-12, 4], [16, 3], [3, 0]].slice(0, stage === 5 ? 5 : 3).forEach(([dx, dy]) => {
        g.appendChild(node("circle", { cx: BASE_X + 2 + dx, cy: top + dy, r: 2.3, fill: bl }));
      });
    }
    return g;
  },
};

/**
 * A plant in its pot. stage 0..5, mood "happy" | "thirsty" | "wilting", pot 0..5.
 * Returns an <svg> element.
 */
export function drawPlant({ plant = "sunflower", stage = 0, mood = "happy", pot = 0, label = "" }) {
  const k = DRYNESS[mood] ?? 0;
  const colors = {
    stem: mix("#3f9a5c", DRY, k), leaf: mix("#4fb36e", DRY, k), leaf2: mix("#3a9a5b", DRY, k), dry: DRY, k,
    petal: k ? mix(petalOf(plant), "#b99c78", k * 0.8) : petalOf(plant),
  };
  const svg = node("svg", { xmlns: NS, viewBox: "0 -4 120 144", class: "plant stage-" + stage + " mood-" + mood, role: "img", "aria-label": label || `${plant}, ${mood}` });
  const lean = LEAN[mood] ?? 0;
  const sway = node("g", { class: "sway" });
  const body = node("g", { transform: `rotate(${lean} ${BASE_X} ${BASE_Y})` });
  // soil shows through for the seed stage
  if (stage === 0) {
    body.appendChild(node("ellipse", { cx: BASE_X, cy: BASE_Y - 1, rx: 15, ry: 5, fill: "#6b4a3a" }));
    body.appendChild(node("ellipse", { cx: BASE_X, cy: BASE_Y - 5, rx: 3.2, ry: 4.2, fill: "#d1ad72", transform: `rotate(-18 ${BASE_X} ${BASE_Y - 5})` }));
  } else {
    body.appendChild(SPECIES[plant](stage, colors));
  }
  sway.appendChild(body);
  svg.appendChild(node("ellipse", { cx: 60, cy: 135, rx: 30, ry: 3.6, fill: "#000", opacity: 0.12 }));
  svg.appendChild(sway);
  const p = POT_COLORS[pot % POT_COLORS.length];
  svg.appendChild(node("ellipse", { cx: 60, cy: 104, rx: 29, ry: 5.5, fill: "#5b4033" }));
  svg.appendChild(node("path", { d: "M33 108L87 108L81 133Q80 135 78 135L42 135Q40 135 39 133Z", fill: p.body }));
  svg.appendChild(node("path", { d: "M33 108L87 108L86 113L34 113Z", fill: p.shade, opacity: 0.35 }));
  svg.appendChild(node("rect", { x: 29, y: 101, width: 62, height: 9, rx: 4.5, fill: p.rim }));
  return svg;
}

function petalOf(plant) {
  return { sunflower: "#f7cd4d", tulip: "#ec5b7a", fern: "#3a9a5b", cactus: "#ef6f9a", lavender: "#9a7bd8", bonsai: "#f5a3c0" }[plant] || "#f7cd4d";
}

/** Serialise a plant so it can be drawn onto a canvas. */
export function plantToDataUrl(opts) {
  const svg = drawPlant(opts);
  svg.setAttribute("width", "240");
  svg.setAttribute("height", "280");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
}
