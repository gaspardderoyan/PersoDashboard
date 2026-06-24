import { getRecentHealthDailyRecords } from "@/src/health/public-data";
import type { HealthDailyRecord } from "@/src/health/types";
import type { TrackedActiveMinuteLevel } from "@/src/health/active-minutes";
import { getPublicFortyTwoDashboardStats } from "@/src/fortytwo/public-data";
import type {
  FortyTwoDailyLogtime,
  FortyTwoLevelPoint,
  FortyTwoRankPoint,
  PublicFortyTwoDashboardStats,
} from "@/src/fortytwo/types";
import { getPublicRescueTimeComputerStats } from "@/src/rescuetime/public-data";
import type { PublicRescueTimeComputerStats } from "@/src/rescuetime/types";
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

function formatCompactMinuteDuration(minutes: number | null) {
  if (minutes === null) {
    return "--";
  }

  const roundedMinutes = Math.round(Math.max(0, minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;

  if (hours === 0) {
    return `${remainder}m`;
  }

  return `${hours}h ${remainder.toString().padStart(2, "0")}m`;
}

function formatLevel(level: number | null) {
  return level === null ? "--" : level.toFixed(2);
}

function formatRank(rank: number | null, population: number | null) {
  return rank === null || population === null ? "--" : `#${formatNumber(rank)} / ${formatNumber(population)}`;
}

function formatPercentile(percentile: number | null) {
  return percentile === null ? "--" : `p${percentile.toFixed(1)}`;
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

function FortyTwoHeatmap({ days }: { days: FortyTwoDailyLogtime[] }) {
  const activeDays = days.map((day) => day.totalMinutes).filter((minutes) => minutes > 0);
  const sortedActiveDays = [...activeDays].sort((a, b) => a - b);
  const cappedMax =
    sortedActiveDays[Math.max(0, Math.ceil(sortedActiveDays.length * 0.95) - 1)] ??
    Math.max(...days.map((day) => day.totalMinutes), 0);

  return (
    <div className="heatmap heatmap--fortytwo" aria-label="recent 42 campus logtime">
      {days.map((day) => {
        const intensity = getIntensity(day.totalMinutes, cappedMax);

        return (
          <div
            key={day.date}
            className="heatmap-cell heatmap-cell--fortytwo"
            style={{
              opacity: day.totalMinutes === 0 ? 0.22 : 0.38 + intensity * 0.62,
              transform: `translateY(${(1 - intensity) * 8}px)`,
            }}
            title={`${formatDateLong(day.date)}: ${formatCompactMinuteDuration(day.totalMinutes)}`}
          >
            <span>{formatDate(day.date)}</span>
          </div>
        );
      })}
    </div>
  );
}

function progressPath(points: { x: number; y: number }[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function ProgressChart({
  title,
  points,
  variant,
}: {
  title: string;
  points: {
    date: string;
    value: number;
    label: string;
  }[];
  variant: "level" | "rank";
}) {
  const width = 520;
  const height = 180;
  const padding = 18;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = values.length === 0 ? 0 : min === max ? min - 0.5 : min;
  const yMax = values.length === 0 ? 1 : min === max ? max + 0.5 : max;
  const plottedPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + ((yMax - point.value) / (yMax - yMin)) * (height - padding * 2);

    return { ...point, x, y };
  });

  return (
    <section className={`chart-panel chart-panel--${variant}`} aria-label={title}>
      <div className="chart-panel__heading">
        <span>{title}</span>
        <strong>{points.length ? `${points.length} snapshot${points.length === 1 ? "" : "s"}` : "no signal"}</strong>
      </div>
      {points.length ? (
        <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img">
          <title>{title}</title>
          <path className="line-chart__grid" d={`M ${padding} ${height - padding} H ${width - padding}`} />
          {plottedPoints.length > 1 ? (
            <path className="line-chart__path" d={progressPath(plottedPoints)} />
          ) : null}
          {plottedPoints.map((point) => (
            <g key={`${point.date}-${point.label}`}>
              <circle className="line-chart__dot" cx={point.x} cy={point.y} r="5" />
              <title>{`${formatDateLong(point.date)}: ${point.label}`}</title>
            </g>
          ))}
        </svg>
      ) : (
        <div className="line-chart__empty">--</div>
      )}
      <div className="chart-panel__axis">
        <span>{points[0] ? formatDate(points[0].date) : "--"}</span>
        <strong>{points.at(-1)?.label ?? "--"}</strong>
        <span>{points.at(-1) ? formatDate(points.at(-1)!.date) : "--"}</span>
      </div>
    </section>
  );
}

function LevelProgressChart({ points }: { points: FortyTwoLevelPoint[] }) {
  return (
    <ProgressChart
      title="level progression"
      variant="level"
      points={points.map((point) => ({
        date: point.date,
        value: point.level,
        label: point.level.toFixed(2),
      }))}
    />
  );
}

function RankProgressChart({ points }: { points: FortyTwoRankPoint[] }) {
  return (
    <ProgressChart
      title="rank in cohort"
      variant="rank"
      points={points.map((point) => ({
        date: point.date,
        value: point.rank,
        label: `#${formatNumber(point.rank)} / ${formatNumber(point.population)}`,
      }))}
    />
  );
}

function FortyTwoBand({ stats }: { stats: PublicFortyTwoDashboardStats }) {
  const hasFortyTwoSignal =
    stats.dailyLogtime.some((day) => day.totalMinutes > 0) ||
    stats.level !== null ||
    stats.cohortRank.rank !== null;

  return (
    <section className="panel-band panel-band--fortytwo">
      <div className="section-heading">
        <div>
          <p className="eyebrow">42 / Paris</p>
          <h2>campus signal</h2>
        </div>
        <span>
          {stats.fetchedAt ? `fetched ${new Date(stats.fetchedAt).toLocaleString("en-GB")}` : "offline"}
        </span>
      </div>

      <section className="metric-grid metric-grid--four" aria-label="42 campus totals">
        <MetricCard
          label="today logtime"
          value={formatCompactMinuteDuration(stats.todayLogtime.totalMinutes)}
          accent="mint"
        />
        <MetricCard
          label="last 30 days"
          value={formatCompactMinuteDuration(stats.last30Logtime.totalMinutes)}
          accent="orange"
        />
        <MetricCard
          label={`${stats.cursus ?? "cursus"} level`}
          value={formatLevel(stats.level)}
          accent="violet"
        />
        <MetricCard
          label={`${formatPercentile(stats.cohortRank.percentile)} cohort rank`}
          value={formatRank(stats.cohortRank.rank, stats.cohortRank.population)}
          accent="pink"
        />
      </section>

      {hasFortyTwoSignal ? (
        <>
          <FortyTwoHeatmap days={stats.dailyLogtime} />
          <div className="chart-grid">
            <LevelProgressChart points={stats.levelProgression} />
            <RankProgressChart points={stats.rankProgression} />
          </div>
          <div className="cohort-caption">
            <span>{stats.cohortRank.label}</span>
            <strong>{stats.grade ?? "student"} at {stats.campus ?? "campus"}</strong>
          </div>
        </>
      ) : (
        <div className="empty-panel">
          <span>042</span>
          <strong>42 stats unavailable</strong>
        </div>
      )}
    </section>
  );
}

function RescueTimeSplit({
  label,
  totalSeconds,
  maxSeconds,
  color,
}: {
  label: string;
  totalSeconds: number;
  maxSeconds: number;
  color: string;
}) {
  const width = maxSeconds === 0 ? 0 : (totalSeconds / maxSeconds) * 100;

  return (
    <div className="rescuetime-split-row">
      <span>{label}</span>
      <div className="rescuetime-split-meter" aria-hidden="true">
        <span
          style={{
            width: `${width}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <strong>{formatCodingDuration(totalSeconds)}</strong>
    </div>
  );
}

function RescueTimeBand({ stats }: { stats: PublicRescueTimeComputerStats }) {
  const splitTotal = stats.total.totalSeconds;
  const splitRows = [
    {
      label: "productive",
      totalSeconds: stats.productive.totalSeconds,
      color: "var(--mint)",
    },
    {
      label: "distracting",
      totalSeconds: stats.distracting.totalSeconds,
      color: "var(--pink)",
    },
    {
      label: "neutral",
      totalSeconds: stats.neutral.totalSeconds,
      color: "var(--orange)",
    },
  ];
  const tooltipText = splitRows
    .map((row) => `${row.label}: ${formatCodingDuration(row.totalSeconds)}`)
    .join("\n");

  return (
    <section className="panel-band panel-band--rescuetime">
      <div className="section-heading">
        <div>
          <p className="eyebrow">RescueTime / Computer</p>
          <h2>computer time</h2>
        </div>
        <span>
          {stats.fetchedAt ? `fetched ${new Date(stats.fetchedAt).toLocaleString("en-GB")}` : "offline"}
        </span>
      </div>

      <section className="rescuetime-grid" aria-label="computer time">
        <article
          className="metric-card metric-card--rescuetime"
          aria-describedby="rescuetime-computer-split"
          tabIndex={0}
          title={tooltipText}
        >
          <span>today</span>
          <strong>{formatCodingDuration(stats.total.totalSeconds)}</strong>
          <div id="rescuetime-computer-split" className="rescuetime-split">
            {splitRows.map((row) => (
              <RescueTimeSplit key={row.label} maxSeconds={splitTotal} {...row} />
            ))}
          </div>
        </article>
      </section>
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
  const [records, fortyTwoStats, codingStats, rescueTimeStats] = await Promise.all([
    getRecentHealthDailyRecords(),
    getPublicFortyTwoDashboardStats(),
    getPublicWakaTimeCodingStats(),
    getPublicRescueTimeComputerStats(),
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

      <FortyTwoBand stats={fortyTwoStats} />
      <CodingBand stats={codingStats} />
      <RescueTimeBand stats={rescueTimeStats} />

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
