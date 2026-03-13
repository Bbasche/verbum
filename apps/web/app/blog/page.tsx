import Link from "next/link";

export default function BlogPage() {
  return (
    <>
      <header>
        <div className="hinner">
          <Link href="/" className="wordmark">
            <img alt="Verbum" className="wordmark-image" src="/brand/verbum-logo-light.png" />
          </Link>
          <nav>
            <Link href="/">Home</Link>
            <Link href="/docs">Docs</Link>
            <a href="https://github.com/Bbasche/verbum-ai" className="ncta">
              GitHub &rarr;
            </a>
          </nav>
        </div>
      </header>

      <section className="docs-hero">
        <div className="container">
          <p className="hlabel">Blog</p>
          <h1>
            Messages all the
            <br />
            way <em>down.</em>
          </h1>
          <p className="hsub">
            On the design of Verbum, the actor model for AI systems, and where this
            kind of thinking leads.
          </p>
        </div>
      </section>

      <article className="blog-article">
        <div className="container">
          <div className="blog-meta">
            <span>March 2026</span>
            <span className="blog-sep">/</span>
            <span>Ben Basche</span>
          </div>

          <h2>The problem with &ldquo;tool use&rdquo;</h2>

          <p>
            Every agentic framework starts the same way. You have a model. You give it
            tools. The model calls the tools. You stitch the results back in. Ship it.
          </p>

          <p>
            This works until you need to watch it happen. Or replay what happened
            yesterday. Or hand control to a person mid-flow. Or swap the model. Or
            fork the run and explore an alternative. Suddenly you are fighting the
            abstraction instead of building on top of it.
          </p>

          <p>
            The issue is that &ldquo;tool use&rdquo; is an implementation detail
            masquerading as a first principle. It describes <em>how</em> a model
            executes side effects, not <em>what</em> the system is doing at a semantic
            level. And the moment you need to reason about the system as a whole, that
            distinction matters.
          </p>

          <h2>Actors and messages</h2>

          <p>
            Verbum starts from a different abstraction: <strong>every participant is an
            Actor, and every interaction is a Message.</strong>
          </p>

          <p>
            An Actor is anything that can receive a message, do some work, and
            optionally return one or more messages. A language model is an Actor. A
            shell session is an Actor. An MCP server is an Actor. A human sitting at a
            keyboard is an Actor. A vector-backed memory store is an Actor.
          </p>

          <p>
            The Router is the only piece that knows about all of them. When an Actor
            produces a message addressed to another Actor, the Router delivers it,
            records it, and recurses. The entire run becomes a directed graph of typed,
            structured messages. Not log lines. Not trace IDs. Messages you can read,
            replay, fork, and query.
          </p>

          <blockquote>
            If every part of your system speaks the same language, you get
            observability, replayability, and composability for free.
          </blockquote>

          <h2>The seven primitives</h2>

          <p>
            Verbum ships with seven actor types. Each one maps to a real thing you
            already use:
          </p>

          <div className="blog-primitives">
            <div className="blog-prim">
              <strong>ModelActor</strong>
              <span>
                Any LLM wrapped uniformly behind a pluggable adapter. Swap Anthropic
                for OpenAI or Ollama in one line. The conversation context belongs to
                the Router, not the provider.
              </span>
            </div>
            <div className="blog-prim">
              <strong>ProcessActor</strong>
              <span>
                A persistent shell session. Send it a command, get back stdout. The
                shell is not a tool the model calls&mdash;it is a participant in the
                conversation with its own history.
              </span>
            </div>
            <div className="blog-prim">
              <strong>MCPActor</strong>
              <span>
                Speaks the Model Context Protocol natively. Connect to any MCP server
                over stdio or SSE and auto-discover its capabilities.
              </span>
            </div>
            <div className="blog-prim">
              <strong>ToolActor</strong>
              <span>
                Deterministic functions and API wrappers that can also initiate
                conversations, not just respond to them.
              </span>
            </div>
            <div className="blog-prim">
              <strong>HumanActor</strong>
              <span>
                A real person is just another actor. Pause any flow, inject a human
                response, resume. The model never knows the difference.
              </span>
            </div>
            <div className="blog-prim">
              <strong>MemoryActor</strong>
              <span>
                Persistent context that participates in conversation. Ask it anything
                and it responds like any other actor, backed by SQLite, vectors, or
                plain JSONL.
              </span>
            </div>
            <div className="blog-prim">
              <strong>Router</strong>
              <span>
                The runtime. Dispatches messages, records every hop, enforces depth
                limits, and exposes the full run as a readable, forkable graph.
              </span>
            </div>
          </div>

          <p>
            The critical insight is that all seven share the same interface. Register
            an actor, give it an ID, and the Router handles everything else. A system
            with one model and one shell uses the same API as a system with six models,
            four MCP servers, and a human in the loop.
          </p>

          <h2>What you get for free</h2>

          <p>
            When every interaction is a structured message flowing through a central
            router, several things fall out naturally:
          </p>

          <p>
            <strong>Observability by construction.</strong> There is no instrumentation
            step. Every message is already recorded with its sender, recipient,
            content, and position in the conversation graph. The Mac app renders this
            in real time: a master conversation view, a typed message feed, and a live
            node graph.
          </p>

          <p>
            <strong>Replay and fork.</strong> Any run can be replayed from its message
            history. More interestingly, you can fork from any message and explore what
            would have happened with a different model response, a different tool
            result, or a human override. Debug with time travel.
          </p>

          <p>
            <strong>Portable context.</strong> Because conversation state lives in the
            Router, not in a provider SDK, you can move a conversation between models
            mid-flight. Start with Claude, hand off to a local model for a code
            generation step, resume with GPT for summarization. The context belongs to
            no one.
          </p>

          <p>
            <strong>Composability without ceremony.</strong> An agent that uses a
            shell, an MCP server, and a memory store is three registered actors and a
            routing rule. No pipelines to wire. No abstractions to fight. No framework
            opinions about how your system should be structured.
          </p>

          <h2>The Mac app as a proof of concept</h2>

          <p>
            The Verbum Mac app is the opinionated expression of this architecture. It
            ingests streams from Claude Code task files, Codex CLI runs, terminal
            sessions, and arbitrary JSONL sources, then renders them as one unified
            conversation surface.
          </p>

          <p>
            Three views. <strong>Chat</strong> is the master conversation, where you
            talk to the system and it routes your messages to the right actors.{" "}
            <strong>Feed</strong> is the typed message stream, every message from every
            source in chronological order. <strong>Graph</strong> is the live topology,
            showing you which actors are connected and what is flowing between them.
          </p>

          <p>
            The app does not do anything the framework cannot do. It is a consumer of
            the same primitives. Any application, CLI, web dashboard, Slack bot, could
            sit on top of the same message graph.
          </p>

          <h2>Areas of extension</h2>

          <p>
            The actor model opens several natural extension points that do not require
            changes to the core:
          </p>

          <p>
            <strong>Routing policies.</strong> The current Router does simple
            address-based dispatch. But the message graph supports arbitrary routing
            logic: priority queues, load balancing across model actors, content-based
            routing where a classifier actor decides who should handle a message. A
            &ldquo;supervisor&rdquo; actor that watches the graph and intervenes when
            things go off track is just another actor with a routing rule.
          </p>

          <p>
            <strong>Persistence backends.</strong> The Router currently holds
            conversation state in memory. Swapping in SQLite, Postgres, or a
            distributed log like Kafka would give you durable, queryable conversation
            histories. Every message is already structured for this. The schema is the
            message type itself.
          </p>

          <p>
            <strong>Multi-agent topologies.</strong> Nothing prevents one Router from
            talking to another. A &ldquo;team&rdquo; of agents could be a Router with
            several ModelActors and a shared MemoryActor, exposed to an outer Router as
            a single composite actor. Hierarchical agent systems fall out of
            composition, not special-casing.
          </p>

          <p>
            <strong>Transport layers.</strong> Actors communicate through the Router
            today, but the message format is transport-agnostic. WebSocket, HTTP,
            Nostr, NATS, carrier pigeon&mdash;as long as messages arrive with the
            right shape, the Router does not care how they got there. This is the path
            to distributed agent systems where actors run on different machines.
          </p>

          <p>
            <strong>Evaluation and testing.</strong> Because every run is a
            deterministic sequence of messages (given deterministic actors), you can
            write tests against message traces. Assert that the model asked the shell
            to run tests before declaring success. Assert that the human was consulted
            before a destructive action. The message graph is the test fixture.
          </p>

          <h2>Research directions</h2>

          <p>
            Several open questions sit at the intersection of the actor model and
            current AI capabilities:
          </p>

          <p>
            <strong>Conversation-as-program.</strong> If a run is a graph of messages,
            that graph is a program. Can you compile it? Optimize it? Generate new runs
            from templates? There is a formal language lurking in the message traces
            that nobody has written the grammar for yet.
          </p>

          <p>
            <strong>Adaptive routing.</strong> What if the Router itself were a model?
            A meta-agent that learns from past runs which actor should handle which
            kind of message, dynamically adjusting routing as the system evolves. The
            current Router is deterministic. A learned Router would be something else
            entirely.
          </p>

          <p>
            <strong>Memory as conversation.</strong> The MemoryActor treats memory as a
            participant, not a database. This is a stronger claim than it sounds. If
            memory responds to queries the same way a model does, the line between
            &ldquo;remembering&rdquo; and &ldquo;reasoning&rdquo; blurs. What is the
            right interface for a memory that talks back?
          </p>

          <p>
            <strong>Consensus protocols for multi-model systems.</strong> When three
            models disagree, who wins? The actor model gives you the message graph to
            reason about divergence, but it does not prescribe a resolution strategy.
            Voting, arbitration, escalation to a human&mdash;these are all expressible
            as actors, but the question of which strategy to use when is wide open.
          </p>

          <p>
            <strong>Observable alignment.</strong> If every model decision is a message
            in a graph, you have a substrate for alignment research that does not
            require interpretability of the model itself. You can study what the model{" "}
            <em>did</em>, who it talked to, what it was told, and what it decided, in
            a format that is already structured for analysis. The conversation graph is
            an alignment log that writes itself.
          </p>

          <h2>The bet</h2>

          <p>
            The bet behind Verbum is simple: the right abstraction for AI systems is
            not &ldquo;function calls with language models&rdquo; but
            &ldquo;conversations between typed participants.&rdquo;
          </p>

          <p>
            This is not a new idea. The actor model has been around since 1973. Message
            passing is the foundation of Erlang, Akka, and every reliable distributed
            system you have ever used. What is new is applying it to a world where one
            of the participants can reason in natural language.
          </p>

          <p>
            When your model is just another actor, everything simplifies. The system
            becomes observable because messages are observable. It becomes replayable
            because message sequences are replayable. It becomes composable because
            actors compose. And it becomes debuggable because you can read the
            conversation.
          </p>

          <blockquote>
            Everything is a conversation. The framework just makes it legible.
          </blockquote>

          <div className="blog-footer-cta">
            <a href="https://www.npmjs.com/package/verbum-ai" className="btnp">
              npm install verbum-ai
            </a>
            <a href="https://github.com/Bbasche/verbum-ai" className="btns">
              Read the source
            </a>
            <Link href="/docs" className="btns">
              Documentation
            </Link>
          </div>
        </div>
      </article>

      <footer>
        <div className="finner">
          <div className="wordmark">
            <img alt="Verbum" className="wordmark-image" src="/brand/verbum-logo-light.png" />
          </div>
          <div className="flinks">
            <Link href="/docs">Docs</Link>
            <Link href="/blog">Blog</Link>
            <a href="https://github.com/Bbasche/verbum-ai">GitHub</a>
          </div>
          <div className="fmit">MIT licensed &middot; built in public</div>
        </div>
      </footer>
    </>
  );
}
