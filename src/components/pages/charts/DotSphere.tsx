/** Procedural line-art: a sphere of dots in orthographic projection. Pure decoration. */
export function DotSphere({ size = 200, count = 480, color = '#ffffff', tilt = 0.55 }: { size?: number; count?: number; color?: string; tilt?: number }) {
  const R = size / 2 - 6;
  const pts: { x: number; y: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * rad;
    const z = Math.sin(theta) * rad;
    // tilt around x so the pole is visible
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    pts.push({ x, y: y2, z: z2 });
  }
  pts.sort((a, b) => a.z - b.z);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {pts.map((p, i) => {
        const depth = (p.z + 1) / 2; // 0 back … 1 front
        // fixed decimals so server and client render identical strings
        return <circle key={i} cx={(size / 2 + p.x * R).toFixed(2)} cy={(size / 2 + p.y * R).toFixed(2)} r={(0.6 + depth * 1.5).toFixed(2)} fill={color} opacity={(0.08 + depth * 0.72).toFixed(3)} />;
      })}
    </svg>
  );
}
