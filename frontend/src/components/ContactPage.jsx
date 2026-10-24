import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, GitBranch, MessageSquare } from 'lucide-react';

const FAQS = [
  { question: 'Where should I report a bug?', answer: 'Choose “Bug report” and include what you searched for, what you expected, and what happened.' },
  { question: 'Can I suggest a source?', answer: 'Yes. Choose “Evidence or dataset” and include the publisher and a link.' },
  { question: 'How do I run the project locally?', answer: 'The README has the setup steps and local server commands.' },
];

export default function ContactPage() {
  const [topic, setTopic] = useState('Bug report');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [prepared, setPrepared] = useState(false);
  const [copyState, setCopyState] = useState('');
  const body = `## ${topic}\n\n${details.trim()}\n\n---\nPrepared from the MedGraph project contact page.`;
  const issueUrl = `https://github.com/Akifali-1/MedGraph/issues/new?${new URLSearchParams({ title: `[${topic}] ${summary.trim()}`, body })}`;

  const prepareIssue = event => {
    event.preventDefault();
    setPrepared(true);
    setCopyState('');
  };

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(`${summary.trim()}\n\n${body}`);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <main className="info-page" aria-labelledby="contact-heading">
      <header className="info-hero info-hero-compact">
        <div className="info-eyebrow"><span className="info-marker" /> OPEN A CONVERSATION / 03</div>
        <h1 id="contact-heading">Better questions.<br /><em>A better MedGraph.</em></h1>
         <p className="info-lead">Found a bug or have an idea? Send a clear note to help improve the project.</p>
      </header>

      <div className="info-contact-grid">
        <section className="info-contact-form" aria-labelledby="feedback-heading">
          <div className="info-card-top"><span className="info-eyebrow">PROJECT FEEDBACK</span><MessageSquare size={20} strokeWidth={1.5} aria-hidden="true" /></div>
          <h2 id="feedback-heading">Write a project <em>note.</em></h2>
           <p>Prepare a note here, then open it in GitHub.</p>
          <form onSubmit={prepareIssue} onChange={() => { setPrepared(false); setCopyState(''); }}>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-topic">What would you like to discuss?</label>
              <select className="form-select" id="contact-topic" value={topic} onChange={event => setTopic(event.target.value)}>
                <option>Bug report</option><option>Feature idea</option><option>Evidence or dataset</option><option>Project question</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-summary">Short summary</label>
              <input className="form-input" id="contact-summary" required minLength={5} maxLength={120} placeholder="e.g. An unrelated guideline appears for an empty search" value={summary} onChange={event => setSummary(event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contact-details">Details and steps to reproduce</label>
              <textarea className="form-input info-textarea" id="contact-details" required minLength={15} maxLength={1800} rows={6} placeholder="What did you try? What did you expect? What happened instead?" value={details} onChange={event => setDetails(event.target.value)} />
              <span className="info-field-note">{details.length} / 1800 characters · Use example data when describing a case.</span>
            </div>
            <button type="submit" className="btn btn-primary">Prepare GitHub issue <ArrowRight size={15} /></button>
          </form>

          {prepared && (
            <div className="info-draft" role="status">
              <span className="info-eyebrow"><Check size={14} /> DRAFT READY</span>
             <p>Your draft is ready. Review it on GitHub before submitting.</p>
              <div className="info-actions">
                <a className="btn btn-primary" href={issueUrl} target="_blank" rel="noopener noreferrer">Open issue draft <ExternalLink size={14} /></a>
                <button type="button" className="btn btn-secondary" onClick={copyDraft}><Copy size={14} /> {copyState === 'copied' ? 'Copied' : 'Copy draft'}</button>
              </div>
              {copyState === 'error' && <p>Clipboard access is unavailable. You can still open the issue draft on GitHub.</p>}
            </div>
          )}
        </section>

        <aside className="info-contact-aside">
          <span className="info-eyebrow">BUILT IN THE OPEN</span>
          <h2>Start with <em>the code.</em></h2>
           <p>Explore the code, see open issues, or contribute a change.</p>
          <a className="info-text-link" href="https://github.com/Akifali-1/MedGraph" target="_blank" rel="noopener noreferrer"><GitBranch size={16} /> Project repository <ExternalLink size={13} /></a>
          <a className="info-text-link" href="https://github.com/Akifali-1/MedGraph/issues" target="_blank" rel="noopener noreferrer"><MessageSquare size={16} /> Browse existing issues <ExternalLink size={13} /></a>
          <div className="info-faq">
               <span className="info-eyebrow">QUICK ANSWERS</span>
            {FAQS.map(({ question, answer }) => (
              <details key={question}><summary>{question}<ChevronDown size={16} aria-hidden="true" /></summary><p>{answer}</p></details>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
