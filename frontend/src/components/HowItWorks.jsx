import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * How MedGraph Works — the case document.
 *
 * A long-form explainer that works a single clinical case in front of the reader
 * rather than describing the product in feature blocks. The case is the real one the
 * backend ships as its canonical test: 65M on warfarin and aspirin presenting
 * with chest pain. The drug interaction short-circuits the pipeline before the
 * model is consulted (see backend/agents/orchestrator.py route_after_graph), so
 * the document short-circuits too.
 *
 * Motion is GSAP throughout; the console uses Motion. One library per tree.
 * All of it runs inside gsap.matchMedia() keyed on prefers-reduced-motion, and
 * the CSS carries finished-state fallbacks so nothing depends on JS to be legible.
 */

const DIFFERENTIALS = [
  { name: 'Medication interaction hazard', src: 'RxNav · AHA/ACC antithrombotic', score: 1.0 },
  { name: 'STEMI', src: 'AHA/ACC 2021 · guideline 1, 3', score: 0.87 },
  { name: 'Unstable angina', src: 'AHA/ACC 2021 · guideline 1, 4', score: 0.71 },
  { name: 'Aortic dissection', src: 'AHA/ACC 2022 · guideline 6, 8', score: 0.34 },
];

export default function HowItWorks({ isLoggedIn, onEnterWorkspace, onLogin, onRegister }) {
  const root = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        /* Reading progress */
        gsap.to('.doc-progress', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        });

        /* Masthead and intake settle on load */
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('.doc-masthead', { y: 16, opacity: 0, duration: 0.7 })
          .from('.doc-intake dd, .doc-intake dt', { opacity: 0, duration: 0.5, stagger: 0.05 }, '-=0.35');

        /* Entity resolution: the patient's words get struck and rewritten
           in clinical vocabulary as the reader reaches them. */
        gsap.utils.toArray('.term').forEach((term) => {
          const strike = term.querySelector('.term-strike');
          const canon = term.querySelector('.term-canon');
          gsap
            .timeline({ scrollTrigger: { trigger: term, start: 'top 78%', once: true } })
            .to(strike, { scaleX: 1, duration: 0.35, ease: 'power2.inOut' })
            .to(canon, { opacity: 1, duration: 0.3, ease: 'power2.out' }, '-=0.1');
        });

        /* Prose movements rise as they enter */
        gsap.utils.toArray('[data-rise]').forEach((el) => {
          gsap.from(el, {
            y: 20,
            opacity: 0,
            duration: 0.65,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          });
        });

        /* The halt. The rule draws across, then the trace prints line by line. */
        gsap
          .timeline({ scrollTrigger: { trigger: '.doc-halt', start: 'top 68%', once: true } })
          .to('.doc-halt-rule', { scaleX: 1, duration: 0.7, ease: 'power3.inOut' })
          .from('.doc-halt-tag', { opacity: 0, duration: 0.3 }, '-=0.3')
          .from('.doc-halt h2', { y: 24, opacity: 0, duration: 0.7 }, '-=0.15')
          .from('.doc-halt-drug', { opacity: 0, y: 10, duration: 0.4, stagger: 0.12 }, '-=0.35')
          .from('.doc-halt-verdict', { opacity: 0, duration: 0.4 }, '-=0.1')
          .from('.doc-halt-body', { opacity: 0, y: 12, duration: 0.5 }, '-=0.25')
          .from('.doc-halt-trace span', { opacity: 0, duration: 0.25, stagger: 0.09 }, '-=0.2');

        /* Confidence bars draw to their score */
        gsap.utils.toArray('.dx-bar i').forEach((bar) => {
          gsap.to(bar, {
            scaleX: bar.dataset.score,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: bar, start: 'top 90%', once: true },
          });
        });

        /* Differential rows settle in order */
        gsap.from('.doc-dx tbody tr', {
          opacity: 0,
          y: 14,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.doc-dx', start: 'top 82%', once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <main className="doc" ref={root}>
      <div className="doc-progress" />

      {/* ---------- Masthead ---------- */}
      <div className="doc-page">
        <div className="doc-margin" />
        <div className="doc-body">
          <header className="doc-masthead">
            <div className="doc-masthead-row">
              <h1>
                A case, <em>worked</em>
              </h1>
              <span className="doc-stamp">MedGraph · case 0417</span>
            </div>
          </header>

          {/* ---------- Intake ---------- */}
          <section className="doc-intake">
            <dl>
              <dt>Patient</dt>
              <dd>65, male</dd>

              <dt>Presenting</dt>
              <dd>
                <span className="term">
                  <span className="term-raw">
                    chest pressure
                    <span className="term-strike" />
                  </span>
                  <span className="term-canon">chest pain</span>
                </span>
                , jaw pain,{' '}
                <span className="term">
                  <span className="term-raw">
                    sweating
                    <span className="term-strike" />
                  </span>
                  <span className="term-canon">diaphoresis</span>
                </span>
              </dd>

              <dt>Medications</dt>
              <dd>Warfarin 5mg daily, Aspirin 81mg daily</dd>

              <dt>History</dt>
              <dd>Atrial fibrillation, hypertension</dd>
            </dl>
          </section>
        </div>
      </div>

      {/* ---------- Movement 1: resolution ---------- */}
      <div className="doc-page">
        <aside className="doc-margin">
          <div className="doc-note doc-sticky">
            <span className="doc-note-label">Resolved against</span>
            RxNav clinical vocabularies and the Columbia symptom set. Only canonical
            terms have edges in the graph.
            <cite>entity_linker.py</cite>
          </div>
        </aside>
        <div className="doc-body">
          <section className="doc-move" data-rise>
            <h2>The patient does not speak in ontologies</h2>
            <p>
              Intake arrives as prose. Someone reports pressure in their chest and a
              sweat they cannot explain, and none of those words are keys in a
              knowledge graph. Before anything can be retrieved, the language has to
              be reconciled with the vocabulary the data was indexed under.
            </p>
            <p>
              That reconciliation is unglamorous and load-bearing. Miss it and the
              graph returns nothing, the retriever returns noise, and the model
              confabulates over the gap without ever signalling that it did.
            </p>
          </section>
        </div>
      </div>

      {/* ---------- Movement 2: the graph ---------- */}
      <div className="doc-page">
        <aside className="doc-margin">
          <div className="doc-note doc-sticky">
            <span className="doc-note-label">Query</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', lineHeight: 1.8 }}>
              MATCH (a:Drug)-[r:INTERACTS_WITH]-&gt;(b:Drug)
              <br />
              WHERE a.name IN $meds
              <br />
              RETURN r.severity
            </span>
            <cite>graph/client.py</cite>
          </div>
        </aside>
        <div className="doc-body">
          <section className="doc-move" data-rise>
            <h2>
              Two medications, <em>one edge between them</em>
            </h2>
            <p>
              With the terms resolved, the medication list goes to the graph before it
              goes anywhere near a language model. Warfarin and aspirin are both
              present. In a graph seeded from NIH RxNav, they are not two independent
              facts. They are two nodes with a typed edge between them, and that edge
              carries a severity.
            </p>
          </section>
        </div>
      </div>

      {/* ---------- The halt ---------- */}
      <section className="doc-halt">
        <div className="doc-halt-inner">
          <div className="doc-halt-rule" />
          <span className="doc-halt-tag">Reasoning halted</span>
          <h2>
            The pipeline stops <em>here</em>
          </h2>

          <div className="doc-halt-pair">
            <span className="doc-halt-drug">Warfarin</span>
            <span className="doc-halt-op">+</span>
            <span className="doc-halt-drug">Aspirin</span>
            <span className="doc-halt-verdict">Severity: high</span>
          </div>

          <p className="doc-halt-body">
            Anticoagulant and antiplatelet together, synergistic bleeding risk. This is
            a graph lookup, not an inference, so there is nothing for the model to be
            uncertain about and no reason to spend a generation call before saying so.
            The orchestrator routes straight to an alert and returns.
          </p>

          <div className="doc-halt-trace">
            <span className="ok">resolve_clinical_entities ok 4 terms</span>
            <span className="ok">query_knowledge_graph ok 1 interaction</span>
            <span className="stop">critical_interaction_flag true</span>
            <span className="stop">route_after_graph alert_early</span>
            <span>retrieve_guidelines skipped</span>
            <span>llm_reasoning skipped</span>
          </div>
        </div>
      </section>

      {/* ---------- Movement 3: evidence ---------- */}
      <div className="doc-page">
        <aside className="doc-margin">
          <div className="doc-note doc-sticky">
            <span className="doc-note-label">Retrieved</span>
            <span className="doc-note-quote">
              Concurrent anticoagulant and antiplatelet therapy substantially increases
              the risk of major haemorrhage and should be limited to patients with a
              clear indication.
            </span>
            <cite>AHA/ACC · guideline 10</cite>
          </div>
        </aside>
        <div className="doc-body">
          <section className="doc-move" data-rise>
            <h2>Every claim carries its source</h2>
            <p>
              The alert does not travel alone. Guideline text is retrieved for the
              interaction and attached to the finding, and each citation the system
              emits is checked against the passages actually pulled for this request.
              References that cannot be matched are removed and the report is flagged
              rather than quietly shipped.
            </p>
            <p>
              This is the part that matters. A model that cites nothing can be doubted.
              A model that cites something it invented cannot, and that is the failure
              mode worth engineering against.
            </p>
          </section>
        </div>
      </div>

      {/* ---------- Differential ---------- */}
      <div className="doc-page">
        <aside className="doc-margin">
          <div className="doc-note doc-sticky">
            <span className="doc-note-label">Note</span>
            Ranking below reflects the halted path. Cardiac differentials are carried
            forward for the clinician but were not model-generated on this run.
          </div>
        </aside>
        <div className="doc-body">
          <section className="doc-move" data-rise>
            <h2>What comes back</h2>
            <table className="doc-dx">
              <caption>Ranked differential · case 0417</caption>
              <thead>
                <tr>
                  <th scope="col">Finding</th>
                  <th scope="col">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {DIFFERENTIALS.map((d) => (
                  <tr key={d.name}>
                    <td>
                      <span className="dx-name">{d.name}</span>
                      <span className="dx-src">{d.src}</span>
                    </td>
                    <td>
                      <span className="dx-score">{d.score.toFixed(2)}</span>
                      <span className="dx-bar">
                        <i data-score={d.score} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {/* ---------- Close ---------- */}
      <div className="doc-page">
        <aside className="doc-margin" />
        <div className="doc-body">
          <section className="doc-close" data-rise>
            <h2>
              Run a case <em>of your own</em>
            </h2>
            <p>
              Submit a patient profile and the console returns the same apparatus: the
              resolved terms, the graph result, the retrieved evidence, the reasoning
              trace, and every citation checked against what was actually retrieved.
            </p>
            <div className="doc-cta-row">
              {isLoggedIn ? (
                <button className="doc-cta" onClick={onEnterWorkspace}>
                  Enter the console <ArrowRight size={17} />
                </button>
              ) : (
                <>
                  <button className="doc-cta" onClick={onLogin}>
                    Enter the console <ArrowRight size={17} />
                  </button>
                  <button className="doc-cta-secondary" onClick={onRegister}>
                    Create an account
                  </button>
                </>
              )}
            </div>

            <div className="doc-colophon">
              <span>Research prototype. Not a certified medical device.</span>
              <span>Neo4j · Pinecone · SageMaker · FastAPI</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
