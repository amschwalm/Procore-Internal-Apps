import { useMemo, useState } from "react";
import {
  audiences,
  customers,
  dataNotes,
  decisions,
  getBriefing,
  initiatives,
  periods,
  views,
  type AudienceId,
  type PeriodId,
  type ViewId,
} from "./data/briefing";
import {
  formatCompact,
  formatPct,
  formatSignedPct,
  kpiTone,
  talkingPointsScript,
} from "./lib/format";

export default function App() {
  const [period, setPeriod] = useState<PeriodId>("week");
  const [audience, setAudience] = useState<AudienceId>("elt");
  const [view, setView] = useState<ViewId>("brief");
  const [toast, setToast] = useState<string | null>(null);

  const briefing = useMemo(() => getBriefing(period, audience), [period, audience]);
  const audienceMeta = audiences.find((item) => item.id === audience)!;

  async function copyBrief() {
    const script = talkingPointsScript(
      briefing.talkingPoints,
      briefing.headline,
      briefing.periodLabel,
    );
    try {
      await navigator.clipboard.writeText(script);
      setToast("Talking points copied");
    } catch {
      setToast("Copy failed — select the Brief tab and copy manually");
    }
    window.setTimeout(() => setToast(null), 2400);
  }

  return (
    <div className="app">
      <aside className="spine">
        <div>
          <div className="spine-brand">
            procore <span>internal</span>
          </div>
          <div className="spine-kicker">AI Solutions</div>
        </div>
        <nav aria-label="Briefing sections">
          {views.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : undefined}
              onClick={() => setView(item.id)}
              type="button"
            >
              <span className="num">{item.kicker}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <p className="spine-foot">
          Director of AI Solutions
          <br />
          Leadership briefing
          <br />
          Confidential · {briefing.asOf}
        </p>
      </aside>

      <main className="frame">
        <header className="masthead">
          <div className="masthead-copy">
            <div className="kicker">Office of the Director · AI Solutions</div>
            <h1>Leadership briefing</h1>
            <p className="meta">
              {briefing.periodLabel} · Prepared for {audienceMeta.label.toLowerCase()} · Not a
              customer-facing document
            </p>
          </div>
          <div className="controls">
            <label>
              <span className="visually-hidden">Period</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as PeriodId)}
                aria-label="Reporting period"
              >
                {periods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="visually-hidden">Audience</span>
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as AudienceId)}
                aria-label="Audience"
              >
                {audiences.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="ghost" type="button" onClick={copyBrief}>
              Copy talking points
            </button>
            <button className="primary" type="button" onClick={() => window.print()}>
              Print packet
            </button>
          </div>
        </header>

        <p className="banner">
          {audienceMeta.blurb} Commercial KPIs are illustrative until Salesforce / Control Tower
          extracts are wired in. Public customer proof (Haskell, Consigli, Level 10) may be cited.
        </p>

        {view === "brief" && <BriefView briefing={briefing} />}
        {view === "performance" && <PerformanceView briefing={briefing} />}
        {view === "adoption" && <AdoptionView briefing={briefing} />}
        {view === "portfolio" && <PortfolioView />}
        {view === "customers" && <CustomersView />}
        {view === "decisions" && <DecisionsView />}

        <ol className="notes">
          {dataNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
      </main>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function BriefView({
  briefing,
}: {
  briefing: ReturnType<typeof getBriefing>;
}) {
  return (
    <>
      <section className="headline-block">
        <h2>{briefing.headline}</h2>
        <p>{briefing.lede}</p>
      </section>
      <KpiStrip briefing={briefing} />
      <div className="grid-2">
        <article className="card">
          <h3>Talking points</h3>
          {briefing.talkingPoints.map((point, index) => (
            <div className="point" key={point.id}>
              <div className="idx">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h4>{point.title}</h4>
                <p>{point.body}</p>
              </div>
            </div>
          ))}
        </article>
        <article className="card">
          <h3>Operating signals</h3>
          {briefing.signals.map((item) => (
            <div className="signal" key={item.id}>
              <span className={`pill ${item.signal}`}>{item.signal.replace("-", " ")}</span>
              <div>
                <div className="label">{item.label}</div>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </article>
      </div>
      <article className="card" style={{ marginTop: 18 }}>
        <h3>What moved</h3>
        <div className="change-list">
          {briefing.weeklyChanges.map((item) => (
            <div className="change" key={item.label}>
              <span>{item.label}</span>
              <b>{item.value}</b>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

function PerformanceView({
  briefing,
}: {
  briefing: ReturnType<typeof getBriefing>;
}) {
  return (
    <>
      <section className="headline-block">
        <h2>Commercial and credit posture</h2>
        <p>
          Land on Starter, expand on Pro, encode on Enterprise. Coverage is adequate if the two
          slipped Enterprise deals are recovered before Q3 freeze.
        </p>
      </section>
      <KpiStrip briefing={briefing} />
      <div className="grid-3">
        <article className="card">
          <h3>Coverage</h3>
          <p className="value" style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 28 }}>
            {briefing.commercial.coverage}
          </p>
          <p style={{ marginTop: 8 }}>
            {briefing.commercial.pipeline} open against {briefing.commercial.remainingTarget}{" "}
            remaining Q3 target.
          </p>
        </article>
        <article className="card">
          <h3>Land and expand</h3>
          <p style={{ marginTop: 12 }}>{briefing.commercial.landExpand}</p>
          <p style={{ marginTop: 8, color: "var(--ink-soft)" }}>
            Keep Starter as a three-project proof. Do not discount Pro credits to rescue a Starter
            stall.
          </p>
        </article>
        <article className="card">
          <h3>Credits</h3>
          <p style={{ marginTop: 12 }}>
            <b>{formatPct(briefing.credit.utilizedPct)}</b> of {briefing.credit.poolLabel}
          </p>
          <div className="bar" style={{ marginTop: 10 }}>
            <span style={{ width: formatPct(briefing.credit.utilizedPct) }} />
          </div>
          <p style={{ marginTop: 10, color: "var(--ink-soft)" }}>
            80% alert forecast: {briefing.credit.at80Forecast}. {briefing.credit.note}
          </p>
        </article>
      </div>
      <article className="card" style={{ marginTop: 18 }}>
        <h3>Package economics</h3>
        {briefing.packageMix.map((row) => (
          <div className="mix-row" key={row.name}>
            <div>
              <b>{row.name}</b>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                {row.logos} logos · {formatPct(row.logoShare)} of base
              </div>
            </div>
            <div>
              <div className="bar navy">
                <span style={{ width: formatPct(row.arrShare) }} />
              </div>
              <div style={{ marginTop: 6, color: "var(--ink-soft)", fontSize: 12.5 }}>
                {row.note}
              </div>
            </div>
            <div style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
              {formatPct(row.arrShare)} ARR
            </div>
          </div>
        ))}
      </article>
    </>
  );
}

function AdoptionView({
  briefing,
}: {
  briefing: ReturnType<typeof getBriefing>;
}) {
  return (
    <>
      <section className="headline-block">
        <h2>How customers are actually putting AI to work</h2>
        <p>
          Gravity is still the Starter five. Pro breakouts are Site Safety and Change Analysis.
          Studio custom agents are not yet a volume story.
        </p>
      </section>
      <article className="card">
        <div className="agent-row table-head">
          <span>Agent</span>
          <span>Category</span>
          <span>30-day runs</span>
          <span>WoW</span>
        </div>
        {briefing.agents.map((agent) => (
          <div className="agent-row" key={agent.name}>
            <div>
              <b>{agent.name}</b>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{agent.package} package</div>
            </div>
            <span>{agent.category}</span>
            <span style={{ fontFamily: "var(--mono)" }}>{formatCompact(agent.runs)}</span>
            <span>{formatSignedPct(agent.wow)}</span>
          </div>
        ))}
      </article>
      <article className="card" style={{ marginTop: 18 }}>
        <div className="region-row table-head">
          <span>Region</span>
          <span>Projects</span>
          <span>WAU</span>
          <span>Attach</span>
          <span>Credits</span>
        </div>
        {briefing.regions.map((row) => (
          <div className="region-row" key={row.region}>
            <b>{row.region}</b>
            <span>{row.enabledProjects.toLocaleString()}</span>
            <span>{row.wau.toLocaleString()}</span>
            <span>{formatPct(row.attach, 1)}</span>
            <span>
              {formatPct(row.creditUtil)}
              <div className="bar" style={{ marginTop: 6 }}>
                <span style={{ width: formatPct(row.creditUtil) }} />
              </div>
            </span>
          </div>
        ))}
      </article>
    </>
  );
}

function PortfolioView() {
  return (
    <>
      <section className="headline-block">
        <h2>Portfolio sequence through FY26</h2>
        <p>
          Skills now, Studio attach through Q4, Document Management in H2. Control Tower in-product
          is the only item that needs an ELT decision this week.
        </p>
      </section>
      <article className="card">
        {initiatives.map((item) => (
          <div className="initiative" key={item.id}>
            <div>
              <span className={`pill ${item.signal}`}>{item.signal.replace("-", " ")}</span>
              <h3 style={{ marginTop: 10, textTransform: "none", letterSpacing: 0 }}>
                {item.name}
              </h3>
              <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 12.5 }}>
                {item.owner} · {item.window}
              </p>
              <div className="bar progress">
                <span style={{ width: formatPct(item.progress) }} />
              </div>
            </div>
            <div>
              <p>{item.summary}</p>
              <p style={{ marginTop: 8 }}>
                <b>Next: </b>
                {item.next}
              </p>
            </div>
          </div>
        ))}
      </article>
    </>
  );
}

function CustomersView() {
  return (
    <>
      <section className="headline-block">
        <h2>Cite named proof. Do not model company-wide hours saved.</h2>
        <p>
          These three firms are on the 23 July 2026 announcement. They are the only customer stories
          in this packet that are cleared for ELT and board rooms.
        </p>
      </section>
      <div className="grid-3">
        {customers.map((customer) => (
          <article className="card" key={customer.name}>
            <h3 style={{ textTransform: "none", letterSpacing: 0 }}>{customer.name}</h3>
            <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 12.5 }}>
              {customer.segment} · {customer.package}
            </p>
            <p style={{ marginTop: 12 }}>{customer.result}</p>
            {customer.quote ? (
              <blockquote className="quote">
                {customer.quote}
                {customer.attribution ? <cite>{customer.attribution}</cite> : null}
              </blockquote>
            ) : null}
            <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>{customer.source}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function DecisionsView() {
  return (
    <>
      <section className="headline-block">
        <h2>Three decisions. One of them is this week.</h2>
        <p>
          If ELT only has time for a single yes/no: fund in-product Control Tower. The other two
          are sequence and policy, not headcount.
        </p>
      </section>
      <div className="grid-3">
        {decisions.map((ask) => (
          <article className="card ask" key={ask.id}>
            <h3 style={{ textTransform: "none", letterSpacing: 0 }}>{ask.title}</h3>
            <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 12.5 }}>
              Needed by {ask.neededBy} · {ask.owner} · {ask.cost}
            </p>
            <p style={{ marginTop: 12 }}>
              <b>Recommend: </b>
              {ask.recommendation}
            </p>
            <p style={{ marginTop: 10, color: "var(--ink-soft)" }}>
              <b>If no: </b>
              {ask.ifNo}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

function KpiStrip({ briefing }: { briefing: ReturnType<typeof getBriefing> }) {
  return (
    <section className="kpi-strip" aria-label="Key performance indicators">
      {briefing.kpis.map((kpi) => {
        const tone = kpiTone(kpi.direction, kpi.goodWhen);
        return (
          <article className="kpi" key={kpi.id}>
            <div className="label">{kpi.label}</div>
            <div className="value">{kpi.value}</div>
            <div className={`delta ${tone}`}>{kpi.delta}</div>
            <div className="note">{kpi.note}</div>
          </article>
        );
      })}
    </section>
  );
}
