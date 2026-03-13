import { launchChecklist, quickstartCode } from "../../lib/content";

export default function DocsPage() {
  return (
    <div className="page-stack">
      <section className="panel intro-panel">
        <span className="eyebrow">Docs</span>
        <h1>Ship the local orchestration story first.</h1>
        <p>
          Verbum launches as the framework and command center for single-machine orchestration. That is
          already a huge story: models, terminals, memory, tools, and humans all visible in one graph.
        </p>
      </section>

      <section className="panel panel-code">
        <div className="section-heading">
          <span className="eyebrow">Install</span>
          <h2>`npm install verbum`</h2>
          <p>
            The package exports the Router, built-in actors, message helpers, and a scripted model adapter
            so you can stand up flows quickly before wiring provider SDKs.
          </p>
        </div>
        <pre>
          <code>{quickstartCode}</code>
        </pre>
      </section>

      <section className="panel">
        <div className="section-heading">
          <span className="eyebrow">What You Get</span>
          <h2>Framework, observability, and launch assets.</h2>
        </div>
        <ul className="docs-list">
          <li>Router with recursive dispatch, conversation storage, and graph visualization data.</li>
          <li>Built-in ToolActor, MemoryActor, HumanActor, ProcessActor, and pluggable ModelActor.</li>
          <li>Next.js launch site with the product narrative, docs, and a static native-app overview.</li>
          <li>Release automation, CI, CONTRIBUTING guide, and weekend launch checklist.</li>
        </ul>
      </section>

      <section className="panel">
        <div className="section-heading">
          <span className="eyebrow">Roadmap Honesty</span>
          <h2>P2P stays next.</h2>
        </div>
        <p>
          Collaboration and mesh networking belong in the roadmap, not in the weekend launch copy. The
          local orchestration thesis is strong enough on its own and will make the future network story
          easier to believe.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <span className="eyebrow">Launch Steps</span>
          <h2>After cloning the repo.</h2>
        </div>
        <ol className="checklist">
          {launchChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
