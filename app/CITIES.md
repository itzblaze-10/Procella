# World cities: data and module contracts

Thirty well-known cities are rebuilt from real OpenStreetMap data (© OpenStreetMap contributors, ODbL),
fetched once with Overpass and committed, so the demo works offline. Landmarks are modelled in code at real size.

## City list (slug, name, country, centre lat, lon). The centre is the most iconic district.
new-york New York, USA 40.7549 -73.9840 | london London, UK 51.5007 -0.1246 | paris Paris, France 48.8584 2.2945
tokyo Tokyo, Japan 35.6595 139.7005 | dubai Dubai, UAE 25.1972 55.2744 | singapore Singapore 1.2834 103.8607
hong-kong Hong Kong 22.2819 114.1580 | sydney Sydney, Australia -33.8568 151.2153 | rome Rome, Italy 41.8902 12.4922
los-angeles Los Angeles, USA 34.0522 -118.2437 | san-francisco San Francisco, USA 37.7952 -122.4028 | barcelona Barcelona, Spain 41.4036 2.1744
istanbul Istanbul, Türkiye 41.0086 28.9802 | mumbai Mumbai, India 18.9220 72.8347 | delhi New Delhi, India 28.6129 77.2295
shanghai Shanghai, China 31.2397 121.4998 | beijing Beijing, China 39.9055 116.3976 | moscow Moscow, Russia 55.7539 37.6208
rio Rio de Janeiro, Brazil -22.9711 -43.1822 | cairo Cairo (Giza), Egypt 29.9870 31.1450 | chicago Chicago, USA 41.8789 -87.6359
toronto Toronto, Canada 43.6426 -79.3871 | berlin Berlin, Germany 52.5163 13.3777 | amsterdam Amsterdam, Netherlands 52.3731 4.8926
seoul Seoul, South Korea 37.5636 126.9822 | bangkok Bangkok, Thailand 13.7500 100.4913 | mexico-city Mexico City, Mexico 19.4326 -99.1332
buenos-aires Buenos Aires, Argentina -34.6037 -58.3816 | cape-town Cape Town, South Africa -33.9249 18.4241 | venice Venice, Italy 45.4341 12.3388

## Data files: `app/data/cities/<slug>.json` (+ `index.json`)
Local metres around the centre, same convention as the game: x = (lon - lon0) * 111320 * cos(lat0), z = -(lat - lat0) * 111320
(x east, z south). All coordinates are integers in decimetres (divide by 10).
```json
{ "slug": "paris", "name": "Paris", "country": "France", "lat": 48.8584, "lon": 2.2945, "radius": 1400,
  "source": "© OpenStreetMap contributors, ODbL. Overpass API, fetched 2026-11-15",
  "b": [[h, minH, kind, x0, z0, x1, z1, ...], ...],
  "r": [[cls, x0, z0, x1, z1, ...], ...],
  "w": [[x0, z0, x1, z1, ...], ...],
  "p": [[x0, z0, x1, z1, ...], ...] }
```
- `b` buildings, outer ring only, closed implicitly (last != first), counter-clockwise or clockwise (renderer must handle both).
  - `h` height in decimetres from `height`, or `building:levels` x 32 (3.2 m per level) + roof, or a per-kind default.
  - `minH` from `min_height` / `building:min_level` (0 normally).
  - `kind`: 0 generic, 1 apartments/residential, 2 office/commercial, 3 retail, 4 industrial/warehouse, 5 religious (church, mosque, temple), 6 house, 7 civic/public/school/government, 8 historic/monument.
- `r` roads (`highway=*` polylines). `cls`: 0 motorway/trunk, 1 primary, 2 secondary/tertiary, 3 residential/unclassified/service, 4 pedestrian/footway/path. Renderer widths in metres: 18, 14, 11, 7, 3.
- `w` water areas (`natural=water`, `waterway=riverbank`, `water=river`): rings, simplified.
- `p` parks and green (`leisure=park|garden`, `landuse=grass|forest`): rings, simplified.
- Rings simplified with Douglas-Peucker at 0.6 m; buildings under 12 m² dropped. Target under 700 KB per city.
- `index.json`: `[{slug, name, country, lat, lon, radius, buildings, bytes}]`.

## City renderer: `app/src/world/city.js`
```js
export async function loadIndex()                    // -> index.json entries
export function cityNear(index, lat, lon, km = 4)    // -> entry or null
export async function loadCity(slug)                 // -> parsed data file
export class City {
  constructor(scene, terrain, data, landmarks = [])  // landmarks: entries from landmarks.js for this city (to clear OSM buildings under them)
  build()                                            // creates meshes (synchronous or returns a Promise)
  collide(x, z, r, y) -> null | { nx, nz, depth, material }   // world coords; y above roof top -> no hit
  blocked(x, z) -> bool                              // inside a building, on a road or in water: no trees/grass/NPCs
  surfaceAt(x, z) -> 'road' | 'water' | null          // null = let the terrain decide
  setNight(n)                                        // 0 day .. 1 night: window lights, street lights
  update(dt, camera)                                 // cheap; optional LOD
  dispose()
}
```
World placement: the city centre maps to `terrain.toLocal(data.lat, data.lon)`; add the decimetre offsets / 10.

## Landmarks: `app/src/world/landmarks.js`
```js
export const LANDMARKS = [{ id, city: '<slug>', name, lat, lon, heading /* compass deg the front faces */,
  clear /* metres: OSM buildings whose centroid is inside are skipped */, build /* () => THREE.Group, metres, base at y = 0, north = -z */,
  colliders /* local: [{ type: 'circle', x, z, r } | { type: 'box', x, z, hw, hd, ry }] */ }]
export function landmarksNear(lat, lon, km = 8) -> entries
```
