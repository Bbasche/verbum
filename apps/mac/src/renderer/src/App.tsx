import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState
} from "react";

import {
  busEvents,
  graphEdges,
  graphNodes,
  inboxThread,
  messageFeed,
  onboardingSteps,
  searchDocuments,
  sessions,
  sourceDescriptors,
  terminalSnapshots
} from "./demo-data";
import { MessageRenderer } from "./MessageRenderer";
import type { AppMessage, SourceDescriptor } from "./message-schema";

type SearchCitation = (typeof searchDocuments)[number];

function scoreDocument(query: string, document: SearchCitation): number {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const haystack = `${document.title} ${document.kind} ${document.tags.join(" ")} ${document.excerpt}`.toLowerCase();
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 2 : 0), 0);
}

function answerQuery(query: string): { summary: string; citations: SearchCitation[] } {
  const citations = [...searchDocuments]
    .map((document) => ({ document, score: scoreDocument(query, document) }))
    .sort((left, right) => right.score - left.score)
    .filter((entry) => entry.score > 0)
    .slice(0, 3)
    .map((entry) => entry.document);

  if (citations.length === 0) {
    return {
      summary:
        "Verbum App still centers the same answer: it is the native layer above Claude Code, Codex, and your terminals, with search and inbox stitched into the graph.",
      citations: searchDocuments.slice(0, 2)
    };
  }

  return {
    summary: citations.map((citation) => citation.excerpt).join(" "),
    citations
  };
}

export function App() {
  const [selectedId, setSelectedId] = useState("verbum-app");
  const [query, setQuery] = useState("How does the app orchestrate Claude Code, Codex, and terminals?");
  const [pulseIndex, setPulseIndex] = useState(0);
  const [routeTo, setRouteTo] = useState("claude-code");
  const [composerValue, setComposerValue] = useState(
    "Summarize the latest build result and route the fix to Claude Code."
  );
  const [searchTurns, setSearchTurns] = useState<
    Array<{ role: "assistant" | "user"; content: string; citations?: SearchCitation[] }>
  >(() => {
    const answer = answerQuery("How does the app orchestrate Claude Code, Codex, and terminals?");
    return [{ role: "assistant", content: answer.summary, citations: answer.citations }];
  });
  const [feed, setFeed] = useState<AppMessage[]>([...messageFeed]);

  const deferredQuery = useDeferredValue(query);
  const selectedNode = graphNodes.find((node) => node.id === selectedId) ?? graphNodes[0];
  const selectedSource =
    sourceDescriptors.find((descriptor) => descriptor.id === selectedId) ?? sourceDescriptors[0];
  const liveMatches = [...searchDocuments]
    .map((document) => ({ document, score: scoreDocument(deferredQuery, document) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const tickPulse = useEffectEvent(() => {
    setPulseIndex((current) => (current + 1) % graphEdges.length);
  });

  useEffect(() => {
    const interval = window.setInterval(() => tickPulse(), 1700);
    return () => window.clearInterval(interval);
  }, [tickPulse]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Verbum App</span>
          <h1>The god-view of every conversation on your machine.</h1>
        </div>
        <div className="topbar-metrics">
          <span>macOS desktop app</span>
          <span>{sessions.length} live sessions</span>
          <span>19 edges/min</span>
        </div>
      </header>

      <div className="bus-strip">
        <div className="bus-marquee">
          {[...busEvents, ...busEvents].map((event, index) => (
            <span className="bus-pill" key={`${event}-${index}`}>
              {event}
            </span>
          ))}
        </div>
      </div>

      <div className="workspace">
        <aside className="sidebar panel">
          <div className="panel-head">
            <span className="eyebrow">Start Here</span>
            <p>Friendly enough for first-time users, typed enough for engineers to extend.</p>
          </div>
          <ol className="onboarding-list">
            {onboardingSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="panel-head">
            <span className="eyebrow">Sources</span>
            <p>Companion app today, replacement interface when you want it.</p>
          </div>
          <div className="session-list">
            {sourceDescriptors.map((source: SourceDescriptor) => (
              <button
                className={`session-card ${source.id === selectedId ? "session-card-active" : ""}`}
                key={source.id}
                onClick={() => setSelectedId(source.id)}
                type="button"
              >
                <strong>{source.name}</strong>
                <span>{source.mode}</span>
                <p>{source.subtitle}</p>
                <small>{source.typing}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="center-column">
          <section className="panel graph-panel">
            <div className="panel-head panel-head-inline">
              <div>
                <span className="eyebrow">Conversation Graph</span>
                <p>Claude Code, Codex, search, inbox, and terminals in one live constellation.</p>
              </div>
              <span className="status-pill">Active edge {pulseIndex + 1}</span>
            </div>

            <div className="graph-stage">
              <svg className="graph-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {graphEdges.map((edge, index) => {
                  const from = graphNodes.find((node) => node.id === edge.from);
                  const to = graphNodes.find((node) => node.id === edge.to);

                  if (!from || !to) {
                    return null;
                  }

                  const curve = `M ${from.x} ${from.y} C ${from.x} ${(from.y + to.y) / 2 - 12}, ${to.x} ${(from.y + to.y) / 2 + 12}, ${to.x} ${to.y}`;
                  return (
                    <path
                      className={index === pulseIndex ? "graph-path graph-path-active" : "graph-path"}
                      d={curve}
                      key={`${edge.from}-${edge.to}`}
                    />
                  );
                })}
              </svg>

              {graphNodes.map((node) => (
                <button
                  className={`graph-node graph-node-${node.type} ${
                    node.id === selectedId ? "graph-node-active" : ""
                  }`}
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    transform: `translate(-50%, -50%) translateZ(${node.z}px)`
                  }}
                  type="button"
                >
                  <strong>{node.label}</strong>
                  <span>{node.type}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel terminal-panel">
            <div className="panel-head panel-head-inline">
              <div>
                <span className="eyebrow">Message Feed</span>
                <p>Claude Code, Codex, terminals, humans, and custom sources all render in one thread.</p>
              </div>
              <span className="status-pill">{feed.length} typed messages</span>
            </div>
            <div className="composer">
              <select onChange={(event) => setRouteTo(event.target.value)} value={routeTo}>
                {sourceDescriptors.map((source) => (
                  <option key={source.id} value={source.id}>
                    Route to {source.name}
                  </option>
                ))}
              </select>
              <input
                onChange={(event) => setComposerValue(event.target.value)}
                value={composerValue}
              />
              <button
                onClick={() => {
                  const content = composerValue.trim();
                  if (!content) {
                    return;
                  }

                  const source = sourceDescriptors.find((descriptor) => descriptor.id === routeTo);
                  if (!source) {
                    return;
                  }

                  startTransition(() => {
                    setFeed((current) => [
                      {
                        id: `user-${current.length + 1}`,
                        sourceId: "inbox",
                        sourceLabel: "Inbox",
                        sourceKind: "human",
                        role: "user",
                        title: "Routed message",
                        timestamp: "Now",
                        blocks: [{ type: "markdown", text: content }]
                      },
                      {
                        id: `system-${current.length + 2}`,
                        sourceId: source.id,
                        sourceLabel: source.name,
                        sourceKind: source.kind,
                        role: "system",
                        title: "Route accepted",
                        timestamp: "Now",
                        blocks: [
                          {
                            type: "status-list",
                            items: [
                              { label: "Destination", value: source.name },
                              { label: "Mode", value: source.mode },
                              { label: "Typed blocks", value: source.typing }
                            ]
                          }
                        ]
                      },
                      ...current
                    ]);
                  });
                }}
                type="button"
              >
                Send
              </button>
            </div>
            <div className="message-feed">
              {feed.map((message) => (
                <MessageRenderer key={message.id} message={message} />
              ))}
            </div>
            <div className="terminal-grid">
              {terminalSnapshots.map((terminal) => (
                <article className="terminal-card" key={terminal.title}>
                  <strong>{terminal.title}</strong>
                  <pre>{terminal.lines.join("\n")}</pre>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="right-column">
          <section className="panel inspector-panel">
            <div className="panel-head">
              <span className="eyebrow">Inspector</span>
              <h2>{selectedNode.label}</h2>
              <p>{selectedNode.detail}</p>
            </div>
            <div className="inspector-metrics">
              <div>
                <span>Selected Source</span>
                <strong>{selectedSource.name}</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>{selectedSource.mode}</strong>
              </div>
              <div>
                <span>Typed Support</span>
                <strong>{selectedSource.typing}</strong>
              </div>
            </div>
            <div className="thread">
              {inboxThread.map((entry) => (
                <article className="thread-item" key={`${entry.author}-${entry.route}`}>
                  <strong>{entry.author}</strong>
                  <span>{entry.route}</span>
                  <p>{entry.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel search-panel">
            <div className="panel-head">
              <span className="eyebrow">Conversational Search</span>
              <p>Fast, local, and grounded in the launch docs.</p>
            </div>
            <form
              className="search-form"
              onSubmit={(event) => {
                event.preventDefault();
                const question = query.trim();
                if (!question) {
                  return;
                }

                const answer = answerQuery(question);
                startTransition(() => {
                  setSearchTurns((current) => [
                    ...current,
                    { role: "user", content: question },
                    { role: "assistant", content: answer.summary, citations: answer.citations }
                  ]);
                });
              }}
            >
              <input
                className="search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask about the launch story"
                value={query}
              />
              <button className="search-button" type="submit">
                Ask
              </button>
            </form>

            <div className="chip-row">
              {[
                "Why is this better than a dashboard?",
                "How do terminals appear in the app?",
                "Why skip collaboration for launch?"
              ].map((chip) => (
                <button className="chip" key={chip} onClick={() => setQuery(chip)} type="button">
                  {chip}
                </button>
              ))}
            </div>

            <div className="search-log">
              {searchTurns.map((turn, index) => (
                <article className={`search-turn search-turn-${turn.role}`} key={`${turn.role}-${index}`}>
                  <span>{turn.role === "user" ? "You" : "Verbum Search"}</span>
                  <p>{turn.content}</p>
                  {turn.citations ? (
                    <div className="citation-row">
                      {turn.citations.map((citation) => (
                        <b className="citation" key={citation.id}>
                          {citation.kind}: {citation.title}
                        </b>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="live-matches">
              <strong>Live matches</strong>
              <ul>
                {liveMatches.map(({ document, score }) => (
                  <li key={document.id}>
                    <span>
                      {document.title} · {score}
                    </span>
                    <p>{document.excerpt}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="custom-source-card">
              <strong>Bring your own source</strong>
              <p>
                If another system can emit typed message blocks, Verbum can render it beside Claude Code
                and Codex without a custom one-off pane.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
