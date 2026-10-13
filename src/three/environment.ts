import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Lighting for the glass: a bright studio prefiltered into an environment
 * map, set up the way glass is photographed on white ("bright field"). The
 * room in front of the sculpture is light, so its faces read clear; the wall
 * behind it is black, so at grazing angles — where glass reflects almost
 * everything — its silhouette turns into a crisp dark line against the white
 * page. A few softboxes add the highlights that give it volume.
 */
export function createStudioEnvironment(renderer: WebGLRenderer): { texture: Texture; dispose(): void } {
  const scene = new Scene();
  const geometries: { dispose(): void }[] = [];
  const materials: { dispose(): void }[] = [];

  // One tone per wall, in BoxGeometry's group order: +x, −x, +y, −y, +z, −z.
  const roomGeometry = new BoxGeometry(14, 14, 14);
  const wallTones = [0.1, 0.09, 0.5, 0.14, 0.9, 0.07];
  const roomMaterials = wallTones.map((v) => new MeshBasicMaterial({ color: new Color(v, v, v * 0.985), side: BackSide }));
  geometries.push(roomGeometry);
  materials.push(...roomMaterials);
  scene.add(new Mesh(roomGeometry, roomMaterials));

  const panel = (w: number, h: number, x: number, y: number, z: number, intensity: number, tint: [number, number, number]) => {
    const geometry = new PlaneGeometry(w, h);
    const material = new MeshBasicMaterial({
      color: new Color(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity),
      side: DoubleSide,
    });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  const warm: [number, number, number] = [1, 0.97, 0.93];
  const neutral: [number, number, number] = [1, 1, 1];
  panel(7, 2.2, 0.4, 5.6, 1.8, 3.4, warm); // key: overhead softbox
  panel(3.2, 5, 6.2, 1.2, 3.4, 2.2, neutral); // broad reflector, right-front — the sheen across the faces
  panel(0.5, 8, -6, 0.4, 2.2, 3, neutral); // narrow strip, left — a crisp highlight line
  panel(1.2, 7, -2.6, 0.2, 4.4, 0.05, neutral); // dark card, front-left — a soft streak across the faces
  panel(0.8, 7, 2.4, 0.4, 4.8, 0.05, neutral); // dark card, front-right

  const pmrem = new PMREMGenerator(renderer);
  // 128 px is ample for glass this smooth, and the softboxes' hard edges
  // need no extra blur pass — together this keeps the bake off the long-task list.
  const target = pmrem.fromScene(scene, 0, 0.1, 100, { size: 128 });
  pmrem.dispose();
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}

/**
 * The backdrop the glass refracts, drawn as two full-screen quads in clip
 * space (independent of the camera and of render-target size, so the
 * transmission pass sees exactly what the screen does):
 *
 *   studio   opaque — the page colour, the white glow behind the sculpture
 *            and the drawing. Rendered only into three.js's transmission
 *            target, i.e. it exists to be refracted. Also holds the
 *            bright-field "cards": dark tones just outside the frame that
 *            the glass bends into its edges, as glass is photographed.
 *   overlay  translucent — only the lines of the drawing. The page's own
 *            CSS provides the colour, the glow and the contact shadow.
 *
 * The drawing changes with the sculpture's form, like a technical sheet:
 *
 *   core          lens rings
 *   beamtransfer  a band of QR frames streaming along a beam
 *   ambiora       a colonnade of arches at three depths, with parallax
 *   sggs-erp      a network of nodes and the paths between them, with
 *                 packets travelling along the paths
 *
 * Lines are faint where you see them directly and come alive *through* the
 * glass, where refraction bends and magnifies them.
 */
const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.99999, 1.0);
  }
`;

const backdropCommon = /* glsl */ `
  uniform vec2 uCore;      // sculpture centre, 0–1 screen space (y up)
  uniform float uAspect;   // width / height
  uniform float uSize;     // sculpture diameter as a fraction of screen height
  uniform vec4 uWeights;   // core, beamtransfer, ambiora, sggs-erp
  uniform float uScroll;   // the anchor's passage through the viewport, 0–1
  uniform float uTime;
  uniform float uPresence; // how present the sculpture is, 0–1
  uniform vec3 uBase;      // the page colour behind the sculpture
  uniform vec3 uLift;      // the glow behind it
  uniform vec3 uInk;       // drawing lines
  uniform vec3 uCard;      // bright-field cards, seen only by the glass
  varying vec2 vUv;

  const float PI = 3.14159265;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  // A drawn line at distance d, held to a pixel or two (px = one pixel in
  // these units) so it stays crisp at any size.
  float hairline(float d, float px) {
    return 1.0 - smoothstep(0.0, max(px * 1.5, 0.0024), abs(d));
  }

  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return length(p - (a + ab * t));
  }

  // Core: a lens diagram — concentric rings around the sculpture. Through
  // the glass they bend and swell.
  float coreLight(vec2 q, float px, float drift) {
    float r = length(q);
    return hairline(abs(fract(r * 8.0 + 0.5 - drift) - 0.5) / 8.0, px) * smoothstep(1.05, 0.25, r) * 0.85;
  }

  // BeamTransfer: a band of QR modules — a new frame twice a second while
  // motion is on — on the beam that carries them through the light pipe.
  float beamLight(vec2 q, float px, float t) {
    float ends = smoothstep(1.6, 0.5, abs(q.x));
    vec2 cell = floor(q / 0.046);
    vec2 inCell = abs(fract(q / 0.046) - 0.5);
    float frame = floor(t * 2.0);
    float module = step(0.52, hash(cell + frame * 17.0)) * step(max(inCell.x, inCell.y), 0.38);
    float band = smoothstep(0.3, 0.2, abs(q.y)) * smoothstep(1.1, 0.8, abs(q.x));
    return band * module * 1.15 + ends * (
      hairline(q.y + 0.34, px) * 0.8 +
      hairline(q.y - 0.34, px) * 0.8);
  }

  // Ambiora: a colonnade of arches at three depths; the nearer, the larger
  // and the darker, and each depth slides at its own rate as you scroll.
  float arches(vec2 q, float px, float scale, float shift) {
    vec2 s = q / scale;
    s.x += shift;
    float light = 0.0;
    for (int i = -3; i <= 3; i++) {
      vec2 p = s - vec2(float(i) * 0.4, 0.06);
      float r = 0.17;
      float d = p.y > 0.0 ? length(p) - r : abs(p.x) - r;
      float legs = smoothstep(-0.95, -0.15, p.y);
      light += hairline(d * scale, px) * legs * (1.0 - abs(float(i)) * 0.2);
    }
    return light;
  }

  float archLight(vec2 q, float px, float drift) {
    return arches(q, px, 1.0, drift * 0.9) +
      arches(q - vec2(0.0, 0.12), px, 0.72, 0.2 + drift * 0.5) * 0.55 +
      arches(q - vec2(0.0, 0.2), px, 0.52, 0.4 + drift * 0.25) * 0.3;
  }

  // SGGS ERP: a network — nodes around the sculpture, paths between them
  // (two cross straight through the glass), packets in flight along them.
  const vec2 NODES[7] = vec2[7](
    vec2(-1.05, 0.55), vec2(-0.3, 0.98), vec2(0.62, 0.8), vec2(1.1, 0.12),
    vec2(0.74, -0.7), vec2(-0.12, -0.98), vec2(-0.98, -0.42));
  const ivec2 EDGES[9] = ivec2[9](
    ivec2(0, 1), ivec2(1, 2), ivec2(2, 3), ivec2(3, 4), ivec2(4, 5),
    ivec2(5, 6), ivec2(6, 0), ivec2(1, 5), ivec2(2, 6));

  float erpLight(vec2 q, float px, float t) {
    float light = 0.0;
    for (int i = 0; i < 9; i++) {
      vec2 a = NODES[EDGES[i].x];
      vec2 b = NODES[EDGES[i].y];
      light += hairline(segment(q, a, b), px) * 0.55;
      // One packet per path, each on its own schedule.
      float phase = fract(t * 0.22 + float(i) * 0.37);
      vec2 packet = mix(a, b, phase);
      light += smoothstep(0.022, 0.008, length(q - packet)) * 1.3;
    }
    for (int i = 0; i < 7; i++) {
      float d = length(q - NODES[i]);
      light += hairline(d - 0.032, px) * 0.9 + smoothstep(0.014, 0.006, d) * 0.9;
    }
    return light;
  }

  // The drawing, in units where 1 = the sculpture's diameter. Uniform
  // branches: only the drawings in play cost anything per pixel.
  float sheet(vec2 q, float px) {
    float r2 = dot(q, q);
    float drift = uScroll * 0.3;
    float light = 0.0;
    if (uWeights.x > 0.001) light += uWeights.x * coreLight(q, px, drift);
    if (uWeights.y > 0.001) light += uWeights.y * beamLight(q, px, uTime);
    if (uWeights.z > 0.001) light += uWeights.z * archLight(q, px, drift);
    if (uWeights.w > 0.001) light += uWeights.w * erpLight(q, px, uTime);
    // Lines gather around the sculpture and fall away towards the text.
    return min(light * 0.42, 0.75) * exp(-r2 * 0.7) * uPresence;
  }
`;

const studioFragment = /* glsl */ `
  ${backdropCommon}
  uniform float uRefracted; // 1 while drawing what the glass refracts
  uniform float uPoster;    // 1 when rendering a still: the studio is the picture

  void main() {
    // Only the transmission pass sees this quad: on screen it draws nothing —
    // except for the stills, which are opaque pictures of the whole studio.
    if (uRefracted < 0.5 && uPoster < 0.5) discard;
    vec2 q = vec2((vUv.x - uCore.x) * uAspect, vUv.y - uCore.y) / uSize;
    float px = fwidth(q.x);
    float r2 = dot(q, q);
    vec3 col = mix(uBase, uLift, exp(-r2 * 1.2));
    col = mix(col, uInk, sheet(q, px));
    // The still carries the contact shadow the page otherwise draws in CSS.
    float shadow = exp(-(q.x * q.x) / 0.16 - pow(q.y + 0.38, 2.0) / 0.0012) * 0.16;
    col = mix(col, uInk, shadow * uPoster * (1.0 - uRefracted));
    // Bright field, as glass is photographed on white: dark cards stand just
    // outside the frame. The camera never sees them, but the glass bends
    // them into its edges, and that is what draws its silhouette.
    col = mix(col, uCard, smoothstep(0.14, 0.46, sqrt(r2)) * uRefracted);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const overlayFragment = /* glsl */ `
  ${backdropCommon}

  void main() {
    vec2 q = vec2((vUv.x - uCore.x) * uAspect, vUv.y - uCore.y) / uSize;
    float px = fwidth(q.x);
    float a = sheet(q, px);
    // Premultiplied ink over a clear background.
    gl_FragColor = vec4(uInk, 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * a, a);
  }
`;

export interface Backdrop {
  /** Opaque studio for the transmission pass, and the on-screen overlay. */
  studio: Mesh;
  overlay: Mesh;
  uniforms: {
    uCore: { value: Vector2 };
    uAspect: { value: number };
    uSize: { value: number };
    uWeights: { value: Vector4 };
    uScroll: { value: number };
    uTime: { value: number };
    uPresence: { value: number };
    uBase: { value: Color };
    uPoster: { value: number };
  };
  dispose(): void;
}

export function createBackdrop(): Backdrop {
  const geometry = new PlaneGeometry(2, 2);
  // sRGB hex → linear working space (three's colour management).
  const uniforms = {
    uCore: { value: new Vector2(0.7, 0.53) },
    uAspect: { value: 16 / 9 },
    uSize: { value: 0.6 },
    uWeights: { value: new Vector4(1, 0, 0, 0) },
    uScroll: { value: 0 },
    uTime: { value: 0 },
    uPresence: { value: 1 },
    uPoster: { value: 0 },
    uBase: { value: new Color('#f5f4f0') },
    uLift: { value: new Color('#ffffff') },
    uInk: { value: new Color('#1c1d21') },
    uCard: { value: new Color('#8f949c') },
  };
  const uRefracted = { value: 0 };
  const studioMaterial = new ShaderMaterial({
    vertexShader: backdropVertex,
    fragmentShader: studioFragment,
    uniforms: { ...uniforms, uRefracted },
    depthWrite: false,
    depthTest: false,
  });
  const overlayMaterial = new ShaderMaterial({
    vertexShader: backdropVertex,
    fragmentShader: overlayFragment,
    uniforms,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    depthTest: true, // the glass, nearer, hides the drawing behind it
  });
  const studio = new Mesh(geometry, studioMaterial);
  studio.frustumCulled = false;
  studio.renderOrder = -1;
  // three.js draws opaque objects twice when glass is present: once into the
  // transmission target (what the glass refracts), once to the screen.
  studio.onBeforeRender = (renderer) => {
    const refracted = renderer.getRenderTarget() !== null ? 1 : 0;
    if (uRefracted.value !== refracted) {
      uRefracted.value = refracted;
      studioMaterial.uniformsNeedUpdate = true;
    }
  };
  const overlay = new Mesh(geometry, overlayMaterial);
  overlay.frustumCulled = false;
  overlay.renderOrder = 1;
  return {
    studio,
    overlay,
    uniforms,
    dispose() {
      geometry.dispose();
      studioMaterial.dispose();
      overlayMaterial.dispose();
    },
  };
}
