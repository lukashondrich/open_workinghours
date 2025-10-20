import Head from "next/head";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  AnalyticsResponse,
  HospitalMonthlySummary,
  StaffGroup,
  StaffGroupMonthlySummary,
  fetchAnalytics
} from "../lib/api";

const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  year: "numeric",
  month: "short"
});

const numberFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});


export default function Dashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<StaffGroup | "all">("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAnalytics({ months: 6, staffGroup: selectedGroup === "all" ? undefined : selectedGroup })
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load analytics");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedGroup]);

  const hospitalOptions = useMemo(() => {
    if (!data) {
      return [];
    }
    const unique = Array.from(
      new Set(
        data.hospital_monthly
          .filter((row) => selectedGroup === "all" || row.staff_group === selectedGroup)
          .map((row) => row.hospital_domain)
      )
    );
    unique.sort();
    return unique;
  }, [data, selectedGroup]);

  useEffect(() => {
    if (!data) {
      return;
    }
    if (!selectedHospital && hospitalOptions.length > 0) {
      setSelectedHospital(hospitalOptions[0]);
    }
  }, [data, hospitalOptions, selectedHospital]);

  const overallReportCount = useMemo(() => {
    if (!data) {
      return 0;
    }
    return data.hospital_monthly.reduce((total, row) => total + row.report_count, 0);
  }, [data]);

  const hospitalSeries = useMemo(() => {
    if (!data || !selectedHospital) {
      return [];
    }
    const filtered = data.hospital_monthly.filter((row) => {
      if (row.hospital_domain !== selectedHospital) {
        return false;
      }
      if (selectedGroup !== "all" && row.staff_group !== selectedGroup) {
        return false;
      }
      return !row.suppressed;
    });
    if (filtered.length === 0) {
      return [];
    }
    const monthlyMap = new Map<
      string,
      {
        date: Date;
        totalReports: number;
        totalActual: number;
        totalOvertime: number;
      }
    >();
    filtered.forEach((row) => {
      const key = row.month_start;
      const entry = monthlyMap.get(key);
      if (!entry) {
        monthlyMap.set(key, {
          date: new Date(row.month_start),
          totalReports: row.report_count,
          totalActual: row.total_actual_hours ?? 0,
          totalOvertime: row.total_overtime_hours ?? 0
        });
      } else {
        entry.totalReports += row.report_count;
        entry.totalActual += row.total_actual_hours ?? 0;
        entry.totalOvertime += row.total_overtime_hours ?? 0;
      }
    });
    const result = Array.from(monthlyMap.values())
      .filter((entry) => entry.totalReports > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((entry) => ({
        date: entry.date,
        label: monthFormatter.format(entry.date),
        avgActual: entry.totalActual / entry.totalReports,
        avgOvertime: entry.totalOvertime / entry.totalReports
      }));
    return result;
  }, [data, selectedHospital, selectedGroup]);

  return (
    <>
      <Head>
        <title>Open Working Hours – Dashboard</title>
        <meta name="description" content="Aggregated physician working-hours summaries" />
      </Head>
      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem", lineHeight: 1.6 }}>
        <header style={{ marginBottom: "2rem" }}>
          <h1>Open Working Hours – Dashboard</h1>
          <p>
            Aggregierte monatliche Berichte (letzte 6 Monate). Werte werden unterdrückt, wenn weniger
            als fünf Meldungen pro Gruppe vorliegen.
          </p>
          <p style={{ fontSize: "0.9rem", color: "#666" }}>
            Gesamtzahl der Meldungen im dargestellten Zeitraum: {overallReportCount}
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <div>
              <label htmlFor="group-selector" style={{ marginRight: "0.5rem" }}>
                Gruppe:
              </label>
              <select
                id="group-selector"
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value as StaffGroup | "all")}
              >
                <option value="all">Alle Gruppen</option>
                <option value="group_a">Assistenz- & Fachärzt:innen</option>
                <option value="group_b">Ober- & Chefärzt:innen</option>
                <option value="group_c">Pflegepersonal</option>
              </select>
            </div>
            {hospitalOptions.length > 0 && (
              <div>
                <label htmlFor="hospital-selector" style={{ marginRight: "0.5rem" }}>
                  Krankenhaus:
                </label>
                <select
                  id="hospital-selector"
                  value={selectedHospital ?? ""}
                  onChange={(event) => setSelectedHospital(event.target.value)}
                >
                  {hospitalOptions.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {loading && <p>Loading analytics…</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {data && (
          <section style={{ display: "grid", gap: "2rem" }}>
            <article>
              <h2>Verlauf – {selectedHospital ?? "Keine Auswahl"}</h2>
              <p style={{ fontSize: "0.9rem", color: "#555" }}>
                Durchschnittliche tatsächliche Stunden und Überstunden pro Meldung (nur Monate ohne Unterdrückung).
              </p>
              <HospitalLineChart data={hospitalSeries} />
            </article>

            <article style={{ fontSize: "0.9rem", color: "#444" }}>
              <h2>Methodik in Kürze</h2>
              <ul style={{ paddingLeft: "1.2rem" }}>
                <li>Monatliche Aggregation nach Meldedatum und Gruppe.</li>
                <li>Konfidenzintervalle: Bootstrap (200 Iterationen) + Laplace-Rauschen für Differential Privacy.</li>
                <li>Unterdrückung bei weniger als fünf Meldungen oder fehlender Abdeckung.</li>
                <li>Tatsächliche Stunden und Überstunden werden getrennt ausgewiesen.</li>
              </ul>
            </article>
          </section>
        )}
      </main>
    </>
  );
}

interface HospitalLineChartProps {
  data: Array<{
    date: Date;
    label: string;
    avgActual: number;
    avgOvertime: number;
  }>;
}

function HospitalLineChart({ data }: HospitalLineChartProps) {
  if (data.length === 0) {
    return <p>Keine auswertbaren Monate (Daten unterdrückt oder nicht vorhanden).</p>;
  }

  const width = 640;
  const height = 260;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const values = data.flatMap((row) => [row.avgActual, row.avgOvertime, row.avgActual - row.avgOvertime]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const yMin = Math.floor((Math.min(0, minValue - 5)) / 5) * 5;
  const yMax = Math.ceil((maxValue + 5) / 5) * 5 || yMin + 10;

  const xScale = (index: number) => {
    if (data.length === 1) {
      return margin.left + innerWidth / 2;
    }
    return margin.left + (index / (data.length - 1)) * innerWidth;
  };

  const yScale = (value: number) => {
    if (yMax === yMin) {
      return margin.top + innerHeight / 2;
    }
    return margin.top + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
  };

  const buildPath = (valuesToPlot: (row: (typeof data)[number]) => number) =>
    data
      .map((row, index) => {
        const x = xScale(index);
        const y = yScale(valuesToPlot(row));
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");

  const lineActual = buildPath((row) => row.avgActual);

  const buildAreaPath = (
    upperAccessor: (row: (typeof data)[number]) => number,
    lowerAccessor: (row: (typeof data)[number]) => number
  ) => {
    if (data.length === 0) {
      return "";
    }
    const upper = data.map((row, index) => {
      const x = xScale(index);
      const y = yScale(upperAccessor(row));
      return { x, y };
    });
    const lower = [...data]
      .reverse()
      .map((row, index) => {
        const realIndex = data.length - 1 - index;
        const x = xScale(realIndex);
        const y = yScale(lowerAccessor(row));
        return { x, y };
      });
    const points = [...upper, ...lower];
    return points
      .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x} ${point.y}`)
      .join(" ") + " Z";
  };

  const areaScheduled = buildAreaPath(
    (row) => Math.max(row.avgActual - row.avgOvertime, 0),
    () => 0
  );
  const areaOvertime = buildAreaPath(
    (row) => row.avgActual,
    (row) => Math.max(row.avgActual - row.avgOvertime, 0)
  );

  const yTicks: number[] = [];
  const step = Math.max(Math.round((yMax - yMin) / 5 / 5) * 5, 5);
  for (let value = yMin; value <= yMax; value += step) {
    yTicks.push(value);
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Arbeitsstunden Verlauf">
      <title>Arbeitsstunden Verlauf</title>
      <desc>Liniengraph tatsächliche Stunden und Überstunden</desc>
      {/* Axes */}
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="#bbb" />
      <line
        x1={margin.left}
        y1={height - margin.bottom}
        x2={width - margin.right}
        y2={height - margin.bottom}
        stroke="#bbb"
      />
      {/* Y ticks */}
      {yTicks.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={`y-${tick}`}>
            <line x1={margin.left - 6} y1={y} x2={margin.left} y2={y} stroke="#888" />
            <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="10">
              {numberFormatter.format(tick)}
            </text>
            <line
              x1={margin.left}
              y1={y}
              x2={width - margin.right}
              y2={y}
              stroke="#e5e5e5"
              strokeDasharray="4 4"
            />
          </g>
        );
      })}
      {/* X labels */}
      {data.map((row, index) => {
        const x = xScale(index);
        return (
          <text key={`x-${row.label}`} x={x} y={height - margin.bottom + 18} textAnchor="middle" fontSize="10">
            {row.label}
          </text>
        );
      })}
      {/* Areas */}
      <path d={areaScheduled} fill="rgba(31, 119, 180, 0.25)" stroke="none" />
      <path d={areaOvertime} fill="rgba(214, 39, 40, 0.35)" stroke="none" />
      {/* Line */}
      <path d={lineActual} fill="none" stroke="#1f77b4" strokeWidth={2} />
      {/* Value labels */}
      {data.map((row, index) => {
        const x = xScale(index);
        const actualLabelY = yScale(row.avgActual) - 8;
        const overtimeMid = row.avgActual - row.avgOvertime / 2;
        const overtimeLabelY = yScale(overtimeMid);
        const baseValue = Math.max(row.avgActual - row.avgOvertime, 0);
        const baseLabelY = yScale(baseValue) + 12;
        return (
          <g key={`label-${row.label}`} fontSize="10" fontStyle="italic" fill="#333">
            <text x={x} y={actualLabelY} textAnchor="middle" fill="#1f77b4">
              {numberFormatter.format(row.avgActual)}
            </text>
            {row.avgOvertime > 0 && (
              <text x={x} y={overtimeLabelY} textAnchor="middle" fill="#d62728">
                +{numberFormatter.format(row.avgOvertime)}
              </text>
            )}
            {baseValue > 0 && (
              <text x={x} y={baseLabelY} textAnchor="middle" fill="#205d8d">
                {numberFormatter.format(baseValue)}
              </text>
            )}
          </g>
        );
      })}
      {/* Legend */}
      <g transform={`translate(${margin.left}, ${margin.top - 8})`} fontSize="10">
        <rect x={0} y={-6} width={12} height={6} fill="rgba(31, 119, 180, 0.35)" />
        <text x={18} y={0}>
          Basis (Plan/Normalstunden)
        </text>
        <rect x={170} y={-6} width={12} height={6} fill="rgba(214, 39, 40, 0.45)" />
        <text x={188} y={0}>
          Überstunden
        </text>
        <line x1={290} y1={-3} x2={310} y2={-3} stroke="#1f77b4" strokeWidth={2} />
        <text x={315} y={0}>
          Summe tatsächliche Stunden
        </text>
      </g>
    </svg>
  );
}
