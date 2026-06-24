import { getRecentHealthDailyRecords } from "@/src/health/public-data";
import type { HealthDailyRecord } from "@/src/health/types";
import type { TrackedActiveMinuteLevel } from "@/src/health/active-minutes";
import { getPublicWakaTimeCodingStats } from "@/src/wakatime/public-data";
import type {
  PublicWakaTimeCodingStats,
  WakaTimeBreakdownItem,
  WakaTimeDailyTotal,
} from "@/src/wakatime/types";

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

function formatCodingDuration(seconds: number | null) {
  if (seconds === null) {
    return "--";
  }

  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

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
  accent: "mint" | "orange" | "pink" | "violet";
}) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CodingHeatmap({ days }: { days: WakaTimeDailyTotal[] }) {
  const maxSeconds = Math.max(...days.map((day) => day.totalSeconds), 0);

  return (
    <div className="heatmap heatmap--coding" aria-label="recent coding hours">
      {days.map((day) => {
        const intensity = getIntensity(day.totalSeconds, maxSeconds);

        return (
          <div
            key={day.date}
            className="heatmap-cell heatmap-cell--coding"
            style={{
              opacity: day.totalSeconds === 0 ? 0.24 : 0.36 + intensity * 0.64,
              transform: `translateY(${(1 - intensity) * 8}px)`,
            }}
            title={`${formatDateLong(day.date)}: ${formatCodingDuration(day.totalSeconds)}`}
          >
            <span>{formatDate(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SplitRows({
  label,
  items,
  accent,
}: {
  label: string;
  items: WakaTimeBreakdownItem[];
  accent: "language" | "editor";
}) {
  return (
    <section className={`split-panel split-panel--${accent}`} aria-label={`top ${label}`}>
      <div className="split-panel__heading">
        <span>{label}</span>
        <strong>{items.length ? "top 5" : "no signal"}</strong>
      </div>
      <div className="split-list">
        {items.length ? (
          items.map((item) => (
            <div key={item.name} className="split-row">
              <div>
                <span>{item.name}</span>
                <strong>{item.text}</strong>
              </div>
              <div className="split-meter" aria-hidden="true">
                <span
                  style={{
                    width: `${item.percent}%`,
                    backgroundColor: item.color ?? undefined,
                  }}
                />
              </div>
              <em>{item.percent.toFixed(1)}%</em>
            </div>
          ))
        ) : (
          <div className="split-empty">--</div>
        )}
      </div>
    </section>
  );
}

function CodingBand({ stats }: { stats: PublicWakaTimeCodingStats }) {
  const hasCodingSignal = stats.dailyTotals.some((day) => day.totalSeconds > 0);

  return (
    <section className="panel-band panel-band--coding">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WakaTime / Coding</p>
          <h2>coding hours</h2>
        </div>
        <span>
          {stats.fetchedAt ? `fetched ${new Date(stats.fetchedAt).toLocaleString("en-GB")}` : "offline"}
        </span>
      </div>

      <section className="metric-grid" aria-label="coding totals">
        <MetricCard
          label="today"
          value={formatCodingDuration(stats.todayTotal.totalSeconds)}
          accent="violet"
        />
        <MetricCard
          label="last 7 days"
          value={formatCodingDuration(stats.last7Total.totalSeconds)}
          accent="mint"
        />
        <MetricCard
          label="active-day avg"
          value={formatCodingDuration(stats.activeDayAverage.totalSeconds)}
          accent="orange"
        />
      </section>

      {hasCodingSignal ? (
        <>
          <CodingHeatmap days={stats.dailyTotals} />
          <div className="split-grid">
            <SplitRows label="languages" items={stats.topLanguages} accent="language" />
            <SplitRows label="editors" items={stats.topEditors} accent="editor" />
          </div>
        </>
      ) : (
        <div className="empty-panel">
          <span>101</span>
          <strong>Coding stats unavailable</strong>
        </div>
      )}
    </section>
  );
}

function ActivityStripe({ record }: { record: HealthDailyRecord }) {
  const levels = [
    ["moderate", "#e0af68", "moderate"],
    ["vigorous", "#f7768e", "vigorous"],
    ["very_active", "#ff9e64", "very active"],
  ] as const satisfies readonly [TrackedActiveMinuteLevel, string, string][];
  const total = record.activeMinutes.total ?? 0;

  return (
    <div className="activity-stripe" aria-label="active minutes by level">
      {levels.map(([level, color, label]) => {
        const minutes = record.activeMinutes.byLevel[level] ?? 0;
        const width = total === 0 ? 0 : (minutes / total) * 100;

        return (
          <span
            key={level}
            style={{
              backgroundColor: color,
              width: `${width}%`,
            }}
            title={`${label}: ${minutes}m`}
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
  const [records, codingStats] = await Promise.all([
    getRecentHealthDailyRecords(),
    getPublicWakaTimeCodingStats(),
  ]);
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

      <CodingBand stats={codingStats} />

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
