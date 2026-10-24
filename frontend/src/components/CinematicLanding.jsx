import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// 8 Perimeter Nodes on the Radial Synaptic Dial (angles in degrees)
const DIAL_ENTITIES = [
  {
    id: 'warfarin',
    code: 'RX-11289',
    label: 'WARFARIN',
    type: 'ANTICOAGULANT',
    angle: -65,
    linkedTo: ['aspirin', 'hemorrhage', 'guideline10'],
    verdict: 'CRITICAL CONTRAINDICATION // 1-HOP EDGE TO ASPIRIN',
    detail: 'Vitamin K antagonist. In the presence of antiplatelet therapy, MedGraph halts generative inference in 180ms.',
  },
  {
    id: 'aspirin',
    code: 'RX-1191',
    label: 'ASPIRIN',
    type: 'ANTIPLATELET',
    angle: -20,
    linkedTo: ['warfarin', 'hemorrhage', 'stemi'],
    verdict: 'SYNERGISTIC BLEED VECTOR // DUAL PATHWAY ACTIVE',
    detail: 'Irreversible COX-1 inhibitor. Flagged against Warfarin via NIH RxNav edge severity = HIGH.',
  },
  {
    id: 'chestpain',
    code: 'UMLS-C0008031',
    label: 'CHEST PAIN',
    type: 'PRESENTING SYMPTOM',
    angle: 25,
    linkedTo: ['diaphoresis', 'stemi', 'guideline21'],
    verdict: 'CANONICAL ONTOLOGY MATCH // RESOLVED FROM "CHEST PRESSURE"',
    detail: 'Mapped from raw patient prose to canonical UMLS identifier before graph traversal.',
  },
  {
    id: 'diaphoresis',
    code: 'UMLS-C0700590',
    label: 'DIAPHORESIS',
    type: 'AUTONOMIC SIGNAL',
    angle: 70,
    linkedTo: ['chestpain', 'stemi', 'guideline21'],
    verdict: 'SECONDARY ISCHEMIC MARKER // WEIGHT +0.34',
    detail: 'Resolved from intake symptom "sweating". Amplifies acute coronary syndrome rank.',
  },
  {
    id: 'stemi',
    code: 'ICD-I21.3',
    label: 'ACUTE STEMI',
    type: 'DIFFERENTIAL DX',
    angle: 115,
    linkedTo: ['chestpain', 'diaphoresis', 'guideline21'],
    verdict: 'PRIMARY CARDIAC DIFFERENTIAL // CONFIDENCE 0.87',
    detail: 'Grounded by 2-hop symptom topology and AHA/ACC 2021 Chest Pain Triage Guidelines.',
  },
  {
    id: 'hemorrhage',
    code: 'ICD-K92.2',
    label: 'HEMORRHAGE RISK',
    type: 'ADVERSE EVENT',
    angle: 160,
    linkedTo: ['warfarin', 'aspirin', 'guideline10'],
    verdict: 'EARLY-EXIT SAFETY INTERCEPT // SEVERITY: CRITICAL',
    detail: 'Compound gastrointestinal and intracranial bleed hazard. Triggers immediate PT/INR order.',
  },
  {
    id: 'guideline10',
    code: 'AHA-ANTITHROMB-10',
    label: 'AHA GUIDELINE §10',
    type: 'VERIFIED LITERATURE',
    angle: 205,
    linkedTo: ['warfarin', 'aspirin', 'hemorrhage'],
    verdict: 'CHUNK VERIFIED // 94.2% DENSE + BM25 RRF MATCH',
    detail: ' mandates strict INR monitoring and contraindicates routine dual therapy without mechanical valve indication.',
  },
  {
    id: 'guideline21',
    code: 'AHA-CHEST-4.1',
    label: 'ACC/AHA §4.1.2',
    type: 'VERIFIED LITERATURE',
    angle: 250,
    linkedTo: ['chestpain', 'diaphoresis', 'stemi'],
    verdict: 'CHUNK VERIFIED // 10-MINUTE ECG PROTOCOL',
    detail: 'Requires 12-lead ECG acquisition within 10 minutes of arrival and serial troponin assays.',
  },
];

const INDEX_CAPABILITIES = [
  {
    idx: '01',
    code: '01 // NAMES',
    title: 'Understand the terms',
    kicker: 'PATIENT WORDS',
    summary: 'Turns everyday symptoms and medicine names into clear, shared terms.',
    signal: ['PATIENT WORDS', 'SHARED TERMS', 'CLEAR MATCH'],
  },
  {
    idx: '02',
    code: '02 // SAFETY',
    title: 'Check known conflicts',
    kicker: 'MEDICATION SAFETY',
    summary: 'Checks for known medication conflicts before any generated answer.',
    signal: ['MEDICINES', 'KNOWN CONFLICTS', 'EARLY WARNING'],
  },
  {
    idx: '03',
    code: '03 // SOURCES',
    title: 'Find useful sources',
    kicker: 'GUIDELINES + LITERATURE',
    summary: 'Combines exact matches with similar clinical language to find useful references.',
    signal: ['EXACT MATCH', 'SIMILAR LANGUAGE', 'USEFUL SOURCES'],
  },
  {
    idx: '04',
    code: '04 // PROOF',
    title: 'Show the source',
    kicker: 'CITATIONS',
    summary: 'Keeps each citation tied to the evidence used for the result.',
    signal: ['RESULT', 'SOURCE CHECK', 'VISIBLE PATH'],
  },
];

// Convert polar angle to SVG (cx=250, cy=250, r=168)
function polarToCartesian(angleDeg, radius = 168) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: 250 + radius * Math.cos(rad),
    y: 250 + radius * Math.sin(rad),
  };
}

export default function CinematicLanding({
  isLoggedIn,
  onEnterWorkspace,
  onLogin,
  onRegister,
  onHowItWorks,
}) {
  const root = useRef(null);
  const [activeEntityId, setActiveEntityId] = useState('warfarin');
  const [compareMode, setCompareMode] = useState('medgraph'); // 'medgraph' | 'llm'
  const [openRow, setOpenRow] = useState('02');

  const activeEntity =
    DIAL_ENTITIES.find((e) => e.id === activeEntityId) || DIAL_ENTITIES[0];

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.mg-title-line', {
          yPercent: 105,
          opacity: 0,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power4.out',
        });
        gsap.from('.mg-dial-wrap', {
          opacity: 0,
          scale: 0.94,
          duration: 1.1,
          delay: 0.2,
          ease: 'power3.out',
        });
        gsap.utils.toArray('[data-mg-reveal]').forEach((el) => {
          gsap.from(el, {
            y: 26,
            opacity: 0,
            duration: 0.75,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 86%',
              once: true,
            },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <main className="mg-monograph" ref={root}>
      {/* ==================== ACT I: MONUMENTAL EDITORIAL HERO & SYNAPTIC DIAL ==================== */}
      <section className="mg-hero">
        <div className="mg-grid">
          {/* Left Column: Brutalist Editorial Typography */}
          <div className="mg-hero-left">
             <div className="mg-kicker">
               <span className="mg-vermilion-dot" />
               <span>00 // FOLLOW THE CLINICAL PATH</span>
            </div>

            <h1 className="mg-display">
              <span className="mg-title-mask">
                <span className="mg-title-line">Medicine is</span>
              </span>
              <span className="mg-title-mask">
                <span className="mg-title-line">
                  not a <em>guess.</em>
                </span>
              </span>
              <span className="mg-title-mask">
                <span className="mg-title-line mg-title-sub">It is a graph.</span>
              </span>
            </h1>

            <div className="mg-hero-cta-row">
              <button
                type="button"
                className="mg-btn-solid"
                onClick={isLoggedIn ? onEnterWorkspace : onLogin}
              >
                <span>{isLoggedIn ? 'ENTER CLINICAL CONSOLE' : 'INITIALIZE CONSOLE'}</span>
                <ArrowRight size={15} />
              </button>

              <button
                type="button"
                className="mg-btn-ruled"
                onClick={onHowItWorks}
              >
                <span>INSPECT WORKED CASE 0417</span>
                <ArrowUpRight size={15} />
              </button>
            </div>

          </div>

          {/* Right Column: The Radial Synaptic Dial (Interactive SVG Instrument) */}
          <div className="mg-hero-right">
            <div className="mg-dial-wrap">
              <div className="mg-dial-stage">
                <svg
                  className="mg-dial-svg"
                  viewBox="0 0 500 500"
                  aria-label="Interactive Clinical Chord Diagram"
                >
                  {/* Outer & Inner Caliper Rings */}
                  <circle cx="250" cy="250" r="218" className="mg-ring-outer" />
                  <circle cx="250" cy="250" r="168" className="mg-ring-main" />
                  <circle cx="250" cy="250" r="78" className="mg-ring-inner" />

                  {/* Crosshair Axis Lines */}
                  <line x1="250" y1="18" x2="250" y2="482" className="mg-axis-line" />
                  <line x1="18" y1="250" x2="482" y2="250" className="mg-axis-line" />

                  {/* Degree Tick Marks around Outer Ring */}
                  {Array.from({ length: 36 }).map((_, i) => {
                    const deg = i * 10;
                    const p1 = polarToCartesian(deg, 212);
                    const p2 = polarToCartesian(deg, 218);
                    return (
                      <line
                        key={deg}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        className="mg-tick"
                      />
                    );
                  })}

                  {/* Relational Bezier Chords through the Center */}
                  {DIAL_ENTITIES.map((source) =>
                    source.linkedTo.map((targetId) => {
                      const target = DIAL_ENTITIES.find((e) => e.id === targetId);
                      if (!target) return null;
                      const p1 = polarToCartesian(source.angle, 168);
                      const p2 = polarToCartesian(target.angle, 168);
                      const isActive =
                        activeEntityId === source.id || activeEntityId === target.id;
                      const isCritical =
                        (source.id === 'warfarin' && target.id === 'aspirin') ||
                        (source.id === 'aspirin' && target.id === 'warfarin') ||
                        source.id === 'hemorrhage' ||
                        target.id === 'hemorrhage';

                      return (
                        <path
                          key={`${source.id}-${target.id}`}
                          d={`M ${p1.x} ${p1.y} Q 250 250 ${p2.x} ${p2.y}`}
                          className={`mg-chord ${isActive ? 'is-active' : ''} ${
                            isCritical && isActive ? 'is-critical' : ''
                          }`}
                        />
                      );
                    })
                  )}

                  {/* Perimeter Entity Nodes */}
                  {DIAL_ENTITIES.map((entity) => {
                    const pos = polarToCartesian(entity.angle, 168);
                    const labelPos = polarToCartesian(entity.angle, 194);
                    const isSelected = activeEntityId === entity.id;
                    const isConnected = activeEntity.linkedTo.includes(entity.id);
                    const alignRight = Math.cos((entity.angle * Math.PI) / 180) < -0.15;

                    return (
                      <g
                        key={entity.id}
                         className={`mg-dial-node ${isSelected ? 'is-selected' : ''} ${
                           isConnected ? 'is-connected' : ''
                         } ${entity.type === 'VERIFIED LITERATURE' ? 'is-source' : ''}`}
                        onMouseEnter={() => setActiveEntityId(entity.id)}
                        onClick={() => setActiveEntityId(entity.id)}
                      >
                        <circle cx={pos.x} cy={pos.y} r={isSelected ? 7 : 4.5} className="mg-node-core" />
                        {isSelected && (
                          <circle cx={pos.x} cy={pos.y} r="14" className="mg-node-halo" />
                        )}
                        <text
                          x={labelPos.x}
                          y={labelPos.y}
                          textAnchor={alignRight ? 'end' : 'start'}
                          dominantBaseline="middle"
                          className="mg-node-label"
                        >
                          {entity.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Center Core Readout */}
                  <circle cx="250" cy="250" r="34" className="mg-center-disc" />
                  <text x="250" y="246" textAnchor="middle" className="mg-center-code">
                    {activeEntity.code}
                  </text>
                  <text x="250" y="260" textAnchor="middle" className="mg-center-sub">
                    1-HOP TRACE
                  </text>
                </svg>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ==================== ACT II: THE OBSIDIAN FAULT LINE (LLM VS MEDGRAPH) ==================== */}
      <section className="mg-obsidian-band">
        <div className="mg-grid" data-mg-reveal>
          <div className="mg-band-header">
              <span className="mg-kicker">[ 01 // A CLEARER PATH ]</span>
            <div className="mg-band-switch" role="tablist" aria-label="Compare AI paradigms">
              <button
                type="button"
                className={compareMode === 'llm' ? 'is-active' : ''}
                onClick={() => setCompareMode('llm')}
              >
                TYPICAL AI
              </button>
              <button
                type="button"
                className={compareMode === 'medgraph' ? 'is-active' : ''}
                onClick={() => setCompareMode('medgraph')}
              >
                MEDGRAPH
              </button>
            </div>
          </div>

          <div className="mg-band-split">
            <div className="mg-band-statement">
              <h2>
                {compareMode === 'medgraph' ? (
                  <>
                    When medicines conflict, check the <em>relationship.</em>
                  </>
                ) : (
                  <>
                    A text model can miss a serious <em>connection.</em>
                  </>
                )}
              </h2>
            </div>

            <div className="mg-band-terminal">
              <div className="mg-term-bar">
                <span>CASE: WARFARIN + ASPIRIN · CHEST PAIN</span>
                <span className={compareMode === 'medgraph' ? 'mg-tag-safe' : 'mg-tag-danger'}>
                  {compareMode === 'medgraph' ? 'SAFETY CHECK' : 'TEXT ONLY'}
                </span>
              </div>

              {compareMode === 'medgraph' ? (
                <div className="mg-term-body">
                  <div className="mg-trace-step is-ok">
                    <b>01</b>
                      <span>1 / MATCH</span>
                      <strong>Warfarin + Aspirin found</strong>
                  </div>
                  <div className="mg-trace-step is-halt">
                    <b>02</b>
                      <span>2 / GRAPH</span>
                      <strong>Known high-risk interaction</strong>
                  </div>
                  <div className="mg-trace-step is-halt">
                    <b>03</b>
                      <span>3 / ALERT</span>
                      <strong>Stop and review the medicines</strong>
                  </div>
                  <div className="mg-trace-step is-ok">
                    <b>04</b>
                      <span>4 / SOURCE</span>
                      <strong>Guideline reference attached</strong>
                  </div>
                </div>
              ) : (
                <div className="mg-term-body">
                  <div className="mg-trace-step is-dim">
                    <b>01</b>
                      <span>1 / TEXT</span>
                      <strong>Raw text collected</strong>
                  </div>
                  <div className="mg-trace-step is-warn">
                    <b>02</b>
                      <span>2 / CHECK</span>
                      <strong>No direct interaction check</strong>
                  </div>
                  <div className="mg-trace-step is-warn">
                    <b>03</b>
                      <span>3 / ANSWER</span>
                      <strong>May miss the medicine conflict</strong>
                  </div>
                  <div className="mg-trace-step is-warn">
                    <b>04</b>
                      <span>4 / SOURCE</span>
                      <strong>Source still needs checking</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== ACT III: THE ARCHITECTURAL FOLDING INDEX ==================== */}
      <section className="mg-index-section">
        <div className="mg-grid">
          <div className="mg-index-intro" data-mg-reveal>
              <span className="mg-kicker">[ 02 // HOW IT HELPS ]</span>
            <h2>
              Four simple checks for a <em>clearer</em> answer.
            </h2>
          </div>

          <div className="mg-index-list" data-mg-reveal>
            {INDEX_CAPABILITIES.map((item) => {
              const isOpen = openRow === item.idx;
              return (
                <article
                  key={item.idx}
                  className={`mg-index-row ${isOpen ? 'is-open' : ''}`}
                  onMouseEnter={() => setOpenRow(item.idx)}
                  onClick={() => setOpenRow(item.idx)}
                >
                  <div className="mg-row-main">
                    <span className="mg-row-num">[{item.idx}]</span>
                    <div className="mg-row-title-block">
                      <small>{item.code}</small>
                      <h3>{item.title}</h3>
                    </div>
                    <p className="mg-row-summary">{item.summary}</p>
                    <span className="mg-row-kicker">{item.kicker}</span>
                  </div>

                  <div className="mg-row-drawer">
                    <div className="mg-signal-track">
                      {item.signal.map((node, i) => (
                        <React.Fragment key={node}>
                          <span className="mg-signal-pill">{node}</span>
                          {i < item.signal.length - 1 && (
                            <span className="mg-signal-arrow">———→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== ACT IV: MONUMENTAL DUAL DOORS (CLINICIAN VS PATIENT) ==================== */}
      <section className="mg-doors-section">
        <div className="mg-grid">
          <div className="mg-doors-header" data-mg-reveal>
              <span className="mg-kicker">[ 03 // CHOOSE YOUR VIEW ]</span>
            <h2>
              Two views. One <em>clear path.</em>
            </h2>
          </div>

          <div className="mg-doors-split" data-mg-reveal>
            {/* Door 01: Clinician Console */}
            <div
              className="mg-door"
              onClick={isLoggedIn ? onEnterWorkspace : onLogin}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? onEnterWorkspace() : onLogin())}
            >
              <div className="mg-door-top">
                <span>SURFACE // 01</span>
                <span>NPI VERIFIED</span>
              </div>
              <h3>
                Practitioner
                <br />
                <em>Decision Console</em>
              </h3>
              <p>
                Review a case, see the important links, and check the sources behind each result.
              </p>
              <div className="mg-door-specs">
                <span>CASE RESULTS</span>
                <span>LINKS</span>
                <span>SOURCES</span>
              </div>
              <div className="mg-door-action">
                <span>{isLoggedIn ? 'OPEN PRACTITIONER CONSOLE' : 'AUTHENTICATE CLINICIAN'}</span>
                <ArrowRight size={18} />
              </div>
            </div>

            {/* Door 02: Patient Portal */}
            <div
              className="mg-door"
              onClick={isLoggedIn ? onEnterWorkspace : onRegister}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && (isLoggedIn ? onEnterWorkspace() : onRegister())}
            >
              <div className="mg-door-top">
                <span>SURFACE // 02</span>
                <span>PLAIN-LANGUAGE SAFETY</span>
              </div>
              <h3>
                Patient
                <br />
                <em>Safety Portal</em>
              </h3>
              <p>
                Check daily medicines for known safety problems and take a simple summary to your clinician.
              </p>
              <div className="mg-door-specs">
                <span>MEDICINE CHECK</span>
                <span>CARE STEPS</span>
                <span>VISIT NOTES</span>
              </div>
              <div className="mg-door-action">
                <span>{isLoggedIn ? 'OPEN PATIENT PORTAL' : 'INITIALIZE PATIENT CHECK'}</span>
                <ArrowRight size={18} />
              </div>
            </div>
          </div>

          {/* Bottom Monograph Colophon Link to How It Works */}
          <div className="mg-colophon-strip">
            <div>
              <span className="mg-kicker">CASE MONOGRAPH // 0417</span>
               <p>See how one case moves from intake to a supported result.</p>
            </div>
            <button type="button" className="mg-btn-ruled" onClick={onHowItWorks}>
              <span>READ THE CASE 0417 MONOGRAPH</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
