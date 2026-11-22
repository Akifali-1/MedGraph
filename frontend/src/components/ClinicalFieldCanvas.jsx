import { useEffect, useRef } from 'react';

/**
 * ClinicalFieldCanvas
 * Full-bleed 60fps interactive 3D clinical topology.
 * - Sweeping tilted dual-strand clinical ribbon across 100vw
 * - Real-time cursor probe reticle with triangulation chords + entity lock
 * - Interactive DDI Halt shockwave morph (haltMode = true)
 * - True Z-axis camera fly-through driven by scroll progressRef (0 -> 1)
 * Zero gradients, zero WebGL bundle overhead.
 */
const CLINICAL_TAGS = [
  { label: 'WARFARIN', code: 'RX-11289', kind: 'critical' },
  { label: 'ASPIRIN', code: 'RX-1191', kind: 'critical' },
  { label: 'CHEST PAIN', code: 'UMLS-C0008031', kind: 'titanium' },
  { label: 'DIAPHORESIS', code: 'UMLS-C0700590', kind: 'titanium' },
  { label: 'ACUTE STEMI', code: 'ICD-I21.3', kind: 'critical' },
  { label: 'AHA/ACC §10', code: 'CHUNK VERIFIED', kind: 'verified' },
  { label: 'ACC/AHA §4.1', code: 'ECG 10-MIN', kind: 'verified' },
  { label: 'NEO4J 1-HOP', code: 'DDI SEVERITY: HI', kind: 'critical' },
];

export default function ClinicalFieldCanvas({ progressRef, haltMode = false }) {
  const canvasRef = useRef(null);
  const haltRef = useRef(haltMode);
  const shockRef = useRef(0);

  useEffect(() => {
    if (haltRef.current !== haltMode) {
      haltRef.current = haltMode;
      shockRef.current = 1; // Trigger crisp geometric shockwave ring
    }
  }, [haltMode]);

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

    const COUNT = 320;
    const nodes = Array.from({ length: COUNT }, (_, i) => {
      const t = i / COUNT;
      const strand = i % 2; // 0 = Ontology Ribbon, 1 = Pharmacology Ribbon
      const angle = t * Math.PI * 6 + strand * Math.PI;
      const spreadX = (t - 0.5) * 920;
      const radius = 115 + Math.sin(t * Math.PI) * 95 + (i % 7) * 7;

      // State A: Sweeping Sculptural Double-Helix / Clinical Ribbon (tilted across viewport)
      const rawX = spreadX;
      const rawY = Math.cos(angle) * radius;
      const rawZ = Math.sin(angle) * radius;

      // Tilt -20deg in XY plane so it sweeps dramatically between diagonal headlines
      const tilt = -0.34;
      const sFlow = {
        x: rawX * Math.cos(tilt) - rawY * Math.sin(tilt),
        y: rawX * Math.sin(tilt) + rawY * Math.cos(tilt),
        z: rawZ,
      };

      // State B: DDI Halt Mode — Two Opposed Pharmacological Planes (Warfarin Left / Aspirin Right)
      const side = strand === 0 ? -1 : 1;
      const row = Math.floor((i / 2) % 16) - 7.5;
      const col = Math.floor(i / 32) - 4.5;
      const sHalt = {
        x: side * (215 + Math.abs(col) * 14),
        y: row * 28,
        z: col * 38,
      };

      return {
        sFlow,
        sHalt,
        strand,
        phase: (i * 0.37) % (Math.PI * 2),
        isCritical: i % 17 === 0,
        isVerified: i % 19 === 0 && i % 17 !== 0,
        tag: CLINICAL_TAGS[i % CLINICAL_TAGS.length],
      };
    });

    // Traveling signal packets along the ribbon
    const pulses = Array.from({ length: 18 }, (_, i) => ({
      pos: (i / 18) * COUNT,
      speed: 0.22 + (i % 4) * 0.08,
      critical: i % 3 === 0,
    }));

    const pointer = {
      x: -999,
      y: -999,
      tx: -999,
      ty: -999,
      active: false,
      nx: 0,
      ny: 0,
    };

    const getPalette = () => {
      const isLight = document.documentElement.classList.contains('light-mode');
      return isLight
        ? {
            ink: '12, 12, 11',
            titanium: '#8d6c3a',
            accent: '#b8292f',
            verified: '#1f6346',
            tagBg: 'rgba(242, 239, 233, 0.94)',
            tagInk: '#0c0c0b',
          }
        : {
            ink: '240, 237, 230',
            titanium: '#c8b288',
            accent: '#ec463e',
            verified: '#45c898',
            tagBg: 'rgba(6, 6, 8, 0.92)',
            tagInk: '#f0ede6',
          };
    };

    const resize = () => {
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      pointer.active = inside;
      if (inside) {
        pointer.tx = e.clientX - rect.left;
        pointer.ty = e.clientY - rect.top;
        pointer.nx = (pointer.tx / width - 0.5) * 2;
        pointer.ny = (pointer.ty / height - 0.5) * 2;
      }
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const lerp = (a, b, t) => a + (b - a) * t;
    let time = 0;
    let haltBlend = haltRef.current ? 1 : 0;
    let camRotX = 0;
    let camRotY = 0;

    const drawFrame = () => {
      if (!prefersReduced) time += 0.0055;

      // Smooth blend between Flow Ribbon (0) and DDI Halt Wall (1)
      const targetHalt = haltRef.current ? 1 : 0;
      haltBlend += (targetHalt - haltBlend) * 0.065;

      // Shockwave ring decay
      if (shockRef.current > 0.005) {
        shockRef.current *= 0.92;
      } else {
        shockRef.current = 0;
      }

      // Smooth pointer tracking
      if (pointer.active) {
        if (pointer.x < -500) {
          pointer.x = pointer.tx;
          pointer.y = pointer.ty;
        } else {
          pointer.x += (pointer.tx - pointer.x) * 0.16;
          pointer.y += (pointer.ty - pointer.y) * 0.16;
        }
      }

      camRotY += (pointer.nx * 0.34 - camRotY) * 0.045;
      camRotX += (pointer.ny * 0.24 - camRotX) * 0.045;

      const scrollP = Math.min(1, Math.max(0, progressRef?.current ?? 0));
      const palette = getPalette();

      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.5;
      const scaleW = Math.min(1.25, Math.max(0.62, width / 1280));

      // True Z-axis camera dive as user scrolls (camera pushes into the 3D field)
      const cameraZ = 640 - scrollP * 470;
      const fov = 560;

      // Architectural background calibration lines (ultra-subtle 1px)
      ctx.save();
      ctx.strokeStyle = `rgba(${palette.ink}, 0.055)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      // Expanding crisp shockwave ring on Halt toggle
      if (shockRef.current > 0.01) {
        const ringR = (1 - shockRef.current) * Math.max(width, height) * 0.72;
        ctx.strokeStyle = palette.accent;
        ctx.globalAlpha = shockRef.current * 0.85;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      const rotY = time * 0.42 + camRotY + scrollP * 0.9;
      const rotX = Math.sin(time * 0.35) * 0.1 + camRotX;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const projected = new Array(COUNT);
      const nearCursor = [];
      const probeRadius = 150;

      for (let i = 0; i < COUNT; i++) {
        const n = nodes[i];
        const wave = Math.sin(time * 1.4 + n.phase) * 9 * (1 - haltBlend);

        const bx = lerp(n.sFlow.x, n.sHalt.x, haltBlend) * scaleW;
        const by = (lerp(n.sFlow.y, n.sHalt.y, haltBlend) + wave) * scaleW;
        const bz = lerp(n.sFlow.z, n.sHalt.z, haltBlend) * scaleW;

        const x1 = bx * cosY - bz * sinY;
        const z1 = bx * sinY + bz * cosY;
        const y2 = by * cosX - z1 * sinX;
        const z2 = by * sinX + z1 * cosX;

        const depth = z2 + cameraZ;
        if (depth < 40) {
          projected[i] = null;
          continue;
        }

        const scale = fov / depth;
        let sx = cx + x1 * scale;
        let sy = cy + y2 * scale;

        // Magnetic pointer deflection inside Probe Reticle
        let distToCursor = 9999;
        if (pointer.active && scrollP < 0.35) {
          const dx = sx - pointer.x;
          const dy = sy - pointer.y;
          distToCursor = Math.hypot(dx, dy);
          if (distToCursor < probeRadius && distToCursor > 1) {
            const push = (1 - distToCursor / probeRadius) * 22;
            sx += (dx / distToCursor) * push;
            sy += (dy / distToCursor) * push;
          }
        }

        const pt = {
          sx,
          sy,
          scale,
          depth,
          strand: n.strand,
          isCritical: n.isCritical,
          isVerified: n.isVerified,
          distToCursor,
          tag: n.tag,
        };
        projected[i] = pt;

        if (distToCursor < probeRadius) {
          nearCursor.push(pt);
        }
      }

      // 1. Draw structural spine + cross-strand clinical edges
      ctx.lineWidth = 0.75;
      for (let i = 0; i < COUNT; i++) {
        const a = projected[i];
        if (!a) continue;

        // Spine neighbor along same strand
        const nextSame = projected[i + 2];
        if (nextSame) {
          const dist = Math.hypot(a.sx - nextSame.sx, a.sy - nextSame.sy);
          if (dist < 140) {
            const alpha = Math.min(0.42, (1 - dist / 140) * 0.38 * a.scale);
            ctx.strokeStyle =
              haltBlend > 0.5 && a.strand === 0
                ? palette.accent
                : `rgba(${palette.ink}, ${alpha.toFixed(3)})`;
            ctx.globalAlpha = haltBlend > 0.5 && a.strand === 0 ? Math.min(0.55, alpha * 1.6) : 1;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(nextSame.sx, nextSame.sy);
            ctx.stroke();
          }
        }

        // Cross-strand rungs (turning into tense vermilion fault lines in Halt Mode)
        if (i % 4 === 0 && i + 1 < COUNT) {
          const b = projected[i + 1];
          if (b) {
            const isHot = haltBlend > 0.35 || a.isCritical;
            ctx.strokeStyle = isHot
              ? palette.accent
              : `rgba(${palette.ink}, ${(0.14 * Math.min(1, a.scale)).toFixed(3)})`;
            ctx.globalAlpha = isHot ? Math.min(0.75, 0.25 + haltBlend * 0.5) : 1;
            ctx.lineWidth = isHot && haltBlend > 0.5 ? 1.1 : 0.65;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
            ctx.lineWidth = 0.75;
          }
        }
      }
      ctx.globalAlpha = 1;

      // 2. Draw crisp nodes
      for (let i = 0; i < COUNT; i++) {
        const pt = projected[i];
        if (!pt) continue;

        const inProbe = pt.distToCursor < probeRadius;
        const baseR = pt.isCritical ? 3.1 : pt.isVerified ? 2.4 : 1.55;
        const r = Math.max(1.0, (inProbe ? baseR * 1.45 : baseR) * Math.min(1.8, pt.scale));
        const alpha = Math.min(1, Math.max(0.14, pt.scale * 0.85));

        if (pt.isCritical || (haltBlend > 0.6 && pt.strand === 0 && i % 5 === 0)) {
          ctx.fillStyle = palette.accent;
          ctx.globalAlpha = Math.min(1, alpha + 0.15);
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (pt.isVerified) {
          ctx.fillStyle = palette.verified;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = inProbe
            ? palette.titanium
            : `rgba(${palette.ink}, ${(alpha * 0.72).toFixed(3)})`;
          ctx.globalAlpha = inProbe ? 1 : 1;
          ctx.beginPath();
          ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // 3. Traveling live clinical signal packets
      if (!prefersReduced) {
        for (const p of pulses) {
          p.pos = (p.pos + p.speed * (haltBlend > 0.5 ? 0.25 : 1)) % (COUNT - 2);
          const idx = Math.floor(p.pos);
          const frac = p.pos - idx;
          const a = projected[idx];
          const b = projected[idx + 2];
          if (!a || !b) continue;
          const px = lerp(a.sx, b.sx, frac);
          const py = lerp(a.sy, b.sy, frac);
          const pr = Math.max(1.8, 3.2 * Math.min(1.6, a.scale));
          ctx.fillStyle = p.critical ? palette.accent : palette.verified;
          ctx.fillRect(px - pr * 0.5, py - pr * 0.5, pr, pr);
        }
      }

      // 4. Center Halt Fault Banner (only visible when user triggers Simulate DDI Halt)
      if (haltBlend > 0.45 && scrollP < 0.25) {
        ctx.save();
        ctx.globalAlpha = (haltBlend - 0.45) / 0.55;
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx - 210 * scaleW, cy);
        ctx.lineTo(cx + 210 * scaleW, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        const bw = 270;
        const bh = 38;
        ctx.fillStyle = palette.accent;
        ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);

        ctx.fillStyle = '#ffffff';
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('INTERCEPTED // WARFARIN × ASPIRIN', cx, cy - 2);
        ctx.font = '400 8.5px "IBM Plex Mono", monospace';
        ctx.fillText('SEVERITY: HIGH · GENERATION HALTED', cx, cy + 12);
        ctx.restore();
      }

      // 5. Interactive Cursor Probe Reticle + Live Triangulation Chords
      if (pointer.active && scrollP < 0.3 && width >= 900) {
        nearCursor.sort((a, b) => a.distToCursor - b.distToCursor);
        const locked = nearCursor.slice(0, 6);

        ctx.save();
        // Precision crosshair reticle ring
        ctx.strokeStyle = haltBlend > 0.5 ? palette.accent : palette.titanium;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 44, 0, Math.PI * 2);
        ctx.stroke();

        // Triangulation chords from cursor to nearest live 3D nodes
        locked.forEach((pt, idx) => {
          ctx.strokeStyle =
            pt.isCritical || haltBlend > 0.5
              ? palette.accent
              : pt.isVerified
                ? palette.verified
                : palette.titanium;
          ctx.globalAlpha = Math.max(0.18, 0.72 - idx * 0.1);
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(pt.sx, pt.sy);
          ctx.stroke();
        });

        // Live Entity HUD readout anchored to closest locked node
        const closest = locked[0];
        if (closest) {
          const rx = Math.min(width - 178, pointer.x + 56);
          const ry = Math.max(24, Math.min(height - 54, pointer.y - 18));
          const borderCol =
            closest.tag.kind === 'critical'
              ? palette.accent
              : closest.tag.kind === 'verified'
                ? palette.verified
                : palette.titanium;

          ctx.globalAlpha = 0.96;
          ctx.fillStyle = palette.tagBg;
          ctx.fillRect(rx, ry, 154, 34);
          ctx.strokeStyle = borderCol;
          ctx.lineWidth = 1;
          ctx.strokeRect(rx, ry, 154, 34);

          ctx.fillStyle = palette.tagInk;
          ctx.font = '600 9.5px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(closest.tag.label, rx + 9, ry + 14);

          ctx.fillStyle = borderCol;
          ctx.font = '400 8.5px "IBM Plex Mono", monospace';
          ctx.fillText(closest.tag.code, rx + 9, ry + 26);
        }
        ctx.restore();
      }
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
    if (prefersReduced) {
      drawFrame();
    } else {
      rafId = requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [progressRef]);

  return <canvas ref={canvasRef} className="mgx-field-canvas" aria-hidden="true" />;
}
