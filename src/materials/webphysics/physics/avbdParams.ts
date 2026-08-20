// Shared AVBD contact/friction tuning used by warmstart, primal, and dual stages.
export const AVBD_FRICTION_STATIC = 0.75;
// Keep dynamic equal to static for now. This matches the simpler 2D reference
// behavior and avoids static/dynamic regime switching drift ("motoring").
export const AVBD_FRICTION_DYNAMIC = 0.75;
export const AVBD_COLLISION_MARGIN = 5e-4;
