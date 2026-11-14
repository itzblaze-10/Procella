/* @ds-bundle: {"format":4,"namespace":"Procella","components":[{"name":"Icon"},{"name":"Stamp"},{"name":"LuggageTag"},{"name":"Dossier"},{"name":"ChartPlate"},{"name":"Dispatch"},{"name":"FlapBoard"},{"name":"Compass"},{"name":"SourceBadge"},{"name":"RouteLine"}]} */
(function () {
  "use strict";
  var uid = 0;
  var MINUS = "−";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function reducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  // Signed number with a true minus sign, fixed decimals.
  function signed(n, d) {
    var s = Math.abs(n).toFixed(d == null ? 3 : d);
    return (n > 0 ? "+" : n < 0 ? MINUS : "") + s;
  }
  function fmtP(p) {
    if (p < 0.001) { var e = p.toExponential(1).split("e"); return e[0] + "e" + e[1].replace("-", MINUS); }
    return p.toFixed(p < 0.01 ? 4 : 3);
  }

  /* ---------- Icon: 24px grid, 1.75 stroke, round caps. Drawn in code. ---------- */
  var DOT = ' fill="currentColor" stroke="none"';
  var I = {
    "compass": '<circle cx="12" cy="12" r="9"/><path d="M12 6.5 14.2 12 12 17.5 9.8 12z"/><circle cx="12" cy="12" r="1"' + DOT + '/>',
    "pin": '<path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    "route": '<circle cx="5.5" cy="18" r="1.8"/><circle cx="18.5" cy="6" r="1.8"/><path d="M7.2 17.2c4.5-1.6 2.3-6.8 6.6-8.4 1.4-.5 2.4-1 3.2-1.6" stroke-dasharray="2 2.6"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.7 3.8 5.7 3.8 9s-1.2 6.3-3.8 9c-2.6-2.7-3.8-5.7-3.8-9S9.4 5.7 12 3z"/>',
    "temperature": '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v6.5"/><circle cx="12" cy="17.5" r="1.6"' + DOT + '/>',
    "rain": '<path d="M12 3.5s-5.5 6.2-5.5 10a5.5 5.5 0 0 0 11 0c0-3.8-5.5-10-5.5-10z"/>',
    "humidity": '<path d="M12 3.5s-5.5 6.2-5.5 10a5.5 5.5 0 0 0 11 0c0-3.8-5.5-10-5.5-10z"/><path d="M8.8 14.2c1.1.6 2.1.6 3.2 0s2.1-.6 3.2 0"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    "haze": '<path d="M4 8.5c2.7-1.6 5.3 1.6 8 0s5.3-1.6 8 0"/><path d="M4 12.5c2.7-1.6 5.3 1.6 8 0s5.3-1.6 8 0"/><path d="M4 16.5c2.7-1.6 5.3 1.6 8 0s5.3-1.6 8 0"/>',
    "cloud": '<path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.2 9.5 4.25 4.25 0 0 0 7 18z"/>',
    "wind": '<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 17h7"/>',
    "soil": '<path d="M12 3s-2.2 2.4-2.2 3.9a2.2 2.2 0 0 0 4.4 0C14.2 5.4 12 3 12 3z"/><path d="M3 12h18M5 16h14M7 20h10"/>',
    "leaf": '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
    "gauge": '<path d="M4.5 16a8 8 0 1 1 15 0"/><path d="M12 16l3.5-4.5"/><circle cx="12" cy="16" r="1.2"' + DOT + '/>',
    "ozone": '<circle cx="12" cy="12" r="3.5"/><path d="M4.5 9a8.5 8.5 0 0 1 15 0M4.5 15a8.5 8.5 0 0 0 15 0"/>',
    "mountain": '<path d="M2.5 19 9 8l4 6.5 2.5-3.5 6 8z"/>',
    "ocean": '<path d="M3 10c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/><path d="M3 15c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"/>',
    "city": '<path d="M3 20V10h5v10M8 20V5h7v15M15 20v-8h6v8M2 20h20"/><path d="M10.5 9h2M10.5 12.5h2M10.5 16h2"/>',
    "desert": '<path d="M2 18c4-4 8-4 11-1.5S19 18 22 16"/><circle cx="16" cy="7.5" r="2.5"/>',
    "forest": '<path d="M12 3 6.5 12h3L6 17.5h12L14.5 12h3z"/><path d="M12 17.5V21"/>',
    "polar": '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
    "trend-up": '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    "trend-down": '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    "trend-flat": '<path d="M3 12c2-2.5 3.5-2.5 5 0s3 2.5 4.5 0 3-2.5 4.5 0 2.5 2.5 4 0"/>',
    "hourglass": '<path d="M7 3h10M7 21h10"/><path d="M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9"/>',
    "stamp": '<path d="M9 4h6v5.5l2.5 2V15h-11v-3.5l2.5-2z"/><path d="M5 19h14"/>',
    "ticket": '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z"/><path d="M15 6v12" stroke-dasharray="1.5 2"/>',
    "passport": '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
    "dispatch": '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12.5h7M7 16h4"/>',
    "calendar": '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    "live": '<circle cx="12" cy="12" r="2"' + DOT + '/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    "cached": '<path d="M4 7h16v3H4z"/><path d="M5.5 10v9h13v-9"/><path d="M10 13.5h4"/>',
    "crosscheck": '<circle cx="9.5" cy="12" r="5.5"/><circle cx="14.5" cy="12" r="5.5"/>',
    "model": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
    "sound-on": '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    "sound-off": '<path d="M4 10v4h3.5L12 18V6L7.5 10z"/><path d="M16 10l4 4M20 10l-4 4"/>',
    "play": '<path d="M8 5.5v13l10-6.5z"/>',
    "pause": '<path d="M8 5v14M16 5v14"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    "warning": '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17h.01"/>',
    "download": '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'
  };

  function Icon(name, o) {
    o = o || {};
    var inner = I[name];
    if (!inner) throw new Error("Procella.Icon: unknown icon '" + name + "'");
    var s = o.size || 24;
    var a11y = o.label ? 'role="img" aria-label="' + esc(o.label) + '"' : 'aria-hidden="true"';
    return '<svg class="pc-icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false" ' + a11y + ">" + inner + "</svg>";
  }

  /* ---------- Stamp: the verdict, as a passport stamp ---------- */
  var VERDICT = {
    detected: { top: "DETECTED", word: "Detected" },
    "null": { top: "NOT DETECTABLE", word: "Not detectable yet", glyph: "trend-flat", bottom: "YET" },
    "short": { top: "TOO SHORT", word: "Too short to judge", glyph: "hourglass", bottom: "TO JUDGE" }
  };
  function Stamp(o) {
    o = o || {};
    var st = o.state || "detected", v = VERDICT[st];
    if (!v) throw new Error("Procella.Stamp: state must be detected, null or short");
    var down = o.direction === "down";
    var glyph = v.glyph || (down ? "trend-down" : "trend-up");
    var bottom = (o.detail || v.bottom || (down ? "FALLING" : "RISING")).toUpperCase();
    var id = "pc-st" + (++uid), size = o.size || 132;
    var label = "Verdict: " + v.word + (st === "detected" ? (down ? ", falling" : ", rising") : "") + (o.detail ? ". " + o.detail : "");
    return '<svg class="pc-stamp pc-stamp--' + st + (o.press ? " is-pressing" : "") + '" width="' + size + '" height="' + size + '" viewBox="0 0 132 132" role="img" aria-label="' + esc(label) + '">' +
      '<defs><path id="' + id + 't" d="M 21 66 A 45 45 0 0 1 111 66"/><path id="' + id + 'b" d="M 17 66 A 49 49 0 0 0 115 66"/></defs>' +
      '<g class="pc-stamp__ink"><circle cx="66" cy="66" r="61" class="pc-stamp__ring"/><circle cx="66" cy="66" r="55" class="pc-stamp__hair"/><circle cx="66" cy="66" r="33" class="pc-stamp__hair pc-stamp__dash"/>' +
      '<text class="pc-stamp__top"><textPath href="#' + id + 't" startOffset="50%" text-anchor="middle">' + v.top + "</textPath></text>" +
      '<text class="pc-stamp__bottom"><textPath href="#' + id + 'b" startOffset="50%" text-anchor="middle">' + esc(bottom) + "</textPath></text>" +
      '<g transform="translate(48 48) scale(1.5)" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + I[glyph] + "</g></g></svg>";
  }

  /* ---------- LuggageTag: one variable ---------- */
  function LuggageTag(o) {
    o = o || {};
    var meta = [o.unit, o.source, o.years].filter(Boolean).join(" · ");
    var tag = o.button ? "button" : "div";
    var attrs = o.button ? ' type="button" aria-pressed="' + (o.selected ? "true" : "false") + '"' : "";
    return "<" + tag + ' class="pc-tag' + (o.selected ? " is-selected" : "") + '"' + attrs + ">" +
      '<span class="pc-tag__hole" aria-hidden="true"></span>' + Icon(o.icon || "globe", { size: 20 }) +
      '<span class="pc-tag__body"><span class="pc-tag__name">' + esc(o.name) + '</span><span class="pc-tag__meta">' + esc(meta) + "</span></span></" + tag + ">";
  }

  /* ---------- trend chart (used by ChartPlate and Dossier) ---------- */
  function niceStep(range, target) {
    var raw = range / (target || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  }
  function trendSvg(o) {
    var W = o.width || 560, H = o.height || 280, L = o.mini ? 6 : 52, R = o.mini ? 6 : 16, T = o.mini ? 6 : 14, B = o.mini ? 6 : 34;
    var ys = o.years, vs = o.values, n = ys.length;
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), step = niceStep(hi - lo || 1, 5);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    var x0 = ys[0], x1 = ys[n - 1];
    var x = function (y) { return L + (y - x0) / (x1 - x0) * (W - L - R); };
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var dec = step < 0.1 ? 2 : step < 1 ? 1 : 0, h = "";
    if (!o.mini) {
      for (var v = lo; v <= hi + step / 1e3; v += step) {
        h += '<line class="pc-chart__grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
          '<text class="pc-chart__tick" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v.toFixed(dec) + "</text>";
      }
      var first = Math.ceil(x0 / 10) * 10;
      [x0].concat(range(first - x0 >= 5 ? first : first + 10, x1 - 5, 10)).concat([x1]).forEach(function (yr) {
        h += '<text class="pc-chart__tick" x="' + x(yr) + '" y="' + (H - 12) + '" text-anchor="middle">' + yr + "</text>";
      });
      h += '<line class="pc-chart__axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>';
    }
    h += '<polyline class="pc-chart__line" points="' + vs.map(function (v, i) { return x(ys[i]) + "," + y(v); }).join(" ") + '"/>';
    if (!o.mini) vs.forEach(function (v, i) { h += '<circle class="pc-chart__pt" cx="' + x(ys[i]) + '" cy="' + y(v) + '" r="2.6"/>'; });
    if (o.sen != null && o.intercept != null) {
      var from = o.from || x0;
      h += '<line class="pc-chart__trend" x1="' + x(from) + '" y1="' + y(o.sen * from + o.intercept) + '" x2="' + x(x1) + '" y2="' + y(o.sen * x1 + o.intercept) + '"/>';
    }
    return '<svg class="pc-chart' + (o.mini ? " pc-chart--mini" : "") + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(o.label || "Annual series with Sen's slope trend line") + '">' + h + "</svg>";
  }
  function range(a, b, s) { var r = []; for (var v = a; v <= b; v += s) r.push(v); return r; }

  /* ---------- SourceBadge ---------- */
  var BADGE = { live: "live", cached: "cached", crosscheck: "crosscheck", model: "model" };
  function SourceBadge(o) {
    o = o || {};
    var k = BADGE[o.kind] ? o.kind : "model";
    return '<span class="pc-badge pc-badge--' + k + '">' + Icon(k, { size: 14 }) + "<span>" + esc(o.text) + "</span></span>";
  }

  /* ---------- ChartPlate: the evidence ---------- */
  function ChartPlate(o) {
    o = o || {};
    var badges = (o.badges || []).map(SourceBadge).join("");
    return '<figure class="pc-plate">' +
      '<header class="pc-plate__head"><span class="pc-plate__eyebrow">' + esc(o.eyebrow) + '</span><h3 class="pc-plate__title">' + esc(o.title) + "</h3>" +
      (o.unit ? '<span class="pc-plate__unit">' + esc(o.unit) + "</span>" : "") + "</header>" +
      trendSvg(o) +
      '<figcaption class="pc-plate__caption">' + esc(o.caption) + "</figcaption>" +
      '<footer class="pc-plate__foot"><span class="pc-plate__source">' + esc(o.source) + "</span>" + (badges ? '<span class="pc-plate__badges">' + badges + "</span>" : "") + "</footer></figure>";
  }

  /* ---------- Dossier: one destination, one variable, one verdict ---------- */
  function Dossier(o) {
    o = o || {};
    var down = o.slope < 0;
    var dir = o.state === "detected" ? (down ? "down" : "up") : null;
    var stats = [signed(o.slope * 10, 2) + " per decade", "p = " + fmtP(o.p), o.years, "n = " + o.n].join(" · ");
    return '<article class="pc-dossier">' +
      '<header class="pc-dossier__head"><span class="pc-dossier__eyebrow">Destination dossier</span>' +
      '<h3 class="pc-dossier__place">' + esc(o.place) + '</h3><span class="pc-dossier__coord">' + esc(o.coords) + "</span></header>" +
      '<div class="pc-dossier__stamp">' + Stamp({ state: o.state, direction: dir, size: 112, detail: o.stampDetail }) + "</div>" +
      '<div class="pc-dossier__tag">' + LuggageTag({ name: o.variable, unit: o.unit, source: o.source, icon: o.icon }) + "</div>" +
      '<div class="pc-dossier__figure"><span class="pc-dossier__rate">' + signed(o.slope, o.digits || 3) + '</span><span class="pc-dossier__per">' + esc(o.unit) + " per year</span></div>" +
      '<p class="pc-dossier__stats">' + esc(stats) + "</p>" +
      (o.series ? '<div class="pc-dossier__spark">' + trendSvg({ years: o.series.years, values: o.series.values, sen: o.series.sen, intercept: o.series.intercept, width: 320, height: 64, mini: true, label: o.variable + " series" }) + "</div>" : "") +
      '<footer class="pc-dossier__foot">' + (o.badges || []).map(SourceBadge).join("") + "</footer></article>";
  }

  /* ---------- Dispatch: a news lead, clipped ---------- */
  function Dispatch(o) {
    o = o || {};
    return '<article class="pc-dispatch">' +
      '<span class="pc-dispatch__dateline">' + Icon("dispatch", { size: 16 }) + esc(o.dateline) + "</span>" +
      '<h3 class="pc-dispatch__headline">' + esc(o.headline) + "</h3>" +
      '<p class="pc-dispatch__standfirst">' + esc(o.standfirst) + "</p>" +
      (o.cta ? '<a class="pc-dispatch__cta" href="' + esc(o.href || "#") + '">' + esc(o.cta) + Icon("route", { size: 16 }) + "</a>" : "") +
      "</article>";
  }

  /* ---------- FlapBoard: split-flap departure-board text ---------- */
  var FLAP_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.+-";
  function FlapBoard(o) {
    o = o || {};
    var text = String(o.text || "").toUpperCase(), len = Math.max(o.length || 0, text.length);
    var cells = "";
    for (var i = 0; i < len; i++) cells += '<span class="pc-flap__cell" aria-hidden="true">' + esc(text.charAt(i) || " ") + "</span>";
    return '<span class="pc-flap' + (o.size === "sm" ? " pc-flap--sm" : "") + '" role="img" aria-label="' + esc(text) + '" data-length="' + len + '">' + cells + "</span>";
  }
  // Animate an existing board to new text. Respects reduced motion.
  function flapTo(board, text) {
    text = String(text).toUpperCase();
    var cells = board.querySelectorAll(".pc-flap__cell");
    board.setAttribute("aria-label", text);
    var instant = reducedMotion();
    Array.prototype.forEach.call(cells, function (cell, i) {
      var target = text.charAt(i) || " ";
      if (instant || cell.textContent === target) { cell.textContent = target; return; }
      var flips = 5 + (i % 4), k = 0;
      setTimeout(function tick() {
        cell.classList.remove("is-flipping"); void cell.offsetWidth; cell.classList.add("is-flipping");
        cell.textContent = ++k >= flips ? target : FLAP_SET.charAt((Math.random() * FLAP_SET.length) | 0);
        if (k < flips) setTimeout(tick, 55);
      }, i * 45);
    });
  }

  /* ---------- Compass ---------- */
  function Compass(o) {
    o = o || {};
    var s = o.size || 96, b = o.bearing || 0, ticks = "";
    for (var i = 0; i < 32; i++) {
      var a = i * 11.25 * Math.PI / 180, r1 = i % 8 === 0 ? 34 : i % 2 === 0 ? 38 : 40;
      ticks += '<line x1="' + (48 + Math.sin(a) * r1).toFixed(2) + '" y1="' + (48 - Math.cos(a) * r1).toFixed(2) + '" x2="' + (48 + Math.sin(a) * 43).toFixed(2) + '" y2="' + (48 - Math.cos(a) * 43).toFixed(2) + '"/>';
    }
    var label = o.label || "Compass bearing " + Math.round(b) + " degrees";
    return '<svg class="pc-compass" width="' + s + '" height="' + s + '" viewBox="0 0 96 96" role="img" aria-label="' + esc(label) + '">' +
      '<circle cx="48" cy="48" r="45" class="pc-compass__ring"/><g class="pc-compass__ticks">' + ticks + "</g>" +
      '<g class="pc-compass__letters"><text x="48" y="25">N</text><text x="73" y="52">E</text><text x="48" y="79">S</text><text x="23" y="52">W</text></g>' +
      '<g class="pc-compass__needle" style="transform:rotate(' + b + 'deg)"><path class="pc-compass__north" d="M48 18 53 48H43z"/><path class="pc-compass__south" d="M48 78 53 48H43z"/><circle cx="48" cy="48" r="3"/></g></svg>';
  }
  function compassTo(svg, bearing) {
    var n = svg.querySelector(".pc-compass__needle");
    if (n) n.style.transform = "rotate(" + bearing + "deg)";
    svg.setAttribute("aria-label", "Compass bearing " + Math.round(bearing) + " degrees");
  }

  /* ---------- RouteLine: from one place code to another ---------- */
  function RouteLine(o) {
    o = o || {};
    return '<div class="pc-route' + (o.variant === "airmail" ? " pc-route--airmail" : "") + (o.drawn === false ? "" : " is-drawn") + '" role="img" aria-label="' + esc("Route from " + (o.fromName || o.from) + " to " + (o.toName || o.to)) + '">' +
      '<span class="pc-route__code">' + esc(o.from) + '</span><span class="pc-route__track" aria-hidden="true"><span class="pc-route__line"></span></span><span class="pc-route__code">' + esc(o.to) + "</span></div>";
  }

  window.Procella = {
    Icon: Icon, icons: Object.keys(I),
    Stamp: Stamp, LuggageTag: LuggageTag, Dossier: Dossier, ChartPlate: ChartPlate, trendSvg: trendSvg,
    Dispatch: Dispatch, FlapBoard: FlapBoard, flapTo: flapTo, Compass: Compass, compassTo: compassTo,
    SourceBadge: SourceBadge, RouteLine: RouteLine, format: { signed: signed, p: fmtP }
  };
})();
