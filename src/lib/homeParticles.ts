import {
  BufferAttribute, BufferGeometry, CanvasTexture, Euler, LinearFilter, LineSegments,
  Matrix3, Matrix4, Mesh, OrthographicCamera, Points, Scene,
  ShaderMaterial, Vector2, Vector3, Vector4, WebGLRenderer,
} from 'three';
import { makeGlobeGeometry } from '@/lib/aboutGlobe';

const coordinates = `
uniform vec2 uViewport;
uniform vec4 uPortrait;
uniform vec4 uGlobe;
uniform float uArrival;
uniform float uNetwork;
uniform float uExit;
uniform float uTime;
uniform float uScroll;
uniform float uDpr;
uniform float uContact;
uniform vec3 uPointer;
uniform vec3 uFocus;
uniform float uLens;
uniform mat3 uRotation;

float release(vec2 home) {
  return .035 + .15 * (1. - abs(home.x)) + .10 * (home.y + 1.) * .5;
}
vec2 portraitPoint(vec2 home) {
  return uPortrait.xy + home * uPortrait.zw * vec2(.5, -.5);
}
vec4 screenPoint(vec2 p) {
  return vec4(p.x / uViewport.x * 2. - 1., 1. - p.y / uViewport.y * 2., 0., 1.);
}
`;

const vertex = `
${coordinates}
attribute vec4 aPortrait;
attribute vec2 aNetwork;
attribute float aSeed;
varying vec4 vColor;
void main() {
  float peeled = smoothstep(release(aPortrait.xy) - .025, release(aPortrait.xy) + .13, uArrival);
  float journey = smoothstep(release(aPortrait.xy), 1., uArrival);
  vec2 photo = portraitPoint(aPortrait.xy);
  vec3 normal = normalize(uRotation * position);
  float lens = (1. - smoothstep(.035, .43, distance(normal, uFocus))) * uLens;
  vec3 tangent = normal - uFocus * dot(normal, uFocus);
  vec3 bent = normalize(normal + tangent * lens * .48);
  vec3 globe = bent * (length(position) + .12 * lens);
  vec2 sphere = uGlobe.xy + vec2(globe.x, -globe.y) * uGlobe.z / (uGlobe.w - globe.z);
  // Every point follows a curve from its own portrait pixel into its sphere target.
  vec2 bend = vec2(mix(photo.x, sphere.x, .48), max(photo.y, sphere.y) + uViewport.y * .15);
  vec2 point = mix(mix(photo, bend, journey), mix(bend, sphere, journey), journey);

  vec2 net = aNetwork * (uViewport + vec2(40.)) - 20.;
  float phase = uTime * .82 + uScroll * .0006;
  net.x += sin(net.y * .012 - phase * .8) * 4.;
  net.y += sin(net.x * .013 + net.y * .009 + phase) * 8.
         + sin(net.x * .025 - net.y * .014 - phase) * 3.;
  vec2 away = net - uPointer.xy;
  float influence = pow(max(0., 1. - dot(away, away) / 24025.), 2.) * uPointer.z;
  net += vec2(away.x * .36, away.y * .36 - 12.) * influence;
  // Release the lower surface first, with enough variation to peel off individual grains.
  float delay = .02 + .19 * (position.y + 1.) * .5 + .19 * aSeed;
  float spreading = smoothstep(delay, .65 + delay * .86, uNetwork);
  float airborne = sin(spreading * 3.14159265);
  float transitionLight = sin(uNetwork * 3.14159265);
  float drop = min(uViewport.y * .17, 135.);
  vec2 outflow = vec2(mix(point.x, net.x, .18), max(point.y + drop, net.y + drop * .32));
  point = mix(mix(point, outflow, spreading), mix(outflow, net, spreading), spreading);
  point.y += airborne * (sin(aNetwork.x * 16. - phase) * 11. + globe.z * 14.);
  point.y += uExit * uExit * (35. + aSeed * 75.);

  float front = smoothstep(-.52, .73, bent.z);
  float rim = 1. - smoothstep(.02, .58, abs(bent.z));
  float globeAlpha = (.12 + front * .59 + rim * .18) * (.58 + .42 * aSeed);
  float alpha = mix(peeled * (.35 + .6 * aPortrait.z) * aPortrait.w, globeAlpha, journey);
  alpha = mix(alpha, .20 + aSeed * .13, spreading);
  alpha = min(.96, alpha + airborne * .21 + transitionLight * .12);
  alpha *= 1. - smoothstep(.05 + aSeed * .25, 1., uExit);
  float warmth = mix(.10, clamp(.51 + .3 * bent.x - .21 * bent.y + (.5 - aSeed) * .41, 0., 1.), journey);
  vec3 color = mix(vec3(1., .94, .83), vec3(1., .39, .16), warmth);
  vec3 orange = vec3(1., 135. / 255., 85. / 255.);
  vec3 ember = mix(orange, vec3(1., .94, .83), smoothstep(.81, 1., aSeed) * airborne * .75);
  color = mix(mix(color, orange, spreading), ember, airborne * .76);
  vColor = vec4(color, alpha);
  gl_Position = screenPoint(point);
  float size = mix(1.3 + aPortrait.z, (1.18 + .97 * aSeed) * (3.55 / (uGlobe.w - globe.z)) * (1. + lens * .69), journey);
  gl_PointSize = uDpr * (mix(size, 1.15, spreading) + airborne * .38 + transitionLight * .18);
#ifdef NETWORK_LINES
  // Connect particles as they approach their actual grid neighbors.
  vColor.a *= smoothstep(.62, 1., uNetwork) * smoothstep(.87, 1., spreading) * .19;
#endif
}
`;
const fragment = `
uniform vec2 uViewport;
uniform float uDpr;
uniform float uContact;
varying vec4 vColor;
void main() {
  // The shared viewport canvas can never draw over the contact section.
  if (uViewport.y - gl_FragCoord.y / uDpr >= uContact) discard;
  float alpha = vColor.a;
#ifndef NETWORK_LINES
  alpha *= 1. - smoothstep(.13, .5, length(gl_PointCoord - .5));
#endif
  gl_FragColor = vec4(vColor.rgb, alpha);
}
`;
const imageVertex = `
${coordinates}
varying vec2 vHome;
void main() {
  vHome = position.xy;
  gl_Position = screenPoint(portraitPoint(position.xy));
}
`;
const imageFragment = `
${coordinates}
uniform sampler2D uImage;
varying vec2 vHome;
void main() {
  vec4 color = texture2D(uImage, vHome * vec2(.5, -.5) + .5);
  float peel = smoothstep(release(vHome) - .025, release(vHome) + .13, uArrival);
  float light = dot(color.rgb, vec3(.213, .715, .072));
  gl_FragColor = vec4(vec3(light), color.a * (1. - peel));
}
`;

// Select only real, opaque portrait pixels, retaining each pixel's luminance and alpha.
function portraitTargets(image: HTMLImageElement, count: number) {
  const sample = document.createElement('canvas');
  sample.width = 320;
  sample.height = Math.round(320 * image.naturalHeight / image.naturalWidth);
  const context = sample.getContext('2d');
  if (!context) throw new Error('Portrait sampling is unavailable');
  context.drawImage(image, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  const candidates: number[] = [];
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] > 32) candidates.push(index);
  }
  if (!candidates.length) throw new Error('Portrait has no visible pixels');
  // Deterministic shuffle distributes small and large devices across the whole portrait.
  let seed = 0x8921753;
  for (let i = candidates.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const targets = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) {
    const offset = candidates[index % candidates.length];
    const pixel = offset / 4;
    targets.set([
      ((pixel % sample.width) + .5) / sample.width * 2 - 1,
      1 - (Math.floor(pixel / sample.width) + .5) / sample.height * 2,
      (.213 * pixels[offset] + .715 * pixels[offset + 1] + .072 * pixels[offset + 2]) / 255,
      pixels[offset + 3] / 255,
    ], index * 4);
  }
  return targets;
}

function smooth(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / Math.max(1, end - start)));
  return t * t * (3 - 2 * t);
}

export async function mountHomeParticles(root: HTMLElement, canvas: HTMLCanvasElement, signal: AbortSignal) {
  const image = root.querySelector<HTMLImageElement>('[data-portrait-image]');
  const photo = root.querySelector<HTMLElement>('[data-portrait-frame]');
  const stage = root.querySelector<HTMLElement>('[data-globe-transition]');
  const pin = stage?.querySelector<HTMLElement>('[data-globe-pin]');
  const globe = root.querySelector<HTMLElement>('[data-globe-stage]');
  const contact = document.getElementById('contact');
  if (!image || !photo || !stage || !pin || !globe || !contact) return;
  await image.decode();
  if (signal.aborted) return;
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false });
  if (!context) return;
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
  renderer.setClearColor(0, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 2;
  const columns = innerWidth < 700 ? 70 : 112;
  const rows = innerWidth < 700 ? 90 : 100;
  const count = columns * rows;
  const geometry = makeGlobeGeometry(count);
  geometry.setAttribute('aPortrait', new BufferAttribute(portraitTargets(image, count), 4));
  const net = new Float32Array(count * 2);
  const links: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      net.set([col / (columns - 1), row / (rows - 1)], index * 2);
      if (row % 2 || col % 2) continue;
      if (col + 2 < columns) links.push(index, index + 2);
      if (row + 2 < rows) links.push(index, index + 2 * columns);
    }
  }
  geometry.setAttribute('aNetwork', new BufferAttribute(net, 2));
  const uniforms = {
    uViewport: { value: new Vector2() }, uPortrait: { value: new Vector4() },
    uGlobe: { value: new Vector4() }, uArrival: { value: 0 }, uNetwork: { value: 0 },
    uExit: { value: 0 }, uTime: { value: 0 }, uScroll: { value: 0 }, uDpr: { value: 1 },
    uContact: { value: 0 }, uPointer: { value: new Vector3(-1000, -1000, 0) },
    uFocus: { value: new Vector3(0, 0, 1) }, uLens: { value: 0 },
    uRotation: { value: new Matrix3() },
  };
  const options = { uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthTest: false, depthWrite: false };
  const material = new ShaderMaterial(options);
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const lineGeometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) lineGeometry.setAttribute(name, attribute);
  lineGeometry.setIndex(links);
  const lineMaterial = new ShaderMaterial({ ...options, defines: { NETWORK_LINES: 1 } });
  const lines = new LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  const photoSurface = document.createElement('canvas');
  photoSurface.width = image.naturalWidth;
  photoSurface.height = image.naturalHeight;
  photoSurface.getContext('2d')!.drawImage(image, 0, 0);
  const texture = new CanvasTexture(photoSurface);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  const quad = new BufferGeometry();
  quad.setAttribute('position', new BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]), 3));
  quad.setIndex([0,1,2,2,1,3]);
  const photoMaterial = new ShaderMaterial({
    ...options, uniforms: { ...uniforms, uImage: { value: texture } }, vertexShader: imageVertex, fragmentShader: imageFragment,
  });
  const portrait = new Mesh(quad, photoMaterial);
  portrait.frustumCulled = false;
  portrait.renderOrder = 0;
  points.renderOrder = 1;
  lines.renderOrder = 2;
  scene.add(portrait, points, lines);
  const rotation = new Matrix4();
  const euler = new Euler();
  const pointer = { x: -1000, y: -1000, active: false };
  let frame = 0, last = 0, disposed = false, lost = false;
  let width = 0, height = 0, scroll = window.scrollY;
  let arrive = 1, contactTop = 0;

  function measure() {
    width = document.documentElement.clientWidth;
    height = innerHeight;
    const dpr = Math.min(devicePixelRatio, width < 700 ? 1.15 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    uniforms.uViewport.value.set(width, height);
    uniforms.uDpr.value = dpr;
    const bounds = globe!.getBoundingClientRect();
    // Use the original document position even when GSAP has pinned the globe in the viewport.
    const top = stage!.getBoundingClientRect().top + window.scrollY + bounds.top - pin!.getBoundingClientRect().top;
    arrive = Math.max(height * .65, top + bounds.height / 2 - height * .58);
    contactTop = contact!.getBoundingClientRect().top + window.scrollY;
    requestDraw();
  }

  function requestDraw() {
    if (!frame && !disposed && !lost && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function draw(now: number) {
    frame = 0;
    if (disposed || lost) return;
    const delta = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    const a = smooth(0, arrive, scroll);
    const n = uniforms.uNetwork.value;
    const exit = smooth(contactTop - height * .85, contactTop - height * .08, scroll);
    uniforms.uArrival.value = a;
    uniforms.uExit.value = exit;
    uniforms.uScroll.value = scroll;
    uniforms.uContact.value = contactTop - scroll;
    uniforms.uTime.value += delta;
    euler.set(.20, -.36 + uniforms.uTime.value * .12, -.19);
    uniforms.uRotation.value.setFromMatrix4(rotation.makeRotationFromEuler(euler));
    const p = photo!.getBoundingClientRect();
    const fit = Math.min(p.width / image!.naturalWidth, p.height / image!.naturalHeight);
    const photoY = Math.max(height * .24, p.top + p.height / 2)
      + height * .12 * smooth(0, arrive * .55, scroll);
    uniforms.uPortrait.value.set(p.left + p.width / 2, photoY, image!.naturalWidth * fit, image!.naturalHeight * fit);
    const g = globe!.getBoundingClientRect();
    // Keep the traveling cloud inside the viewport until its actual destination arrives.
    const centerY = Math.min(g.top + g.height / 2, height * .78);
    const distance = 3.54 * Math.max(1, .92 / (g.width / g.height));
    uniforms.uGlobe.value.set(g.left + g.width / 2, centerY, g.height / (2 * Math.tan(19 * Math.PI / 180)), distance);
    const radius = uniforms.uGlobe.value.z / Math.sqrt(distance * distance - 1);
    const px = (pointer.x - (g.left + g.width / 2)) / radius;
    const py = (centerY - pointer.y) / radius;
    const onSphere = pointer.active && a > .99 && n < .01 && px * px + py * py < 1;
    if (onSphere) uniforms.uFocus.value.set(px, py, Math.sqrt(1 - px * px - py * py)).normalize();
    uniforms.uLens.value += (Number(onSphere) - uniforms.uLens.value) * (1 - Math.exp(-delta * 10));
    uniforms.uPointer.value.x = pointer.x;
    uniforms.uPointer.value.y = pointer.y;
    uniforms.uPointer.value.z += (Number(pointer.active) - uniforms.uPointer.value.z) * (1 - Math.exp(-delta * 9));
    portrait.visible = a < .5;
    lines.visible = n > 0 && exit < 1;
    points.visible = a > 0 && exit < 1;
    renderer.render(scene, camera);
    if (!root.hasAttribute('data-journey-ready')) root.setAttribute('data-journey-ready', '');
    if (scroll > 0 && exit < 1) requestDraw();
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    root.removeAttribute('data-journey-ready');
  }, { signal });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; measure(); }, { signal });
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    requestDraw();
  }, { passive: true, signal });
  root.addEventListener('pointerleave', () => { pointer.active = false; requestDraw(); }, { signal });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    requestDraw();
  }, { signal });
  signal.addEventListener('abort', () => {
    disposed = true;
    cancelAnimationFrame(frame);
    geometry.dispose();
    lineGeometry.dispose();
    quad.dispose();
    material.dispose();
    lineMaterial.dispose();
    photoMaterial.dispose();
    texture.dispose();
    renderer.dispose();
    root.removeAttribute('data-journey-ready');
  }, { once: true });
  measure();
  return {
    measure,
    update(value: number) {
      scroll = value;
      requestDraw();
    },
    setNetwork(progress: number) {
      uniforms.uNetwork.value = progress;
      requestDraw();
    },
  };
}
