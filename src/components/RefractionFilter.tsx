import { useEffect, useState, type RefObject } from 'react';

/**
 * Edge refraction for a glass surface, as an SVG displacement filter used in
 * `backdrop-filter` (Chromium). A displacement map is generated for the
 * element's exact size and corner radius: zero in the interior, rising
 * towards the rim along the surface normal, so content behind the edge bends
 * like light through the curved lip of real glass. Regenerated on resize.
 */
function displacementMap(w: number, h: number, radius: number, depth: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(w, h);
  const r = Math.min(radius, w / 2, h / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - r);
      const qy = Math.abs(py) - (h / 2 - r);
      // Signed distance to the rounded-rectangle edge (negative inside).
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const inside = Math.min(Math.max(qx, qy), 0);
      const d = outside + inside - r;
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        const l = Math.hypot(qx, qy) || 1;
        nx = (qx / l) * Math.sign(px);
        ny = (qy / l) * Math.sign(py);
      } else if (qx > qy) {
        nx = Math.sign(px);
      } else {
        ny = Math.sign(py);
      }
      const t = Math.min(1, Math.max(0, 1 + d / depth)); // 1 at the rim → 0 at `depth` px inside
      const m = t * t * t;
      const i = (y * w + x) * 4;
      image.data[i] = 128 + nx * m * 127;
      image.data[i + 1] = 128 + ny * m * 127;
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

interface MapState {
  href: string;
  width: number;
  height: number;
}

export function RefractionFilter({
  targetRef,
  id = 'glass-refraction',
  depth = 16,
  strength = 22,
}: {
  targetRef: RefObject<HTMLElement | null>;
  id?: string;
  depth?: number;
  strength?: number;
}) {
  const [map, setMap] = useState<MapState | null>(null);

  useEffect(() => {
    const element = targetRef.current;
    if (!element || !document.documentElement.classList.contains('supports-refraction')) return;
    let frame = 0;
    const build = () => {
      frame = 0;
      const width = Math.round(element.offsetWidth);
      const height = Math.round(element.offsetHeight);
      if (width < 2 || height < 2) return;
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || height / 2;
      setMap({ href: displacementMap(width, height, radius, depth), width, height });
    };
    const observer = new ResizeObserver(() => {
      if (frame === 0) frame = requestAnimationFrame(build);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [targetRef, depth]);

  return (
    <svg className="refraction-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        {map && (
          <feImage
            href={map.href}
            x="0"
            y="0"
            width={map.width}
            height={map.height}
            preserveAspectRatio="none"
            result="map"
          />
        )}
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale={map ? strength : 0}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
