# Credits and Third-Party Material

Every third-party resource used to build Procella, with its licence. NASA Space Apps requires citing
all code, text, images, fonts and data used, including open-source material.

## Data

| Source | Use | Terms |
|---|---|---|
| NASA POWER (MERRA-2, CERES SYN1deg, GEWEX SRB, GPM IMERG derived) | Trend series | NASA open data |
| ORNL DAAC MODIS Web Service (MOD13Q1) | Vegetation index | NASA open data |
| NASA GISTEMP v4 | Global context | NASA open data |

## Development tooling (not shipped in the app)

| Item | Source | Licence | Version |
|---|---|---|---|
| GSAP agent skills (core, timeline, scrolltrigger, plugins, performance, utils) | github.com/greensock/gsap-skills | MIT, `.claude/skills/LICENSES/gsap-skills-MIT.txt` | commit aed9cfd |
| three.js agent skills (11 skills) | github.com/CloudAI-X/threejs-skills | MIT, `.claude/skills/LICENSES/threejs-skills-MIT.txt` | commit 0e18186 |
| pymannkendall (test reference only) | PyPI | MIT | used in a local venv |

## App libraries and fonts

Added here as the build pulls them in.

| Item | Use | Licence |
|---|---|---|
| three.js r187 and addons (Sky, GLTFLoader, BufferGeometryUtils, SkeletonUtils, RoomEnvironment, RoundedBoxGeometry) | 3D engine, physical sky, model loading | MIT, vendored in `app/vendor/` |
| EZ-Tree 1.1.0 by Daniel Greenheck | Procedural trees (bark and leaf textures bundled) | MIT, `app/vendor/ez-tree.LICENSE` |
| EZ-Tree app rock models (rock1 to rock3.glb) | Boulders | MIT (same repository) |
| Poly Haven textures: aerial_grass_rock, dry_ground_01, aerial_rocks_02, coast_sand_01, snow_02, brown_mud_02, forest_ground_04, clay_plaster, brick_wall_02, clay_roof_tiles, corrugated_iron, brown_planks_05, concrete_block_wall, aerial_asphalt_01 | Ground and building surfaces (resized to 512 px) | CC0, polyhaven.com |
| three.js waternormals.jpg | Water surface normals | MIT (three.js examples) |

## Imagery and elevation

| Source | Use | Terms |
|---|---|---|
| Sentinel-2 cloudless 2020 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2020) | Ground colour at 10 m | CC BY-NC-SA 4.0, s2maps.eu; attribution shown in the app |
| NASA GIBS: Blue Marble Next Generation, MODIS Terra Corrected Reflectance, GPM IMERG, AIRS | Globe and fallback ground colour | NASA open data |
| AWS Terrain Tiles (Mapzen terrarium: SRTM, GMTED2010, ETOPO1) | Elevation | Open data, registry.opendata.aws/terrain-tiles |
| OpenStreetMap via Nominatim | Place names | © OpenStreetMap contributors, ODbL |
