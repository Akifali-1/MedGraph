import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import gsap from 'gsap';

const PageCurtain = forwardRef(function PageCurtain(_, ref) {
  const colsRef = useRef([]);
  const labelRef = useRef(null);
  const [label, setLabel] = useState('');

  useImperativeHandle(ref, () => ({
    transition(nextLabel, onMidpoint) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        if (typeof onMidpoint === 'function') onMidpoint();
        return;
      }

      setLabel((nextLabel || 'LOADING').toUpperCase());
      const cols = colsRef.current.filter(Boolean);
      const tl = gsap.timeline();

      tl.set(cols, { transformOrigin: 'bottom', scaleY: 0 })
        .to(cols, {
          scaleY: 1,
          duration: 0.48,
          stagger: 0.04,
          ease: 'expo.inOut',
        })
        .to(labelRef.current, { opacity: 1, duration: 0.16 }, '-=0.16')
        .add(() => {
          if (typeof onMidpoint === 'function') onMidpoint();
          window.scrollTo({ top: 0, behavior: 'instant' });
        })
        .to(labelRef.current, { opacity: 0, duration: 0.16 }, '+=0.08')
        .set(cols, { transformOrigin: 'top' })
        .to(cols, {
          scaleY: 0,
          duration: 0.54,
          stagger: 0.04,
          ease: 'expo.inOut',
        });
    },
  }));

  return (
    <>
      <div className="mg-curtain" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="mg-curtain-col"
            ref={(el) => {
              colsRef.current[i] = el;
            }}
          />
        ))}
      </div>
      <div className="mg-curtain-label" ref={labelRef} aria-hidden="true">
        [ {label} ]
      </div>
    </>
  );
});

export default PageCurtain;
