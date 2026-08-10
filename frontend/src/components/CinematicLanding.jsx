import { useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import ParticleStream from './ParticleStream.jsx';
import BrainNetwork from './BrainNetwork.jsx';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Cinematic landing.
 *
 * One continuous scroll journey rather than a stack of sections. A single
 * signal path — the spine — is fixed to the viewport and morphs its geometry
 * as each stage takes over, so the reader sees one line travelling with them
 * instead of separate graphics scrolling past. At the end it converges into
 * the report, which is the actual output of the system.
 *
 * Four stages were chosen over the six pipeline steps because the pipeline
 * detail belongs in How It Works. These are the four things that make the
 * project defensible: structured retrieval, hybrid evidence, citation
 * verification, and graceful degradation.
 *
 * Motion notes:
 *  - Everything scroll-driven lives inside gsap.matchMedia() keyed on
 *    prefers-reduced-motion, and cine.css carries finished-state fallbacks,
 *    so no content depends on JS or on motion being allowed.
 *  - The spine morph animates the `d` attribute directly. Every path in
 *    SPINES has the same command structure and point count, which is what
 *    makes a plain attribute tween interpolate cleanly without MorphSVG.
 */

const STAGE_COLOR = {
  intake: 'var(--c-intake)',
  graph: 'var(--c-graph)',
  evidence: 'var(--c-evidence)',
  verify: 'var(--c-verify)',
};

const STAGES = [
  {
    key: 'intake',
    side: 'left',
    index: '01 — Structure',
    title: (
      <>
        Retrieval over a <em>graph</em>, not a pile of text
      </>
    ),
    body: 'Drug and symptom relationships live in Neo4j as typed edges seeded from NIH RxNav, with severity stored on the edge itself. A dangerous combination is a single hop, not a similarity score that happened to rank well. The traversal is deterministic and it is auditable — you can read the Cypher that produced the finding.',
    readout: [
      ['Store', 'Neo4j · Cypher'],
      ['Seeded from', 'NIH RxNav'],
      ['Edge property', 'severity'],
    ],
  },
  {
    key: 'graph',
    side: 'right',
    index: '02 — Evidence',
    title: (
      <>
        Two retrievers, <em>reconciled</em>
      </>
    ),
    body: 'Sparse BM25 catches the exact drug name and the specific ICD code. Dense vector search catches the clinical paraphrase that shares no keywords at all. Both run over AHA/ACC guidelines and PubMed abstracts, and the two ranked lists are merged by reciprocal rank fusion before anything reaches the model.',
    readout: [
      ['Sparse', 'BM25'],
      ['Dense', 'Pinecone · FAISS'],
      ['Merge', 'RRF + rerank'],
    ],
  },
  {
    key: 'evidence',
    side: 'left',
    index: '03 — Verification',
    title: (
      <>
        Every citation <em>checked</em> against what was retrieved
      </>
    ),
    body: 'After generation, each reference the model emits is matched against the passages actually pulled for that request. Anything unsupported is stripped and the response carries a warning flag. A model that cites nothing can be doubted; a model that cites something it invented cannot, and that is the failure mode worth engineering against.',
    readout: [
      ['Checked', 'post-generation'],
      ['Unsupported', 'stripped + flagged'],
      ['Coverage', '100%'],
    ],
  },
  {
    key: 'verify',
    side: 'right',
    index: '04 — Resilience',
    title: (
      <>
        Every dependency <em>degrades</em> instead of failing
      </>
    ),
    body: 'Neo4j falls back to an in-memory graph. Pinecone falls back to local FAISS, then to BM25 alone. The reasoning layer walks from the fine-tuned SageMaker endpoint to Gemini to a deterministic simulator. Each response reports which fallbacks were active, so a degraded answer is never mistaken for a full one.',
    readout: [
      ['Graph', 'Neo4j → memory'],
      ['Vectors', 'Pinecone → FAISS → BM25'],
      ['Reasoning', 'SageMaker → Gemini → sim'],
    ],
  },
];

const REPORT = [
  { name: 'Medication interaction hazard', src: 'RxNav · AHA/ACC antithrombotic', score: '1.00' },
  { name: 'STEMI', src: 'AHA/ACC 2021 · guideline 1, 3', score: '0.87' },
  { name: 'Unstable angina', src: 'AHA/ACC 2021 · guideline 1, 4', score: '0.71' },
];

const WORD = 'MedGraph';

export default function CinematicLanding({ isLoggedIn, onEnterWorkspace, onLogin, onRegister, onHowItWorks }) {
  const root = useRef(null);

  /* Where the stream should sit at a given scroll fraction, as a 0-1 share of
     viewport width. The stream swings to whichever side the text is not on,
     so the ribbon and the copy never fight for the same space. Stable
     identity via useCallback so the canvas effect does not re-seed. */
  const sideForY = useCallback((t) => {
    /* Hero occupies roughly the first viewport, convergence the last. */
    const first = 0.14;
    const last = 0.86;
    if (t <= first) return 0.5;
    if (t >= last) return 0.5;

    const span = (t - first) / (last - first);
    const n = STAGES.length;
    const idx = Math.min(n - 1, Math.floor(span * n));
    const within = span * n - idx;

    /* Stage bodies alternate left/right; the stream takes the opposite side. */
    const target = (i) => (STAGES[i].side === 'left' ? 0.74 : 0.26);
    const cur = target(idx);
    const nxt = target(Math.min(n - 1, idx + 1));

    /* Ease across the second half of each stage so the crossing feels like a
       single continuous sweep rather than a jump at the boundary. */
    if (within < 0.55) return cur;
    const k = (within - 0.55) / 0.45;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    return cur + (nxt - cur) * e;
  }, []);

  /* Motes get stable randomised parameters. Generated once so a re-render
     never reshuffles them mid-drift. */
  const motes = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        left: `${(i * 6.4 + ((i * 37) % 11)) % 100}%`,
        delay: `${-(i * 1.7) % 26}s`,
        duration: `${24 + ((i * 5) % 16)}s`,
        scale: 0.6 + ((i * 13) % 10) / 10,
      })),
    [],
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        /* --- Reading progress --- */
        gsap.to('.cine-progress', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.25 },
        });

        /* --- Paper deepens as the reader descends --- */
        /* Scrubbed against total scroll, so the tone always matches position
           regardless of how fast the reader moves. */
        gsap.to(document.body, {
          '--tint': 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.6 },
        });

        /* --- Opening: letters rise, then the tagline unmasks --- */
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .fromTo('.cine-letter', 
            { yPercent: 118, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.055 }
          )
          .fromTo('.cine-tagline span',
            { yPercent: 105, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.9 },
            '-=0.5'
          )
          .fromTo('.cine-kicker',
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.8 },
            '-=0.6'
          )
          .fromTo('.cine-hint',
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.8 },
            '-=0.5'
          )
          .fromTo('.cine-open-figure',
            { opacity: 0, scale: 0.94 },
            { opacity: 1, scale: 1, duration: 1.2 },
            0.15
          )
          .fromTo('.cine-badge',
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.7 },
            '-=0.4'
          );

        /* Slow gradient sweep across the wordmark, independent of scroll. */
        gsap.to('.cine-letter', {
          backgroundPosition: '340% 50%',
          duration: 18,
          ease: 'none',
          repeat: -1,
          yoyo: true,
        });

        /* Opening lifts and fades as the reader leaves it. */
        gsap.to('.cine-open', {
          yPercent: -14,
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: '.cine-open',
            start: 'bottom bottom',
            end: 'bottom top',
            scrub: 0.4,
          },
        });

        /* Navbar: transparent over the hero, frosted surface once the reader
           scrolls past. Class is toggled at the midpoint of the hero exit. */
        ScrollTrigger.create({
          trigger: '.cine-open',
          start: 'bottom 92%',
          onEnter: () => document.querySelector('.navbar')?.classList.add('is-docked'),
          onLeaveBack: () => document.querySelector('.navbar')?.classList.remove('is-docked'),
        });

        /* --- Stages: copy rises, readout facts stagger in ---
           Scrubbed rather than time-based. Progress is tied to scroll
           position, so a fast reader sees the whole reveal compressed instead
           of arriving after it has already played. `scrub: 1` adds a short
           catch-up so the motion still feels eased rather than glued to the
           wheel. Anchored on the section's own travel through the viewport,
           which keeps the timing proportional on any screen height. */
        STAGES.forEach((s) => {
          const scope = `#stage-${s.key}`;
          gsap
            .timeline({
              scrollTrigger: {
                trigger: scope,
                start: 'top 88%',
                end: 'top 38%',
                scrub: 1,
              },
              defaults: { ease: 'power2.out' },
            })
            .from(`${scope} .cine-index`, { opacity: 0, x: -14, duration: 0.6 })
            .from(`${scope} h2`, { opacity: 0, y: 30, duration: 0.9 }, '-=0.35')
            .from(`${scope} p`, { opacity: 0, y: 22, duration: 0.8 }, '-=0.6')
            .from(
              `${scope} .cine-readout div`,
              { opacity: 0, y: 16, duration: 0.55, stagger: 0.12 },
              '-=0.5',
            );

          /* Gentle parallax drift so the block is never static while in view. */
          gsap.fromTo(
            `${scope} .cine-stage-body`,
            { y: 30 },
            {
              y: -30,
              ease: 'none',
              scrollTrigger: { trigger: scope, start: 'top bottom', end: 'bottom top', scrub: 0.8 },
            },
          );
        });

        /* --- Report assembles --- */
        gsap
          .timeline({
            scrollTrigger: {
              trigger: '.cine-converge',
              start: 'top 82%',
              end: 'top 30%',
              scrub: 1,
            },
            defaults: { ease: 'power2.out' },
          })
          .from('.cine-converge-lead', { opacity: 0, duration: 0.7 })
          .from('.cine-report', { opacity: 0, y: 46, scale: 0.97, duration: 1 }, '-=0.4')
          .from('.cine-report-row', { opacity: 0, x: -18, duration: 0.5, stagger: 0.14 }, '-=0.5')
          .from('.cine-report-flag', { opacity: 0, duration: 0.5 }, '-=0.15')
          .from('.cine-actions', { opacity: 0, y: 18, duration: 0.7 }, '-=0.2');
      });

      /* The docked class lives on .navbar, which is outside this component's
         scope, so it has to be cleared by hand on unmount. */
      return () => {
        document.querySelector('.navbar')?.classList.remove('is-docked');
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <main className="cine" ref={root}>
      <div className="cine-progress" />

      {/* ---------- Ambient ---------- */}
      <div className="cine-ambient" aria-hidden="true">
        <div className="cine-blob cine-blob-1" />
        <div className="cine-blob cine-blob-2" />
        <div className="cine-blob cine-blob-3" />
      </div>
      <div className="cine-grain" aria-hidden="true" />
      <div className="cine-motes" aria-hidden="true">
        {motes.map((m, i) => (
          <span
            key={i}
            className="cine-mote"
            style={{
              left: m.left,
              bottom: 0,
              animationDelay: m.delay,
              animationDuration: m.duration,
              transform: `scale(${m.scale})`,
            }}
          />
        ))}
      </div>

      {/* ---------- Stream ---------- */}
      {/* The braided particle ribbon. Lives behind everything, spans the whole
          document, and carries the reader from the hero to the final node. */}
      <ParticleStream sideForY={sideForY} />

      {/* ---------- Opening ---------- */}
      <section className="cine-open">
        <div className="cine-open-copy">
          <h1 className="cine-wordmark" aria-label={WORD}>
            {WORD.split('').map((ch, i) => (
              <span className="cine-letter" key={i} aria-hidden="true">
                {ch}
              </span>
            ))}
          </h1>

          <div className="cine-tagline">
            <span>Clinical AI Assistant</span>
          </div>

          <p className="cine-kicker">
            Graph-powered clinical intelligence that connects evidence to decisions.
          </p>

          <button className="cine-hint" onClick={onHowItWorks}>
            Explore how it works
            <span className="cine-hint-rail" />
          </button>
        </div>

        <div className="cine-open-figure">
          <BrainNetwork />
          <span className="cine-badge">
            <Sparkles size={13} />
            Clinical AI Assistant
          </span>
        </div>
      </section>

      {/* ---------- Stages ---------- */}
      {STAGES.map((s) => (
        <section
          key={s.key}
          id={`stage-${s.key}`}
          className={`cine-stage cine-stage-${s.side}`}
        >
          <div className="cine-stage-body">
            <span className="cine-index" style={{ color: STAGE_COLOR[s.key] }}>
              {s.index}
            </span>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
            <dl className="cine-readout">
              {s.readout.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ))}

      {/* ---------- Convergence ---------- */}
      <section className="cine-converge">
        <p className="cine-converge-lead">Everything above resolves into one artifact</p>

        <div className="cine-report">
          <div className="cine-report-head">
            <h3>Ranked differential</h3>
            <span className="cine-report-id">Case 0417 · 1.4s</span>
          </div>

          {REPORT.map((r) => (
            <div className="cine-report-row" key={r.name}>
              <span className="cine-report-name">
                {r.name}
                <span className="cine-report-src">{r.src}</span>
              </span>
              <span className="cine-report-score">{r.score}</span>
            </div>
          ))}

          <div className="cine-report-flag">Reasoning halted · critical interaction</div>

          <div className="cine-report-foot">
            <span>3 citations · 3 verified</span>
            <span>No fallbacks active</span>
          </div>
        </div>

        <div className="cine-actions">
          {isLoggedIn ? (
            <button className="cine-cta" onClick={onEnterWorkspace}>
              Enter the console <ArrowRight size={17} />
            </button>
          ) : (
            <button className="cine-cta" onClick={onLogin}>
              Enter the console <ArrowRight size={17} />
            </button>
          )}
          <button className="cine-link" onClick={onHowItWorks}>
            See how it works
          </button>
          {!isLoggedIn && (
            <button className="cine-link" onClick={onRegister}>
              Create an account
            </button>
          )}
        </div>

        <p className="cine-fineprint">
          Research prototype · Not a certified medical device
        </p>
      </section>
    </main>
  );
}
