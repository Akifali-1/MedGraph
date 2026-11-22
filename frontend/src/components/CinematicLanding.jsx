import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, ArrowUpRight, MoveHorizontal } from 'lucide-react';
import HeroTelemetryCanvas from './HeroTelemetryCanvas';
import evaluation from '../data/latest_eval_summary.json';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const HERO_CASES = [
  {
    id: 'ddi',
    tab: '01 // DRUG CONFLICT HALT',
    tag: 'CASE 0417 · EARLY-EXIT INTERCEPT',
    tone: 'critical',
    bpm: '114 BPM · ALERT',
    xrayTag: 'INTERCEPT_LOCKED // RX-11289 × RX-1191',
    nodes: [
      { step: '01 / INTAKE', ms: '014ms', title: 'Warfarin + Aspirin', meta: '65M · Chest pain · AFib' },
      { step: '02 / NEO4J GRAPH', ms: '048ms', title: '1-Hop DDI Edge', meta: 'RX-11289 ↔ RX-1191 · HIGH' },
      { step: '03 / SAFETY GATE', ms: '061ms', title: 'Generation Halted', meta: 'route_after_graph: alert_early' },
      { step: '04 / SOURCE LOCK', ms: '112ms', title: 'AHA/ACC §10', meta: 'Major bleed risk · Chunk verified' },
    ],
    verdict: 'CRITICAL INTERACTION INTERCEPTED BEFORE LLM SYNTHESIS',
  },
  {
    id: 'stemi',
    tab: '02 // DIFFERENTIAL GROUNDING',
    tag: 'CASE 0417 · HYBRID RAG PATH',
    tone: 'verified',
    bpm: '98 BPM · ST-ELEV',
    xrayTag: 'ONTOLOGY_BOUND // UMLS-C0008031 -> ICD-I21.3',
    nodes: [
      { step: '01 / INTAKE', ms: '012ms', title: 'Chest Pressure', meta: 'Colloquial prose + sweating' },
      { step: '02 / ONTOLOGY', ms: '039ms', title: 'Chest Pain + Diaphoresis', meta: 'UMLS-C0008031 · C0700590' },
      { step: '03 / HYBRID RAG', ms: '184ms', title: 'Dense + BM25 RRF', meta: 'AHA/ACC 2021 §4.1 matched' },
      { step: '04 / DIFFERENTIAL', ms: '420ms', title: 'Acute STEMI · 0.87', meta: '12-lead ECG within 10 min' },
    ],
    verdict: 'EVERY RANKED FINDING BOUND TO RETRIEVED GUIDELINE CHUNKS',
  },
  {
    id: 'boundary',
    tab: '03 // NO-EVIDENCE BOUNDARY',
    tag: 'SAFETY CONTROL · ZERO GUESSING',
    tone: 'titanium',
    bpm: '72 BPM · CONTROL',
    xrayTag: 'RETRIEVAL_GATE // THRESHOLD_UNMET -> NO_EVIDENCE',
    nodes: [
      { step: '01 / INTAKE', ms: '011ms', title: 'Unindexed Query', meta: 'Schema valid · No matching guide' },
      { step: '02 / RETRIEVAL', ms: '146ms', title: '0 Chunks Passed', meta: 'Threshold gate rejected noise' },
      { step: '03 / GUARDRAIL', ms: '152ms', title: 'status: no_evidence', meta: 'diagnoses: [] · Never invented' },
      { step: '04 / TRANSPARENCY', ms: '158ms', title: 'Exact Boundary Shown', meta: 'Graph alerts still returned' },
    ],
    verdict: 'WHEN EVIDENCE IS MISSING, MEDGRAPH REFUSES TO FABRICATE',
  },
];

const DISSECT_STAGES = [
  {
    num: '01',
    code: 'STAGE 01 // CANONICAL INTAKE',
    title: 'Everyday prose becomes exact ontology.',
    summary:
      'Patients describe "chest pressure" and "sweating". Before any retrieval or graph lookup runs, MedGraph validates schema bounds and links colloquial terms to canonical clinical entities.',
    artifactLabel: 'ENTITY LINKER TRACE',
    artifactLines: [
      '"chest pressure"  ->  chest pain [UMLS-C0008031]',
      '"sweating"        ->  diaphoresis [UMLS-C0700590]',
      '"Warfarin 5mg"    ->  Warfarin [RX-11289]',
      '"Aspirin 81mg"    ->  Aspirin [RX-1191]',
    ],
    badge: 'SCHEMA VALIDATED',
  },
  {
    num: '02',
    code: 'STAGE 02 // GRAPH SAFETY INTERCEPT',
    title: 'Known drug conflicts halt generation first.',
    summary:
      'Structured Neo4j lookups execute before the language model speaks. When Warfarin and Aspirin appear together, the graph flags a high-severity bleeding interaction and triggers an early-exit safety intercept.',
    artifactLabel: 'NEO4J CYPHER INTERCEPT',
    artifactLines: [
      'MATCH (a:Drug)-[r:INTERACTS_WITH]->(b:Drug)',
      'WHERE a.name IN ["Warfarin", "Aspirin"]',
      '-> EDGE FOUND // SEVERITY: HIGH',
      '-> ACTION: ROUTE_AFTER_GRAPH = ALERT_EARLY',
    ],
    badge: 'CRITICAL HALT',
    isCritical: true,
  },
  {
    num: '03',
    code: 'STAGE 03 // HYBRID RETRIEVAL BOUNDARY',
    title: 'No indexed guideline? No invented diagnosis.',
    summary:
      'Dense vector search and BM25 lexical matching retrieve indexed guideline chunks in tandem. If nothing clears the retrieval boundary, MedGraph explicitly returns no_evidence instead of guessing.',
    artifactLabel: 'RETRIEVAL GATE',
    artifactLines: [
      'DENSE + BM25 RRF  ->  AHA/ACC Chest Pain 2021',
      'DENSE + BM25 RRF  ->  AHA/ACC Antithrombotic §10',
      'BOUNDARY CHECK    ->  PASSED (CHUNK IDS LOCKED)',
      'FALLBACK POLICY   ->  EMPTY = status: "no_evidence"',
    ],
    badge: 'EVIDENCE GATED',
  },
  {
    num: '04',
    code: 'STAGE 04 // DETERMINISTIC CITATIONS',
    title: 'Every finding carries its exact source path.',
    summary:
      'Returned sources stay attached with their title, source type, chunk ID, excerpt, and external URL. Unavailable services or provisional metrics stay visible—never masked behind confident prose.',
    artifactLabel: 'CITATION RESOLUTION',
    artifactLines: [
      'DX #1  Medication Interaction Hazard   [1.00]',
      'DX #2  Acute STEMI                     [0.87]',
      'CITE   AHA/ACC §10  ->  CHUNK VERIFIED',
      'GRAPH  Unavailable  ->  MARKED EXPLICITLY',
    ],
    badge: 'TRACEABLE OUTPUT',
    isVerified: true,
  },
];

function StageSchematic({ activeStage, onSelectStage }) {
  const current = DISSECT_STAGES[activeStage] || DISSECT_STAGES[0];
  const hudStatus =
    activeStage === 1
      ? { label: 'INTERCEPT ACTIVE', cls: 'is-alert' }
      : activeStage === 3
        ? { label: 'CITATIONS LOCKED', cls: 'is-verified' }
        : { label: 'DAG PIPELINE', cls: 'is-titanium' };

  return (
    <div className="mgx-schematic-frame" data-stage={activeStage}>
      <div className="mgx-schematic-hud">
        <span>INSTRUMENT // VIEWPORT_0{activeStage + 1}</span>
        <span className={hudStatus.cls}>
          <i className="mgx-hud-dot" />
          {hudStatus.label}
        </span>
      </div>

      <div className="mgx-schematic-viewport">
        {/* 4 Architectural Corner Registration Brackets */}
        <span className="mgx-bracket is-tl" aria-hidden="true" />
        <span className="mgx-bracket is-tr" aria-hidden="true" />
        <span className="mgx-bracket is-bl" aria-hidden="true" />
        <span className="mgx-bracket is-br" aria-hidden="true" />

        {/* VIEWPORT 01: CANONICAL INTAKE */}
        {activeStage === 0 && (
          <div className="mgx-vp mgx-vp-01" key="vp-01">
            <div className="mgx-vp01-headers">
              <span>WHAT THE PATIENT SAID</span>
              <span>CANONICAL ENTITY</span>
            </div>

            <div className="mgx-vp01-body">
              <div className="mgx-vp01-col">
                <div className="mgx-vp01-raw">&ldquo;chest pressure&rdquo;</div>
                <div className="mgx-vp01-raw">&ldquo;sweating&rdquo;</div>
                <div className="mgx-vp01-raw">&ldquo;Warfarin 5mg&rdquo;</div>
                <div className="mgx-vp01-raw">&ldquo;Aspirin 81mg&rdquo;</div>
              </div>

              <svg className="mgx-vp01-wires" viewBox="0 0 180 240" preserveAspectRatio="none" aria-hidden="true">
                {/* Left inputs converging to center ontology node */}
                <path d="M 0 26 H 26 V 120 H 46" className="mgx-vp-wire" />
                <path d="M 0 88 H 26 V 120" className="mgx-vp-wire" />
                <path d="M 0 152 H 26 V 120" className="mgx-vp-wire" />
                <path d="M 0 214 H 26 V 120" className="mgx-vp-wire" />

                {/* Center ontology node fanning out to canonical entities */}
                <path d="M 134 120 H 154 V 26 H 176" className="mgx-vp-wire is-gold" />
                <path d="M 154 120 V 88 H 176" className="mgx-vp-wire is-gold" />
                <path d="M 154 120 V 152 H 176" className="mgx-vp-wire is-gold" />
                <path d="M 154 120 V 214 H 176" className="mgx-vp-wire is-gold" />

                {/* Arrowheads */}
                <polygon points="179,26 173,23 173,29" className="mgx-vp-arrow-gold" />
                <polygon points="179,88 173,85 173,91" className="mgx-vp-arrow-gold" />
                <polygon points="179,152 173,149 173,155" className="mgx-vp-arrow-gold" />
                <polygon points="179,214 173,211 173,217" className="mgx-vp-arrow-gold" />
              </svg>

              <div className="mgx-vp01-core">
                <div className="mgx-vp01-core-inner">
                  <strong>ONTOLOGY</strong>
                  <span>4 MATCHED</span>
                </div>
              </div>

              <div className="mgx-vp01-col">
                <div className="mgx-vp01-canon">
                  <strong>Chest pain</strong>
                  <small>UMLS-C0008031</small>
                </div>
                <div className="mgx-vp01-canon">
                  <strong>Diaphoresis</strong>
                  <small>UMLS-C0700590</small>
                </div>
                <div className="mgx-vp01-canon">
                  <strong>Warfarin</strong>
                  <small>RX-11289</small>
                </div>
                <div className="mgx-vp01-canon">
                  <strong>Aspirin</strong>
                  <small>RX-1191</small>
                </div>
              </div>
            </div>

            <div className="mgx-vp-caption">FREE TEXT IN → SCHEMA-BOUNDED ENTITIES OUT</div>
          </div>
        )}

        {/* VIEWPORT 02: GRAPH SAFETY INTERCEPT */}
        {activeStage === 1 && (
          <div className="mgx-vp mgx-vp-02" key="vp-02">
            <div className="mgx-vp02-top-label">INTERACTS_WITH · HIGH</div>

            <div className="mgx-vp02-row">
              <div className="mgx-vp02-drug">
                <strong>Warfarin</strong>
                <small>RX-11289</small>
              </div>

              <span className="mgx-vp02-dash" aria-hidden="true" />

              <div className="mgx-vp02-halt">
                <strong>EARLY-EXIT HALT</strong>
                <small>BLEED RISK: HIGH</small>
              </div>

              <span className="mgx-vp02-dash" aria-hidden="true" />

              <div className="mgx-vp02-drug">
                <strong>Aspirin</strong>
                <small>RX-1191</small>
              </div>
            </div>

            <div className="mgx-vp02-arrow is-alert" aria-hidden="true" />

            <div className="mgx-vp02-stopped">
              <small>LLM SYNTHESIS · NOT RUN</small>
              <strong>Generation halted</strong>
            </div>

            <div className="mgx-vp02-route">route_after_graph = alert_early</div>

            <div className="mgx-vp02-arrow" aria-hidden="true" />

            <div className="mgx-vp02-alert">
              <strong>Clinician alert</strong>
              <small>interaction + cited source</small>
            </div>
          </div>
        )}

        {/* VIEWPORT 03: HYBRID RETRIEVAL BOUNDARY */}
        {activeStage === 2 && (
          <div className="mgx-vp mgx-vp-03" key="vp-03">
            <div className="mgx-vp03-grid">
              {/* Left Column: Ranked Candidates + Drops */}
              <div className="mgx-vp03-col">
                <div className="mgx-vp03-heading">RETRIEVED CANDIDATES · RANKED</div>
                <div className="mgx-vp03-chunk is-pass">CHUNK_01</div>
                <div className="mgx-vp03-chunk is-pass">CHUNK_02</div>

                <div className="mgx-vp03-boundary">
                  <span>RETRIEVAL BOUNDARY</span>
                </div>

                <div className="mgx-vp03-chunk is-drop">DROP_03</div>
                <div className="mgx-vp03-chunk is-drop">DROP_04</div>
                <div className="mgx-vp03-chunk is-drop">DROP_05</div>
              </div>

              {/* Center Column: RRF Gate + Connector Lines */}
              <div className="mgx-vp03-mid">
                <svg className="mgx-vp03-wires" viewBox="0 0 150 96" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M 0 18 H 20 V 48 H 34" className="mgx-vp-wire is-ok" />
                  <path d="M 0 64 H 20 V 48" className="mgx-vp-wire is-ok" />
                  <path d="M 116 48 H 130 V 18 H 146" className="mgx-vp-wire is-ok" />
                  <path d="M 130 48 V 64 H 146" className="mgx-vp-wire is-ok" />
                  <polygon points="149,18 143,15 143,21" className="mgx-vp-arrow-ok" />
                  <polygon points="149,64 143,61 143,67" className="mgx-vp-arrow-ok" />
                </svg>

                <div className="mgx-vp03-gate">
                  <strong>RRF GATE</strong>
                  <small>DENSE + BM25</small>
                </div>
              </div>

              {/* Right Column: Locked Sources + Drop Counter */}
              <div className="mgx-vp03-col">
                <div className="mgx-vp03-heading">LOCKED SOURCES</div>
                <div className="mgx-vp03-chunk is-pass is-strong">AHA/ACC §10</div>
                <div className="mgx-vp03-chunk is-pass is-strong">AHA 2021 §4.1</div>

                <div className="mgx-vp03-locked-label">CHUNK IDS LOCKED</div>

                <div className="mgx-vp03-dropped-box">
                  <strong>3</strong>
                  <p>chunks fell below the boundary and were dropped</p>
                </div>
              </div>
            </div>

            <div className="mgx-vp03-policy">
              <small>FALLBACK POLICY</small>
              <p>
                If nothing clears the boundary, MedGraph returns <code>status: no_evidence</code> instead of guessing.
              </p>
            </div>
          </div>
        )}

        {/* VIEWPORT 04: RANKED AND CITED OUTPUT */}
        {activeStage === 3 && (
          <div className="mgx-vp mgx-vp-04" key="vp-04">
            <div className="mgx-vp03-heading">RANKED CANDIDATES · SOURCE LOCKED</div>

            <div className="mgx-vp04-list">
              <div className="mgx-vp04-card is-alert">
                <span className="mgx-vp04-rank">01</span>
                <div className="mgx-vp04-main">
                  <strong>Medication interaction hazard</strong>
                  <div className="mgx-vp04-bar">
                    <i style={{ width: '100%' }} />
                  </div>
                  <small>CONFIDENCE 1.00</small>
                </div>
                <span className="mgx-vp04-badge">INTERCEPTED</span>
              </div>

              <div className="mgx-vp04-card is-verified">
                <span className="mgx-vp04-rank">02</span>
                <div className="mgx-vp04-main">
                  <strong>Acute STEMI</strong>
                  <div className="mgx-vp04-bar">
                    <i style={{ width: '87%' }} />
                  </div>
                  <small>CONFIDENCE 0.87</small>
                </div>
                <span className="mgx-vp04-badge">AHA/ACC 2021 · LOCKED</span>
              </div>

              <div className="mgx-vp04-card is-lower">
                <span className="mgx-vp04-rank">03</span>
                <div className="mgx-vp04-main">
                  <strong>Unstable angina</strong>
                  <div className="mgx-vp04-bar">
                    <i style={{ width: '71%' }} />
                  </div>
                  <small>CONFIDENCE 0.71</small>
                </div>
                <span className="mgx-vp04-badge">AHA/ACC 2021 · LOCKED</span>
              </div>
            </div>

            <div className="mgx-vp04-legend">
              <span><i className="is-alert" /> INTERCEPTED FIRST</span>
              <span><i className="is-verified" /> TOP SUPPORTED</span>
              <span><i className="is-lower" /> LOWER RANK</span>
            </div>

            <p className="mgx-vp04-note">
              Candidates are ranked by confidence, and each one carries the guideline chunk that supports it.
            </p>
          </div>
        )}
      </div>

      <div className="mgx-schematic-footer">
        <div className="mgx-stage-pills" role="tablist" aria-label="Pipeline stage jump">
          {DISSECT_STAGES.map((st, idx) => (
            <button
              key={st.num}
              type="button"
              role="tab"
              aria-selected={activeStage === idx}
              className={`mgx-stage-pill ${activeStage === idx ? 'is-active' : ''}`}
              onClick={() => onSelectStage(idx)}
            >
              {st.num}
            </button>
          ))}
        </div>
        <span
          className={
            current.isCritical ? 'is-alert' : current.isVerified ? 'is-verified' : 'is-titanium'
          }
        >
          {current.badge}
        </span>
      </div>
    </div>
  );
}

export default function CinematicLanding({
  isLoggedIn,
  onEnterWorkspace,
  onLogin,
  onRegister,
  onHowItWorks,
}) {
  const root = useRef(null);
  const heroPinRef = useRef(null);
  const traceDeckRef = useRef(null);
  const loupeRingRef = useRef(null);
  const coordReadoutRef = useRef(null);
  const splitBoxRef = useRef(null);
  const marqueeTrackRef = useRef(null);
  const beatRefs = useRef([]);

  const [heroCaseIdx, setHeroCaseIdx] = useState(0);
  const [activeStep, setActiveStep] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 2;
    }
    return 0;
  });
  const activeHeroCase = HERO_CASES[heroCaseIdx] || HERO_CASES[0];
  const [activeStage, setActiveStage] = useState(0);
  const [splitPct, setSplitPct] = useState(48);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const citationRate =
    evaluation.citation_resolution?.rate != null
      ? `${Math.round(evaluation.citation_resolution.rate * 100)}%`
      : 'N/A';
  const citationCount = `${evaluation.citation_resolution?.resolved ?? 0}/${evaluation.citation_resolution?.total ?? 0}`;
  const latencyP50 = evaluation.diagnosis_latency_ms?.p50
    ? `${(evaluation.diagnosis_latency_ms.p50 / 1000).toFixed(1)}s`
    : 'N/A';
  const evalCases = `${evaluation.diagnosis_cases_evaluated ?? 0}/${evaluation.diagnosis_cases ?? 0}`;
  const interactionStatus = String(evaluation.interactions?.status || 'demo').toUpperCase();

  // 1. Live Self-Executing DAG Sequencer:
  //    Steps 01 -> 02 -> 03 -> 04, then auto-advances to the next tab and loops.
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return undefined;

    const timer = window.setTimeout(() => {
      if (activeStep < 3) {
        setActiveStep((prev) => prev + 1);
      } else {
        setActiveStep(0);
        setHeroCaseIdx((prev) => (prev + 1) % HERO_CASES.length);
      }
    }, 1350);

    return () => window.clearTimeout(timer);
  }, [heroCaseIdx, activeStep]);

  // 2. 60fps Diagnostic X-Ray Loupe:
  //    - 20% smaller radius (110px)
  //    - Expands ONLY when hovering directly over the headline text spans
  //    - Clips cleanly above .mgx-trace-deck so it never interferes with the bottom deck
  useEffect(() => {
    const heroEl = heroPinRef.current;
    if (!heroEl) return undefined;
    if (window.matchMedia('(pointer: coarse)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const LOUPE_RADIUS = 110; // 20% smaller than 138px
    let tx = heroEl.clientWidth * 0.35;
    let ty = heroEl.clientHeight * 0.34;
    let cx = tx;
    let cy = ty;
    let tr = 0;
    let cr = 0;
    let rafId = 0;

    const syncBounds = () => {
      const heroH = heroEl.clientHeight;
      heroEl.style.setProperty('--hero-h', `${heroH}px`);
      const deckEl = traceDeckRef.current;
      if (deckEl) {
        const deckTop = deckEl.offsetTop;
        const cutBottom = Math.max(0, heroH - deckTop + 6);
        heroEl.style.setProperty('--xray-cut-bottom', `${cutBottom}px`);
      }
    };

    syncBounds();
    window.addEventListener('resize', syncBounds);

    const onMove = (e) => {
      const rect = heroEl.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (coordReadoutRef.current) {
        const sx = String(Math.max(0, Math.round(e.clientX))).padStart(4, '0');
        const sy = String(Math.max(0, Math.round(e.clientY))).padStart(4, '0');
        coordReadoutRef.current.textContent = `X:${sx}  Y:${sy}`;
      }

      if (!inside) {
        tr = 0;
        return;
      }

      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;

      // Expand when hovering over either the headline text OR the right-side description paragraph
      const overXrayText = Boolean(e.target?.closest?.('.mgx-hero-line-inner, .mgx-hero-lead'));
      tr = overXrayText ? LOUPE_RADIUS : 0;
    };

    const onLeave = () => {
      tr = 0;
    };

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      cr += (tr - cr) * 0.16;

      heroEl.style.setProperty('--lx', `${cx.toFixed(1)}px`);
      heroEl.style.setProperty('--ly', `${cy.toFixed(1)}px`);
      heroEl.style.setProperty('--lr', `${cr.toFixed(1)}px`);

      if (loupeRingRef.current) {
        const scale = cr / LOUPE_RADIUS;
        loupeRingRef.current.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        loupeRingRef.current.style.opacity = cr > 6 ? '1' : '0';
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    heroEl.addEventListener('mouseleave', onLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncBounds);
      window.removeEventListener('mousemove', onMove);
      heroEl.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const updateSplitFromClientX = (clientX) => {
    const box = splitBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setSplitPct(Math.min(92, Math.max(8, raw)));
  };

  useEffect(() => {
    if (!isDraggingSplit) return undefined;
    const onMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      updateSplitFromClientX(x);
    };
    const onUp = () => setIsDraggingSplit(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDraggingSplit]);

  const jumpToStage = (idx) => {
    setActiveStage(idx);
    const target = beatRefs.current[idx];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Crisp entrance that never traps elements invisible
        gsap.from('.mgx-hero-line-inner', {
          yPercent: 100,
          duration: 0.9,
          stagger: 0.08,
          ease: 'expo.out',
          clearProps: 'transform',
        });

        gsap.from('.mgx-hero-fade', {
          y: 16,
          opacity: 0,
          duration: 0.75,
          stagger: 0.06,
          delay: 0.15,
          ease: 'expo.out',
          clearProps: 'transform,opacity',
        });

        // Accurate Stage Tracking across all 4 chapters
        gsap.utils.toArray('.mgx-stage-beat').forEach((beat, idx) => {
          ScrollTrigger.create({
            trigger: beat,
            start: 'top 52%',
            end: 'bottom 52%',
            onEnter: () => setActiveStage(idx),
            onEnterBack: () => setActiveStage(idx),
          });
        });

        // Velocity-reactive ticker
        if (marqueeTrackRef.current) {
          const marqueeTween = gsap.to(marqueeTrackRef.current, {
            xPercent: -50,
            repeat: -1,
            duration: 24,
            ease: 'none',
          });

          ScrollTrigger.create({
            trigger: '.mgx-marquee',
            start: 'top bottom',
            end: 'bottom top',
            onUpdate: (self) => {
              const vel = Math.abs(self.getVelocity()) / 420;
              const dir = self.direction === -1 ? -1 : 1;
              gsap.to(marqueeTween, {
                timeScale: dir * (1 + Math.min(vel, 4.5)),
                duration: 0.3,
                overwrite: true,
              });
            },
          });
        }

        gsap.utils.toArray('.mgx-eval-bar-fill').forEach((bar) => {
          gsap.fromTo(
            bar,
            { scaleX: 0 },
            {
              scaleX: parseFloat(bar.dataset.fill || '1'),
              duration: 1.0,
              ease: 'expo.out',
              scrollTrigger: {
                trigger: bar,
                start: 'top 88%',
                once: true,
              },
            }
          );
        });

        gsap.utils.toArray('[data-mgx-reveal]').forEach((el) => {
          gsap.from(el, {
            y: 34,
            opacity: 0,
            duration: 0.85,
            ease: 'expo.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              once: true,
            },
          });
        });
      });

      // Desktop-Only Hero Pin + Bulletproof Pipeline Instrument Pin
      mm.add('(min-width: 1025px) and (prefers-reduced-motion: no-preference)', () => {
        // 1. Pinned Hero -> Restored Expanding Light-White Archival Aperture
        gsap.set('.mgx-aperture', {
          clipPath: 'inset(44% 32% 44% 32%)',
          autoAlpha: 0,
        });
        gsap.set('.mgx-aperture-word', {
          yPercent: 85,
          opacity: 0,
        });

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: '.mgx-hero-pin',
            start: () => {
              const navH = document.querySelector('.navbar')?.offsetHeight || 68;
              return `top ${navH}px`;
            },
            end: '+=155%',
            pin: true,
            scrub: 0.75,
            invalidateOnRefresh: true,
          },
        });

        heroTl
          .to(
            '.mgx-hero-content',
            {
              scale: 0.94,
              y: -24,
              opacity: 0.14,
              ease: 'none',
              duration: 0.45,
            },
            0
          )
          .to(
            '.mgx-xray-clip-stage',
            {
              opacity: 0,
              ease: 'none',
              duration: 0.2,
            },
            0
          )
          .to(
            '.mgx-aperture',
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              autoAlpha: 1,
              ease: 'power2.inOut',
              duration: 0.56,
            },
            0.14
          )
          .to(
            '.mgx-aperture-word',
            {
              yPercent: 0,
              opacity: 1,
              stagger: 0.035,
              duration: 0.32,
              ease: 'expo.out',
            },
            0.44
          )
          // Brief hold at full light-white screen before releasing into Act II
          .to({}, { duration: 0.22 });

        // 2. Bulletproof GSAP Pin for the Left Pipeline Instrument Box
        //    Works reliably even when body has overflow-x: hidden
        ScrollTrigger.create({
          trigger: '.mgx-dissect-grid',
          pin: '.mgx-dissect-sticky',
          start: 'top 94px',
          end: () => {
            const grid = root.current?.querySelector('.mgx-dissect-grid');
            const sticky = root.current?.querySelector('.mgx-dissect-sticky');
            if (!grid || !sticky) return 'bottom bottom';
            const travel = Math.max(0, grid.offsetHeight - sticky.offsetHeight);
            return `+=${travel}`;
          },
          pinSpacing: false,
          invalidateOnRefresh: true,
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <main className="mgx-root" ref={root}>
      {/* ==================== ACT I: THE CLINICAL X-RAY INSTRUMENT HERO ==================== */}
      <section className="mgx-hero-pin" ref={heroPinRef} data-tone={activeHeroCase.tone}>
        {/* 60fps Live ECG Oscilloscope + Connected Graph Nodes */}
        <HeroTelemetryCanvas tone={activeHeroCase.tone} />

        {/* Architectural 1px Grid Backdrop */}
        <div className="mgx-hero-grid-bg" aria-hidden="true" />

        {/* One-shot Boot Calibration Scanline */}
        <div className="mgx-boot-scan" aria-hidden="true" />

        {/* BASE LAYER (Interactive & Immediately Clear) */}
        <div className="mgx-hero-content">
          {/* Row 1: Flush Live Telemetry Rail */}
          <div className="mgx-hero-meta mgx-hero-fade">
            <div className="mgx-meta-cluster">
              <span className="mgx-dot-vermilion is-live-pulse" />
              <span>MEDGRAPH // GRAPH-GROUNDED CLINICAL DECISION SUPPORT</span>
            </div>
            <div className="mgx-meta-cluster mgx-meta-coords">
              <span className="mgx-meta-bpm">{activeHeroCase.bpm}</span>
              <span ref={coordReadoutRef}>X:0000  Y:0000</span>
              <span className="mgx-meta-titanium">HOVER HEADLINE FOR X-RAY LAYER</span>
            </div>
          </div>

          {/* Row 2: Monumental Editorial Statement + Primary Actions */}
          <div className="mgx-hero-editorial">
            <div className="mgx-hero-title-col">
              <span className="mgx-kicker mgx-kicker-titanium mgx-hero-fade">
                [ 00 // EVIDENCE-LOCKED CLINICAL AI ]
              </span>
              <h1 className="mgx-editorial-h1">
                <span className="mgx-line-mask">
                  <span className="mgx-hero-line-inner">Clinical AI that</span>
                </span>
                <span className="mgx-line-mask">
                  <span className="mgx-hero-line-inner">
                    checks the <em>graph</em>
                  </span>
                </span>
                <span className="mgx-line-mask">
                  <span className="mgx-hero-line-inner">first.</span>
                </span>
              </h1>
            </div>

            <div className="mgx-hero-cta-col mgx-hero-fade">
              <p className="mgx-hero-lead">
                MedGraph checks structured drug interactions in Neo4j before generating text, retrieves indexed clinical guidelines, and keeps every citation and system limit visible.
              </p>

              <div className="mgx-hero-actions">
                <button
                  type="button"
                  className="mgx-btn-primary"
                  data-cursor="LAUNCH"
                  onClick={isLoggedIn ? onEnterWorkspace : onLogin}
                >
                  <span>{isLoggedIn ? 'ENTER CLINICAL CONSOLE' : 'INITIALIZE CONSOLE'}</span>
                  <ArrowRight size={15} />
                </button>

                <button
                  type="button"
                  className="mgx-btn-ghost"
                  data-cursor="CASE 0417"
                  onClick={onHowItWorks}
                >
                  <span>WORKED CASE 0417</span>
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Self-Executing Live 4-Node Clinical DAG Instrument */}
          <div className="mgx-trace-deck mgx-hero-fade" ref={traceDeckRef} data-tone={activeHeroCase.tone}>
            <div className="mgx-trace-top">
              <div className="mgx-trace-tabs" role="tablist" aria-label="Interactive clinical paths">
                {HERO_CASES.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={heroCaseIdx === idx}
                    className={`mgx-trace-tab ${heroCaseIdx === idx ? 'is-active' : ''}`}
                    data-tone={item.tone}
                    onClick={() => {
                      setHeroCaseIdx(idx);
                      setActiveStep(0);
                    }}
                  >
                    {item.tab}
                  </button>
                ))}
              </div>

              <span className="mgx-trace-tag">
                STEP 0{activeStep + 1}/04 · {activeHeroCase.tag}
              </span>
            </div>

            {/* Live Sequenced Signal Rail */}
            <div className="mgx-trace-rail" key={activeHeroCase.id}>
              <svg
                className="mgx-trace-wires"
                viewBox="0 0 1200 24"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="12" x2="1200" y2="12" className="mgx-wire-base" />
                <line
                  x1="0"
                  y1="12"
                  x2={Math.round(((activeStep + 0.5) / 4) * 1200)}
                  y2="12"
                  className="mgx-wire-progress"
                />
                <line x1="0" y1="12" x2="1200" y2="12" className="mgx-wire-pulse" />
              </svg>

              <div className="mgx-trace-nodes">
                {activeHeroCase.nodes.map((node, idx) => {
                  const isLive = activeStep === idx;
                  const isPassed = idx < activeStep;
                  return (
                    <div
                      key={node.step}
                      className={`mgx-trace-node ${isLive ? 'is-live' : ''} ${
                        isPassed ? 'is-passed' : ''
                      }`}
                      onMouseEnter={() => setActiveStep(idx)}
                    >
                      <div className="mgx-trace-node-head">
                        <span>{node.step}</span>
                        <span className="mgx-node-ms">
                          {node.ms} <i className="mgx-node-pip" />
                        </span>
                      </div>
                      <strong>{node.title}</strong>
                      <small>{node.meta}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mgx-trace-bottom">
              <span className="mgx-trace-verdict">
                <i className="mgx-verdict-dot" />
                {activeHeroCase.verdict}
              </span>
              <span className="mgx-trace-scroll">SCROLL TO INSPECT THESIS ↓</span>
            </div>
          </div>
        </div>

        {/* Clipped strictly above the bottom trace deck so the circle can never interfere with it */}
        <div className="mgx-xray-clip-stage" aria-hidden="true">
          <div className="mgx-hero-xray">
            <div className="mgx-xray-content">
              <div className="mgx-xray-meta">
                <span>[ X-RAY // STRUCTURED GRAPH SUBSTRATE ]</span>
                <span>{activeHeroCase.xrayTag}</span>
              </div>

              <div className="mgx-hero-editorial mgx-xray-editorial">
                <div className="mgx-hero-title-col">
                  <span className="mgx-xray-kicker">
                    [ UMLS_LINKER · NEO4J_1HOP · DENSE+BM25_RRF ]
                  </span>
                  <div className="mgx-editorial-h1 mgx-xray-h1">
                    <span className="mgx-line-mask">Clinical AI that</span>
                    <span className="mgx-line-mask">
                      checks the <em>graph</em>
                    </span>
                    <span className="mgx-line-mask">first.</span>
                  </div>
                </div>

                <div className="mgx-hero-cta-col">
                  <div className="mgx-xray-schematic-note">
                    <span>NODE_A: RX-11289 (WARFARIN)</span>
                    <span>NODE_B: RX-1191 (ASPIRIN)</span>
                    <span>EDGE: INTERACTS_WITH [SEVERITY=HIGH]</span>
                    <span>GATE: ROUTE_AFTER_GRAPH -&gt; ALERT_EARLY</span>
                    <span>CITATION: AHA/ACC §10 [CHUNK_ID LOCKED]</span>
                  </div>
                </div>
              </div>

              <div className="mgx-xray-spacer" />
            </div>
          </div>

          {/* Rotating Surgical Caliper Reticle Ring Around the Cursor Loupe */}
          <div className="mgx-loupe-ring" ref={loupeRingRef}>
            <svg viewBox="0 0 280 280" className="mgx-loupe-svg">
              <circle cx="140" cy="140" r="137" className="mgx-loupe-outer" />
              <circle cx="140" cy="140" r="129" className="mgx-loupe-dashed" />
              <line x1="140" y1="0" x2="140" y2="14" className="mgx-loupe-tick" />
              <line x1="140" y1="266" x2="140" y2="280" className="mgx-loupe-tick" />
              <line x1="0" y1="140" x2="14" y2="140" className="mgx-loupe-tick" />
              <line x1="266" y1="140" x2="280" y2="140" className="mgx-loupe-tick" />
            </svg>
            <span className="mgx-loupe-label">X-RAY // GRAPH</span>
          </div>
        </div>

        {/* RESTORED: Expanding Light-White Archival Bone Surgical Aperture on Scroll */}
        <div className="mgx-aperture" aria-hidden="true">
          <div className="mgx-aperture-inner">
            <span className="mgx-kicker-inv">[ 01 // ARCHITECTURAL THESIS ]</span>
            <h2 className="mgx-aperture-headline">
              {['WHEN', 'MEDICINES', 'CONFLICT,', 'WE', 'HALT', 'BEFORE', 'THE', 'MODEL', 'SPEAKS.'].map(
                (word, idx) => (
                  <span key={idx} className="mgx-aperture-mask">
                    <span
                      className={`mgx-aperture-word ${
                        word === 'HALT' || word === 'CONFLICT,' ? 'is-vermilion' : ''
                      }`}
                    >
                      {word}
                    </span>
                  </span>
                )
              )}
            </h2>
            <div className="mgx-aperture-foot">
              <span>NEO4J STRUCTURED LOOKUP</span>
              <span>·</span>
              <span>DENSE + BM25 RETRIEVAL</span>
              <span>·</span>
              <span>ZERO SILENT FALLBACKS</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== ACT II: PINNED 4-STAGE PIPELINE DISSECTION ==================== */}
      <section className="mgx-dissect-section">
        <div className="mgx-shell">
          <div className="mgx-section-head" data-mgx-reveal>
            <span className="mgx-kicker mgx-kicker-titanium">[ 02 // PIPELINE DISSECTION ]</span>
            <h2>
              Four deterministic checks. <em>Zero black boxes.</em>
            </h2>
          </div>

          <div className="mgx-dissect-grid">
            {/* Pinned Left Architectural Instrument */}
            <div className="mgx-dissect-left">
              <div className="mgx-dissect-sticky">
                <StageSchematic activeStage={activeStage} onSelectStage={jumpToStage} />
              </div>
            </div>

            {/* Scrolling Right Editorial Chapters */}
            <div className="mgx-dissect-right">
              {DISSECT_STAGES.map((stage, idx) => (
                <article
                  key={stage.num}
                  ref={(el) => {
                    beatRefs.current[idx] = el;
                  }}
                  className={`mgx-stage-beat ${activeStage === idx ? 'is-current' : ''} ${
                    stage.isCritical ? 'is-critical' : ''
                  } ${stage.isVerified ? 'is-verified' : ''}`}
                  onMouseEnter={() => setActiveStage(idx)}
                >
                  <div className="mgx-stage-top">
                    <span className="mgx-stage-num">{stage.num}</span>
                    <span className="mgx-kicker mgx-kicker-titanium">{stage.code}</span>
                  </div>

                  <h3>{stage.title}</h3>
                  <p>{stage.summary}</p>

                  <div className="mgx-artifact-box">
                    <div className="mgx-artifact-head">
                      <span>{stage.artifactLabel}</span>
                      <span
                        className={
                          stage.isCritical
                            ? 'is-alert'
                            : stage.isVerified
                              ? 'is-verified'
                              : 'is-titanium'
                        }
                      >
                        {stage.badge}
                      </span>
                    </div>
                    <div className="mgx-artifact-body">
                      {stage.artifactLines.map((line, i) => (
                        <code key={i}>{line}</code>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== ACT III: INTERACTIVE RAZOR SPLIT-SCREEN ==================== */}
      <section className="mgx-split-section">
        <div className="mgx-shell">
          <div className="mgx-split-header" data-mgx-reveal>
            <div>
              <span className="mgx-kicker mgx-kicker-titanium">
                [ 03 // THE FAULT LINE — DRAG TO COMPARE ]
              </span>
              <h2>
                Unverified prose vs. <em>graph-gated safety.</em>
              </h2>
            </div>

            <div className="mgx-split-presets">
              <button
                type="button"
                className={splitPct > 70 ? 'is-active' : ''}
                onClick={() => setSplitPct(88)}
              >
                TYPICAL AI
              </button>
              <button
                type="button"
                className={splitPct >= 30 && splitPct <= 70 ? 'is-active' : ''}
                onClick={() => setSplitPct(50)}
              >
                50 / 50
              </button>
              <button
                type="button"
                className={splitPct < 30 ? 'is-active' : ''}
                onClick={() => setSplitPct(12)}
              >
                MEDGRAPH
              </button>
            </div>
          </div>
        </div>

        <div
          className="mgx-razor-stage"
          ref={splitBoxRef}
          data-cursor="DRAG"
          onMouseDown={(e) => {
            setIsDraggingSplit(true);
            updateSplitFromClientX(e.clientX);
          }}
          onTouchStart={(e) => {
            setIsDraggingSplit(true);
            updateSplitFromClientX(e.touches[0].clientX);
          }}
        >
          <div className="mgx-razor-pane mgx-pane-medgraph">
            <div className="mgx-pane-inner">
              <div className="mgx-pane-bar">
                <span>MEDGRAPH // DAG SAFETY ARCHITECTURE</span>
                <span className="mgx-tag-ok">INTERCEPTED IN GRAPH LAYER</span>
              </div>

              <div className="mgx-pane-case">CASE 0417: 65M · WARFARIN + ASPIRIN · CHEST PAIN</div>

              <div className="mgx-pane-grid">
                <div className="mgx-pane-block is-halt">
                  <small>01 // CRITICAL INTERACTION HALT</small>
                  <strong>Warfarin + Aspirin → High Bleed Risk</strong>
                  <p>Structured Neo4j lookup intercepts dual antithrombotic risk before free-text synthesis.</p>
                </div>
                <div className="mgx-pane-block">
                  <small>02 // VERIFIED CITATION LOCK</small>
                  <strong>AHA/ACC Antithrombotic §10</strong>
                  <p>Chunk ID, excerpt, and source URL attached directly to the output payload.</p>
                </div>
                <div className="mgx-pane-block">
                  <small>03 // EXPLICIT BOUNDARIES</small>
                  <strong>Zero silent failures</strong>
                  <p>If Neo4j is unreachable or evidence is missing, status is returned explicitly.</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="mgx-razor-pane mgx-pane-llm"
            style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
          >
            <div className="mgx-pane-inner">
              <div className="mgx-pane-bar">
                <span>TYPICAL TEXT AI // UNSTRUCTURED GENERATION</span>
                <span className="mgx-tag-err">NO GRAPH GATE</span>
              </div>

              <div className="mgx-pane-case">CASE 0417: 65M · WARFARIN + ASPIRIN · CHEST PAIN</div>

              <div className="mgx-pane-grid">
                <div className="mgx-pane-block is-dim">
                  <small>01 // RAW PROMPT INGESTION</small>
                  <strong>Unstructured prose token prediction</strong>
                  <p>No deterministic drug-drug graph query runs prior to generating clinical text.</p>
                </div>
                <div className="mgx-pane-block is-warn">
                  <small>02 // MISSED OR BURIED CONFLICT</small>
                  <strong>Warfarin + Aspirin risk may be diluted</strong>
                  <p>Severe hemorrhage hazard can be buried deep in generic paragraphs or omitted.</p>
                </div>
                <div className="mgx-pane-block is-warn">
                  <small>03 // UNVERIFIED SOURCES</small>
                  <strong>Citations require manual verification</strong>
                  <p>Plausible-sounding references are generated without locked chunk IDs.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mgx-razor-line" style={{ left: `${splitPct}%` }} aria-hidden="true">
            <div className="mgx-razor-knob">
              <MoveHorizontal size={15} />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== ACT IV: VELOCITY TICKER + STICKY STACKING FOLIOS ==================== */}
      <div className="mgx-marquee" aria-hidden="true">
        <div className="mgx-marquee-track" ref={marqueeTrackRef}>
          {[0, 1].map((dup) => (
            <div className="mgx-marquee-group" key={dup}>
              <span>NEO4J KNOWLEDGE GRAPH</span>
              <i>/</i>
              <span>DENSE + BM25 HYBRID RAG</span>
              <i>/</i>
              <span>DETERMINISTIC CITATION IDS</span>
              <i>/</i>
              <span>EARLY-EXIT DRUG INTERCEPT</span>
              <i>/</i>
              <span>EXPLICIT NO_EVIDENCE BOUNDARY</span>
              <i>/</i>
            </div>
          ))}
        </div>
      </div>

      <section className="mgx-folios-section">
        <div className="mgx-shell">
          <div className="mgx-folios-stack">
            <article className="mgx-folio mgx-folio-01">
              <div className="mgx-folio-bar">
                <span>FOLIO 01 // MEASURED BOUNDARIES</span>
                <span>{evaluation.summary_path || 'eval/results/latest/summary.json'}</span>
              </div>

              <div className="mgx-folio-head">
                <h2>
                  Real telemetry. <em>Open gaps included.</em>
                </h2>
                <p>
                  Bounded {evaluation.run_mode || 'live'} evaluation metrics loaded directly from the project summary—provisional labels and blocked datasets remain explicit.
                </p>
              </div>

              <div className="mgx-eval-ledger">
                <div className="mgx-eval-item">
                  <small>CITATION RESOLUTION</small>
                  <strong>{citationRate}</strong>
                  <div className="mgx-eval-bar">
                    <i
                      className="mgx-eval-bar-fill is-verified"
                      data-fill={evaluation.citation_resolution?.rate ?? 1}
                    />
                  </div>
                  <p>{citationCount} deterministic ID-set resolution</p>
                </div>

                <div className="mgx-eval-item">
                  <small>PROVISIONAL CASES RUN</small>
                  <strong>{evalCases}</strong>
                  <div className="mgx-eval-bar">
                    <i
                      className="mgx-eval-bar-fill is-titanium"
                      data-fill={
                        evaluation.diagnosis_cases
                          ? (evaluation.diagnosis_cases_evaluated ?? 0) / evaluation.diagnosis_cases
                          : 0.9
                      }
                    />
                  </div>
                  <p>Underpowered set vs. 40-case target</p>
                </div>

                <div className="mgx-eval-item">
                  <small>MEDIAN LATENCY (P50)</small>
                  <strong>{latencyP50}</strong>
                  <div className="mgx-eval-bar">
                    <i className="mgx-eval-bar-fill" data-fill="0.62" />
                  </div>
                  <p>End-to-end DAG retrieval + reasoning</p>
                </div>

                <div className="mgx-eval-item">
                  <small>INTERACTION BENCHMARK</small>
                  <strong>{interactionStatus}</strong>
                  <div className="mgx-eval-bar">
                    <i className="mgx-eval-bar-fill is-muted" data-fill="0.25" />
                  </div>
                  <p>Demo graph labeled; no invented labels</p>
                </div>
              </div>
            </article>

            <article
              className="mgx-folio mgx-folio-02"
              data-cursor="OPEN"
              onClick={isLoggedIn ? onEnterWorkspace : onLogin}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? onEnterWorkspace() : onLogin())}
            >
              <div className="mgx-folio-bar">
                <span>FOLIO 02 // SURFACE 01</span>
                <span>NPI PRACTITIONER WORKSPACE</span>
              </div>

              <div className="mgx-folio-split">
                <div>
                  <h2>
                    Practitioner
                    <br />
                    <em>Decision Console</em>
                  </h2>
                  <p>
                    Evaluate patient presentations, inspect the bipartite concept graph, review locked guideline excerpts, upload custom PDFs or interaction CSVs, and export structured Markdown reports.
                  </p>
                </div>

                <div className="mgx-folio-specs">
                  <ul>
                    <li><span>01</span>Structured intake + quick case presets</li>
                    <li><span>02</span>Live Neo4j + Pinecone dependency telemetry</li>
                    <li><span>03</span>Bipartite concept graph + expandable chunks</li>
                    <li><span>04</span>Custom guideline &amp; CSV knowledge ingestion</li>
                  </ul>
                  <div className="mgx-folio-cta">
                    <span>{isLoggedIn ? 'OPEN PRACTITIONER CONSOLE' : 'AUTHENTICATE CLINICIAN'}</span>
                    <ArrowRight size={18} />
                  </div>
                </div>
              </div>
            </article>

            <article
              className="mgx-folio mgx-folio-03"
              data-cursor="OPEN"
              onClick={isLoggedIn ? onEnterWorkspace : onRegister}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? onEnterWorkspace() : onRegister())}
            >
              <div className="mgx-folio-bar">
                <span>FOLIO 03 // SURFACE 02</span>
                <span>PLAIN-LANGUAGE SAFETY CHECK</span>
              </div>

              <div className="mgx-folio-split">
                <div>
                  <h2>
                    Patient
                    <br />
                    <em>Safety Portal</em>
                  </h2>
                  <p>
                    Check daily prescriptions for known interaction warnings, track recommended care checklists, and download a clear visit summary to discuss directly with your clinician.
                  </p>
                </div>

                <div className="mgx-folio-specs">
                  <ul>
                    <li><span>01</span>Daily prescription interaction screening</li>
                    <li><span>02</span>Plain-language safety explanations</li>
                    <li><span>03</span>Interactive care workup checklist</li>
                    <li><span>04</span>Downloadable visit summary report</li>
                  </ul>
                  <div className="mgx-folio-cta">
                    <span>{isLoggedIn ? 'OPEN PATIENT PORTAL' : 'INITIALIZE PATIENT CHECK'}</span>
                    <ArrowRight size={18} />
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ==================== ACT V: MONUMENTAL POLARITY-WIPE FINALE ==================== */}
      <section className="mgx-finale">
        <button
          type="button"
          className="mgx-finale-row"
          data-cursor="READ"
          onClick={onHowItWorks}
        >
          <span className="mgx-finale-index">01 // MONOGRAPH</span>
          <span className="mgx-finale-title">
            INSPECT WORKED CASE <em>0417</em>
          </span>
          <ArrowUpRight className="mgx-finale-arrow" size={44} strokeWidth={1.3} />
        </button>

        <button
          type="button"
          className="mgx-finale-row"
          data-cursor="LAUNCH"
          onClick={isLoggedIn ? onEnterWorkspace : onLogin}
        >
          <span className="mgx-finale-index">02 // CONSOLE</span>
          <span className="mgx-finale-title">
            {isLoggedIn ? (
              <>
                ENTER ACTIVE <em>WORKSPACE</em>
              </>
            ) : (
              <>
                RUN A CASE <em>OF YOUR OWN</em>
              </>
            )}
          </span>
          <ArrowRight className="mgx-finale-arrow" size={44} strokeWidth={1.3} />
        </button>
      </section>
    </main>
  );
}
