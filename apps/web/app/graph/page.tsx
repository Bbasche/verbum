import { GraphPreview } from "../../components/GraphPreview";

export default function GraphPage() {
  return (
    <div className="page-stack">
      <section className="panel intro-panel">
        <span className="eyebrow">Verbum App</span>
        <h1>Graph, search, inbox, and message bus in one surface.</h1>
        <p>
          This page is the static overview for the native app. The interactive graph, inbox controls, and
          conversational search live in the Mac app, not on the docs site.
        </p>
      </section>
      <GraphPreview />
    </div>
  );
}
