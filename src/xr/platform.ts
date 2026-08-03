/**
 * Runtime platform hints for AVP vs desktop.
 *
 * visionOS Safari often spoofs a Macintosh UA, so UA substring checks alone are not enough.
 */

/** True on Apple Vision Pro / visionOS (not desktop macOS with a mouse/trackpad). */
export function isVisionOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  if (/VisionOS|Apple Vision/i.test(ua)) return true;

  // Macintosh UA + multi-touch + no fine pointer ≈ spatial / iPad-desktop-mode spoof.
  // Require WebXR so a pure iPad Safari hit is less likely for this WebGPU XR app.
  const macSpoof = /Macintosh/.test(ua) && !/iPhone|iPad|iPod/.test(ua);
  if (!macSpoof || navigator.maxTouchPoints < 1 || !('xr' in navigator)) return false;
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}
