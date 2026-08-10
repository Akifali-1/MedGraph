import { useRef, useEffect } from 'react';

/**
 * ParticleStream
 *
 * The connective tissue of the landing page: a braided ribbon of particles
 * that erupts from a vortex beneath the hero, flows the full height of the
 * document, weaves past the alternating sections, and converges into a single
 * node at the base.
 *
 * Implementation notes:
 *  - One fixed, viewport-sized canvas. Particles live in page space (y is a
 *    document offset) and are drawn at `y - scrollY`, so the stream reads as
 *    one continuous object rather than a per-section graphic.
 *  - The spine is a braid: three strands sharing a centreline, each phase
 *    shifted, so the ribbon appears to twist as it descends.
 *  - The centreline x is driven by the same alternating rhythm as the layout,
 *    so the stream naturally swings away from whichever side holds the text.
 *  - devicePixelRatio scaling, a single rAF loop, an IntersectionObserver to
 *    stop work when the page is not visible, and a hard stop under
 *    prefers-reduced-motion (which paints one static frame instead of
 *    leaving an empty canvas).
 */

const PALETTE = [
  [86, 137, 216],  // blue
  [138, 108, 200], // violet
  [212, 124, 176], // pink
  [78, 178, 172],  // teal
  [112, 145, 226], // periwinkle
];

const COUNT = 420;

export default function ParticleStream({ sideForY }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ particles: [], docH: 0, w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    let visible = true;
    let running = true;

    const S = stateRef.current;

    /* Centreline of the braid at a given document y.
       Returns x in CSS pixels. The swing mirrors the layout rhythm so the
       ribbon always drifts opposite the text column. */
    const centre = (docY) => {
      const w = S.w;
      const t = S.docH ? docY / S.docH : 0;

      /* Hero: tight column under the vortex. */
      if (t < 0.12) {
        const k = t / 0.12;
        return w * 0.5 + Math.sin(k * Math.PI) * w * 0.015;
      }

      /* Tail: pull back to centre for the convergence node. */
      if (t > 0.88) {
        const k = (t - 0.88) / 0.12;
        const from = sideForY ? sideForY(0.88) : 0.5;
        return w * (from + (0.5 - from) * easeInOut(k));
      }

      /* Body: swing between the free side of each section. */
      const target = sideForY ? sideForY(t) : 0.5;
      return w * target;
    };

    const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

    const seed = () => {
      S.particles = Array.from({ length: COUNT }, (_, i) => {
        const colour = PALETTE[i % PALETTE.length];
        return {
          /* Progress along the stream, 0 at the vortex, 1 at the node. */
          p: Math.random(),
          /* Which strand of the braid, and where in its rotation. */
          strand: i % 3,
          phase: Math.random() * Math.PI * 2,
          /* Radial offset from the centreline, in px. */
          spread: 6 + Math.random() * 34,
          speed: 0.00018 + Math.random() * 0.00042,
          r: 0.85 + Math.random() * 2.2,
          colour,
          alpha: 0.34 + Math.random() * 0.6,
        };
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.w = window.innerWidth;
      S.h = window.innerHeight;
      S.docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      canvas.width = Math.floor(S.w * dpr);
      canvas.height = Math.floor(S.h * dpr);
      canvas.style.width = `${S.w}px`;
      canvas.style.height = `${S.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /* Draw one frame. `animate` false paints the static reduced-motion state. */
    const draw = (animate) => {
      const scrollY = window.scrollY || window.pageYOffset;
      ctx.clearRect(0, 0, S.w, S.h);

      /* Vortex bloom removed — the bright white disc clashed with the hero
         artwork on dark backgrounds. The particle braid carries the visual
         weight on its own. */

      for (const q of S.particles) {
        if (animate) {
          q.p += q.speed;
          if (q.p > 1) q.p -= 1;
        }

        const docY = q.p * S.docH;
        const y = docY - scrollY;

        /* Skip anything well outside the viewport. */
        if (y < -80 || y > S.h + 80) continue;

        const cx = centre(docY);

        /* Braid: each strand rotates around the centreline as it descends. */
        const twist = q.p * 34 + q.phase + (q.strand * Math.PI * 2) / 3;
        const t = q.p;

        /* The ribbon is tight at the vortex, widest mid page, tight again
           as it converges. */
        const envelope =
          t < 0.1
            ? t / 0.1
            : t > 0.9
              ? Math.max(0.06, (1 - t) / 0.1)
              : 1;

        const x = cx + Math.cos(twist) * q.spread * envelope;
        const depth = (Math.sin(twist) + 1) / 2; // 0 behind, 1 in front

        const [r, g2, b] = q.colour;
        const a = q.alpha * (0.35 + depth * 0.65) * (0.25 + envelope * 0.75);

        ctx.beginPath();
        ctx.arc(x, y, q.r * (0.6 + depth * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g2},${b},${a})`;
        ctx.fill();
      }
    };

    const loop = () => {
      if (!running) return;
      if (visible) draw(true);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reduce.matches) {
        resize();
        seed();
        draw(false);
        return;
      }
      resize();
      seed();
      loop();
    };

    /* Pause when the tab or the canvas is not visible. */
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => {
      visible = !document.hidden;
    };

    const onResize = () => {
      resize();
      if (reduce.matches) draw(false);
    };

    const onMotionChange = () => {
      cancelAnimationFrame(raf);
      running = true;
      start();
    };

    start();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    reduce.addEventListener('change', onMotionChange);

    /* The document grows as fonts load and sections settle. */
    const ro = new ResizeObserver(() => resize());
    ro.observe(document.body);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce.removeEventListener('change', onMotionChange);
    };
  }, [sideForY]);

  return <canvas className="cine-stream" ref={canvasRef} aria-hidden="true" />;
}
