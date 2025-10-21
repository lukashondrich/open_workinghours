type ViewModeOption = "MONTH" | "WEEK" | "DAY";

interface NavigationBarProps {
  viewMode: ViewModeOption;
  handleViewChange: (mode: ViewModeOption) => void;
  stepWeek: (delta: number) => void;
  goToToday: () => void;
  compact: boolean;
}

export function NavigationBar({ viewMode, handleViewChange, stepWeek, goToToday, compact }: NavigationBarProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: compact ? "column" : "row",
        alignItems: compact ? "stretch" : "center",
        justifyContent: "space-between",
        gap: compact ? "0.75rem" : "0.5rem",
        marginBottom: "1rem",
        border: "1px solid #d0d7de",
        borderRadius: "12px",
        padding: "0.75rem",
        background: "#f8fbff"
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(["MONTH", "WEEK", "DAY"] as ViewModeOption[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleViewChange(mode)}
            aria-pressed={viewMode === mode}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "999px",
              border: "1px solid #94a3b8",
              background: viewMode === mode ? "#0f172a" : "#fff",
              color: viewMode === mode ? "#fff" : "#0f172a",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button type="button" onClick={() => stepWeek(-1)}>
          ← Prev
        </button>
        <button type="button" onClick={goToToday}>
          Today
        </button>
        <button type="button" onClick={() => stepWeek(1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
