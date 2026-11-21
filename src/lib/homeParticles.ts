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
in vec4 aPortrait;
in vec2 aNetwork;
in float aSeed;
out vec4 vColor;
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
in vec4 vColor;
out vec4 colorOutput;
void main() {
  // The shared viewport canvas can never draw over the contact section.
  if (uViewport.y - gl_FragCoord.y / uDpr >= uContact) discard;
  float alpha = vColor.a;
#ifndef NETWORK_LINES
  alpha *= 1. - smoothstep(.13, .5, length(gl_PointCoord - .5));
#endif
  colorOutput = vec4(vColor.rgb, alpha);
}
`;
const imageVertex = `
${coordinates}
out vec2 vHome;
void main() {
  vHome = position.xy;
  gl_Position = screenPoint(portraitPoint(position.xy));
}
`;
const imageFragment = `
${coordinates}
uniform sampler2D uImage;
in vec2 vHome;
out vec4 colorOutput;
void main() {
  vec4 color = texture(uImage, vHome * vec2(.5, -.5) + .5);
  float peel = smoothstep(release(vHome) - .025, release(vHome) + .13, uArrival);
  float light = dot(color.rgb, vec3(.213, .715, .072));
  colorOutput = vec4(vec3(light), color.a * (1. - peel));
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
    const target = index * 4;
    targets[target] = ((pixel % sample.width) + .5) / sample.width * 2 - 1;
    targets[target + 1] = 1 - (Math.floor(pixel / sample.width) + .5) / sample.height * 2;
    targets[target + 2] = (.213 * pixels[offset] + .715 * pixels[offset + 1] + .072 * pixels[offset + 2]) / 255;
    targets[target + 3] = pixels[offset + 3] / 255;
  }
  return targets;
}

function smooth(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / Math.max(1, end - start)));
  return t * t * (3 - 2 * t);
}

type Coordinates = {
  viewport: [number, number];
  portrait: [number, number, number, number];
  globe: [number, number, number, number];
  rotation: Float32Array<ArrayBuffer>;
  pointer: [number, number, number];
  focus: [number, number, number];
  arrival: number; network: number; exit: number; time: number;
  scroll: number; dpr: number; contact: number; lens: number;
};

const attributeNames = ['position', 'aPortrait', 'aNetwork', 'aSeed'] as const;
const uniformNames = ['uViewport', 'uPortrait', 'uGlobe', 'uRotation', 'uPointer', 'uFocus', 'uArrival',
  'uNetwork', 'uExit', 'uTime', 'uScroll', 'uDpr', 'uContact', 'uLens'] as const;

function createRenderer(gl: WebGL2RenderingContext, image: HTMLImageElement, columns: number, rows: number) {
  const programs: WebGLProgram[] = [];
  const buffers: WebGLBuffer[] = [];
  const arrays: WebGLVertexArrayObject[] = [];
  let texture: WebGLTexture | null = null;

  const dispose = () => {
    for (const array of arrays) gl.deleteVertexArray(array);
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const program of programs) gl.deleteProgram(program);
    gl.deleteTexture(texture);
  };

  function program(vertexSource: string, fragmentSource: string, defines = '') {
    const handle = gl.createProgram();
    if (!handle) throw new Error('Cannot allocate particle shader');
    programs.push(handle);
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, body] of [[gl.VERTEX_SHADER, 'in vec3 position;\n' + vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Cannot allocate particle shader');
        shaders.push(shader);
        gl.shaderSource(shader, '#version 300 es\nprecision highp float;\n' + defines + '\n' + body);
        gl.compileShader(shader);
        gl.attachShader(handle, shader);
      }
      attributeNames.forEach((name, location) => gl.bindAttribLocation(handle, location, name));
      gl.linkProgram(handle);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
        throw new Error(shaders.map((shader) => gl.getShaderInfoLog(shader)).filter(Boolean).join(' ') || 'Cannot link particle shader');
      }
      const location = Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(handle, name)])) as
        Record<(typeof uniformNames)[number], WebGLUniformLocation | null>;
      return (coordinates: Coordinates) => {
        gl.useProgram(handle);
        gl.uniform2fv(location.uViewport, coordinates.viewport);
        gl.uniform4fv(location.uPortrait, coordinates.portrait);
        gl.uniform4fv(location.uGlobe, coordinates.globe);
        gl.uniformMatrix3fv(location.uRotation, false, coordinates.rotation);
        gl.uniform3fv(location.uPointer, coordinates.pointer);
        gl.uniform3fv(location.uFocus, coordinates.focus);
        gl.uniform1f(location.uArrival, coordinates.arrival);
        gl.uniform1f(location.uNetwork, coordinates.network);
        gl.uniform1f(location.uExit, coordinates.exit);
        gl.uniform1f(location.uTime, coordinates.time);
        gl.uniform1f(location.uScroll, coordinates.scroll);
        gl.uniform1f(location.uDpr, coordinates.dpr);
        gl.uniform1f(location.uContact, coordinates.contact);
        gl.uniform1f(location.uLens, coordinates.lens);
      };
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }

  function vertexArray() {
    const array = gl.createVertexArray();
    if (!array) throw new Error('Cannot allocate particle vertices');
    arrays.push(array);
    gl.bindVertexArray(array);
    return array;
  }

  function upload(target: number, values: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>) {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Cannot allocate particle buffer');
    buffers.push(buffer);
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, values, gl.STATIC_DRAW);
  }

  function attribute(location: number, size: number, values: Float32Array<ArrayBuffer>) {
    upload(gl.ARRAY_BUFFER, values);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  try {
    const count = columns * rows;
    const sphere = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const net = new Float32Array(count * 2);
    const links: number[] = [];
    const angle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const sample = i * 6043 % count;
      const y = 1 - 2 * (sample + .5) / count;
      const ring = Math.sqrt(1 - y * y);
      const x = Math.cos(sample * angle) * ring;
      const z = Math.sin(sample * angle) * ring;
      const relief = 1 + .012 * Math.sin(x * 21 + y * 17) * Math.cos(z * 18 - y * 8);
      sphere[i * 3] = x * relief;
      sphere[i * 3 + 1] = y * relief;
      sphere[i * 3 + 2] = z * relief;
      seeds[i] = (i * .754877666 + .37) % 1;
      const row = Math.floor(i / columns);
      const col = i % columns;
      net[i * 2] = col / (columns - 1);
      net[i * 2 + 1] = row / (rows - 1);
      if (row % 2 || col % 2) continue;
      if (col + 2 < columns) links.push(i, i + 2);
      if (row + 2 < rows) links.push(i, i + 2 * columns);
    }

    const particles = vertexArray();
    attribute(0, 3, sphere);
    attribute(1, 4, portraitTargets(image, count));
    attribute(2, 2, net);
    attribute(3, 1, seeds);
    upload(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(links));

    const portrait = vertexArray();
    attribute(0, 3, new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]));
    texture = gl.createTexture();
    if (!texture) throw new Error('Cannot allocate portrait texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const bindPhoto = program(imageVertex, imageFragment);
    const bindPoints = program(vertex, fragment);
    let bindLines: ReturnType<typeof program> | undefined;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    return {
      render(coordinates: Coordinates) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (coordinates.arrival < .5) {
          bindPhoto(coordinates);
          gl.bindVertexArray(portrait);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        gl.bindVertexArray(particles);
        if (coordinates.arrival > 0 && coordinates.exit < 1) {
          bindPoints(coordinates);
          gl.drawArrays(gl.POINTS, 0, count);
        }
        if (coordinates.network > .62 && coordinates.exit < 1) {
          bindLines ??= program(vertex, fragment, '#define NETWORK_LINES 1');
          bindLines(coordinates);
          gl.drawElements(gl.LINES, links.length, gl.UNSIGNED_SHORT, 0);
        }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export async function mountHomeParticles(root: HTMLElement, canvas: HTMLCanvasElement, signal: AbortSignal, onUnavailable: () => void) {
  const image = root.querySelector<HTMLImageElement>('[data-portrait-image]');
  const photo = root.querySelector<HTMLElement>('[data-portrait-frame]');
  const stage = root.querySelector<HTMLElement>('[data-globe-transition]');
  const pin = stage?.querySelector<HTMLElement>('[data-globe-pin]');
  const globe = root.querySelector<HTMLElement>('[data-globe-stage]');
  const contact = document.getElementById('contact');
  if (!image || !photo || !stage || !pin || !globe || !contact) return;
  await image.decode();
  if (signal.aborted) return;
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false });
  if (!gl) return;
  const mobile = innerWidth < 700;
  const compact = mobile && (navigator.hardwareConcurrency || 4) <= 4;
  const columns = compact ? 56 : mobile ? 70 : 112;
  const rows = compact ? 72 : mobile ? 90 : 100;
  const map: Coordinates = {
    viewport: [1, 1], portrait: [0, 0, 0, 0], globe: [0, 0, 1, 3.54],
    rotation: new Float32Array(9), pointer: [-1000, -1000, 0], focus: [0, 0, 1],
    arrival: 0, network: 0, exit: 0, time: 0, scroll: window.scrollY, dpr: 1, contact: 0, lens: 0,
  };
  let renderer: ReturnType<typeof createRenderer> | undefined;
  let frame = 0, last = 0, displayed = false, lost = false, failed = false;
  let dirty = true, continuous = false;
  let arrive = 1, contactTop = 0;
  let pointerActive = false;

  function measure() {
    const width = document.documentElement.clientWidth;
    const height = innerHeight;
    const dpr = Math.min(devicePixelRatio, mobile ? 1 : 1.5);
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl!.viewport(0, 0, w, h);
    map.viewport = [width, height];
    map.dpr = dpr;
    const bounds = globe!.getBoundingClientRect();
    const top = stage!.getBoundingClientRect().top + window.scrollY + bounds.top - pin!.getBoundingClientRect().top;
    arrive = Math.max(height * .65, top + bounds.height / 2 - height * .58);
    contactTop = contact!.getBoundingClientRect().top + window.scrollY;
    dirty = true;
    requestDraw();
  }

  function requestDraw() {
    if (!frame && !signal.aborted && !lost && !failed && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function draw(now: number) {
    frame = 0;
    const height = map.viewport[1];
    const scroll = map.scroll;
    if (scroll <= 0 || scroll >= contactTop - height * .08) {
      if (displayed) gl!.clear(gl!.COLOR_BUFFER_BIT);
      if (scroll <= 0) root.removeAttribute('data-journey-ready');
      displayed = false;
      continuous = false;
      last = 0;
      return;
    }
    if (compact && continuous && !dirty && now - last < 32) { requestDraw(); return; }
    const delta = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    const a = smooth(0, arrive, scroll);
    map.arrival = a;
    map.exit = smooth(contactTop - height * .85, contactTop - height * .08, scroll);
    map.contact = contactTop - scroll;
    map.time += delta;
    if (dirty) {
      const p = photo!.getBoundingClientRect();
      const fit = Math.min(p.width / image!.naturalWidth, p.height / image!.naturalHeight);
      map.portrait = [p.left + p.width / 2, Math.max(height * .24, p.top + p.height / 2)
        + height * .12 * smooth(0, arrive * .55, scroll), image!.naturalWidth * fit, image!.naturalHeight * fit];
      const g = globe!.getBoundingClientRect();
      map.globe = [g.left + g.width / 2, Math.min(g.top + g.height / 2, height * .78),
        g.height / (2 * Math.tan(19 * Math.PI / 180)), 3.54 * Math.max(1, .92 / (g.width / g.height))];
      dirty = false;
    }
    const cosX = .9800665778, sinX = .1986693308, cosZ = .9820042351, sinZ = -.188858895;
    const y = -.36 + map.time * .12;
    const cosY = Math.cos(y), sinY = Math.sin(y);
    map.rotation.set([
      cosY * cosZ, cosX * sinZ + sinX * cosZ * sinY, sinX * sinZ - cosX * cosZ * sinY,
      -cosY * sinZ, cosX * cosZ - sinX * sinZ * sinY, sinX * cosZ + cosX * sinZ * sinY,
      sinY, -sinX * cosY, cosX * cosY,
    ]);
    const radius = map.globe[2] / Math.sqrt(map.globe[3] * map.globe[3] - 1);
    const px = (map.pointer[0] - map.globe[0]) / radius;
    const py = (map.globe[1] - map.pointer[1]) / radius;
    const onSphere = pointerActive && a > .99 && map.network < .01 && px * px + py * py < 1;
    if (onSphere) map.focus = [px, py, Math.sqrt(1 - px * px - py * py)];
    map.lens += (Number(onSphere) - map.lens) * (1 - Math.exp(-delta * 10));
    map.pointer[2] += (Number(pointerActive) - map.pointer[2]) * (1 - Math.exp(-delta * 9));

    try {
      renderer ??= createRenderer(gl!, image!, columns, rows);
      renderer.render(map);
    } catch {
      failed = true;
      renderer?.dispose();
      renderer = undefined;
      root.removeAttribute('data-journey-ready');
      onUnavailable();
      return;
    }
    if (!displayed) root.setAttribute('data-journey-ready', '');
    displayed = true;
    // Near the top the portrait barely changes except during scrolling.
    continuous = map.network > 0 || a > .35;
    if (continuous) requestDraw();
    else last = 0;
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    renderer = undefined;
    displayed = false;
    cancelAnimationFrame(frame);
    frame = 0;
    root.removeAttribute('data-journey-ready');
  }, { signal });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; measure(); }, { signal });
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    map.pointer[0] = event.clientX;
    map.pointer[1] = event.clientY;
    pointerActive = true;
    if (continuous) requestDraw();
  }, { passive: true, signal });
  root.addEventListener('pointerleave', () => { pointerActive = false; }, { signal });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    requestDraw();
  }, { signal });
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    renderer?.dispose();
    root.removeAttribute('data-journey-ready');
  }, { once: true });

  measure();
  return {
    measure,
    update(value: number, network: number) {
      dirty ||= value !== map.scroll || network !== map.network;
      map.scroll = value;
      map.network = network;
      requestDraw();
    },
  };
}
