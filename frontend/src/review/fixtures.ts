import { addMinutes, toDateKey } from "../lib/time";

export type ShiftCategory = "work" | "oncall";

export interface BreakSegment {
  id: string;
  start: string;
  end: string;
}

export interface ShiftSegment {
  id: string;
  category: ShiftCategory;
  start: string;
  end: string;
  label?: string;
  creditPct?: number;
  breaks: BreakSegment[];
  reviewed?: boolean;
}

export interface ScheduledSegment {
  id: string;
  category: ShiftCategory;
  start: string;
  end: string;
  label?: string;
}

export interface DayReviewRecord {
  date: string;
  scheduled: ScheduledSegment[];
  actual: ShiftSegment[];
  reviewed: boolean;
  notes?: string;
}

export interface ReviewDataset {
  id: string;
  label: string;
  description: string;
  defaultBreakMinutes: number;
  defaultShift: {
    start: string;
    end: string;
  };
  defaultOnCallCreditPct: number;
  days: DayReviewRecord[];
}

function buildRange(date: string, start: string, end: string) {
  const startDate = start.startsWith("24:") ? adjustDay(date, 1) : date;
  const endDate = end.startsWith("24:") ? adjustDay(date, 1) : date;
  return {
    start: `${startDate}T${normalizeTime(start)}`,
    end: `${endDate}T${normalizeTime(end)}`
  };
}

function normalizeTime(time: string): string {
  if (time.startsWith("24:")) {
    return `00:${time.slice(3)}`;
  }
  return time;
}

function adjustDay(date: string, delta: number): string {
  const base = new Date(`${date}T00:00`);
  const withDelta = addMinutes(base, delta * 24 * 60);
  return toDateKey(withDelta);
}

function shift(
  id: string,
  category: ShiftCategory,
  date: string,
  start: string,
  end: string,
  breaks: Array<[string, string]> = [],
  creditPct?: number,
  label?: string
): ShiftSegment {
  const range = buildRange(date, start, end);
  return {
    id,
    category,
    start: range.start,
    end: range.end,
    breaks: breaks.map(([from, to], index) => {
      const breakRange = buildRange(date, from, to);
      return {
        id: `${id}-break-${index}`,
        start: breakRange.start,
        end: breakRange.end
      };
    }),
    creditPct,
    label
  };
}

function scheduled(
  id: string,
  category: ShiftCategory,
  date: string,
  start: string,
  end: string,
  label?: string
): ScheduledSegment {
  const range = buildRange(date, start, end);
  return {
    id,
    category,
    start: range.start,
    end: range.end,
    label
  };
}

export const REVIEW_FIXTURES: ReviewDataset[] = [
  {
    id: "regular-week",
    label: "Reguläre Woche (Mixed)",
    description:
      "Standarddienstplan mit einem Überstundentag, Rufbereitschaft und einem conflict case zum Testen der Hinweise.",
    defaultBreakMinutes: 30,
    defaultShift: {
      start: "09:00",
      end: "17:30"
    },
    defaultOnCallCreditPct: 50,
    days: [
      {
        date: "2024-03-04",
        scheduled: [
          scheduled("sch-mon-1", "work", "2024-03-04", "09:00", "17:30"),
          scheduled("sch-mon-oc", "oncall", "2024-03-04", "20:00", "23:00")
        ],
        actual: [
          shift("act-mon-1", "work", "2024-03-04", "08:52", "17:50", [["12:58", "13:28"]]),
          shift("act-mon-oc", "oncall", "2024-03-04", "20:05", "23:05", [], 50, "Rufbereitschaft")
        ],
        reviewed: true
      },
      {
        date: "2024-03-05",
        scheduled: [
          scheduled("sch-tue-1", "work", "2024-03-05", "09:00", "17:30")
        ],
        actual: [
          shift("act-tue-1", "work", "2024-03-05", "09:02", "17:20", [["13:05", "13:35"]])
        ],
        reviewed: true
      },
      {
        date: "2024-03-06",
        scheduled: [
          scheduled("sch-wed-1", "work", "2024-03-06", "09:00", "17:30")
        ],
        actual: [
          shift("act-wed-1", "work", "2024-03-06", "08:40", "18:45", [["12:55", "13:25"]])
        ],
        reviewed: false,
        notes: "Check with station manager about late case."
      },
      {
        date: "2024-03-07",
        scheduled: [
          scheduled("sch-thu-1", "work", "2024-03-07", "09:00", "17:30")
        ],
        actual: [
          shift("act-thu-1", "work", "2024-03-07", "08:30", "20:15", [
            ["12:50", "13:20"],
            ["17:45", "17:55"]
          ])
        ],
        reviewed: true,
        notes: "Trauma OR overran by 2h."
      },
      {
        date: "2024-03-08",
        scheduled: [
          scheduled("sch-fri-1", "work", "2024-03-08", "09:00", "15:30")
        ],
        actual: [
          shift("act-fri-1", "work", "2024-03-08", "09:10", "14:45", [["12:58", "13:18"]]),
          shift("act-fri-2", "work", "2024-03-08", "15:00", "18:30", [["16:40", "16:55"]])
        ],
        reviewed: false
      },
      {
        date: "2024-03-09",
        scheduled: [],
        actual: [
          shift("act-sat-oc", "oncall", "2024-03-09", "18:00", "23:59", [], 40, "Rufbereitschaft Abend"),
          shift("act-sun-oc", "oncall", "2024-03-09", "23:59", "24:30", [], 40, "Rufbereitschaft Nacht")
        ],
        reviewed: true
      },
      {
        date: "2024-03-10",
        scheduled: [],
        actual: [],
        reviewed: false,
        notes: "Off – yet to confirm."
      }
    ]
  },
  {
    id: "night-shifts",
    label: "Nachtdienst Rotation",
    description:
      "Mehrere Nachtschichten mit Mitternachts-Connector, inkl. Schicht über DST-Grenzen und Konflikttest.",
    defaultBreakMinutes: 15,
    defaultShift: {
      start: "19:00",
      end: "07:00"
    },
    defaultOnCallCreditPct: 30,
    days: [
      {
        date: "2024-03-24",
        scheduled: [
          scheduled("n-sch-sun", "work", "2024-03-24", "19:00", "24:00"),
          scheduled("n-sch-mon", "work", "2024-03-24", "24:00", "07:00")
        ],
        actual: [
          shift("n-act-1", "work", "2024-03-24", "18:50", "24:00", [["00:45", "01:00"]], undefined, "Station Übergabe"),
          shift("n-act-1b", "work", "2024-03-24", "24:00", "07:20", [["02:05", "02:20"]])
        ],
        reviewed: true
      },
      {
        date: "2024-03-25",
        scheduled: [
          scheduled("n-sch-mon2", "work", "2024-03-25", "19:00", "24:00"),
          scheduled("n-sch-tue", "work", "2024-03-25", "24:00", "07:00")
        ],
        actual: [
          shift("n-act-2", "work", "2024-03-25", "19:05", "07:05", [["00:55", "01:10"]])
        ],
        reviewed: true
      },
      {
        date: "2024-03-30",
        scheduled: [
          scheduled("n-sch-dst1", "work", "2024-03-30", "19:00", "24:00"),
          scheduled("n-sch-dst2", "work", "2024-03-30", "24:00", "07:00")
        ],
        actual: [
          shift("n-act-dst", "work", "2024-03-30", "19:00", "07:30", [["01:00", "01:15"]])
        ],
        reviewed: false,
        notes: "DST spring forward, check totals."
      },
      {
        date: "2024-03-31",
        scheduled: [],
        actual: [
          shift("n-act-dst-call", "oncall", "2024-03-31", "12:00", "18:00", [], 30, "Bereitschaft"),
          shift("n-act-dst-call2", "oncall", "2024-03-31", "17:30", "21:00", [], 30, "Überlappend für Hinweis")
        ],
        reviewed: false,
        notes: "Intentional overlap to flag conflict."
      },
      {
        date: "2024-04-01",
        scheduled: [
          scheduled("n-sch-mon3", "work", "2024-04-01", "19:00", "24:00"),
          scheduled("n-sch-tue3", "work", "2024-04-01", "24:00", "07:00")
        ],
        actual: [
          shift("n-act-3a", "work", "2024-04-01", "19:10", "23:50", [["22:10", "22:20"]]),
          shift("n-act-3b", "work", "2024-04-01", "23:50", "07:05", [["02:35", "02:42"]])
        ],
        reviewed: true
      },
      {
        date: "2024-04-02",
        scheduled: [],
        actual: [],
        reviewed: true,
        notes: "Recovery day."
      },
      {
        date: "2024-04-03",
        scheduled: [],
        actual: [],
        reviewed: true
      }
    ]
  },
  {
    id: "edge-cases",
    label: "Edge Cases Mix",
    description:
      "Testdaten mit geteilter Schicht, Tag ohne Plan aber Arbeit, sowie 25-Stunden DST (Herbst).",
    defaultBreakMinutes: 20,
    defaultShift: {
      start: "07:00",
      end: "19:00"
    },
    defaultOnCallCreditPct: 50,
    days: [
      {
        date: "2024-10-26",
        scheduled: [
          scheduled("edge-sch-1", "work", "2024-10-26", "07:00", "15:00"),
          scheduled("edge-sch-2", "work", "2024-10-26", "15:00", "19:00")
        ],
        actual: [
          shift("edge-act-1", "work", "2024-10-26", "06:55", "11:30", [["09:00", "09:15"]]),
          shift("edge-act-2", "work", "2024-10-26", "14:15", "20:30", [["18:05", "18:20"]])
        ],
        reviewed: true
      },
      {
        date: "2024-10-27",
        scheduled: [
          scheduled("edge-sch-dst", "work", "2024-10-27", "07:00", "19:00")
        ],
        actual: [
          shift("edge-act-dst", "work", "2024-10-27", "07:00", "19:15", [["12:30", "13:00"]])
        ],
        reviewed: false,
        notes: "DST fall back – should show 25h day."
      },
      {
        date: "2024-10-28",
        scheduled: [],
        actual: [
          shift("edge-act-nosched", "work", "2024-10-28", "09:00", "17:45", [["13:00", "13:30"]])
        ],
        reviewed: false,
        notes: "No schedule but worked => entire day overtime."
      },
      {
        date: "2024-10-29",
        scheduled: [],
        actual: [],
        reviewed: true,
        notes: "Day off."
      },
      {
        date: "2024-10-30",
        scheduled: [
          scheduled("edge-sch-split", "work", "2024-10-30", "07:00", "11:00"),
          scheduled("edge-sch-split2", "work", "2024-10-30", "14:00", "18:00")
        ],
        actual: [
          shift("edge-act-split", "work", "2024-10-30", "06:45", "11:05", [["09:15", "09:30"]]),
          shift("edge-act-split2", "work", "2024-10-30", "13:40", "18:30", [["16:05", "16:20"]]),
          shift("edge-act-oncall", "oncall", "2024-10-30", "18:30", "22:00", [], 60, "Rufbereitschaft")
        ],
        reviewed: true
      },
      {
        date: "2024-10-31",
        scheduled: [],
        actual: [
          shift("edge-act-overlap-1", "work", "2024-10-31", "07:00", "12:00"),
          shift("edge-act-overlap-2", "work", "2024-10-31", "11:50", "16:30")
        ],
        reviewed: false,
        notes: "Overlap intentionally left to test conflict message."
      },
      {
        date: "2024-11-01",
        scheduled: [],
        actual: [],
        reviewed: true
      }
    ]
  }
];
