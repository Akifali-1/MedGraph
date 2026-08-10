/**
 * BrainNetwork
 *
 * Hero figure: the brain-shaped node network, resting on a luminous platform.
 *
 * The brain is supplied artwork on a black field rather than an alpha channel,
 * so mix-blend-mode: screen drops the black - screen maps black to transparent
 * and preserves the bright cyan/violet network exactly, without the halo
 * fringing that pre-keying the PNG introduced.
 *
 * What remains here is the surrounding treatment: the platform it sits on, its
 * reflection, and a slow float so the figure reads as suspended rather than
 * pasted down. All motion is CSS (see cinematic.css) and transform/opacity
 * only, so there is no main-thread cost once settled and nothing to pause on
 * scroll.
 */

import brainSrc from '/brain-hero.png';

export default function BrainNetwork() {
  return (
    <div className="hero-figure" aria-hidden="true">
      <img className="hero-brain-img" src={brainSrc} alt="" draggable="false" />

      {/* Platform. Kept in normal flow after the artwork and pulled up with a
          negative margin, rather than absolutely positioned - the absolute
          version resolved against the wrong box and floated above the brain. */}
      <svg className="hero-plate-svg" viewBox="0 0 240 60" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="hf-plate" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#c9d9f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#c9d9f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="hero-plate" cx="120" cy="30" rx="82" ry="17" fill="url(#hf-plate)" />
        <ellipse className="hero-plate-ring" cx="120" cy="30" rx="62" ry="12" />
        <ellipse className="hero-plate-ring hero-plate-ring-2" cx="120" cy="30" rx="42" ry="8" />
      </svg>
    </div>
  );
}
