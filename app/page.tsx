import { getRecentHealthDailyRecords } from "@/src/health/public-data";
import type { HealthDailyRecord } from "@/src/health/types";

export const dynamic = "force-dynamic";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatDateLong(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatNumber(value: number | null) {
  return value === null ? "--" : new Intl.NumberFormat("en").format(value);
}

function formatDuration(minutes: number | null) {
  if (minutes === null) {
    return "--";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder.toString().padStart(2, "0")}m`;
}

function getIntensity(value: number | null, max: number) {
  if (value === null || max === 0) {
    return 0;
  }

  return Math.min(1, value / max);
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "mint" | "orange" | "pink";
}) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActivityStripe({ record }: { record: HealthDailyRecord }) {
  const levels = [
    ["light", "#73daca"],
    ["moderate", "#e0af68"],
    ["vigorous", "#f7768e"],
  ] as const;
  const total = record.activeMinutes.total ?? 0;

  return (
    <div className="activity-stripe" aria-label="active minutes by level">
      {levels.map(([level, color]) => {
        const minutes = record.activeMinutes.byLevel[level] ?? 0;
        const width = total === 0 ? 0 : (minutes / total) * 100;

        return (
          <span
            key={level}
            style={{
              backgroundColor: color,
              width: `${width}%`,
            }}
            title={`${level}: ${minutes}m`}
          />
        );
      })}
    </div>
  );
}

function Heatmap({ records }: { records: HealthDailyRecord[] }) {
  const chronological = [...records].reverse();
  const maxSteps = Math.max(...chronological.map((record) => record.steps ?? 0), 0);

  return (
    <div className="heatmap" aria-label="recent step volume">
      {chronological.map((record) => {
        const intensity = getIntensity(record.steps, maxSteps);

        return (
          <div
            key={record.date}
            className="heatmap-cell"
            style={{
              opacity: record.steps === null ? 0.28 : 0.35 + intensity * 0.65,
              transform: `translateY(${(1 - intensity) * 8}px)`,
            }}
            title={`${formatDateLong(record.date)}: ${formatNumber(record.steps)} steps`}
          >
            <span>{formatDate(record.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DailyRows({ records }: { records: HealthDailyRecord[] }) {
  return (
    <section className="daily-list" aria-label="daily health rows">
      {records.slice(0, 7).map((record) => (
        <article key={record.date} className="daily-row">
          <div>
            <span>{formatDateLong(record.date)}</span>
            <strong>{formatNumber(record.steps)} steps</strong>
          </div>
          <div>
            <span>bed</span>
            <strong>{formatDuration(record.timeInBedMinutes)}</strong>
          </div>
          <div>
            <span>active</span>
            <strong>{formatDuration(record.activeMinutes.total)}</strong>
          </div>
          <ActivityStripe record={record} />
        </article>
      ))}
    </section>
  );
}

export default async function Home() {
  const records = await getRecentHealthDailyRecords();
  const latest = records[0];

  return (
    <main className="dashboard-shell">
      <section className="hero-band">
        <div>
          <p className="eyebrow">PersoDashboard / Health</p>
          <h1>{latest ? formatDateLong(latest.date) : "Awaiting first sync"}</h1>
        </div>
        <div className="sync-stamp">
          <span>last fetch</span>
          <strong>{latest ? new Date(latest.fetchedAt).toLocaleString("en-GB") : "--"}</strong>
        </div>
      </section>

      <section className="metric-grid" aria-label="latest health totals">
        <MetricCard label="steps" value={formatNumber(latest?.steps ?? null)} accent="mint" />
        <MetricCard
          label="time in bed"
          value={formatDuration(latest?.timeInBedMinutes ?? null)}
          accent="orange"
        />
        <MetricCard
          label="active"
          value={formatDuration(latest?.activeMinutes.total ?? null)}
          accent="pink"
        />
      </section>

      <section className="panel-band">
        <div className="section-heading">
          <h2>recent days</h2>
          <span>{records.length ? `${records.length} stored` : "no rows"}</span>
        </div>
        {records.length ? (
          <>
            <Heatmap records={records} />
            <DailyRows records={records} />
          </>
        ) : (
          <div className="empty-panel">
            <span>000</span>
            <strong>No stored health rows yet</strong>
          </div>
        )}
      </section>
    </main>
  );
}
