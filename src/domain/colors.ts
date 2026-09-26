/** Stable fill colour per Nutzungscode: same code, same colour, on every device. */
export function colorForCode(code: string): string {
  let hash = 2166136261;
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;
  const hue = hash % 360;
  const saturation = 55 + ((hash >>> 9) % 25);
  const lightness = 45 + ((hash >>> 17) % 15);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}
