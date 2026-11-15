// Nine low-poly vehicle models in metres. Forward is -z, lowest point at y = 0.
import * as THREE from 'three';
import { frame, add, box, cyl, tube, wheel, wheels, rotor, hull, profile, decal, wake, smoke, mat, paintMat, GLASS, LIGHT, TAIL } from './parts.js';

const D = '#26282b', CHROME = '#cfd3d6';

export function offroad(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint);
  box(b, 1.9, 0.75, 4.7, P, 0, 0.95, 0);                 // lower body
  box(b, 1.8, 0.7, 2.9, P, 0, 1.675, 0.35);              // cabin
  box(b, 1.82, 0.48, 2.5, GLASS(), 0, 1.7, 0.35);        // side glass
  box(b, 1.66, 0.5, 2.92, GLASS(), 0, 1.7, 0.35);        // windscreen + rear glass
  box(b, 1.5, 0.4, 0.06, D, 0, 0.95, -2.36);             // grille
  for (const z of [-2.42, 2.42]) box(b, 2.0, 0.22, 0.25, D, 0, 0.62, z); // bumpers
  for (const s of [-1, 1]) {
    box(b, 0.32, 0.18, 0.05, LIGHT(), s * 0.68, 1.08, -2.37);
    box(b, 0.2, 0.25, 0.05, TAIL(), s * 0.8, 1.05, 2.37);
    box(b, 0.05, 0.05, 2.6, D, s * 0.85, 2.15, 0.35);    // roof rack rails
    box(b, 0.12, 0.1, 0.2, D, s * 0.95, 1.55, -1.0);     // mirrors
  }
  for (const z of [-0.8, 0, 0.8, 1.55]) box(b, 1.75, 0.04, 0.06, D, 0, 2.12, z);
  tube(b, [0.97, 0.95, -1.35], [0.97, 2.2, -1.2], 0.06, D); // snorkel
  box(b, 0.16, 0.14, 0.24, D, 0.97, 2.25, -1.26);
  box(b, 1.5, 0.12, 0.12, D, 0, 2.24, -0.95);            // light bar
  for (let i = 0; i < 4; i++) box(b, 0.28, 0.08, 0.04, LIGHT(), -0.54 + i * 0.36, 2.24, -1.02);
  box(b, 0.35, 0.45, 0.17, '#4b5d2a', -0.45, 2.37, 1.3); // jerrycans
  box(b, 0.35, 0.45, 0.17, '#a8281e', -0.45, 2.37, 1.08);
  box(b, 0.8, 0.32, 0.9, '#6b5a40', 0.35, 2.3, 0.75);    // cargo bag
  cyl(b, 0.4, 0.4, 0.26, 12, '#1d1d1f', 0, 1.15, 2.55, Math.PI / 2); // spare tyre
  decal(b, dec, 0.95, 0.95, 0.1, 3.4, 0.55);
  wheels(m, 0.43, 0.33, 0.82, -1.425, 1.425);
  return m;
}

export function sedan(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint);
  box(b, 1.83, 0.6, 4.8, P, 0, 0.62, 0);
  profile(b, [[-1.05, 0.9], [1.35, 0.9], [0.8, 1.42], [-0.3, 1.42]], 1.62, GLASS()); // glass cabin
  box(b, 1.5, 0.05, 1.05, P, 0, 1.44, 0.25);             // roof
  box(b, 0.8, 0.18, 0.05, D, 0, 0.6, -2.41);             // grille
  for (const z of [-2.38, 2.38]) box(b, 1.85, 0.16, 0.2, D, 0, 0.42, z);
  for (const s of [-1, 1]) {
    box(b, 0.42, 0.12, 0.05, LIGHT(), s * 0.6, 0.78, -2.41);
    box(b, 0.45, 0.14, 0.05, TAIL(), s * 0.6, 0.8, 2.41);
    box(b, 0.18, 0.1, 0.12, P, s * 0.93, 1.0, -0.85);
  }
  decal(b, dec, 0.915, 0.6, 0, 3.6, 0.4);
  wheels(m, 0.33, 0.24, 0.78, -1.4, 1.4);
  return m;
}

export function buggy(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint), T = mat(CHROME, { metalness: 0.6, roughness: 0.3 });
  box(b, 1.2, 0.1, 3.0, D, 0, 0.42, 0);                  // floor pan
  box(b, 1.1, 0.35, 0.9, P, 0, 0.62, -1.4);              // nose
  for (const s of [-1, 1]) {
    box(b, 0.14, 0.3, 1.7, P, s * 0.6, 0.62, 0.05);      // side pods
    box(b, 0.45, 0.12, 0.5, '#222', s * 0.28, 0.53, 0.15); // seats
    box(b, 0.45, 0.65, 0.1, '#222', s * 0.28, 0.9, 0.42);
    tube(b, [s * 0.55, 0.47, 0.5], [s * 0.5, 1.6, 0.5], 0.04, T);    // main hoop
    tube(b, [s * 0.58, 0.47, -0.75], [s * 0.45, 1.45, -0.4], 0.04, T); // A-pillars
    tube(b, [s * 0.45, 1.45, -0.4], [s * 0.5, 1.6, 0.5], 0.04, T);
    tube(b, [s * 0.5, 1.6, 0.5], [s * 0.4, 0.75, 1.45], 0.04, T);     // rear stays
    tube(b, [s * 0.58, 0.55, -0.75], [s * 0.55, 0.55, -1.85], 0.04, T); // nerf bars
    cyl(b, 0.1, 0.1, 0.08, 8, LIGHT(), s * 0.3, 1.55, -0.44, Math.PI / 2);
  }
  tube(b, [-0.5, 1.6, 0.5], [0.5, 1.6, 0.5], 0.04, T);
  tube(b, [-0.45, 1.45, -0.4], [0.45, 1.45, -0.4], 0.04, T);
  tube(b, [-0.5, 1.6, 0.5], [0.55, 0.47, 0.5], 0.04, T);
  tube(b, [-0.55, 0.55, -1.85], [0.55, 0.55, -1.85], 0.04, T);
  box(b, 0.75, 0.45, 0.6, '#5a5a5a', 0, 0.72, 1.1);       // exposed engine
  box(b, 0.85, 0.12, 0.3, '#8a8a8a', 0, 1.0, 1.1);
  cyl(b, 0.13, 0.13, 0.25, 8, '#b02020', 0.25, 1.15, 0.95);
  tube(b, [0.25, 0.8, 1.35], [0.3, 0.95, 1.75], 0.05, '#9a9a9a');
  tube(b, [-0.25, 0.8, 1.35], [-0.3, 0.95, 1.75], 0.05, '#9a9a9a');
  decal(b, dec, 0.67, 0.62, 0.05, 1.6, 0.28);
  wheels(m, 0.38, 0.36, 0.82, -1.2, 1.1);
  return m;
}

function aircraft(paint, dec, floats) {
  const m = frame(), b = m.body, P = paintMat(paint), W = '#efeee8', y = floats ? 1.0 : 0;
  box(b, 1.12, 1.3, 2.8, P, 0, y + 1.35, -0.9);          // cabin
  box(b, 1.0, 1.0, 0.9, P, 0, y + 1.3, -2.75);           // cowl
  add(b, new THREE.ConeGeometry(0.2, 0.4, 8), D, 0, y + 1.3, -3.4, -Math.PI / 2); // spinner
  m.props.push(rotor(b, 2, 0.95, 0.13, D, 0, y + 1.3, -3.3));
  box(b, 1.14, 0.45, 1.9, GLASS(), 0, y + 1.7, -1.0);
  box(b, 0.98, 0.5, 0.06, GLASS(), 0, y + 1.72, -2.32, 0.5);
  add(b, new THREE.CylinderGeometry(0.16, 0.62, 4.0, 6).rotateX(Math.PI / 2), P, 0, y + 1.45, 2.5); // tail cone
  box(b, 0.08, 1.4, 1.2, P, 0, y + 2.2, 4.0, 0.35);      // fin
  box(b, 3.4, 0.07, 0.85, P, 0, y + 1.55, 4.1);          // stabiliser
  box(b, 11, 0.14, 1.5, W, 0, y + 2.08, -1.0);           // high wing
  for (const s of [-1, 1]) {
    box(b, 0.3, 0.16, 1.5, P, s * 5.4, y + 2.08, -1.0);
    box(b, 0.1, 0.08, 0.14, mat(s > 0 ? '#1fa64a' : '#d42a2a', { emissive: s > 0 ? '#1fa64a' : '#d42a2a' }), s * 5.58, y + 2.08, -1.3);
    tube(b, [s * 0.56, y + 0.9, -0.9], [s * 2.7, y + 2.0, -1.0], 0.045, W); // wing struts
    if (floats) {
      box(b, 0.6, 0.5, 5.6, '#dcdcd6', s * 1.3, 0.25, -0.3);
      box(b, 0.6, 0.3, 0.9, '#dcdcd6', s * 1.3, 0.42, -3.4, 0.35);
      tube(b, [s * 1.3, 0.5, -1.9], [s * 0.5, y + 0.72, -1.9], 0.04, D);
      tube(b, [s * 1.3, 0.5, 0.6], [s * 0.5, y + 0.72, 0.3], 0.04, D);
    } else {
      tube(b, [s * 0.5, 0.8, -0.3], [s * 1.2, 0.26, -0.3], 0.04, D); // spring gear
      m.wheels.push(wheel(b, 0.25, 0.15, s * 1.25, 0.25, -0.3, false));
    }
  }
  if (floats) tube(b, [-1.3, 0.5, -1.9], [1.3, 0.5, -1.9], 0.04, D);
  else {
    tube(b, [0, 0.85, -2.6], [0, 0.2, -2.75], 0.045, D);
    m.wheels.push(wheel(b, 0.2, 0.12, 0, 0.2, -2.75, false));
  }
  decal(b, dec, 0.56, y + 1.08, -0.9, 2.6, 0.38);
  return m;
}
export const cessna = (p, d) => aircraft(p, d, false);
export const seaplane = (p, d) => aircraft(p, d, true);

export function helicopter(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint);
  for (const s of [-1, 1]) {
    cyl(b, 0.05, 0.05, 3.4, 6, D, s * 1.05, 0.05, -0.1, Math.PI / 2); // skids
    tube(b, [s * 1.05, 0.05, -0.9], [s * 0.6, 0.8, -0.8], 0.04, D);
    tube(b, [s * 1.05, 0.05, 0.8], [s * 0.6, 0.8, 0.7], 0.04, D);
  }
  add(b, new THREE.SphereGeometry(1, 10, 8), P, 0, 1.55, -0.7).scale.set(0.95, 0.8, 1.3);
  add(b, new THREE.SphereGeometry(1, 10, 8), GLASS(), 0, 1.7, -1.25).scale.set(0.85, 0.7, 0.9); // bubble
  box(b, 1.9, 0.95, 1.6, P, 0, 1.45, 0.3);               // rear cabin
  box(b, 0.9, 0.6, 1.8, P, 0, 2.2, 0.5);                 // engine housing
  add(b, new THREE.CylinderGeometry(0.12, 0.3, 5, 6).rotateX(Math.PI / 2), P, 0, 1.8, 3.3); // tail boom
  box(b, 0.06, 1.1, 0.7, P, 0, 2.25, 5.6, 0.3);
  box(b, 1.4, 0.05, 0.4, P, 0, 1.85, 4.9);
  cyl(b, 0.08, 0.1, 0.5, 6, D, 0, 2.75, 0.2);            // mast
  m.rotors.push(rotor(b, 3, 5.0, 0.3, D, 0, 3.0, 0.2, -Math.PI / 2), rotor(b, 2, 0.75, 0.12, D, 0.12, 2.3, 5.75, 0, Math.PI / 2));
  box(b, 0.2, 0.1, 0.1, LIGHT(), 0, 0.95, -1.9);
  decal(b, dec, 0.95, 1.45, 0.3, 1.5, 0.45);
  return m;
}

export function riverboat(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint);
  hull(b, 9, 2.6, 0.9, 1.4, P);
  hull(b, 9.06, 2.66, 0.08, 1.42, '#7a5a3a', 0.88);      // gunwale
  for (const z of [-1.6, 0, 1.6]) box(b, 2.1, 0.4, 0.45, '#6b4a2b', 0, 1.1, z); // benches
  for (const s of [-1, 1]) for (const z of [-2.6, 0, 2.6]) tube(b, [s * 1.18, 0.9, z], [s * 1.18, 2.9, z], 0.045, '#3a3a3a');
  box(b, 2.84, 0.18, 6.24, P, 0, 2.86, 0);               // canopy valance
  box(b, 2.8, 0.08, 6.2, '#d9c9a0', 0, 2.95, 0);         // canvas roof
  box(b, 0.45, 0.6, 0.55, '#2b2b2b', 0, 1.15, 4.75);     // outboard motor
  box(b, 0.12, 0.9, 0.16, '#333', 0, 0.5, 4.9);
  m.props.push(rotor(b, 3, 0.17, 0.08, '#9a9a9a', 0, 0.22, 5.0));
  decal(b, dec, 1.3, 0.5, 0.4, 5, 0.42);
  m.wake = wake(b, 2.6, 4.5, 0.4);
  return m;
}

export function steamliner(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint), Wh = '#efeadf', Wd = '#6b4a2b', S = '#eee5cf', R = '#333';
  hull(b, 50, 7, 2.5, 8, '#6e1c17');                     // below waterline
  hull(b, 50, 8, 3.5, 9, P, 2.5);
  box(b, 5, 2.5, 16, Wh, 0, 7.25, 2);                    // deckhouse
  box(b, 4, 2, 6, Wh, 0, 9.5, -2);                       // bridge
  box(b, 4.05, 0.6, 6.05, GLASS(), 0, 9.9, -2);
  cyl(b, 1.1, 1.25, 5, 10, '#b82b22', 0, 11, 5);         // funnel
  cyl(b, 1.13, 1.13, 0.9, 10, '#151515', 0, 13.1, 5);
  for (const z of [-14, 17]) cyl(b, 0.25, 0.35, 22, 8, Wd, 0, 17, z); // masts
  for (const [w, y] of [[8, 10.4], [10, 15.6], [8, 21.4]]) box(b, w, 0.22, 0.22, Wd, 0, y, -14); // yards
  box(b, 9, 5, 0.12, S, 0, 13, -13.7);                   // square sails
  box(b, 7, 5, 0.12, S, 0, 18.8, -13.7);
  box(b, 0.12, 9, 7, S, 0, 13.5, 20.8);                  // aft gaff sail
  box(b, 0.18, 0.18, 7.5, Wd, 0, 18.1, 20.8);
  box(b, 0.18, 0.18, 7.5, Wd, 0, 8.9, 20.8);
  tube(b, [0, 28, -14], [0, 6.1, -24.5], 0.06, R);       // stays
  tube(b, [0, 28, -14], [0, 28, 17], 0.06, R);
  tube(b, [0, 28, 17], [0, 6.1, 24.5], 0.06, R);
  for (const s of [-1, 1]) hull(b, 5, 1.6, 0.8, 1.2, '#f4f4f0', 6, -7).position.x = s * 3.3; // lifeboats
  decal(b, dec, 4, 4.3, 0, 28, 1.8);
  m.smoke = smoke(b, 0, 13.8, 5);
  m.wake = wake(b, 8, 25, 2.55);
  return m;
}

export function yacht(paint, dec) {
  const m = frame(), b = m.body, P = paintMat(paint), Wh = '#f5f5f2';
  hull(b, 16, 3.8, 0.9, 4, '#2a2e34');                   // boot
  hull(b, 16, 4.6, 1.6, 4.5, P, 0.9);
  box(b, 3.8, 1.5, 7, Wh, 0, 3.25, 0.5);                 // superstructure
  box(b, 3.86, 0.6, 6.2, GLASS(), 0, 3.35, 0.5);
  box(b, 3.4, 1.0, 0.1, GLASS(), 0, 3.2, -3.05, 0.55);
  box(b, 3.4, 0.15, 4.2, Wh, 0, 4.08, 1.2);              // flybridge deck
  box(b, 3.0, 0.45, 0.06, GLASS(), 0, 4.4, -0.8, 0.5);
  box(b, 0.8, 0.5, 0.6, '#2a2e34', 0, 4.4, 0.2);         // helm
  box(b, 1.6, 0.4, 0.5, '#d8cbb0', 0, 4.35, 1.2);        // seat
  for (const s of [-1, 1]) {
    tube(b, [s * 1.65, 4.75, -0.6], [s * 1.65, 4.75, 3.2], 0.03, CHROME);
    for (const z of [-0.6, 1.3, 3.2]) tube(b, [s * 1.65, 4.15, z], [s * 1.65, 4.75, z], 0.03, CHROME);
    tube(b, [s * 2.1, 2.9, -3.5], [s * 0.3, 2.9, -7.4], 0.03, CHROME); // bow rail
  }
  cyl(b, 0.07, 0.1, 2.4, 6, Wh, 0, 5.3, 2.6);            // mast
  const radar = new THREE.Group(); radar.position.set(0, 5.9, 2.6); b.add(radar);
  box(radar, 1.3, 0.12, 0.22, '#2a2e34', 0, 0, 0);
  m.spinners.push(radar);
  box(b, 0.12, 0.12, 0.12, LIGHT(), 0, 6.55, 2.6);
  box(b, 4.2, 0.12, 1.0, '#a37a4c', 0, 1.0, 8.4);        // swim platform
  for (const [h, c, y] of [[0.55, '#3c3f44', 2.5], [0.25, '#e8742a', 2.8]]) { // tender with orange collar
    const t = hull(b, 3, 1.5, h, 0.8, c, y, 6.0); t.rotation.y = Math.PI / 2;
  }
  decal(b, dec, 2.3, 1.75, 0.5, 8, 0.6);
  m.wake = wake(b, 4.6, 8, 0.85);
  return m;
}
