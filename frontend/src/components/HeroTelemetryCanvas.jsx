import { useEffect, useRef } from 'react';

/**
 * HeroTelemetryCanvas
 * Full-bleed 60fps clinical ECG oscilloscope + live graph topology layer.
 * Reacts dynamically to `tone`:
 *   - 'critical': P-QRS-T cardiac trace hitting a vermilion DDI intercept gate
 *   - 'verified': Authentic ST-elevation (STEMI) trace with emerald citation bursts
 *   - 'titanium': Calm precision calibration baseline (no_evidence boundary)
 * Zero gradients; uses stepped alpha vector trails and crisp 1px geometry.
 */
export default function HeroTelemetryCanvas({ tone = 'critical' }) {
  const canvasRef = useRef(null);
  const toneRef = useRef(tone);

  useEffect(() => {
    toneRef.current = tone;
  }, [tone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let isVisible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Floating clinical graph nodes suspended around the waveform band
    const GRAPH_COUNT = 34;
    const graphNodes = Array.from({ length: GRAPH_COUNT }, (_, i) => ({
      rx: (i + 0.5) / GRAPH_COUNT + ((i * 19) % 10 - 5) * 0.008,
      ry: 0.24 + (((i * 37) % 100) / 100) * 0.48,
      vx: ((i % 2 === 0 ? 1 : -1) * (0.00004 + (i % 5) * 0.000012)),
      vy: ((i % 3 === 0 ? 1 : -1) * (0.00005 + (i % 4) * 0.000015)),
      r: i % 5 === 0 ? 2.8 : 1.5,
      key: i % 5 === 0,
    }));

    const pointer = { nx: 0, ny: 0, tx: 0, ty: 0 };

    const getPalette = () => {
      const isLight = document.documentElement.classList.contains('light-mode');
      return isLight
        ? {
            ink: '12, 12, 11',
            critical: '#b8292f',
            verified: '#1f6346',
            titanium: '#8d6c3a',
          }
        : {
            ink: '240, 237, 230',
            critical: '#ec463e',
            verified: '#45c898',
            titanium: '#c8b288',
          };
    };

    // Synthesize realistic ECG waveform amplitude for phase p in [0, 1)
    const sampleWave = (p, mode, t) => {
      if (mode === 'titanium') {
        // Calm calibration micro-pulse for no_evidence control
        const gatePulse = Math.abs(p - 0.5) < 0.025 ? Math.sin(((p - 0.475) / 0.05) * Math.PI) * 0.22 : 0;
        return Math.sin(p * Math.PI * 4 + t * 2) * 0.03 + gatePulse;
      }

      // Standard P wave
      const pWave = 0.14 * Math.exp(-Math.pow((p - 0.18) / 0.032, 2));
      // Q dip
      const qDip = -0.18 * Math.exp(-Math.pow((p - 0.295) / 0.011, 2));
      // Sharp R spike
      const rPeak = 1.0 * Math.exp(-Math.pow((p - 0.32) / 0.012, 2));
      // S dip
      const sDip = -0.32 * Math.exp(-Math.pow((p - 0.348) / 0.013, 2));

      if (mode === 'verified') {
        // ST-Elevation (STEMI) tombstone elevation + broad T wave
        const stElev = 0.36 * Math.exp(-Math.pow((p - 0.43) / 0.075, 2));
        const tWave = 0.28 * Math.exp(-Math.pow((p - 0.54) / 0.055, 2));
        return pWave + qDip + rPeak + sDip + stElev + tWave;
      }

      // Critical DDI mode: sharp ectopic spike + tension jitter after R-peak
      const tWave = 0.24 * Math.exp(-Math.pow((p - 0.52) / 0.048, 2));
      const ddiSpike =
        p > 0.62 && p < 0.72
          ? Math.sin((p - 0.62) * 95 + t * 14) * 0.26 * Math.exp(-Math.pow((p - 0.67) / 0.035, 2))
          : 0;
      return pWave + qDip + rPeak + sDip + tWave + ddiSpike;
    };

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    let time = 0;
    let scanX = 0;

    const drawFrame = () => {
      if (!prefersReduced) {
        time += 0.016;
        scanX = (scanX + Math.max(2.4, width * 0.0028)) % (width || 1);
      } else {
        scanX = width * 0.64;
      }

      pointer.nx += (pointer.tx - pointer.nx) * 0.05;
      pointer.ny += (pointer.ty - pointer.ny) * 0.05;

      const mode = toneRef.current;
      const pal = getPalette();
      const activeColor =
        mode === 'verified' ? pal.verified : mode === 'titanium' ? pal.titanium : pal.critical;

      ctx.clearRect(0, 0, width, height);

      const baselineY = height * 0.615 + pointer.ny * 5;
      const amp = Math.min(58, height * 0.092);
      const cyclePx = Math.max(240, Math.min(360, width * 0.27));

      // 1. Subtle drifting knowledge-graph mesh behind waveform
      const pxCoords = graphNodes.map((n) => {
        if (!prefersReduced) {
          n.rx += n.vx;
          n.ry += n.vy;
          if (n.rx < 0.03 || n.rx > 0.97) n.vx *= -1;
          if (n.ry < 0.14 || n.ry > 0.78) n.vy *= -1;
        }
        return {
          x: n.rx * width + pointer.nx * (n.key ? 18 : 9),
          y: n.ry * height + pointer.ny * (n.key ? 14 : 7),
          r: n.r,
          key: n.key,
        };
      });

      ctx.lineWidth = 0.7;
      for (let i = 0; i < pxCoords.length; i++) {
        const a = pxCoords[i];
        for (let j = i + 1; j < pxCoords.length; j++) {
          const b = pxCoords[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 165) {
            const alpha = (1 - d / 165) * 0.13;
            ctx.strokeStyle =
              a.key && b.key
                ? activeColor
                : `rgba(${pal.ink}, ${alpha.toFixed(3)})`;
            ctx.globalAlpha = a.key && b.key ? Math.min(0.32, alpha * 2.2) : 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < pxCoords.length; i++) {
        const pt = pxCoords[i];
        const nearScan = Math.abs(pt.x - scanX) < 110;
        ctx.fillStyle = pt.key || nearScan ? activeColor : `rgba(${pal.ink}, 0.28)`;
        ctx.globalAlpha = nearScan ? 0.95 : pt.key ? 0.55 : 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, nearScan ? pt.r * 1.45 : pt.r, 0, Math.PI * 2);
        ctx.fill();

        if (nearScan && pt.key) {
          // Live vertical telemetry tether down to the ECG baseline
          ctx.strokeStyle = activeColor;
          ctx.globalAlpha = 0.35;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x, baselineY);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.globalAlpha = 1;

      // 2. Horizontal Clinical Calibration Axis + Millisecond Ticks
      ctx.strokeStyle = `rgba(${pal.ink}, 0.1)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(width, baselineY);
      ctx.stroke();

      const tickStep = 48;
      ctx.beginPath();
      for (let x = 0; x < width; x += tickStep) {
        const tall = x % (tickStep * 4) === 0 ? 7 : 3;
        ctx.moveTo(x, baselineY - tall);
        ctx.lineTo(x, baselineY + tall);
      }
      ctx.stroke();

      // 3. Real-Time Sweeping ECG Oscilloscope Trace (Stepped Alpha Trail, Zero Gradients)
      const step = 3;
      const tailLen = Math.min(480, width * 0.42);

      // Ghost trace (full width faint reference)
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${pal.ink}, 0.1)`;
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += step) {
        const phase = (((x + time * 14) % cyclePx) + cyclePx) % cyclePx / cyclePx;
        const y = baselineY - sampleWave(phase, mode, time) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Active Phosphor Sweep Segments trailing behind scanX
      const segments = 14;
      const segPx = tailLen / segments;
      for (let s = 0; s < segments; s++) {
        const distFromHead = s * segPx;
        const xEnd = scanX - distFromHead;
        const xStart = xEnd - segPx - step;
        const alpha = Math.pow(1 - s / segments, 1.5) * 0.92;

        ctx.beginPath();
        ctx.strokeStyle = activeColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = s < 3 ? 2.2 : 1.45;

        let started = false;
        for (let x = Math.floor(xStart); x <= Math.ceil(xEnd); x += step) {
          const wx = ((x % width) + width) % width;
          // Break stroke across wrap seam
          if (started && Math.abs(wx - (((x - step) % width) + width) % width) > step * 3) {
            ctx.stroke();
            ctx.beginPath();
            started = false;
          }
          const phase = (((wx + time * 14) % cyclePx) + cyclePx) % cyclePx / cyclePx;
          const y = baselineY - sampleWave(phase, mode, time) * amp;
          if (!started) {
            ctx.moveTo(wx, y);
            started = true;
          } else {
            ctx.lineTo(wx, y);
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 4. Crisp Vertical Scan Beam + Active Head Dot
      const headPhase = (((scanX + time * 14) % cyclePx) + cyclePx) % cyclePx / cyclePx;
      const headY = baselineY - sampleWave(headPhase, mode, time) * amp;

      ctx.strokeStyle = activeColor;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scanX, 0);
      ctx.lineTo(scanX, height);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(scanX, headY, 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = activeColor;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(scanX, headY, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (isVisible) drawFrame();
      if (!prefersReduced) rafId = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    resize();
    if (prefersReduced) drawFrame();
    else rafId = requestAnimationFrame(loop);

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="mgx-telemetry-canvas" aria-hidden="true" />;
}
