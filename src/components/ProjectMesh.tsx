'use client';

import { useEffect, useRef } from 'react';

export default function ProjectMesh() {
  const surface = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = surface.current;
    const section = canvas?.closest('section');
    const context = canvas?.getContext('2d');
    if (!canvas || !section || !context) return;
    const preference = matchMedia('(prefers-reduced-motion: no-preference)');
    const pointer = { active: false, x: 0, y: 0, intensity: 0 };
    const events = new AbortController();
    let width = 0, height = 0, columns = 0, rows = 0, step = 0;
    let positions = new Float32Array(0);
    let shown = false, frame = 0, last = 0, phase = 0;

    const sync = () => {
      if (preference.matches && shown && !document.hidden && width && height) {
        if (!frame) frame = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
    };

    const draw = (now: number) => {
      frame = 0;
      const delta = last ? Math.min((now - last) / 1000, .05) : 0;
      last = now;
      phase += delta * .82;
      pointer.intensity += (Number(pointer.active) - pointer.intensity) * (1 - Math.exp(-delta * 9));
      const box = canvas.getBoundingClientRect();
      const pointerX = pointer.x - box.left;
      const pointerY = pointer.y - box.top;
      const radius = Math.min(155, width * .25);
      const radiusSquared = radius * radius;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const sx = (col - 1) * step;
          const sy = (row - 1) * step;
          let x = sx + Math.sin(sy * .012 - phase * .8) * 4;
          let y = sy + Math.sin(sx * .013 + sy * .009 + phase) * 8
            + Math.sin(sx * .025 - sy * .014 - phase) * 3;
          const dx = x - pointerX;
          const dy = y - pointerY;
          const distanceSquared = dx * dx + dy * dy;
          if (pointer.intensity > .002 && distanceSquared < radiusSquared) {
            const pull = 1 - distanceSquared / radiusSquared;
            x += dx * pull * pull * pointer.intensity * .36;
            y += (dy * .36 - 12) * pull * pull * pointer.intensity;
          }
          const index = 2 * (row * columns + col);
          positions[index] = x;
          positions[index + 1] = y;
        }
      }

      context.clearRect(0, 0, width, height);
      context.beginPath();
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const index = 2 * (row * columns + col);
          const x = positions[index], y = positions[index + 1];
          if (col + 1 < columns) {
            context.moveTo(x, y);
            context.lineTo(positions[index + 2], positions[index + 3]);
          }
          if (row + 1 < rows) {
            context.moveTo(x, y);
            context.lineTo(positions[index + columns * 2], positions[index + columns * 2 + 1]);
          }
        }
      }
      context.strokeStyle = 'rgba(255, 135, 85, .07)';
      context.lineWidth = .55;
      context.stroke();

      context.fillStyle = 'rgba(255, 135, 85, .32)';
      for (let index = 0; index < positions.length; index += 2) {
        context.fillRect(positions[index] - .7, positions[index + 1] - .7, 1.4, 1.4);
      }
      sync();
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      step = Math.max(width < 700 ? 23 : 18, width / 64);
      columns = Math.ceil(width / step) + 3;
      rows = Math.ceil(height / step) + 3;
      positions = new Float32Array(columns * rows * 2);
      const dpr = Math.min(devicePixelRatio, 1.35);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      sync();
    };
    const visibility = new IntersectionObserver(([entry]) => {
      shown = entry.isIntersecting;
      sync();
    });
    const geometry = new ResizeObserver(resize);
    section.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      pointer.active = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }, { passive: true, signal: events.signal });
    section.addEventListener('pointerleave', () => { pointer.active = false; }, { signal: events.signal });
    document.addEventListener('visibilitychange', sync, { signal: events.signal });
    preference.addEventListener('change', sync, { signal: events.signal });
    geometry.observe(canvas);
    visibility.observe(section);
    resize();

    return () => {
      events.abort();
      geometry.disconnect();
      visibility.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={surface} aria-hidden="true" />;
}
