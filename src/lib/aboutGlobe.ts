import {
  BufferAttribute, BufferGeometry, PerspectiveCamera, Points, Raycaster,
  Scene, ShaderMaterial, Sphere, Vector2, Vector3, WebGLRenderer,
} from 'three';

const vertex = `
uniform vec3 uFocus;
uniform float uLens;
uniform float uDpr;
attribute float aSeed;
varying float vAlpha;
varying float vWarmth;

void main() {
  vec3 normal = normalize(position);
  float localDistance = distance(normal, uFocus);
  float lens = (1. - smoothstep(.035, .43, localDistance)) * uLens;

  // Expand around the selected point on the shell, rather than scaling the globe.
  vec3 tangent = normal - uFocus * dot(normal, uFocus);
  vec3 bent = normalize(normal + tangent * lens * .48);
  vec3 point = bent * (length(position) + .12 * lens);
  vec4 view = modelViewMatrix * vec4(point, 1.);
  vec3 viewNormal = normalize(mat3(modelViewMatrix) * bent);
  float front = smoothstep(-.52, .73, viewNormal.z);
  float rim = 1. - smoothstep(.02, .58, abs(viewNormal.z));
  float light = .83 + .17 * dot(bent, normalize(vec3(-.55, .72, .43)));

  gl_Position = projectionMatrix * view;
  gl_PointSize = uDpr * (1.18 + .97 * aSeed) * (3.55 / -view.z) * (1. + lens * .69);
  vAlpha = clamp((.12 + front * .59 + rim * .18) * (.58 + .42 * aSeed) * light + lens * .27, 0., .96);
  vWarmth = clamp(.51 + .3 * bent.x - .21 * bent.y + (.5 - aSeed) * .41, 0., 1.);
}`;

const fragment = `
varying float vAlpha;
varying float vWarmth;

void main() {
  float circle = 1. - smoothstep(.23, .49, length(gl_PointCoord - .5));
  vec3 color = mix(vec3(1., .94, .83), vec3(1., .39, .16), vWarmth);
  gl_FragColor = vec4(color, vAlpha * circle);
}`;

export function makeGlobeGeometry(count = 11200) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    // Visit the sphere out of order so a smaller draw range still covers every latitude.
    const sample = (index * 6043) % count;
    const y = 1 - 2 * (sample + .5) / count;
    const azimuth = sample * goldenAngle;
    const ring = Math.sqrt(1 - y * y);
    const x = Math.cos(azimuth) * ring;
    const z = Math.sin(azimuth) * ring;
    const relief = 1 + .012 * Math.sin(x * 21 + y * 17) * Math.cos(z * 18 - y * 8);
    positions.set([x * relief, y * relief, z * relief], 3 * index);
    seeds[index] = (index * .754877666 + .37) % 1;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  return geometry;
}

export function mountAboutGlobe(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  onContextLost: () => void,
) {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false });
  if (!context) return;

  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false });
  renderer.setClearColor(0, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, .1, 12);
  camera.position.z = 3.54;
  camera.updateMatrixWorld();
  const geometry = makeGlobeGeometry();
  const uniforms = { uFocus: { value: new Vector3(0, 0, 1) }, uLens: { value: 0 }, uDpr: { value: 1 } };
  const material = new ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, uniforms,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const globe = new Points(geometry, material);
  globe.rotation.set(.20, -.36, -.19);
  scene.add(globe);
  const ray = new Raycaster();
  const sphere = new Sphere(new Vector3(), 1.025);
  const pointer = new Vector2();
  const hit = new Vector3();
  const target = new Vector3();
  const events = new AbortController();
  let pointerInside = false;
  let onSphere = false;
  let visible = false;
  let paused = false;
  let lost = false;
  let frame = 0;
  let previous = 0;

  function sync() {
    if (visible && !paused && !lost && !document.hidden) {
      if (!frame) frame = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    }
  }

  function draw(now: number) {
    frame = 0;
    const delta = previous ? Math.min((now - previous) * .001, .045) : 0;
    previous = now;
    globe.rotation.y += delta * .12;
    globe.updateMatrixWorld(true);
    if (pointerInside) ray.setFromCamera(pointer, camera);
    const focus = pointerInside && ray.ray.intersectSphere(sphere, hit);
    if (focus) {
      target.copy(focus);
      globe.worldToLocal(target).normalize();
      if (!onSphere) uniforms.uFocus.value.copy(target);
      else uniforms.uFocus.value.lerp(target, 1 - Math.exp(-delta * 20)).normalize();
    }
    if (onSphere !== Boolean(focus)) stage.toggleAttribute('data-lens', Boolean(focus));
    onSphere = Boolean(focus);
    uniforms.uLens.value += ((onSphere ? 1 : 0) - uniforms.uLens.value) * (1 - Math.exp(-delta * 10));

    renderer.render(scene, camera);
    if (!stage.hasAttribute('data-rendering')) stage.setAttribute('data-rendering', '');
    sync();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height || lost) return;
    const dpr = Math.min(window.devicePixelRatio, width < 480 ? 1.15 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    geometry.setDrawRange(0, width < 480 ? 6300 : width < 620 ? 8800 : 11200);
    uniforms.uDpr.value = dpr;
    camera.aspect = width / height;
    camera.position.z = camera.aspect < .92 ? 3.54 * .92 / camera.aspect : 3.54;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // Updating the backbuffer dimensions clears it, including during a manual pause.
    if (paused && visible) renderer.render(scene, camera);
    else sync();
  }

  const geometryObserver = new ResizeObserver(resize);
  geometryObserver.observe(stage);
  resize();
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const bounds = stage.getBoundingClientRect();
    pointer.set(2 * (event.clientX - bounds.left) / bounds.width - 1,
      1 - 2 * (event.clientY - bounds.top) / bounds.height);
    pointerInside = true;
  }, { signal: events.signal });
  stage.addEventListener('pointerleave', () => { pointerInside = false; }, { signal: events.signal });
  document.addEventListener('visibilitychange', sync, { signal: events.signal });
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    stage.removeAttribute('data-rendering');
    stage.removeAttribute('data-lens');
    sync();
    onContextLost();
  }, { signal: events.signal });

  return {
    setVisible(value: boolean) {
      visible = value;
      if (!value) pointerInside = false;
      sync();
    },
    setPaused(value: boolean) {
      paused = value;
      if (paused) {
        pointerInside = false;
        onSphere = false;
        uniforms.uLens.value = 0;
        stage.removeAttribute('data-lens');
        if (visible && !document.hidden && !lost) renderer.render(scene, camera);
      }
      sync();
    },
    dispose() {
      lost = true;
      sync();
      events.abort();
      geometryObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      stage.removeAttribute('data-rendering');
      stage.removeAttribute('data-lens');
    },
  };
}
