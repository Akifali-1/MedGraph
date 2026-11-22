import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScrollProvider({ children, routeKey }) {
  const fillRef = useRef(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.35,
    });

    lenis.on('scroll', (e) => {
      ScrollTrigger.update();
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleY(${e.progress || 0})`;
      }
    });

    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    lenis.scrollTo(0, { immediate: true });
    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refreshId);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [routeKey]);

  return (
    <div className="mg-public-shell">
      <div className="mg-progress-rail" aria-hidden="true">
        <div className="mg-progress-fill" ref={fillRef} />
      </div>
      {children}
    </div>
  );
}
