const silhouette = `
float grain(vec2 uv) {
  vec3 p = fract(uv.xyx * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float erosionNoise(vec2 uv) {
  vec2 cell = floor(uv);
  vec2 t = fract(uv);
  t *= t * (3. - 2. * t);
  return mix(mix(grain(cell), grain(cell + vec2(1., 0.)), t.x),
             mix(grain(cell + vec2(0., 1.)), grain(cell + vec2(1.)), t.x), t.y);
}

float releaseAt(vec2 home, float edge) {
  float outline = max(edge, .45 * smoothstep(.22, .87, abs(home.x)));
  float lower = 1. - smoothstep(-.77, -.15, home.y);
  float face = (1. - smoothstep(.12, .48, abs(home.x))) * smoothstep(-.18, .28, home.y);
  face *= 1. - smoothstep(.62, .9, home.y);
  return mix(.46, .075, outline) - lower * .038
      + .075 * face * (1. - edge) + erosionNoise(home * 9.) * .12 + erosionNoise(home * 108.) * .11;
}
`;

const portraitTransform = `
uniform vec3 uPortrait;
uniform float uTravel;

vec2 portraitPosition(vec2 home) {
  float width = 1. + uTravel * .22;
  float height = 1. - uTravel * .10;
  return home * uPortrait.xy * vec2(width, height) + vec2(0., uPortrait.z - uTravel);
}
`;

const textureVertex = `
attribute vec2 aHome;
varying mediump vec2 vHome;
${portraitTransform}

void main() {
  vHome = aHome;
  gl_Position = vec4(portraitPosition(aHome), 0., 1.);
}`;

const textureFragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uImage;
uniform float uPortraitDissolve;
varying mediump vec2 vHome;
${silhouette}

void main() {
  vec2 uv = vHome * vec2(.5, -.5) + .5;
  vec4 color = texture2D(uImage, uv);
  if (color.a < .006) discard;
  vec2 dx = vec2(.017, 0.);
  vec2 dy = vec2(0., .017);
  float nearby = min(min(texture2D(uImage, uv + dx).a, texture2D(uImage, uv - dx).a),
                     min(texture2D(uImage, uv + dy).a, texture2D(uImage, uv - dy).a));
  float edge = 1. - nearby;
  float release = releaseAt(vHome, edge);
  float bite = smoothstep(max(.018, release - .075), release + .17, uPortraitDissolve);
  float light = dot(color.rgb, vec3(.213, .715, .072));
  vec3 rim = vec3(.25, .09, .035) * edge * smoothstep(-.5, .55, vHome.x);
  gl_FragColor = vec4(vec3(light) + rim, color.a * .97 * (1. - bite));
}`;

const vertexSource = `
attribute vec4 aHome;
attribute vec4 aFlow;
uniform float uScrollProgress;
uniform float uPortraitDissolve;
uniform float uWaveExpansion;
uniform float uScatterAmount;
uniform float uClock;
uniform float uDpr;
varying float vLight;
varying float vWarmth;
varying float vOpacity;
${portraitTransform}
${silhouette}

float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453);
}

float noise(float x) {
  float cell = floor(x);
  float t = fract(x);
  return mix(hash(cell), hash(cell + 1.), t * t * (3. - 2. * t));
}

void main() {
  float p = uScrollProgress;
  float expansion = uWaveExpansion;
  float scatter = uScatterAmount;
  float layer = aFlow.y;
  float seed = aFlow.z;
  float lane = aFlow.x;
  float edge = abs(lane);
  float width = mix(uPortrait.x * .8, 1.02, expansion);
  float flow = p * 1.35;
  float swell = noise(lane * 4.1 + flow + layer * .47)
              + .45 * noise(lane * 9. + layer * .25 - flow * .55) - .68;
  float roll = sin(lane * 9. + layer * 1.8 + flow) * .045;
  float depth = .94 + layer * .075;
  float band = mix(uPortrait.z - uTravel - uPortrait.y * .65, -.69, expansion);
  band -= scatter * .09;
  vec2 wave = vec2(lane * width * depth, band);
  wave.y += (swell * .24 + roll) * mix(1., .6, scatter);
  wave.y += layer * mix(.14, .095, expansion) + .09 * (1. - edge);
  wave.y += sin(lane * 8. + layer + uClock * .48) * .009 * expansion;
  wave.x += sign(lane) * seed * scatter * .06;

  vec2 portrait = portraitPosition(aHome.xy);
  float lower = 1. - smoothstep(-.85, .58, aHome.y);
  float release = releaseAt(aHome.xy, aFlow.w);
  float peel = smoothstep(max(.016, release - .09), release + .12, uPortraitDissolve);
  float morph = smoothstep(max(.02, release - .045), release + .48 + seed * .09,
                           uPortraitDissolve + smoothstep(.68, 1., p) * .25);

  // The curve leaves each portrait sample heading down before spreading sideways.
  vec2 bend = vec2(mix(portrait.x, wave.x, .26), mix(portrait.y, wave.y, .76));
  bend.y -= .055 + .035 * erosionNoise(aHome.xy * 8.);
  vec2 position = mix(mix(portrait, bend, morph), mix(bend, wave, morph), morph);

  float fade = 1. - smoothstep(.83 + seed * .055, 1., p);
  float contourAlpha = .045 + aFlow.w * .12 + lower * .04;
  float edgeFade = 1. - edge * edge * .48 * morph;
  vOpacity = mix(contourAlpha, .94, peel) * fade * edgeFade;
  vOpacity *= (.42 + aHome.z * .58) * aHome.w;
  vLight = mix(aHome.z, max(.48, aHome.z), morph * .74);
  vWarmth = mix(.10 + lower * .43, .45 + layer * .26, morph);
  vWarmth += seed * .28;

  gl_Position = vec4(position, 0., 1.);
  gl_PointSize = uDpr * (1.02 + vLight * .98 + seed * .48) * mix(1., depth, morph);
}`;

const fragmentSource = `
precision mediump float;
varying float vLight;
varying float vWarmth;
varying float vOpacity;

void main() {
  float core = 1. - smoothstep(.12, .5, length(gl_PointCoord - .5));
  vec3 color = mix(vec3(1., .94, .85), vec3(1., .52, .29), clamp(vWarmth, 0., 1.));
  float brightness = mix(.39, 1., vLight);
  gl_FragColor = vec4(color * brightness, core * vOpacity);
}`;

function makeProgram(gl: WebGLRenderingContext, vertex: string, fragment: string) {
  const program = gl.createProgram();
  if (!program) return null;

  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type);
    if (!shader) {
      gl.deleteProgram(program);
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }

  gl.bindAttribLocation(program, 0, 'aHome');
  gl.bindAttribLocation(program, 1, 'aFlow');
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

function getPoints(image: HTMLImageElement, width: number) {
  // Repeatable sampling keeps the same silhouette and flow after a remount.
  let seed = 0x8921753;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const sample = document.createElement('canvas');
  const resolution = width < 700 ? 144 : width < 1100 ? 198 : 273;
  const ratio = Math.min(1, resolution / Math.max(image.naturalWidth, image.naturalHeight));
  sample.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  sample.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = sample.getContext('2d');
  if (!context) return;

  context.drawImage(image, 0, 0, sample.width, sample.height);
  const rgba = context.getImageData(0, 0, sample.width, sample.height).data;
  const stepX = Math.max(1, Math.round(sample.width * .017));
  const stepY = Math.max(1, Math.round(sample.height * .017));
  const alphaAt = (x: number, y: number) => {
    const px = Math.max(0, Math.min(sample.width - 1, x));
    const py = Math.max(0, Math.min(sample.height - 1, y));
    return rgba[4 * (py * sample.width + px) + 3] / 255;
  };
  const points: number[] = [];

  for (let y = 0; y < sample.height; y++) {
    for (let x = 0; x < sample.width; x++) {
      const offset = 4 * (y * sample.width + x);
      const alpha = rgba[offset + 3] / 255;
      const light = (.213 * rgba[offset] + .715 * rgba[offset + 1] + .072 * rgba[offset + 2]) / 255;
      if (alpha < .055 || random() > alpha * (.57 + light * .31)) continue;

      const homeX = (x + .5) / sample.width * 2 - 1;
      const homeY = 1 - (y + .5) / sample.height * 2;
      const side = homeX + (random() - .5) * .21 < 0 ? -1 : 1;
      const lane = Math.max(-1, Math.min(1, homeX * .60 + side * random() * .64 + (random() - .5) * .25));
      const edge = 1 - Math.min(alphaAt(x + stepX, y), alphaAt(x - stepX, y), alphaAt(x, y + stepY), alphaAt(x, y - stepY));
      points.push(homeX, homeY, light, alpha, lane, random() * 2 - 1, random(), edge);
    }
  }

  return new Float32Array(points);
}

function smoothstep(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export async function mountPortrait(
  stage: HTMLElement,
  motion: { scroll: number },
  signal: AbortSignal,
) {
  const canvas = stage.querySelector('canvas');
  const photoFrame = stage.querySelector<HTMLElement>('[data-portrait-frame]');
  const image = photoFrame?.querySelector('img');
  if (!canvas || !photoFrame || !image) return;

  try {
    await image.decode();
  } catch {
    return;
  }
  if (signal.aborted) return;

  const points = getPoints(image, stage.clientWidth);
  if (!points?.length) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false });
  if (!gl) return;

  const program = makeProgram(gl, vertexSource, fragmentSource);
  const imageProgram = makeProgram(gl, textureVertex, textureFragment);
  const buffer = gl.createBuffer();
  const quad = gl.createBuffer();
  const texture = gl.createTexture();
  const disposeBuffers = () => {
    gl.deleteProgram(program);
    gl.deleteProgram(imageProgram);
    gl.deleteBuffer(buffer);
    gl.deleteBuffer(quad);
    gl.deleteTexture(texture);
  };
  if (!program || !imageProgram || !buffer || !quad || !texture) {
    disposeBuffers();
    return;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  if (gl.getError() !== gl.NO_ERROR) {
    disposeBuffers();
    return;
  }

  const portrait = gl.getUniformLocation(program, 'uPortrait');
  const travel = gl.getUniformLocation(program, 'uTravel');
  const progressUniform = gl.getUniformLocation(program, 'uScrollProgress');
  const dissolve = gl.getUniformLocation(program, 'uPortraitDissolve');
  const expansion = gl.getUniformLocation(program, 'uWaveExpansion');
  const scatter = gl.getUniformLocation(program, 'uScatterAmount');
  const time = gl.getUniformLocation(program, 'uClock');
  const scale = gl.getUniformLocation(program, 'uDpr');
  const imagePortrait = gl.getUniformLocation(imageProgram, 'uPortrait');
  const imageTravel = gl.getUniformLocation(imageProgram, 'uTravel');
  const imageDissolve = gl.getUniformLocation(imageProgram, 'uPortraitDissolve');
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  let frame = 0;
  let visible = false;
  let lost = false;
  let clock = 0;
  let previousTime = 0;
  let dpr = 1;
  let fitWidth = 0;
  let fitHeight = 0;
  let anchor = 0;
  let travelLimit = 0;

  const requestFrame = () => {
    if (visible && !document.hidden && !lost && !frame) frame = requestAnimationFrame(render);
  };

  const render = (now: number) => {
    frame = 0;
    if (!visible || document.hidden || lost) return;

    const progress = motion.scroll;
    const inTransition = progress > 0 && progress < 1;
    if (previousTime && inTransition) clock += Math.min(48, now - previousTime) * .001;
    previousTime = inTransition ? now : 0;

    const descend = travelLimit * smoothstep(0, .75, progress);
    const erosion = smoothstep(.035, .91, progress);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (erosion < 1) {
      gl.useProgram(imageProgram);
      gl.uniform3f(imagePortrait, fitWidth, fitHeight, anchor);
      gl.uniform1f(imageTravel, descend);
      gl.uniform1f(imageDissolve, erosion);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0);
      gl.disableVertexAttribArray(1);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    if (progress < 1) {
      gl.useProgram(program);
      gl.uniform3f(portrait, fitWidth, fitHeight, anchor);
      gl.uniform1f(travel, descend);
      gl.uniform1f(progressUniform, progress);
      gl.uniform1f(dissolve, erosion);
      gl.uniform1f(expansion, smoothstep(.015, .82, progress));
      gl.uniform1f(scatter, smoothstep(.84, 1, progress));
      gl.uniform1f(time, clock);
      gl.uniform1f(scale, dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
      gl.drawArrays(gl.POINTS, 0, points.length / 8);
    }
    if (!stage.hasAttribute('data-rendering')) stage.setAttribute('data-rendering', '');
    if (inTransition) requestFrame();
  };

  const resize = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height || lost) return;
    dpr = Math.min(window.devicePixelRatio, width < 700 ? 1.25 : 1.5);
    const bufferWidth = Math.round(width * dpr);
    const bufferHeight = Math.round(height * dpr);
    if (canvas.width !== bufferWidth) canvas.width = bufferWidth;
    if (canvas.height !== bufferHeight) canvas.height = bufferHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const fit = Math.min(photoFrame.clientWidth / image.naturalWidth, photoFrame.clientHeight / image.naturalHeight);
    const centerY = photoFrame.offsetTop + photoFrame.clientHeight / 2;
    fitWidth = image.naturalWidth * fit / width;
    fitHeight = image.naturalHeight * fit / height;
    anchor = 1 - 2 * centerY / height;
    travelLimit = width < 700 ? .25 : .46;
    requestFrame();
  };

  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  };
  const visibility = () => {
    if (visible && !document.hidden && !lost) requestFrame();
    else pause();
  };
  const resetStage = () => {
    stage.removeAttribute('data-rendering');
  };
  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visibility();
  });

  resize();
  resizeObserver.observe(stage);
  resizeObserver.observe(photoFrame);
  intersection.observe(stage);
  document.addEventListener('visibilitychange', visibility, { signal });
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    resetStage();
    pause();
  }, { signal });

  signal.addEventListener('abort', () => {
    pause();
    resizeObserver.disconnect();
    intersection.disconnect();
    disposeBuffers();
    resetStage();
  }, { once: true });

  return requestFrame;
}
