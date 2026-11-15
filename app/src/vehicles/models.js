// Nine vehicle models at real size, in metres. Forward is -z, lowest point at y = 0.
// Land vehicles: the axle midpoint sits at z = 0 so the physics samples the ground under the real wheel positions.
import * as THREE from 'three';
import {
  frame, add, box, rbox, cyl, ball, tube, arc, arch, shell, lathe, airfoil, wing, wheel, rotor, hullGeo, hull, decal, wake,
  mat, paintMat, GLASS, CHROME, ALU, TRIM, STEEL, LIGHT, TAIL, AMBER,
} from './parts.js';

const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const both = f => { f(-1); f(1); };
const roundLamp = (p, r, M, x, y, z) => { // headlamp: chrome bezel + lens, facing -z
  cyl(p, r * 1.18, r * 1.18, 0.06, 20, CHROME(), x, y, z + 0.02, Math.PI / 2);
  cyl(p, r, r, 0.07, 20, M, x, y, z, Math.PI / 2);
};
const wheels4 = (m, r, w, x, a, o) => both(s => { m.wheels.push(wheel(m.root, r, w, s * x, r, -a, true, o)); });
const wheels4r = (m, r, w, x, a, o) => both(s => { m.wheels.push(wheel(m.root, r, w, s * x, r, a, false, o)); });

// Toyota Land Cruiser 76 wagon (1VD-FTV V8): length 4,910 mm, width 1,870 mm (over flares), height 1,940 mm,
// wheelbase 2,730 mm, track 1,555 mm, 265/70R16 tyres (radius 0.389 m).
export function offroad(paint, dec) {
  const m = frame(1.9), b = m.body, P = paintMat(paint), BL = TRIM(), a = 1.365, W = 1.79;
  shell(b, [[-2.17, 0.55], [-2.17, 1.12], [-2.12, 1.21], [-0.78, 1.27], [2.55, 1.27], [2.6, 1.2], [2.6, 0.55],
    ...arch(a, 0.389, 0.5, 0.55), ...arch(-a, 0.389, 0.5, 0.55)], W, P, { bevel: 0.07, def: y => 1 - 0.025 * clamp((y - 1.0) / 0.27, 0, 1) });
  const tumble = y => 1 - 0.05 * clamp((y - 1.27) / 0.6, 0, 1);
  shell(b, [[-0.78, 1.26], [-0.63, 1.87], [2.5, 1.87], [2.55, 1.26]], 1.72, GLASS(), { bevel: 0.05, def: tumble });
  rbox(b, 1.66, 0.08, 3.18, 0.03, P, 0, 1.895, 0.93);                     // roof skin
  both(s => {
    tube(b, [s * 0.86, 1.27, -0.79], [s * 0.82, 1.88, -0.63], 0.045, P);   // A pillar
    flare(b, s, -a); flare(b, s, a);
    rbox(b, 0.16, 0.06, 1.5, 0.02, BL, s * 0.94, 0.45, 0);               // side step
    tube(b, [s * 0.87, 1.33, -0.66], [s * 1.0, 1.36, -0.72], 0.02, BL);   // mirror arm
    rbox(b, 0.06, 0.26, 0.2, 0.03, BL, s * 1.02, 1.38, -0.72);
    for (const z of [-0.62, 0.43, 1.47]) box(b, 0.008, 0.68, 0.014, BL, s * 0.897, 0.91, z); // door shut lines
    for (const z of [0.3, 1.34]) rbox(b, 0.03, 0.04, 0.16, 0.01, CHROME(), s * 0.9, 1.13, z); // handles
    roundLamp(b, 0.088, LIGHT(), s * 0.66, 0.98, -2.185);
    rbox(b, 0.12, 0.06, 0.04, 0.01, AMBER(), s * 0.66, 0.8, -2.18);
    rbox(b, 0.1, 0.3, 0.04, 0.015, TAIL(), s * 0.8, 0.9, 2.61);
  });
  box(b, 1.7, 0.6, 0.1, P, 0, 1.56, 0.43); box(b, 1.7, 0.6, 0.12, P, 0, 1.56, 1.47);   // B and C pillars
  both(s => box(b, 0.12, 0.62, 0.1, P, s * 0.79, 1.56, 2.5));                       // D pillars, rear glass between
  box(b, 0.008, 0.7, 0.01, BL, 0.2, 0.92, 2.605);                         // rear barn-door split
  rbox(b, 1.16, 0.4, 0.06, 0.02, BL, 0, 0.97, -2.175);                    // grille
  for (const y of [0.88, 0.97, 1.06]) box(b, 1.1, 0.025, 0.02, CHROME(), 0, y, -2.21);
  rbox(b, 0.56, 0.06, 0.5, 0.03, P, 0, 1.29, -1.3);                      // bonnet scoop
  rbox(b, 0.4, 0.04, 0.06, 0.02, BL, 0, 1.31, -1.56);
  for (const z of [-2.24, 2.66]) rbox(b, 1.92, 0.22, 0.16, 0.04, mat('#2a2b2d', { metalness: 0.5, roughness: 0.5 }), 0, 0.53, z); // steel bumpers
  tube(b, [0.93, 0.95, -1.05], [0.92, 1.36, -0.9], 0.055, BL); tube(b, [0.92, 1.36, -0.9], [0.86, 1.98, -0.68], 0.055, BL); // snorkel
  rbox(b, 0.14, 0.16, 0.2, 0.04, BL, 0.86, 2.04, -0.7);
  for (const x of [-0.78, 0.78]) tube(b, [x, 2.02, -0.5], [x, 2.02, 2.5], 0.022, BL);           // roof rack
  for (const z of [-0.5, 0.5, 1.5, 2.5]) tube(b, [-0.78, 2.02, z], [0.78, 2.02, z], 0.02, BL);
  for (const z of [-0.5, 2.5]) both(s => tube(b, [s * 0.78, 1.94, z], [s * 0.78, 2.02, z], 0.02, BL));
  rbox(b, 0.36, 0.44, 0.17, 0.03, mat('#4b5d2a'), -0.4, 2.25, 2.1); rbox(b, 0.36, 0.44, 0.17, 0.03, mat('#a8281e'), -0.4, 2.25, 1.88); // jerrycans
  rbox(b, 0.75, 0.3, 0.85, 0.12, mat('#6b5a40', { roughness: 0.9 }), 0.3, 2.18, 1.1);           // canvas bag
  tube(b, [-0.3, 1.3, -0.77], [0.25, 1.82, -0.66], 0.008, BL); tube(b, [0.3, 1.3, -0.77], [0.75, 1.75, -0.68], 0.008, BL); // wipers
  decal(b, dec, 0.895, 0.9, 0.3, 2.9, 0.42);
  wheels4(m, 0.389, 0.265, 0.778, a, { style: 'steel', tread: 'mud' }); wheels4r(m, 0.389, 0.265, 0.778, a, { style: 'steel', tread: 'mud' });
  return m;
}
function flare(b, s, z) { // black wheel-arch over-fender
  const o = arc(z, 0.389, 0.6, 0.25, Math.PI - 0.25, 12), i = arc(z, 0.389, 0.5, Math.PI - 0.32, 0.32, 12);
  shell(b, [...o, ...i], 0.1, TRIM(), { bevel: 0.03 }).position.x = s * 0.9;
}

// Windscreen or backlight: a thin glass strip laid just proud of the sloped face from a to b ([z, y]), inset from the ends.
function pane(p, a, b, w, def) {
  const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy), nz = -dy / l, ny = dz / l; // outward normal (faces are listed front to back)
  const at = (t, o) => [a[0] + dz * t + nz * o, a[1] + dy * t + ny * o];
  shell(p, [at(0.04, 0.01), at(0.95, 0.01), at(0.95, -0.04), at(0.04, -0.04)], w, GLASS(), { bevel: 0.02, def });
}

// Toyota Corolla saloon (E210): length 4,630 mm, width 1,780 mm, height 1,435 mm, wheelbase 2,700 mm,
// track 1,530 mm, 205/55R16 tyres (radius 0.316 m).
export function sedan(paint, dec) {
  const m = frame(1.3), b = m.body, P = paintMat(paint), BL = TRIM(), a = 1.35;
  const plan = (y, z) => (1 - 0.11 * Math.max(0, (Math.abs(z) - 1.55) / 0.75) ** 2) * (1 - 0.07 * clamp((y - 0.72) / 0.3, 0, 1));
  shell(b, [[-2.29, 0.36], [-2.315, 0.5], [-2.3, 0.7], [-2.2, 0.78], [-1.5, 0.87], [-0.72, 0.98], [1.7, 1.03], [2.2, 1.02], [2.33, 0.95],
    [2.36, 0.7], [2.32, 0.42], [2.2, 0.33], ...arch(a, 0.316, 0.37, 0.33), ...arch(-a, 0.316, 0.37, 0.33), [-2.1, 0.33]], 1.78, P, { bevel: 0.1, def: plan });
  const tumble = y => 1 - 0.16 * clamp((y - 0.97) / 0.45, 0, 1), gh = [[-0.74, 0.97], [-0.04, 1.4], [0.9, 1.42], [1.72, 1.02]];
  shell(b, gh, 1.56, P, { bevel: 0.06, def: tumble });                    // greenhouse in paint, glass laid on it
  shell(b, [[-0.6, 1.0], [-0.07, 1.345], [0.38, 1.36], [0.38, 1.0]], 1.572, GLASS(), { bevel: 0.02, def: tumble });
  shell(b, [[0.48, 1.0], [0.48, 1.36], [0.86, 1.37], [1.42, 1.06], [1.42, 1.0]], 1.572, GLASS(), { bevel: 0.02, def: tumble });
  pane(b, gh[0], gh[1], 1.42, tumble); pane(b, gh[2], gh[3], 1.3, tumble);
  both(s => {
    for (const z of [-0.7, 0.42, 1.52]) box(b, 0.008, 0.52, 0.012, BL, s * 0.892, 0.66, z);
    for (const z of [0.18, 1.25]) rbox(b, 0.025, 0.035, 0.15, 0.01, CHROME(), s * 0.875, 0.86, z);
    tube(b, [s * 0.83, 0.98, -0.62], [s * 0.93, 1.0, -0.6], 0.02, P); rbox(b, 0.08, 0.13, 0.2, 0.04, P, s * 0.96, 1.02, -0.6);
    rbox(b, 0.4, 0.08, 0.12, 0.03, LIGHT(), s * 0.58, 0.68, -2.2, 0, s * 0.3);
    rbox(b, 0.44, 0.1, 0.18, 0.04, TAIL(), s * 0.6, 0.88, 2.29, 0, -s * 0.38);
    rbox(b, 0.14, 0.05, 0.05, 0.02, BL, s * 0.62, 0.45, -2.27);           // fog lamp recess
  });
  rbox(b, 0.66, 0.07, 0.06, 0.03, BL, 0, 0.64, -2.3);                    // upper grille
  rbox(b, 1.2, 0.22, 0.08, 0.06, BL, 0, 0.45, -2.29);                     // lower intake
  add(b, new THREE.TorusGeometry(0.06, 0.01, 6, 20), CHROME(), 0, 0.64, -2.335).scale.y = 0.7;
  rbox(b, 0.5, 0.13, 0.03, 0.01, mat('#e8e8e4'), 0, 0.62, 2.36);          // plate
  rbox(b, 0.06, 0.06, 0.18, 0.03, BL, 0, 1.46, 0.95);                     // fin antenna
  decal(b, dec, 0.89, 0.62, 0.1, 2.9, 0.3);
  wheels4(m, 0.316, 0.205, 0.765, a, { style: 'alloy' }); wheels4r(m, 0.316, 0.205, 0.765, a, { style: 'alloy' });
  return m;
}

// VW-based dune buggy, Meyers Manx pattern: 80 in (2.03 m) wheelbase on a shortened Beetle pan, fibreglass tub,
// exposed air-cooled flat-four at the back, narrow fronts, wide rears.
export function buggy(paint, dec) {
  const m = frame(1.1), b = m.body, P = paintMat(paint), BL = TRIM(), a = 1.015, T = mat('#2b2d30', { metalness: 0.6, roughness: 0.4 });
  const side = [[-1.78, 0.55], [-1.65, 0.7], [-1.3, 0.8], [-0.9, 0.82], [-0.6, 0.72], [-0.35, 0.64], [0.45, 0.66], [0.75, 0.88], [1.05, 0.98],
    [1.35, 0.9], [1.52, 0.72], [1.55, 0.5], [1.5, 0.3], ...arch(a, 0.39, 0.47, 0.3), ...arch(-a, 0.32, 0.41, 0.3), [-1.6, 0.33]];
  both(s => {
    shell(b, side, 0.2, P, { bevel: 0.07 }).position.x = s * 0.63;
    rbox(b, 0.42, 0.1, 0.45, 0.04, BL, s * 0.27, 0.42, 0.15);                                  // bucket seat
    rbox(b, 0.42, 0.52, 0.1, 0.04, BL, s * 0.27, 0.7, 0.47, 0.25);
    tube(b, [s * 0.55, 0.62, 0.62], [s * 0.47, 1.36, 0.68], 0.03, T);                          // roll bar
    tube(b, [s * 0.47, 1.36, 0.68], [s * 0.5, 0.78, 1.35], 0.025, T);
    roundLamp(b, 0.075, LIGHT(), s * 0.36, 0.86, -1.22);
    cyl(b, 0.04, 0.04, 0.03, 12, TAIL(), s * 0.63, 0.74, 1.54, Math.PI / 2);
    cyl(b, 0.1, 0.1, 0.36, 12, mat('#77797c', { metalness: 0.6, roughness: 0.5 }), s * 0.42, 0.55, 1.15, 0, 0, Math.PI / 2); // cylinders
    for (let i = 0; i < 5; i++) cyl(b, 0.13, 0.13, 0.015, 14, mat('#5d6064', { metalness: 0.6 }), s * (0.28 + i * 0.065), 0.55, 1.15, 0, 0, Math.PI / 2); // fins
    tube(b, [s * 0.4, 0.4, 1.25], [s * 0.15, 0.36, 1.6], 0.03, T);                             // exhaust
    tube(b, [s * 0.15, 0.36, 1.6], [s * 0.18, 0.62, 1.78], 0.035, CHROME());
    tube(b, [s * 0.7, 0.48, -0.5], [s * 0.7, 0.48, 0.45], 0.03, CHROME());                     // nerf bar
  });
  shell(b, [[-1.79, 0.42], [-1.79, 0.55], [-1.66, 0.7], [-1.3, 0.8], [-0.9, 0.83], [-0.62, 0.75], [-0.62, 0.35], [-1.6, 0.33]], 1.1, P,
    { bevel: 0.1, def: (y, z) => 1 - 0.3 * Math.max(0, (-z - 1.2) / 0.6) ** 2 });               // nose
  rbox(b, 1.1, 0.06, 2.3, 0.02, BL, 0, 0.33, 0.05);                                             // floor pan
  tube(b, [-0.47, 1.36, 0.68], [0.47, 1.36, 0.68], 0.03, T);
  rbox(b, 1.02, 0.3, 0.025, 0.01, GLASS(), 0, 0.92, -0.62, 0.35);                               // windscreen
  tube(b, [-0.52, 0.76, -0.66], [-0.52, 1.07, -0.56], 0.018, CHROME()); tube(b, [0.52, 0.76, -0.66], [0.52, 1.07, -0.56], 0.018, CHROME());
  tube(b, [-0.52, 1.07, -0.56], [0.52, 1.07, -0.56], 0.018, CHROME());
  add(b, new THREE.TorusGeometry(0.17, 0.018, 8, 28), BL, -0.27, 0.86, -0.32, -0.45);           // steering wheel
  tube(b, [-0.27, 0.86, -0.32], [-0.27, 0.62, -0.62], 0.02, BL);
  rbox(b, 0.56, 0.32, 0.5, 0.06, mat('#8d9094', { metalness: 0.5, roughness: 0.5 }), 0, 0.56, 1.15); // crankcase
  rbox(b, 0.55, 0.3, 0.36, 0.08, BL, 0, 0.86, 1.08);                                            // fan shroud
  cyl(b, 0.11, 0.11, 0.06, 16, CHROME(), 0, 0.82, 1.3, Math.PI / 2);                            // alternator pulley
  cyl(b, 0.15, 0.15, 0.12, 18, CHROME(), 0, 1.07, 1.05);                                         // air cleaner
  decal(b, dec, 0.73, 0.52, 0.0, 1.0, 0.22);
  both(s => m.wheels.push(wheel(m.root, 0.32, 0.17, s * 0.71, 0.32, -a, true, { style: 'buggy', rimCol: '#c9ccd0' })));
  both(s => m.wheels.push(wheel(m.root, 0.39, 0.28, s * 0.71, 0.39, a, false, { style: 'buggy', tread: 'mud', rimCol: '#c9ccd0' })));
  return m;
}

// Fuselage helper: side profile with a width that follows the plan view w(z).
const fuselage = (p, pts, wz, M, w0, bevel) => shell(p, pts, w0, M, { bevel, def: (y, z) => lerpTab(wz, z) / w0, crease: 0.9 });
function lerpTab(t, x) { for (let i = 1; i < t.length; i++) if (x <= t[i][0]) return lerp(t[i - 1][1], t[i][1], clamp((x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]), 0, 1)); return t[t.length - 1][1]; }

// Cessna 172S Skyhawk: span 11.0 m, length 8.28 m, height 2.72 m, strut-braced high wing (root chord 1.63 m),
// tricycle gear (main track 2.53 m, wheelbase 1.65 m), 1.9 m two-blade propeller.
export function cessna(paint, dec) {
  const m = frame(0.9), b = m.body, P = paintMat(paint), Wg = paintMat('#f2f1ec'), BL = TRIM();
  const wz = [[-3.9, 0.92], [-3.0, 1.04], [-2.4, 1.12], [-0.4, 1.12], [1.2, 0.72], [3.4, 0.3], [4.1, 0.2]];
  fuselage(b, [[-3.85, 0.98], [-3.9, 1.22], [-3.85, 1.46], [-3.55, 1.56], [-2.75, 1.63], [-1.85, 2.0], [-0.2, 2.02], [0.75, 1.62], [2.0, 1.53],
    [3.4, 1.47], [4.05, 1.47], [4.05, 1.18], [3.4, 1.18], [2.0, 1.03], [0.4, 0.86], [-0.5, 0.74], [-2.6, 0.76], [-3.5, 0.86]], wz, P, 1.12, 0.15);
  fuselage(b, [[-2.72, 1.63], [-1.86, 1.985], [-0.25, 2.0], [0.7, 1.63], [0.6, 1.43], [-2.5, 1.43]], wz.map(([z, w]) => [z, w + 0.03]), GLASS(), 1.15, 0.1);
  for (const z of [-1.0, -0.15]) box(b, 1.17, 0.55, 0.07, P, 0, 1.72, z);                      // window posts
  lathe(b, [[0.001, 0.36], [0.07, 0.32], [0.13, 0.22], [0.17, 0.06], [0.17, 0]], 20, P, 0, 1.22, -3.88, -Math.PI / 2); // spinner
  m.props.push(rotor(b, 2, 0.95, 0.12, mat('#2b2c2e', { metalness: 0.5, roughness: 0.4 }), 0, 1.22, -3.98, 0, 0, { root: 0.1 }));
  both(s => {
    rbox(b, 0.14, 0.14, 0.05, 0.03, BL, s * 0.26, 1.06, -3.86);                                // cowl inlets
    tube(b, [s * 0.52, 0.95, -1.3], [s * 2.55, 1.98, -1.42], 0.04, Wg).scale.z = 2;            // wing strut
    tube(b, [s * 0.48, 0.82, -1.2], [s * 1.27, 0.2, -1.15], 0.035, STEEL());                    // spring-steel main leg
    m.wheels.push(wheel(b, 0.19, 0.13, s * 1.27, 0.19, -1.15, false));
    ball(b, 0.3, P, s * 1.27, 0.25, -1.12, 0.45, 0.6, 1.5);                                       // wheel pant
    const nav = s > 0 ? '#1fa64a' : '#d42a2a';
    rbox(b, 0.06, 0.05, 0.12, 0.02, mat(nav, { clean: true, emissive: nav, emissiveIntensity: 1.5 }), s * 5.52, 2.19, -1.65);
  });
  wing(b, 11.0, ax => ax < 2.6 ? 1.63 : 1.63 - (ax - 2.6) / 2.9 * 0.51, Wg, { y: 2.02, z: -1.78, dihedral: 0.03, sweep: ax => ax < 2.6 ? 0 : (ax - 2.6) / 2.9 * 0.2 });
  wing(b, 3.45, ax => 1.1 - ax / 1.725 * 0.32, Wg, { y: 1.36, z: 3.05, foil: airfoil(0, 0.4, 0.09) });
  shell(b, [[2.75, 1.45], [3.75, 2.72], [4.16, 2.72], [4.12, 1.35], [3.3, 1.42]], 0.12, Wg, { bevel: 0.04 });  // swept fin
  shell(b, [[2.0, 1.5], [3.0, 1.62], [3.0, 1.46]], 0.1, P, { bevel: 0.03 });                       // dorsal fillet
  tube(b, [0, 0.95, -3.0], [0, 0.17, -2.85], 0.035, STEEL());                                     // nose oleo
  m.wheels.push(wheel(b, 0.17, 0.11, 0, 0.17, -2.85, true));
  ball(b, 0.26, P, 0, 0.23, -2.83, 0.35, 0.55, 1.4);
  rbox(b, 0.05, 0.05, 0.3, 0.02, BL, 0.25, 0.85, -3.4);                                            // exhaust stub
  decal(b, dec, 0.565, 1.15, -1.4, 1.8, 0.3);
  return m;
}

// DHC-2 Beaver on floats: span 14.64 m, length 9.24 m, constant-chord wing (1.59 m), R-985 radial in a round cowl.
export function seaplane(paint, dec) {
  const m = frame(1), b = m.body, P = paintMat(paint), Wg = paintMat('#f2f1ec'), BL = TRIM(), Y = 1.55, FL = paintMat('#d6d9db');
  const wz = [[-4.3, 1.28], [-3.4, 1.3], [-0.5, 1.3], [1.2, 0.95], [4.3, 0.3], [4.8, 0.2]];
  const pts = [[-4.3, 0.12], [-4.35, 0.75], [-4.3, 1.38], [-3.6, 1.42], [-2.7, 1.5], [-2.0, 1.9], [0.2, 1.92], [1.0, 1.58], [2.6, 1.42], [4.3, 1.3],
    [4.75, 1.3], [4.75, 1.02], [4.3, 0.98], [2.6, 0.72], [1.2, 0.45], [0, 0], [-3.2, 0], [-3.9, 0.08]].map(([z, y]) => [z, y + Y]);
  fuselage(b, pts, wz, P, 1.3, 0.28);
  fuselage(b, [[-2.68, 1.52], [-2.02, 1.87], [0.15, 1.88], [0.95, 1.6], [0.8, 1.15], [-2.5, 1.15]].map(([z, y]) => [z, y + Y]), wz.map(([z, w]) => [z, w + 0.03]), GLASS(), 1.33, 0.12);
  for (const z of [-1.4, -0.4]) box(b, 1.34, 0.72, 0.08, P, 0, Y + 1.5, z);
  lathe(b, [[0.5, 0], [0.66, 0.05], [0.68, 0.3], [0.66, 0.9], [0.62, 0.95]], 28, P, 0, Y + 0.75, -3.5, -Math.PI / 2);   // round cowl
  cyl(b, 0.5, 0.5, 0.05, 24, mat('#151617'), 0, Y + 0.75, -4.4, Math.PI / 2);
  lathe(b, [[0.001, 0.3], [0.1, 0.25], [0.16, 0.08], [0.17, 0]], 18, P, 0, Y + 0.75, -4.42, -Math.PI / 2);
  m.props.push(rotor(b, 2, 1.3, 0.16, mat('#2b2c2e', { metalness: 0.5, roughness: 0.4 }), 0, Y + 0.75, -4.5, 0, 0, { root: 0.12 }));
  wing(b, 14.64, () => 1.59, Wg, { y: Y + 1.9, z: -2.05, dihedral: 0.03, foil: airfoil(0.04, 0.4, 0.16) });
  wing(b, 4.8, ax => 1.35 - ax / 2.4 * 0.3, Wg, { y: Y + 1.25, z: 3.4, foil: airfoil(0, 0.4, 0.1) });
  shell(b, [[3.1, Y + 1.3], [3.9, Y + 2.25], [4.2, Y + 2.95], [4.6, Y + 3.0], [4.9, Y + 2.6], [4.85, Y + 1.15]], 0.12, Wg, { bevel: 0.05 });
  shell(b, [[2.0, Y + 1.42], [3.3, Y + 1.7], [3.3, Y + 1.38]], 0.1, P, { bevel: 0.03 });
  // floats: chined pontoons with a step, spreader bars and N-struts
  const fpts = [[-3.9, 0.5], [-3.7, 0.72], [3.3, 0.72], [3.65, 0.62], [3.6, 0.42], [0.55, 0.12], [0.5, 0.0], [-2.9, 0.02], [-3.6, 0.22]];
  both(s => {
    shell(b, fpts, 0.78, FL, { bevel: 0.2, def: (y, z) => (1 - 0.45 * Math.max(0, (-z - 2.4) / 1.5) ** 2) * (1 - 0.55 * Math.max(0, (z - 1.2) / 2.45)) }).position.set(s * 1.4, 0, -0.5);
    for (const [z0, z1] of [[-2.3, -2.0], [0.1, 0.1]]) tube(b, [s * 1.4, 0.72, z0 - 0.5], [s * 0.5, Y + 0.05, z1 - 0.5], 0.04, BL);
    tube(b, [s * 1.4, 0.72, -2.8], [s * 0.5, Y + 0.05, -2.0], 0.04, BL);
    tube(b, [s * 0.6, Y + 0.25, -1.5], [s * 2.9, Y + 1.88, -1.5], 0.045, Wg).scale.z = 2;
    rbox(b, 0.02, 0.22, 0.28, 0.01, BL, s * 1.4, 0.45, 3.2);                                     // water rudder
    const nav = s > 0 ? '#1fa64a' : '#d42a2a';
    rbox(b, 0.06, 0.05, 0.12, 0.02, mat(nav, { clean: true, emissive: nav, emissiveIntensity: 1.5 }), s * 7.3, Y + 2.07, -1.9);
  });
  for (const z of [-2.5, 0.4]) tube(b, [-1.4, 0.72, z], [1.4, 0.72, z], 0.04, BL);
  decal(b, dec, 0.655, Y + 0.8, -1.3, 1.9, 0.36);
  m.wheels = []; // floats: nothing turns
  return m;
}

// Bell 47G: main rotor 11.32 m (37 ft 1.5 in), fuselage 9.63 m, height 2.83 m, bubble canopy, lattice tail boom, skids.
export function helicopter(paint, dec) {
  const m = frame(0.8), b = m.body, P = paintMat(paint), BL = TRIM(), S = mat('#9fa3a7', { metalness: 0.8, roughness: 0.3 });
  add(b, new THREE.SphereGeometry(0.95, 32, 22, 0, Math.PI * 2, 0, Math.PI * 0.72), mat('#a9c3d2', { physical: true, clean: true, transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.03, clearcoat: 1, envMapIntensity: 2 }), 0, 1.25, -0.55).scale.set(0.86, 1.0, 1.0); // bubble
  rbox(b, 1.5, 0.36, 1.75, 0.16, P, 0, 0.74, -0.5);                       // cabin tub
  rbox(b, 1.3, 0.4, 0.3, 0.08, BL, 0, 1.05, 0.25);                        // seat back / bulkhead
  rbox(b, 0.36, 0.42, 0.3, 0.06, BL, 0, 1.08, -1.2);                      // instrument pedestal
  rbox(b, 1.2, 0.14, 0.55, 0.06, mat('#5b4a3a', { roughness: 0.8 }), 0, 0.98, -0.1);   // bench seat
  tube(b, [-0.2, 0.92, -0.7], [-0.25, 1.35, -0.45], 0.02, BL);            // cyclic stick
  rbox(b, 0.95, 0.7, 0.75, 0.08, mat('#3b3e42', { metalness: 0.5, roughness: 0.5 }), 0, 1.25, 0.85); // engine bay
  for (let i = 0; i < 3; i++) both(s => cyl(b, 0.1, 0.1, 0.22, 10, S, s * 0.5, 1.1 + i * 0.2, 0.85, 0, 0, Math.PI / 2)); // vertical engine cylinders
  both(s => {
    cyl(b, 0.22, 0.22, 0.95, 18, P, s * 0.45, 1.86, 0.8, Math.PI / 2);   // saddle tanks
    for (const z of [0.33, 1.27]) add(b, new THREE.SphereGeometry(0.22, 14, 10), P, s * 0.45, 1.86, z);
    tube(b, [s * 1.15, 0.05, -1.4], [s * 1.15, 0.05, 1.35], 0.045, S);   // skids
    tube(b, [s * 1.15, 0.05, -1.4], [s * 1.15, 0.22, -1.75], 0.045, S);
    for (const z of [-0.95, 0.75]) tube(b, [s * 1.15, 0.05, z], [s * 0.55, 0.66, z + 0.05], 0.04, S);
  });
  for (const z of [-0.9, 0.8]) tube(b, [-0.55, 0.66, z + 0.05], [0.55, 0.66, z + 0.05], 0.04, S);
  cyl(b, 0.09, 0.12, 1.2, 12, S, 0, 2.2, 0);                              // mast
  rbox(b, 0.5, 0.4, 0.5, 0.08, S, 0, 1.75, 0);                            // transmission
  const mr = rotor(b, 2, 5.66, 0.28, mat('#26282b', { roughness: 0.5 }), 0, 2.8, 0, -Math.PI / 2, 0, { twist: 0.06, root: 0.25, thick: 0.04 });
  tube(mr, [-1.0, 0, -0.18], [1.0, 0, -0.18], 0.025, S, 6);               // Bell stabiliser bar under the blades
  for (const s of [-1, 1]) add(mr, new THREE.SphereGeometry(0.07, 10, 8), S, s * 1.02, 0, -0.18);
  m.rotors.push(mr);
  // lattice tail boom: three longerons, frames and zig-zag diagonals (painted tube)
  const A = [[-0.26, 1.12, 1.05], [0.26, 1.12, 1.05], [0, 1.62, 1.05]], B = [[-0.05, 1.42, 6.55], [0.05, 1.42, 6.55], [0, 1.52, 6.55]], N = 8;
  const at = (i, k) => A[k].map((v, j) => lerp(v, B[k][j], i / N));
  for (let k = 0; k < 3; k++) tube(b, A[k], B[k], 0.03, P, 6);
  for (let i = 0; i <= N; i++) for (let k = 0; k < 3; k++) {
    tube(b, at(i, k), at(i, (k + 1) % 3), 0.018, P, 5);
    if (i < N) tube(b, at(i, k), at(i + 1, (k + 1) % 3), 0.015, P, 5);
  }
  tube(b, [0, 1.42, 1.05], [0, 1.45, 6.6], 0.02, S, 6);                   // tail-rotor drive shaft
  rbox(b, 1.1, 0.04, 0.32, 0.02, P, 0, 1.38, 5.5);                         // stabiliser
  const tr = rotor(b, 2, 0.865, 0.11, mat('#d9d9d9', { roughness: 0.4 }), -0.16, 1.48, 6.62, 0, Math.PI / 2, { root: 0.06 });
  tr.userData.rate = 230; m.rotors.push(tr);
  tube(b, [0, 1.36, 6.0], [0, 0.6, 6.55], 0.025, S); tube(b, [0, 0.6, 6.55], [0, 1.4, 6.7], 0.025, S); // tail guard
  cyl(b, 0.06, 0.06, 0.05, 12, LIGHT(), 0, 0.55, -1.25, Math.PI / 2);
  decal(b, dec, 0.75, 0.74, -0.5, 1.2, 0.28);
  return m;
}

// Superellipse hull half-width at height y (matches hullGeo with no keel rise), for placing things on the topsides.
const sideX = (beam, depth, n, y) => beam / 2 * Math.sin(Math.acos(clamp(1 - y / depth, 0, 1) ** (n / 2))) ** (2 / n);
const deckOf = c => mat(c, { roughness: 0.75 });

// Safari river boat: 9 m flat-bottom aluminium hull, 2.6 m beam, canvas canopy, single outboard.
export function riverboat(paint, dec) {
  const m = frame(1), b = m.body, P = paintMat(paint), BL = TRIM(), D = 0.95, canvas = mat('#d9c9a0', { roughness: 0.95, side: THREE.DoubleSide });
  hull(b, { len: 9, beam: 2.6, depth: D, n: 5, bowT: 0.3, transom: 0.95, rise: 0.7, sheer: 0.25 }, paint, deckOf('#8a6a48'), 0.35);
  both(s => {
    rbox(b, 0.08, 0.08, 6.2, 0.03, BL, s * 1.3, D, 1.2);                   // rub rail
    for (const z of [-2.4, -0.4, 1.6, 3.6]) tube(b, [s * 1.18, D, z], [s * 1.18, 2.95, z], 0.035, ALU());
    tube(b, [s * 1.2, D + 0.55, -2.8], [s * 1.2, D + 0.55, 4.3], 0.025, ALU()); // side rail
  });
  for (const z of [-1.6, -0.4, 0.8, 2.0]) {
    rbox(b, 2.2, 0.14, 0.45, 0.05, mat('#3c4a3a', { roughness: 0.8 }), 0, D + 0.42, z);   // bench cushions
    rbox(b, 2.2, 0.4, 0.08, 0.03, mat('#3c4a3a', { roughness: 0.8 }), 0, D + 0.65, z + 0.24);
    rbox(b, 2.1, 0.35, 0.4, 0.03, ALU(), 0, D + 0.17, z);
  }
  rbox(b, 2.72, 0.06, 6.6, 0.03, canvas, 0, 3.0, 0.6);                      // canopy
  both(s => rbox(b, 0.02, 0.2, 6.6, 0.01, canvas, s * 1.36, 2.9, 0.6));
  rbox(b, 0.7, 0.9, 0.5, 0.08, mat('#e9e6df'), 0.6, D + 0.45, 3.3);         // helm console
  add(b, new THREE.TorusGeometry(0.16, 0.015, 6, 20), BL, 0.6, D + 0.95, 3.05, -0.6);
  rbox(b, 0.48, 0.56, 0.66, 0.16, mat('#1c1e21', { physical: true, clearcoat: 1, roughness: 0.3 }), 0, 1.28, 4.65); // outboard cowl
  rbox(b, 0.16, 0.95, 0.24, 0.06, BL, 0, 0.6, 4.78);
  rbox(b, 0.14, 0.14, 0.42, 0.06, BL, 0, 0.16, 4.82);
  m.props.push(rotor(b, 3, 0.17, 0.08, ALU(), 0, 0.16, 5.05, 0, 0, { twist: 0.5 }));
  cyl(b, 0.05, 0.05, 0.08, 10, LIGHT(), 0, D + 0.3, -4.4);
  decal(b, dec, sideX(2.6, D, 5, 0.62), 0.62, 0.4, 4.5, 0.36);
  m.wake = wake(b, 2.6, 4.5, 0.36);
  return m;
}

// Sailing steamship, about 50 m: black hull with a clipper bow, barque rig (square sails on fore and main), one funnel.
export function steamliner(paint, dec) {
  const m = frame(1), b = m.body, Dk = 5.2, Wh = mat('#efeadf', { roughness: 0.5 }), Wd = mat('#6b4a2b', { roughness: 0.7 }), R = mat('#2a2826', { roughness: 0.8 });
  const sail = mat('#ece3cc', { roughness: 0.95, side: THREE.DoubleSide });
  hull(b, { len: 50, beam: 8, depth: Dk, n: 2.4, bowT: 0.4, transom: 0.55, rise: 0.35, rake: 4, sheer: 1.2, rows: 36 }, paint, deckOf('#9c7a52'), 2.5);
  rbox(b, 5, 2.4, 14, 0.15, Wh, 0, Dk + 1.2, 2);                           // deckhouse
  rbox(b, 5.6, 2.1, 4, 0.12, Wh, 0, Dk + 3.45, -8);                         // bridge
  rbox(b, 5.66, 0.7, 4.06, 0.06, GLASS(), 0, Dk + 3.8, -8);
  for (let i = 0; i < 6; i++) both(s => cyl(b, 0.28, 0.28, 0.05, 14, GLASS(), s * 2.52, Dk + 1.4, -3 + i * 2, 0, 0, Math.PI / 2)); // deckhouse ports
  const F = mat('#b8862b', { roughness: 0.5 });
  cyl(b, 1.1, 1.25, 6, 20, F, 0, Dk + 5, -1.4, 0.08);     // raked funnel
  cyl(b, 1.13, 1.12, 1.1, 20, mat('#141414'), 0, Dk + 7.6, -1.2, 0.08);
  for (const [x, z] of [[-1.8, -5], [1.8, -5], [-1.8, 9.5], [1.8, 9.5]]) { // cowl ventilators
    cyl(b, 0.18, 0.18, 2, 10, Wh, x, Dk + 1, z);
    lathe(b, [[0.18, 0], [0.3, 0.2], [0.42, 0.45]], 14, mat('#b8862b', { side: THREE.DoubleSide }), x, Dk + 2.2, z - 0.1, -1.2);
  }
  const masts = [[-14, 25, true], [7, 24, true], [17, 19, false]];
  for (const [z, h, square] of masts) {
    cyl(b, 0.2, 0.36, h, 12, Wd, 0, Dk + h / 2, z);
    both(s => { for (let i = 0; i < 3; i++) tube(b, [0, Dk + h * 0.82, z], [s * 3.9, Dk + 0.5, z + 1.5 - i * 1.6], 0.04, R, 4); }); // shrouds
    if (square) for (const [w, y0, y1] of [[13, 8, 13.4], [10.5, 13.8, 18.4], [8, 18.8, 22.2]]) {
      tube(b, [-w / 2, Dk + y1, z], [w / 2, Dk + y1, z], 0.16, Wd, 8);       // yard
      const g = new THREE.PlaneGeometry(w * 0.96, y1 - y0 - 0.3, 6, 5), pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) / (w / 2), v = pa.getY(i) / ((y1 - y0) / 2); pa.setZ(i, -1.1 * (1 - u * u) * (1 - 0.6 * v * v)); }
      g.computeVertexNormals();
      add(b, g, sail, 0, Dk + (y0 + y1) / 2, z - 0.25);
    }
  }
  // mizzen gaff sail and jibs: fore-and-aft canvas
  const gaff = new THREE.Shape([new THREE.Vector2(17.3, Dk + 2.5), new THREE.Vector2(17.3, Dk + 15), new THREE.Vector2(23.5, Dk + 17), new THREE.Vector2(24.5, Dk + 2.5)]);
  add(b, new THREE.ShapeGeometry(gaff).rotateY(-Math.PI / 2), sail);
  tube(b, [0, Dk + 15, 17.2], [0, Dk + 17.2, 23.8], 0.12, Wd); tube(b, [0, Dk + 2.5, 17.2], [0, Dk + 2.5, 24.8], 0.12, Wd);
  tube(b, [0, Dk + 1.5, -27], [0, Dk + 3.4, -35], 0.25, Wd);              // bowsprit
  for (const [zt, yt] of [[-35, Dk + 3.4], [-32, Dk + 2.6]]) {
    const jib = new THREE.Shape([new THREE.Vector2(zt + 1, yt + 0.4), new THREE.Vector2(-14.6, Dk + 21 - (zt + 35) * 1.5), new THREE.Vector2(-16.5, Dk + 1.8)]);
    add(b, new THREE.ShapeGeometry(jib).rotateY(-Math.PI / 2), sail);
    tube(b, [0, yt, zt], [0, Dk + 24.5, -14], 0.035, R, 4);
  }
  tube(b, [0, Dk + 24.5, -14], [0, Dk + 23.5, 7], 0.035, R, 4); tube(b, [0, Dk + 23.5, 7], [0, Dk + 18.5, 17], 0.035, R, 4);
  both(s => {
    for (let z = -20; z <= 22; z += 2.4) cyl(b, 0.03, 0.03, 1, 4, mat('#cfc8b6'), s * sideX(8, Dk, 2.4, Dk) * 0.98, Dk + 0.5, z); // stanchions
    tube(b, [s * 3.9, Dk + 1, -20], [s * 3.9, Dk + 1, 22], 0.04, mat('#cfc8b6'));
    for (let i = 0; i < 14; i++) cyl(b, 0.2, 0.2, 0.05, 12, GLASS(), s * sideX(8, Dk, 2.4, 3.9), 3.9, -17 + i * 2.6, 0, 0, Math.PI / 2); // portholes
    const lb = add(b, hullGeo({ len: 7, beam: 2, depth: 0.9, n: 2, bowT: 0.45, transom: 0.3, rise: 0.3, rows: 12, cols: 6 }), [mat('#f4f4f0'), deckOf('#9c7a52')], s * 3.3, Dk + 1.5, 11);
    lb.material[0].side = THREE.DoubleSide;
    for (const z of [8.5, 13.5]) { tube(b, [s * 3.7, Dk, z], [s * 3.7, Dk + 2.6, z], 0.07, Wh); tube(b, [s * 3.7, Dk + 2.6, z], [s * 3.3, Dk + 2.8, z], 0.07, Wh); } // davits
  });
  decal(b, dec, sideX(8, Dk, 2.4, 4.2), 4.2, 0, 22, 1.5);
  const top = new THREE.Vector3(0, Dk + 8.3, -1.1), w = new THREE.Vector3();
  let acc = 0;
  m.smoke = (s, dt, o) => { // coal smoke from the funnel, left behind in world space as the ship steams on
    if ((acc += dt * (3 + 6 * Math.abs(s.thr))) < 1) return;
    acc = 0; w.copy(top); o.localToWorld(w);
    const R = Math.random, c = 0.14 + R() * 0.08;
    s.emit(w.x + (R() - 0.5), w.y, w.z + (R() - 0.5), (R() - 0.5) * 0.8, 2.5 + R(), (R() - 0.5) * 0.8, 10, 2.2, [c, c, c * 1.02, 0.5], -0.25, 1.6, 0.25);
  };
  m.wake = wake(b, 8, 25, 2.55);
  return m;
}

// Explorer yacht, 28 m: steel displacement hull, plumb bow, wheelhouse with raked glass, flybridge, radar mast, tender.
export function yacht(paint, dec) {
  const m = frame(1), b = m.body, Dk = 3.8, Wh = mat('#f4f4f1', { physical: true, roughness: 0.3, clearcoat: 0.6 }), BL = TRIM();
  hull(b, { len: 28, beam: 7, depth: Dk, n: 1.7, bowT: 0.42, transom: 0.9, rise: 0.4, rake: 0.8, sheer: 1.0, rows: 32 }, paint, deckOf('#a0794d'), 1.8);
  rbox(b, 6.0, 2.4, 13, 0.3, Wh, 0, Dk + 1.2, 0.5);                        // main deckhouse
  rbox(b, 6.06, 1.1, 12, 0.1, GLASS(), 0, Dk + 1.3, 0.8);                   // saloon windows
  shell(b, [[-5.5, Dk + 2.4], [-4.6, Dk + 4.6], [0.5, Dk + 4.6], [0.5, Dk + 2.4]], 5.6, Wh, { bevel: 0.15 }); // wheelhouse
  shell(b, [[-5.32, Dk + 3.0], [-4.72, Dk + 4.25], [0.55, Dk + 4.25], [0.55, Dk + 3.0]], 5.66, GLASS(), { bevel: 0.08 });
  rbox(b, 5.8, 0.18, 10.5, 0.06, Wh, 0, Dk + 4.68, 0.6);                    // flybridge deck
  rbox(b, 5.9, 0.5, 0.06, 0.02, GLASS(), 0, Dk + 5.0, -4.6, -0.3);           // flybridge screen
  both(s => {
    tube(b, [s * 2.9, Dk + 5.7, -4.2], [s * 2.9, Dk + 5.7, 5.7], 0.035, CHROME());
    for (const z of [-4.2, -1, 2.4, 5.7]) tube(b, [s * 2.9, Dk + 4.75, z], [s * 2.9, Dk + 5.7, z], 0.03, CHROME());
    tube(b, [s * 3.2, Dk + 1.0, -7], [s * 0.3, Dk + 2.1, -13.6], 0.035, CHROME());   // bow rail
    for (let i = 0; i < 9; i++) cyl(b, 0.16, 0.16, 0.05, 12, GLASS(), s * sideX(7, Dk, 1.7, 2.6), 2.6, -9 + i * 2.2, 0, 0, Math.PI / 2); // portholes
    tube(b, [s * 2.4, Dk + 4.8, 1.5], [s * 0.9, Dk + 7.6, 2.3], 0.1, Wh);   // radar arch legs
    const nav = s > 0 ? '#1fa64a' : '#d42a2a';
    rbox(b, 0.08, 0.14, 0.24, 0.03, mat(nav, { clean: true, emissive: nav, emissiveIntensity: 1.5 }), s * 3.02, Dk + 4.0, -4.0);
  });
  rbox(b, 2.0, 0.3, 1.2, 0.12, Wh, 0, Dk + 7.7, 2.3);                       // mast top
  ball(b, 0.45, Wh, -0.55, Dk + 8.3, 2.3); ball(b, 0.3, Wh, 0.65, Dk + 8.2, 2.5);  // satcom radomes
  const radar = new THREE.Group(); radar.position.set(0, Dk + 8.95, 2.0); b.add(radar);
  rbox(radar, 2.4, 0.18, 0.28, 0.06, BL, 0, 0, 0); cyl(b, 0.18, 0.2, 0.4, 12, BL, 0, Dk + 8.7, 2.0);
  m.spinners.push(radar);
  for (const x of [-0.8, 0.9]) tube(b, [x, Dk + 7.85, 2.6], [x * 1.1, Dk + 10.4, 2.7], 0.02, Wh, 5); // whip antennas
  rbox(b, 1.6, 0.85, 0.8, 0.15, Wh, -0.6, Dk + 5.1, -2.6);                  // flybridge helm
  rbox(b, 2.8, 0.45, 0.8, 0.15, mat('#d8cbb0', { roughness: 0.8 }), 0, Dk + 5.0, 3.5); // seating
  rbox(b, 6.6, 0.12, 1.6, 0.04, deckOf('#a0794d'), 0, 1.95, 14.6);          // swim platform
  // tender: a RIB with an orange collar on the aft deck, and its crane
  const tg = add(b, hullGeo({ len: 4.2, beam: 1.8, depth: 0.55, n: 2, bowT: 0.4, transom: 0.85, rise: 0.4, rows: 12, cols: 6 }), [mat('#3c3f44'), mat('#2e3135')], 0, Dk + 0.05, 10.5);
  tg.rotation.y = Math.PI / 2; tg.material[0].side = THREE.DoubleSide;
  const tc = add(b, hullGeo({ len: 4.5, beam: 2.1, depth: 0.35, n: 2.2, bowT: 0.45, transom: 0.9, rise: 0.2, rows: 12, cols: 6 }), [mat('#e8742a'), mat('#2e3135')], 0, Dk + 0.35, 10.5);
  tc.rotation.y = Math.PI / 2; tc.material[0].side = THREE.DoubleSide;
  cyl(b, 0.14, 0.18, 2.2, 10, Wh, 2.6, Dk + 1.1, 8.0); tube(b, [2.6, Dk + 2.2, 8.0], [0.4, Dk + 2.6, 10.3], 0.09, Wh);
  cyl(b, 0.1, 0.1, 0.2, 10, LIGHT(), 0, Dk + 8.5, 2.3);
  decal(b, dec, sideX(7, Dk, 1.7, 2.9), 2.9, 1, 9, 0.7);
  m.wake = wake(b, 7, 14, 1.85);
  return m;
}
