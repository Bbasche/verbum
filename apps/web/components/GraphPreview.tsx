import { graphEdges, graphNodes, inboxTranscript, searchDocuments } from "../lib/content";

export function GraphPreview() {
  const featuredNode = graphNodes[0];
  const featuredCitations = searchDocuments.slice(0, 3);

  return (
    <div className="graph-studio">
      <section className="panel panel-graph">
        <div className="panel-topline">
          <span className="eyebrow">Native App Preview</span>
          <span className="badge-live">Mac app surface</span>
        </div>
        <div className="graph-shell">
          <svg className="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {graphEdges.map((edge) => {
              const from = graphNodes.find((node) => node.id === edge.from);
              const to = graphNodes.find((node) => node.id === edge.to);

              if (!from || !to) {
                return null;
              }

              const curve = `M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2 - 10}, ${to.x} ${(from.y + to.y) / 2 + 10}, ${to.x} ${to.y}`;
              return <path d={curve} key={`${edge.from}-${edge.to}`} />;
            })}
          </svg>
          {graphNodes.map((node) => (
            <div
              className={`graph-node graph-node-${node.type} ${
                node.id === featuredNode.id ? "graph-node-active" : ""
              }`}
              key={node.id}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) translateZ(${node.z}px)`
              }}
            >
              <strong>{node.label}</strong>
              <span>{node.type}</span>
            </div>
          ))}
          <div className="graph-hud">
            <span>7 nodes</span>
            <span>19 live edges/min</span>
            <span>Native search</span>
          </div>
        </div>
        <div className="inspector-grid">
          <div className="inspector-card">
            <span className="eyebrow">Inspector</span>
            <h3>{featuredNode.label}</h3>
            <p>{featuredNode.detail}</p>
          </div>
          <div className="inspector-card">
            <span className="eyebrow">Inbox</span>
            <ul className="transcript">
              {inboxTranscript.map((entry) => (
                <li key={`${entry.speaker}-${entry.route}`}>
                  <strong>{entry.speaker}</strong>
                  <span>{entry.route}</span>
                  <p>{entry.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel panel-search">
        <div className="section-heading">
          <span className="eyebrow">Native Search</span>
          <h2>Conversational search lives in the Mac app.</h2>
          <p>
            The docs site stays static. The native app is where fast local search, live graph inspection,
            and inbox orchestration happen.
          </p>
        </div>

        <div className="search-layout">
          <div className="conversation-log">
            <article className="turn turn-user">
              <span className="turn-role">Founder</span>
              <p>How does Verbum orchestrate Claude Code, Codex, and multiple terminals?</p>
            </article>
            <article className="turn turn-assistant">
              <span className="turn-role">Verbum Search</span>
              <p>
                Verbum App sits above Claude Code, Codex, and PTY terminals. It does not replace them. It
                makes them visible in one command center, then uses local retrieval to answer from docs,
                traces, and launch materials.
              </p>
              <div className="citation-row">
                {featuredCitations.map((citation) => (
                  <span className="citation" key={citation.id}>
                    {citation.kind}: {citation.title}
                  </span>
                ))}
              </div>
            </article>
          </div>

          <aside className="result-rail">
            <h3>What the native app adds</h3>
            <ul>
              <li>
                <strong>Live graph</strong>
                <span>Claude Code, Codex, inbox, and terminals together</span>
                <p>The app makes the whole machine legible in one observatory-style view.</p>
              </li>
              <li>
                <strong>Conversational search</strong>
                <span>Local-first and instant</span>
                <p>Answers are grounded in docs, session traces, and your launch assets.</p>
              </li>
              <li>
                <strong>Unified inbox</strong>
                <span>Human interrupts stay inside the graph</span>
                <p>Route the next message to Claude Code, Codex, or any terminal-aware flow.</p>
              </li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
