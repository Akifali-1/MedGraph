import { useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, Search, X } from 'lucide-react';

const SOURCES = [
  { id: 'chest-pain', type: 'Guidelines', publisher: 'AHA / ACC', year: '2021', title: 'Chest pain guidance', description: 'A reference for first steps when someone has acute or stable chest pain.', topics: ['Chest pain', 'Cardiology', 'ECG'], href: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001029' },
  { id: 'aortic-disease', type: 'Guidelines', publisher: 'ACC / AHA', year: '2022', title: 'Aortic disease guidance', description: 'A reference for aortic disease, risk factors, imaging, and urgent care.', topics: ['Aortic disease', 'Imaging', 'Cardiology'], href: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106' },
  { id: 'antithrombotic', type: 'Literature', publisher: 'PubMed', year: 'Research index', title: 'Warfarin and aspirin', description: 'Research on combined blood thinners and bleeding risk.', topics: ['Warfarin', 'Aspirin', 'Drug interactions'], href: 'https://pubmed.ncbi.nlm.nih.gov/?term=warfarin+aspirin+bleeding+risk' },
  { id: 'pubmed', type: 'Literature', publisher: 'National Library of Medicine', year: 'Research index', title: 'PubMed literature', description: 'Search biomedical papers and open the original abstracts.', topics: ['Biomedical research', 'Abstracts', 'Publications'], href: 'https://pubmed.ncbi.nlm.nih.gov/' },
  { id: 'rxnav', type: 'Knowledge graph', publisher: 'National Library of Medicine', year: 'Terminology resource', title: 'RxNav drug names', description: 'Drug names and concepts used to connect medicines to structured knowledge.', topics: ['RxNorm', 'Medications', 'Terminology'], href: 'https://lhncbc.nlm.nih.gov/RxNav/' },
  { id: 'project-data', type: 'Knowledge graph', publisher: 'MedGraph', year: 'Project data', title: 'Graph seed data', description: 'Starter drug-interaction and symptom-disease data used by the project.', topics: ['Neo4j', 'Graph seeds', 'Open source'], href: 'https://github.com/Akifali-1/MedGraph/tree/main/backend/graph' },
];

const FILTERS = ['All sources', 'Guidelines', 'Literature', 'Knowledge graph'];

export default function EvidenceLibraryPage({ onEnterWorkspace }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All sources');
  const search = query.trim().toLowerCase();
  const sources = SOURCES.filter(source => (
    (filter === 'All sources' || source.type === filter)
    && `${source.title} ${source.description} ${source.publisher} ${source.topics.join(' ')}`.toLowerCase().includes(search)
  ));

  const resetFilters = () => { setQuery(''); setFilter('All sources'); };

  return (
    <main className="info-page" aria-labelledby="library-heading">
      <header className="info-hero info-hero-compact">
        <div className="info-eyebrow"><span className="info-marker" /> REFERENCE DESK / 02</div>
        <h1 id="library-heading">Go back to <em>the source.</em></h1>
         <p className="info-lead">Browse the guidelines, papers, and structured data behind MedGraph.</p>
      </header>

      <section className="info-library" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="info-visually-hidden">Browse reference sources</h2>
        <div className="info-library-toolbar">
          <div className="info-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label="Search evidence sources" placeholder="Search a topic, drug, or publisher…" value={query} onChange={event => setQuery(event.target.value)} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
          </div>
          <span className="info-result-count" role="status">{sources.length} {sources.length === 1 ? 'source' : 'sources'}</span>
        </div>
        <div className="info-filters" role="group" aria-label="Filter sources by type">
          {FILTERS.map(item => (
            <button type="button" key={item} className={`info-filter ${filter === item ? 'is-active' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>

        {sources.length ? (
          <div className="info-source-grid">
            {sources.map(source => (
              <article className="info-source-card" key={source.id}>
                <div className="info-card-top"><span className="info-source-type">{source.type}</span><BookOpen size={18} strokeWidth={1.5} aria-hidden="true" /></div>
                <h3>{source.title}</h3>
                <p>{source.description}</p>
                <div className="info-topic-list">{source.topics.map(topic => <span key={topic}>{topic}</span>)}</div>
                <div className="info-source-footer">
                  <span>{source.publisher}<small>{source.year}</small></span>
                  <a className="info-text-link" href={source.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${source.title} in a new tab`}>Open source <ExternalLink size={14} /></a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="info-no-results">
            <Search size={30} strokeWidth={1.3} aria-hidden="true" />
            <h3>No matching sources found.</h3>
             <p>Try a broader topic such as “cardiology” or “medications”, or clear the filters.</p>
            <button type="button" className="btn btn-secondary" onClick={resetFilters}>Clear search and filters</button>
          </div>
        )}
      </section>

      <aside className="info-callout">
         <div><span className="info-eyebrow">ADD A SOURCE</span><h2>Bring your own <em>knowledge.</em></h2><p>Practitioners can add documents from the Uploads tab in the workspace.</p></div>
        <button type="button" className="btn btn-primary" onClick={onEnterWorkspace}>Open workspace <ArrowRight size={15} /></button>
      </aside>
      <p className="info-footnote">This is a curated reference catalog. These links are not patient-specific retrieval results, and listing a source does not mean the full publication is indexed in MedGraph.</p>
    </main>
  );
}
