import { useEffect, useRef, useState } from 'react';

export default function ClinicalCursor() {
  const cursorRef = useRef(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let mx = -120;
    let my = -120;
    let cx = -120;
    let cy = -120;
    let rafId = 0;

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      const target = e.target?.closest?.('[data-cursor]');
      setLabel(target ? target.getAttribute('data-cursor') || '' : '');
    };

    const tick = () => {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafId = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="mg-cursor"
      data-mode={label ? 'label' : 'dot'}
      aria-hidden="true"
    >
      <div className="mg-cursor-dot">
        {label ? <span className="mg-cursor-text">{label}</span> : null}
      </div>
    </div>
  );
}
