import {
  Clipboard,
  Icon,
  LaunchType,
  LocalStorage,
  MenuBarExtra,
  Toast,
  environment,
  getPreferenceValues,
  openCommandPreferences,
  showToast,
} from "@raycast/api";
import { existsSync } from "node:fs";
import { useEffect, useState } from "react";

import {
  CalendarEntry,
  addDays,
  defaultCalendarSearchRoots,
  entryForDate,
  formatDateLabel,
  formatItems,
  formatStatusItems,
  loadCalendarEntries,
  resolveCalendarPath,
} from "./garbage-calendar";

type Preferences = {
  calendarPath?: string;
};

const hiddenStorageKey = "tomorrow-garbage.hidden";
const selectedDayOffsetStorageKey = "tomorrow-garbage.selected-day-offset";
const defaultSelectedDayOffset = 1;
const maxSelectableDayOffset = 7;

type MenuBarState = {
  hidden: boolean;
  selectedDayOffset: number;
  selectDayOffset: (offset: number) => Promise<void>;
  quit: () => Promise<void>;
};

type ScheduleState =
  | {
      status: "ready";
      calendarPath: string;
      source: "preference" | "auto";
      today: CalendarEntry | undefined;
      tomorrow: CalendarEntry | undefined;
      dayAfterTomorrow: CalendarEntry | undefined;
      upcoming: Array<CalendarEntry | undefined>;
    }
  | {
      status: "missing";
      searchedPaths: string[];
    }
  | {
      status: "error";
      calendarPath: string;
      message: string;
    };

export default function Command() {
  const menuBarState = useMenuBarState();

  if (!menuBarState) {
    return <MenuBarExtra icon={Icon.Trash} title="明日: 読込中" tooltip="Loading garbage schedule" isLoading />;
  }

  if (menuBarState.hidden) {
    return null;
  }

  const state = loadScheduleState();

  if (state.status === "missing") {
    return (
      <MenuBarExtra icon={Icon.Trash} title="明日: 未設定" tooltip="Garbage calendar TSV is not configured">
        <MenuBarExtra.Section title="Calendar">
          <MenuBarExtra.Item title="Calendar TSV was not found" icon={Icon.Warning} />
          <MenuBarExtra.Item
            title="Open Preferences"
            icon={Icon.Gear}
            onAction={() => {
              openCommandPreferences();
            }}
          />
          <MenuBarExtra.Item
            title="Copy Searched Paths"
            icon={Icon.Clipboard}
            onAction={async () => {
              await Clipboard.copy(state.searchedPaths.join("\n"));
              await showToast({ style: Toast.Style.Success, title: "Copied searched paths" });
            }}
          />
          <QuitMenuItem onQuit={menuBarState.quit} />
        </MenuBarExtra.Section>
      </MenuBarExtra>
    );
  }

  if (state.status === "error") {
    return (
      <MenuBarExtra icon={Icon.Trash} title="明日: エラー" tooltip={state.message}>
        <MenuBarExtra.Section title="Calendar Error">
          <MenuBarExtra.Item title={state.message} icon={Icon.Warning} />
          <MenuBarExtra.Item
            title="Copy Calendar Path"
            subtitle={state.calendarPath}
            icon={Icon.Clipboard}
            onAction={async () => {
              await Clipboard.copy(state.calendarPath);
              await showToast({ style: Toast.Style.Success, title: "Copied calendar path" });
            }}
          />
          <MenuBarExtra.Item
            title="Open Preferences"
            icon={Icon.Gear}
            onAction={() => {
              openCommandPreferences();
            }}
          />
          <QuitMenuItem onQuit={menuBarState.quit} />
        </MenuBarExtra.Section>
      </MenuBarExtra>
    );
  }

  const selectedLabel = labelForDayOffset(menuBarState.selectedDayOffset);
  const selectedEntry = entryForDayOffset(state, menuBarState.selectedDayOffset);
  const title = selectedEntry
    ? `${selectedLabel}: ${formatStatusItems(selectedEntry.items)}`
    : `${selectedLabel}: 期間外`;
  const tooltip = selectedEntry
    ? `${formatDateLabel(selectedEntry)} ${formatItems(selectedEntry.items)}`
    : `${selectedLabel} is outside the configured calendar range`;

  return (
    <MenuBarExtra icon={Icon.Trash} title={title} tooltip={tooltip}>
      <MenuBarExtra.Section title="Garbage Schedule">
        <ScheduleItem
          label="明日"
          entry={state.tomorrow}
          icon={Icon.Calendar}
          offset={1}
          selectedOffset={menuBarState.selectedDayOffset}
          onSelect={menuBarState.selectDayOffset}
        />
        <ScheduleItem
          label="今日"
          entry={state.today}
          icon={Icon.Clock}
          offset={0}
          selectedOffset={menuBarState.selectedDayOffset}
          onSelect={menuBarState.selectDayOffset}
        />
        <ScheduleItem
          label="明後日"
          entry={state.dayAfterTomorrow}
          icon={Icon.Forward}
          offset={2}
          selectedOffset={menuBarState.selectedDayOffset}
          onSelect={menuBarState.selectDayOffset}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Submenu title="Upcoming 7 Days" icon={Icon.List}>
        {state.upcoming.map((entry, index) => {
          const offset = index + 1;
          return (
            <ScheduleItem
              key={entry?.date ?? index}
              label={`+${offset}`}
              entry={entry}
              offset={offset}
              selectedOffset={menuBarState.selectedDayOffset}
              onSelect={menuBarState.selectDayOffset}
            />
          );
        })}
      </MenuBarExtra.Submenu>

      <MenuBarExtra.Section title="Actions">
        <MenuBarExtra.Item
          title="Copy Displayed Schedule"
          icon={Icon.Clipboard}
          onAction={async () => {
            await Clipboard.copy(formatClipboardLine(selectedLabel, selectedEntry));
            await showToast({ style: Toast.Style.Success, title: "Copied displayed schedule" });
          }}
        />
        <MenuBarExtra.Item
          title="Copy Calendar Path"
          subtitle={state.calendarPath}
          icon={Icon.Document}
          onAction={async () => {
            await Clipboard.copy(state.calendarPath);
            await showToast({ style: Toast.Style.Success, title: "Copied calendar path" });
          }}
        />
        <MenuBarExtra.Item
          title="Open Preferences"
          subtitle={state.source === "auto" ? "Using auto-detected TSV path" : "Using preference TSV path"}
          icon={Icon.Gear}
          onAction={() => {
            openCommandPreferences();
          }}
        />
        <QuitMenuItem onQuit={menuBarState.quit} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

function useMenuBarState(): MenuBarState | undefined {
  const [state, setState] = useState<Omit<MenuBarState, "selectDayOffset" | "quit"> | undefined>(undefined);

  useEffect(() => {
    async function initialize() {
      const [storedHiddenValue, storedSelectedDayOffset] = await Promise.all([
        LocalStorage.getItem<string>(hiddenStorageKey),
        LocalStorage.getItem<string>(selectedDayOffsetStorageKey),
      ]);
      const storedHidden = storedHiddenValue === "true";
      const selectedDayOffset = parseSelectedDayOffset(storedSelectedDayOffset);

      if (storedHidden && environment.launchType === LaunchType.UserInitiated) {
        await LocalStorage.removeItem(hiddenStorageKey);
        setState({ hidden: false, selectedDayOffset });
        return;
      }

      setState({ hidden: storedHidden, selectedDayOffset });
    }

    initialize();
  }, []);

  if (!state) {
    return undefined;
  }

  async function selectDayOffset(offset: number) {
    const selectedDayOffset = parseSelectedDayOffset(String(offset));
    await LocalStorage.setItem(selectedDayOffsetStorageKey, String(selectedDayOffset));
    setState((currentState) => ({ hidden: currentState?.hidden ?? false, selectedDayOffset }));
  }

  async function quit() {
    await LocalStorage.setItem(hiddenStorageKey, "true");
    setState((currentState) => ({
      hidden: true,
      selectedDayOffset: currentState?.selectedDayOffset ?? defaultSelectedDayOffset,
    }));
  }

  return { ...state, selectDayOffset, quit };
}

function loadScheduleState(): ScheduleState {
  const preferences = getPreferenceValues<Preferences>();
  const resolvedPath = resolveCalendarPath(preferences.calendarPath, [
    ...defaultCalendarSearchRoots(),
    process.cwd(),
    environment.assetsPath,
    environment.supportPath,
    __dirname,
  ]);

  if (!resolvedPath.path) {
    return {
      status: "missing",
      searchedPaths: resolvedPath.searchedPaths,
    };
  }

  if (!existsSync(resolvedPath.path)) {
    return {
      status: "error",
      calendarPath: resolvedPath.path,
      message: "Calendar TSV does not exist",
    };
  }

  try {
    const entries = loadCalendarEntries(resolvedPath.path);
    const now = new Date();

    return {
      status: "ready",
      calendarPath: resolvedPath.path,
      source: resolvedPath.source === "preference" ? "preference" : "auto",
      today: entryForDate(entries, now),
      tomorrow: entryForDate(entries, addDays(now, 1)),
      dayAfterTomorrow: entryForDate(entries, addDays(now, 2)),
      upcoming: Array.from({ length: 7 }, (_, index) => entryForDate(entries, addDays(now, index + 1))),
    };
  } catch (error) {
    return {
      status: "error",
      calendarPath: resolvedPath.path,
      message: error instanceof Error ? error.message : "Failed to read calendar TSV",
    };
  }
}

function QuitMenuItem(props: { onQuit: () => Promise<void> }) {
  return <MenuBarExtra.Item title="Quit Garbage Menu" icon={Icon.XMarkCircle} onAction={props.onQuit} />;
}

function ScheduleItem(props: {
  label: string;
  entry: CalendarEntry | undefined;
  icon?: Icon;
  offset: number;
  selectedOffset: number;
  onSelect: (offset: number) => Promise<void>;
}) {
  const { label, entry, icon, offset, selectedOffset, onSelect } = props;
  const isSelected = offset === selectedOffset;
  const itemIcon = isSelected ? Icon.CheckCircle : icon;
  const onAction = async () => {
    await onSelect(offset);
  };

  if (!entry) {
    return <MenuBarExtra.Item title={`${label}: 期間外`} icon={itemIcon} onAction={onAction} />;
  }

  return (
    <MenuBarExtra.Item
      title={`${label}: ${formatItems(entry.items)}`}
      subtitle={formatDateLabel(entry)}
      icon={itemIcon}
      onAction={onAction}
    />
  );
}

function formatClipboardLine(label: string, entry: CalendarEntry | undefined): string {
  if (!entry) {
    return `${label}: 期間外`;
  }

  return `${label} ${formatDateLabel(entry)} ${formatItems(entry.items)}`;
}

function entryForDayOffset(
  state: Extract<ScheduleState, { status: "ready" }>,
  offset: number,
): CalendarEntry | undefined {
  if (offset === 0) {
    return state.today;
  }

  if (offset === 1) {
    return state.tomorrow;
  }

  if (offset === 2) {
    return state.dayAfterTomorrow;
  }

  return state.upcoming[offset - 1];
}

function labelForDayOffset(offset: number): string {
  if (offset === 0) {
    return "今日";
  }

  if (offset === 1) {
    return "明日";
  }

  if (offset === 2) {
    return "明後日";
  }

  return `+${offset}`;
}

function parseSelectedDayOffset(value: string | undefined): number {
  const offset = Number(value);
  if (Number.isInteger(offset) && offset >= 0 && offset <= maxSelectableDayOffset) {
    return offset;
  }

  return defaultSelectedDayOffset;
}
