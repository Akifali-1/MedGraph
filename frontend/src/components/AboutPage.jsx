import { ArrowRight, BookOpen, GitBranch, Layers, ShieldCheck } from 'lucide-react';
import evaluation from '../data/latest_eval_summary.json';

const PRINCIPLES = [
  { number: '01', title: 'Evidence stays visible', text: 'Returned sources carry their title, type, ID, excerpt, and link into the result.', Icon: BookOpen },
  { number: '02', title: 'Structured checks stay separate', text: 'Medication interactions come from the graph lookup and are shown separately from retrieved text.', Icon: GitBranch },
  { number: '03', title: 'Limits stay visible', text: 'Unavailable services, missing evidence, provisional labels, and blocked measurements remain explicit.', Icon: ShieldCheck },
];

function Metric({ label, children }) {
  return (
    <div className="info-principle">
      <div className="info-eyebrow">{label}</div>
      <p style={{ marginTop: '10px' }}>{children}</p>
    </div>
  );
}

export default function AboutPage({ onHowItWorks, onOpenLibrary, onEnterWorkspace }) {
  const diagnosisMetric = evaluation.diagnosis_metric?.status === 'not_measured'
    ? 'Not measured'
    : `Top-1 ${evaluation.diagnosis_metric?.top1?.correct ?? 0}/${evaluation.diagnosis_metric?.top1?.n ?? 0}`;
  const controls = evaluation.controls || {};
  const interactionStatus = evaluation.interactions?.status || 'not measured';

  return (
    <main className="info-page" aria-labelledby="about-heading">
      <header className="info-hero">
        <div className="info-eyebrow"><span className="info-marker" /> THE PROJECT / 01</div>
        <div className="info-hero-grid">
          <div>
            <h1 id="about-heading">Clinical knowledge.<br /><em>Traceable results.</em></h1>
            <p className="info-lead">MedGraph combines validated intake, structured graph lookups, and indexed sources while showing what the system did and did not find.</p>
            <div className="info-actions">
              <button type="button" className="btn btn-primary" onClick={onEnterWorkspace}>Explore the workspace <ArrowRight size={15} /></button>
              <a className="info-text-link" href="https://github.com/Akifali-1/MedGraph" target="_blank" rel="noopener noreferrer"><GitBranch size={15} /> View the project</a>
            </div>
          </div>
          <aside className="info-project-note" aria-label="Project at a glance">
            <Layers size={25} strokeWidth={1.4} />
            <span className="info-eyebrow">IMPLEMENTED PATH</span>
            <p>Intake is checked.<br />Sources are retrieved.<br />Citations stay attached.</p>
            <dl className="info-facts">
              <div><dt>Graph</dt><dd>Neo4j</dd></div>
              <div><dt>Retrieval</dt><dd>Dense + BM25</dd></div>
              <div><dt>Default route</dt><dd>DAG</dd></div>
            </dl>
          </aside>
        </div>
      </header>

      <section className="info-section" aria-labelledby="does-heading">
        <div className="info-section-label">01 / WHAT IT DOES</div>
        <div className="info-section-body">
          <h2 id="does-heading">A grounded case <em>workspace.</em></h2>
          <p>MedGraph accepts age, sex, symptoms, medications, and comorbidities. It resolves common clinical terms, queries the graph for structured relationships, retrieves indexed guideline chunks, and returns a differential only when indexed guideline evidence is available.</p>
          <p>A medication interaction result is returned as a structured lookup. It is not silently converted into “no interactions found” when Neo4j is unavailable.</p>
        </div>
      </section>

      <section className="info-section" aria-labelledby="works-heading">
        <div className="info-section-label">02 / HOW IT WORKS</div>
        <div className="info-section-body">
          <h2 id="works-heading">One request. Several <em>checks.</em></h2>
          <div className="info-pipeline" aria-label="Intake, normalization, graph and vector retrieval, citation filtering, and reasoning">
            <div><span className="info-eyebrow">01</span><strong>Intake + validation</strong><small>Schema limits and required fields</small></div>
            <ArrowRight size={20} aria-hidden="true" />
            <div><span className="info-eyebrow">02</span><strong>Normalize + retrieve</strong><small>Entity links, Neo4j, vector store, BM25</small></div>
            <ArrowRight size={20} aria-hidden="true" />
            <div><span className="info-eyebrow">03</span><strong>Filter + reason</strong><small>Metadata citations and response status</small></div>
          </div>
          <p>Gemini is the default reasoning model when configured. SageMaker is used only when `SAGEMAKER_ENDPOINT_NAME` is set; it is currently unset. The ReAct route remains opt-in; the default `/diagnose` route is the DAG path.</p>
          <p>If no retrieved chunk passes the retrieval boundary, the response is `no_evidence`, diagnoses is empty, and the exact message is shown. Graph interaction results are still returned. If the graph cannot be reached, the interaction check is marked unavailable.</p>
          <div className="info-actions">
            <button type="button" className="info-text-link" onClick={onHowItWorks}>Read a worked case <ArrowRight size={15} /></button>
            <button type="button" className="info-text-link" onClick={onOpenLibrary}>Browse the evidence library <ArrowRight size={15} /></button>
          </div>
        </div>
      </section>

      <section className="info-section" aria-labelledby="sources-heading">
        <div className="info-section-label">03 / DATA SOURCES</div>
        <div className="info-section-body">
          <h2 id="sources-heading">Attribution and <em>access.</em></h2>
          <div className="info-principles">
            <Metric label="DDInter 2.0">Primary interaction candidate. CC BY-NC-SA 4.0; non-commercial redistribution with attribution and ShareAlike is allowed. Download/schema verification was blocked on 2026-11-02, so the current graph was not replaced.</Metric>
            <Metric label="Columbia disease-symptom">Public source page describing 2004 discharge-summary data. No clear redistribution license was identified. The exposed disease count is documented as a source count; the edge score remains a labeled rank heuristic.</Metric>
            <Metric label="DrugBank + RxNav">DrugBank academic access is license-gated and was not used. The NLM RxNav interaction API was discontinued on January 2, 2024.</Metric>
          </div>
        </div>
      </section>

      <section className="info-section" aria-labelledby="evaluation-heading">
        <div className="info-section-label">04 / EVALUATION</div>
        <div className="info-section-body">
          <h2 id="evaluation-heading">Measured boundaries. <em>Open gaps.</em></h2>
          <div className="info-principles">
            <Metric label="Diagnosis">{evaluation.diagnosis_cases} provisional cases; accuracy {diagnosisMetric}. The case set is underpowered versus the target of 40.</Metric>
            <Metric label="Controls">{controls.no_evidence ?? 0}/{controls.n ?? 0} synthetic controls returned `no_evidence` in the offline HTTP run.</Metric>
            <Metric label="Interactions">{interactionStatus}. Precision/recall and brand/synonym mapping were not measured.</Metric>
          </div>
          <p>Latest summary: <code>{evaluation.summary_path || 'eval/results/latest/summary.json'}</code>. The offline run used deterministic test mode; its latency and control results do not establish clinical accuracy.</p>
        </div>
      </section>

      <section className="info-section" aria-labelledby="limits-heading">
        <div className="info-section-label">05 / LIMITATIONS</div>
        <div className="info-section-body">
          <h2 id="limits-heading">What it does <em>not do.</em></h2>
          <p>MedGraph has not established clinical validity. The current diagnosis labels are provisional, the interaction source replacement is blocked, and Gemini-dependent evaluation was not measured because the provider/API checks failed. Retrieved citations show the source chunk returned; they do not independently prove the cited claim.</p>
          <p className="info-footnote">MedGraph is a research and demonstration prototype, not medical advice. Do not use it as a substitute for a qualified clinician or emergency care.</p>
        </div>
      </section>

      <div className="info-principles" style={{ marginTop: '30px' }}>
        {PRINCIPLES.map(({ number, title, text, Icon }) => (
          <article className="info-principle" key={number}>
            <div className="info-card-top"><span className="info-eyebrow">{number}</span><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
