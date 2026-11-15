# Procella game: module contracts

Static ES modules, no build step. `index.html` maps `three` to `vendor/three.module.js` with an importmap.
Every module imports three as `import * as THREE from 'three';`. Plain JavaScript (no TypeScript).

## World conventions (shared by everyone)

- Units are metres. `y` is up. `x` = east, `z` = south (so -z is north). Sea level is `y = 0`.
- `terrain.heightAt(x, z)` returns ground elevation in metres (can be negative under the sea).
- `terrain.isWater(x, z)` is true where `heightAt < 0.5`; the water surface is at `y = 0`.
- Frame loop calls `update(dt, ...)` with `dt` in seconds, clamped to at most 0.05.
- `keys` is a plain object: `keys[KeyboardEvent.code] === true` while held (e.g. `keys.KeyW`, `keys.ArrowUp`, `keys.Space`, `keys.ShiftLeft`).
- Models are low-poly, flat-shaded (`MeshStandardMaterial({ flatShading: true })`), built only from three.js primitives in code. No external models, textures or images. Canvas-generated textures are allowed for decals.
- Objects face -z (forward = north) and sit on `y = 0` at their lowest point in local space.
- Brand: night palette. Use the colour values in `app/src/brand.js` for UI accents only; vehicles and people have their own real-world colours.

## Vehicles: `app/src/vehicles/index.js`

```js
export const VEHICLES = [ // 9 entries, this exact order
  { kind: 'offroad',   name, class: 'land',  colors: ['#hex', ...], decals: ['None', ...], blurb },
  { kind: 'sedan',     ... }, { kind: 'buggy', ... },
  { kind: 'cessna',    class: 'air' }, { kind: 'helicopter', class: 'air' }, { kind: 'seaplane', class: 'air' },
  { kind: 'riverboat', class: 'water' }, { kind: 'steamliner', class: 'water' }, { kind: 'yacht', class: 'water' },
];
export function createVehicle(kind, { color, decal }) -> Vehicle
```

`Vehicle` object:
- `kind`, `class`, `object` (THREE.Group, added to the scene by the caller)
- `update(dt, keys, terrain)`: reads keys, runs physics, moves `object`
- `telemetry()`: `{ speedKmh, altitudeM, aglM, headingDeg, throttle, status }` (`status` is a short string such as "Airborne", "On water", "Stalling")
- `controlsHelp`: array of strings, e.g. `['W/S throttle', 'A/D steer', 'Space brake']`
- `cameraOffset`: THREE.Vector3 in local space for the chase camera (behind and above)
- `exitOffset`: THREE.Vector3 in local space where the driver steps out
- `place(x, z, terrain, headingRad)`: put it at a valid start (land on ground; water on water at y = 0; air on the ground, ready to take off)
- `dispose()`: free geometries and materials

Physics expectations (arcade, stable, fun, never explodes):
- Land: sample terrain under four wheels, set pitch and roll from them, gravity, grip, top speeds roughly sedan 160, off-road 120 (best on slopes), buggy 140 (light, jumps) km/h. Cannot drive into water deeper than 1 m (stops at shore).
- Air: Cessna 172 fixed-wing model (throttle, lift proportional to speed squared, stall below about 85 km/h, pitch, roll, yaw, gravity, ground roll for take-off and landing). Helicopter (collective up/down, cyclic tilt moves it, yaw, hover stable). Seaplane: same as Cessna but floats on water and can take off from water.
- Water: buoyancy at y = 0 with bob and roll, turn rate and top speed differ by boat: river boat (flat, nimble), steamliner (slow, huge, smoke from funnel), explorer yacht (fast). Cannot leave water (stops at shore).
- Never pass through terrain: clamp to `heightAt` everywhere.

## People: `app/src/people/index.js`

```js
export const CHARACTERS = [ /* 6 player characters */ { id, name, title, blurb } ];
export function createCharacter(id) -> Person
export const NPC_ROLES = ['farmer', 'fisher', 'factory', 'herder', 'teacher', 'nurse', 'builder', 'vendor'];
export function createNPC(role, seed) -> Person
```

`Person` object:
- `object` (THREE.Group, feet at y = 0, faces -z, about 1.75 m tall)
- `update(dt, speedMps)`: animates idle (breathing, small sway) when speed is near 0, walk or run cycle otherwise (legs and arms swing, scaled by speed)
- `setTalking(bool)`: gesture animation while talking
- `height`
- `dispose()`

## Mine (integration): terrain, data, weather, UI, NPC stories, advancements, camera, on-foot controller.
