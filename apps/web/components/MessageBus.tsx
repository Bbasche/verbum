import { messageBusLanes } from "../lib/content";

export function MessageBus() {
  return (
    <section className="panel panel-bus">
      <div className="section-heading">
        <span className="eyebrow">Home Surface</span>
        <h2>The message bus makes the system feel alive.</h2>
        <p>
          Instead of a static dashboard, the home screen is a living stream of actors, terminals, and
          interrupts. It tells the launch story in one glance.
        </p>
      </div>
      <div className="bus">
        {messageBusLanes.map((lane, laneIndex) => (
          <div className="bus-lane" key={lane.label}>
            <div className="bus-label">{lane.label}</div>
            <div className="bus-track">
              <div
                className="bus-marquee"
                style={{ animationDuration: `${18 + laneIndex * 3}s` }}
              >
                {[...lane.items, ...lane.items].map((item, itemIndex) => (
                  <span className="bus-pill" key={`${lane.label}-${item}-${itemIndex}`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
