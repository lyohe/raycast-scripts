import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { homedir } from "node:os";

export const defaultCalendarFilename = "garbage-calendar.local.tsv";

export type CalendarEntry = {
  date: string;
  weekday: string;
  items: string[];
};

export type CalendarPathResolution = {
  path: string | null;
  source: "preference" | "auto" | "missing";
  searchedPaths: string[];
};

export function defaultCalendarSearchRoots(): string[] {
  return [
    process.env.RAYCAST_SCRIPTS_HOME,
    join(homedir(), "Projects", "raycast-scripts"),
    join(homedir(), "projects", "raycast-scripts"),
    join(homedir(), "src", "raycast-scripts"),
  ].filter((root): root is string => Boolean(root));
}

export function resolveCalendarPath(preferencePath: string | undefined, searchRoots: string[]): CalendarPathResolution {
  const trimmedPreferencePath = preferencePath?.trim();

  if (trimmedPreferencePath) {
    const path = expandPath(trimmedPreferencePath);
    return {
      path,
      source: "preference",
      searchedPaths: [path],
    };
  }

  const searchedPaths: string[] = [];
  for (const root of searchRoots) {
    for (const candidate of calendarPathCandidates(root)) {
      if (searchedPaths.includes(candidate)) {
        continue;
      }

      searchedPaths.push(candidate);

      if (existsSync(candidate)) {
        return {
          path: candidate,
          source: "auto",
          searchedPaths,
        };
      }
    }
  }

  return {
    path: null,
    source: "missing",
    searchedPaths,
  };
}

export function loadCalendarEntries(path: string): CalendarEntry[] {
  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [header, ...body] = lines;
  if (header !== "date\tweekday\titems") {
    throw new Error("Calendar TSV must start with: date<TAB>weekday<TAB>items");
  }

  return body.map((line, index) => {
    const columns = line.split("\t");
    if (columns.length !== 3) {
      throw new Error(`Invalid TSV row ${index + 2}: expected 3 columns`);
    }

    const [date, weekday, itemsText] = columns;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date at row ${index + 2}: ${date}`);
    }

    return {
      date,
      weekday,
      items: parseItems(itemsText),
    };
  });
}

export function entryForDate(entries: CalendarEntry[], date: Date): CalendarEntry | undefined {
  const key = formatDateKey(date);
  return entries.find((entry) => entry.date === key);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(entry: CalendarEntry): string {
  return `${entry.date}(${entry.weekday})`;
}

export function formatItems(items: string[]): string {
  return items.length > 0 ? items.map(formatItemWithEmoji).join("、") : "なし";
}

export function formatStatusItems(items: string[]): string {
  if (items.length === 0) {
    return "なし";
  }

  const full = items.map(formatItemWithEmoji).join("+");
  if (full.length <= 14) {
    return full;
  }

  const labels = items.map(shortItemLabel);
  return `${labels[0]}+${items.length - 1}`;
}

function parseItems(itemsText: string): string[] {
  if (itemsText === "なし") {
    return [];
  }

  return itemsText
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function shortItemLabel(item: string): string {
  const labels: Record<string, string> = {
    可燃ごみ: "可燃 🔥",
    不燃ごみ: "不燃 🧱",
    容器包装プラスチック: "プラ ♻️",
    小型家電: "小型家電 🔌",
    有害ごみ: "有害 ☣️",
    危険物: "危険 ⚠️",
    段ボール: "段ボール 📦",
    紙パック: "紙パック 🥛",
    新聞紙: "新聞紙 📰",
    雑がみ: "雑がみ 🗞️",
    古布: "古布 👕",
    "本・雑誌": "本・雑誌 📚",
    びん: "びん 🍾",
    かん: "かん 🥫",
    ペットボトル: "ペット 💧",
    "せん定枝等(申込制)": "せん定枝 🌿",
  };

  return labels[item] ?? item;
}

function formatItemWithEmoji(item: string): string {
  const emojis: Record<string, string> = {
    可燃ごみ: "🔥",
    不燃ごみ: "🧱",
    容器包装プラスチック: "♻️",
    小型家電: "🔌",
    有害ごみ: "☣️",
    危険物: "⚠️",
    段ボール: "📦",
    紙パック: "🥛",
    新聞紙: "📰",
    雑がみ: "🗞️",
    古布: "👕",
    "本・雑誌": "📚",
    びん: "🍾",
    かん: "🥫",
    ペットボトル: "💧",
    "せん定枝等(申込制)": "🌿",
  };

  const emoji = emojis[item];
  return emoji ? `${item} ${emoji}` : item;
}

function expandPath(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function calendarPathCandidates(root: string): string[] {
  const candidates: string[] = [];
  let current = resolve(root);
  const filesystemRoot = parse(current).root;

  while (true) {
    candidates.push(join(current, "data", defaultCalendarFilename));

    if (current === filesystemRoot) {
      break;
    }

    current = dirname(current);
  }

  return candidates;
}
