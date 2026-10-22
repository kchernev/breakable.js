// Breakable.js: real-time destruction for Three.js (WebGPU) on three-avbd's GPU rigid bodies.

export { Destruction, Dormant, Piece, Bond } from './destruction.ts';
export type { DestructionOptions, DormantOptions, ExplosionOptions, ExplosionResult, PieceOptions, PieceState, Pose, PropModel, PropOptions, RayHit, ShotHit, DustEvent, DebrisEvent, ImpactEvent, StateEvent, LandedEvent, BondTolerance, Hinge } from './destruction.ts';
export { bulletPush, bulletsToBreak, materialKind } from './bullets.ts';
export type { MaterialKind } from './bullets.ts';
export { material, presets } from './materials.ts';
export type { BreakableMaterial, MaterialOptions } from './materials.ts';
export { Ground, groundPresets } from './ground.ts';
export type { GroundOptions } from './ground.ts';
export { FragmentMesh, pieceState, pieceFrame, pieceTint } from './fragment-mesh.ts';
export type { DrawFace, Allocation, FragmentLook, TextureFrame } from './fragment-mesh.ts';
export { boxConvex, hullConvex, clip, volumeCentroid, raycastConvex, signedDistance } from './convex.ts';
export type { Convex, Face } from './convex.ts';
export { voronoi, impactSeeds, uniformSeeds } from './fracture.ts';
export type { Cell, Grain } from './fracture.ts';
export { contactPatch } from './contact.ts';
export * from './math.ts';
export { SoundEngine, Voice, streetReverb } from './audio.ts';
export type { SoundOptions, PlayOptions, SoundEngineOptions } from './audio.ts';
export { DestructionSounds } from './destruction-audio.ts';
export type { MaterialSounds, DestructionSoundsOptions } from './destruction-audio.ts';
export { loadSoundPack, packSettings, packMaterials } from './sound-pack.ts';
export { PropMesh } from './prop-mesh.ts';
export { loadPropPack } from './prop-pack.ts';
export type { PropPackEntry } from './prop-pack.ts';
export { addVehicle, loadVehicles, Vehicle, vehicleModel, vehicleOf, vehiclePresets } from './vehicle.ts';
export type { VehicleEntry, VehicleHooks, VehicleModel, VehicleOptions, VehiclePartEntry, VehiclePartRole } from './vehicle.ts';
export * from './shapes.ts';
