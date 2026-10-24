import { ArrowRight, BookOpen, GitBranch, Layers, ShieldCheck } from 'lucide-react';

const PRINCIPLES = [
  { number: '01', title: 'Connections first', text: 'Known links between medicines, symptoms, and conditions stay visible.', Icon: GitBranch },
  { number: '02', title: 'Sources first', text: 'Exact matches and related language help find useful medical references.', Icon: BookOpen },
  { number: '03', title: 'Limits stay visible', text: 'Missing sources or services are shown instead of hidden.', Icon: ShieldCheck },
];

export default function AboutPage({ onHowItWorks, onOpenLibrary, onEnterWorkspace }) {
  return (
    <main className="info-page" aria-labelledby="about-heading">
      <header className="info-hero">
        <div className="info-eyebrow"><span className="info-marker" /> THE PROJECT / 01</div>
        <div className="info-hero-grid">
          <div>
            <h1 id="about-heading">Clinical intelligence.<br /><em>A traceable foundation.</em></h1>
             <p className="info-lead">MedGraph brings medical knowledge and useful sources into one workspace, so you can follow each result.</p>
            <div className="info-actions">
              <button type="button" className="btn btn-primary" onClick={onEnterWorkspace}>Explore the workspace <ArrowRight size={15} /></button>
              <a className="info-text-link" href="https://github.com/Akifali-1/MedGraph" target="_blank" rel="noopener noreferrer"><GitBranch size={15} /> View the project</a>
            </div>
          </div>
          <aside className="info-project-note" aria-label="Project at a glance">
            <Layers size={25} strokeWidth={1.4} />
            <span className="info-eyebrow">A CONNECTED APPROACH</span>
             <p>Context starts the case.<br />Connections show the path.<br />Sources support the result.</p>
            <dl className="info-facts">
              <div><dt>Knowledge</dt><dd>Neo4j graph</dd></div>
              <div><dt>Retrieval</dt><dd>Dense + BM25</dd></div>
              <div><dt>Workflow</dt><dd>LangGraph agents</dd></div>
            </dl>
          </aside>
        </div>
      </header>

      <section className="info-section" aria-labelledby="purpose-heading">
        <div className="info-section-label">01 / PURPOSE</div>
        <div className="info-section-body">
          <h2 id="purpose-heading">Make the reasoning <em>readable.</em></h2>
           <p>Medical information often lives in different places. MedGraph brings patient details, known medicine conflicts, and useful references together.</p>
           <p>The goal is simple: make it easier to see how a question connects to its sources and result.</p>
        </div>
      </section>

      <section className="info-section" aria-labelledby="principles-heading">
        <div className="info-section-label">02 / PRINCIPLES</div>
        <div className="info-section-body">
           <h2 id="principles-heading">Built around three <em>ideas.</em></h2>
          <div className="info-principles">
            {PRINCIPLES.map(({ number, title, text, Icon }) => (
              <article className="info-principle" key={number}>
                <div className="info-card-top"><span className="info-eyebrow">{number}</span><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="info-section" aria-labelledby="architecture-heading">
        <div className="info-section-label">03 / UNDER THE HOOD</div>
        <div className="info-section-body">
           <h2 id="architecture-heading">One case. Two source paths.</h2>
          <div className="info-pipeline" aria-label="Patient intake flows into graph and literature retrieval, then analysis">
             <div><span className="info-eyebrow">INPUT</span><strong>Patient details</strong><small>Symptoms · medicines · history</small></div>
            <ArrowRight size={20} aria-hidden="true" />
             <div><span className="info-eyebrow">SOURCES</span><strong>Graph + literature</strong><small>Known links · useful passages</small></div>
            <ArrowRight size={20} aria-hidden="true" />
             <div><span className="info-eyebrow">OUTPUT</span><strong>Case result</strong><small>Findings · sources · next steps</small></div>
          </div>
          <div className="info-actions">
            <button type="button" className="info-text-link" onClick={onHowItWorks}>Read a worked case <ArrowRight size={15} /></button>
            <button type="button" className="info-text-link" onClick={onOpenLibrary}>Browse the evidence library <ArrowRight size={15} /></button>
          </div>
        </div>
      </section>
      <p className="info-footnote">MedGraph is a research and demonstration prototype. Its analysis supports exploration and does not replace professional clinical judgment.</p>
    </main>
  );
}
