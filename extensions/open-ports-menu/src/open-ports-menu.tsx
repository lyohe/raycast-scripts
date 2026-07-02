import {
  Clipboard,
  Icon,
  LaunchType,
  LocalStorage,
  MenuBarExtra,
  Toast,
  environment,
  open,
  showToast,
} from "@raycast/api";
import { execFileSync } from "node:child_process";
import { useEffect, useState } from "react";

type OpenPort = {
  port: number;
  processName: string;
  pid: number;
  protocol: string;
  addresses: string[];
};

type OpenPortsState =
  | {
      status: "ready";
      ports: OpenPort[];
      updatedAt: Date;
    }
  | {
      status: "error";
      message: string;
      updatedAt: Date;
    };

type MenuBarState = {
  hidden: boolean;
  quit: () => Promise<void>;
};

const hiddenStorageKey = "open-ports-menu.hidden";
const menuBarIcon = "🔌";

export default function Command() {
  const menuBarState = useMenuBarState();
  const [portsState, setPortsState] = useState<OpenPortsState | undefined>(undefined);

  useEffect(() => {
    if (menuBarState?.hidden) {
      return;
    }

    setPortsState(loadOpenPortsState());
  }, [menuBarState?.hidden]);

  if (!menuBarState || !portsState) {
    return <MenuBarExtra icon={menuBarIcon} title="Ports: ..." tooltip="Loading open ports" isLoading />;
  }

  if (menuBarState.hidden) {
    return null;
  }

  async function refresh() {
    setPortsState(loadOpenPortsState());
    await showToast({ style: Toast.Style.Success, title: "Open ports refreshed" });
  }

  if (portsState.status === "error") {
    return (
      <MenuBarExtra icon={menuBarIcon} title="Ports: Error" tooltip={portsState.message}>
        <MenuBarExtra.Section title="Open Ports">
          <MenuBarExtra.Item title={portsState.message} icon={Icon.Warning} />
        </MenuBarExtra.Section>
        <ActionsSection updatedAt={portsState.updatedAt} onRefresh={refresh} onQuit={menuBarState.quit} />
      </MenuBarExtra>
    );
  }

  const title = `Ports: ${portsState.ports.length}`;
  const tooltip =
    portsState.ports.length > 0
      ? `${portsState.ports.length} listening TCP port${portsState.ports.length === 1 ? "" : "s"}`
      : "No listening TCP ports";

  return (
    <MenuBarExtra icon={menuBarIcon} title={title} tooltip={tooltip}>
      <MenuBarExtra.Section title="Open Ports">
        {portsState.ports.length === 0 ? (
          <MenuBarExtra.Item title="No listening TCP ports" icon={Icon.CheckCircle} />
        ) : (
          portsState.ports.map((port) => <OpenPortSubmenu key={`${port.pid}:${port.port}`} port={port} />)
        )}
      </MenuBarExtra.Section>

      <ActionsSection updatedAt={portsState.updatedAt} onRefresh={refresh} onQuit={menuBarState.quit} />
    </MenuBarExtra>
  );
}

function useMenuBarState(): MenuBarState | undefined {
  const [hidden, setHidden] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    async function initialize() {
      const storedHiddenValue = await LocalStorage.getItem<string>(hiddenStorageKey);
      const storedHidden = storedHiddenValue === "true";

      if (storedHidden && environment.launchType === LaunchType.UserInitiated) {
        await LocalStorage.removeItem(hiddenStorageKey);
        setHidden(false);
        return;
      }

      setHidden(storedHidden);
    }

    initialize();
  }, []);

  if (hidden === undefined) {
    return undefined;
  }

  async function quit() {
    await LocalStorage.setItem(hiddenStorageKey, "true");
    setHidden(true);
  }

  return { hidden, quit };
}

function loadOpenPortsState(): OpenPortsState {
  try {
    const output = execFileSync("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcPnT"], {
      encoding: "utf8",
      timeout: 5000,
    });

    return {
      status: "ready",
      ports: parseLsofOutput(output),
      updatedAt: new Date(),
    };
  } catch (error) {
    const commandError = error as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stdout = outputToString(commandError.stdout);
    const stderr = outputToString(commandError.stderr);

    if (commandError.status === 1 && stdout.trim() === "") {
      return {
        status: "ready",
        ports: [],
        updatedAt: new Date(),
      };
    }

    const message = stderr.trim() || commandError.message || "Failed to read open ports";
    return {
      status: "error",
      message,
      updatedAt: new Date(),
    };
  }
}

function outputToString(output: string | Buffer | undefined): string {
  if (!output) {
    return "";
  }
  return typeof output === "string" ? output : output.toString("utf8");
}

function parseLsofOutput(output: string): OpenPort[] {
  const ports = new Map<string, OpenPort & { addressSet: Set<string> }>();
  let currentPid: number | undefined;
  let currentProcessName: string | undefined;
  let currentProtocol = "TCP";

  for (const line of output.split("\n")) {
    if (line.length < 2) {
      continue;
    }

    const field = line[0];
    const value = line.slice(1);

    if (field === "p") {
      currentPid = Number.parseInt(value, 10);
      currentProcessName = undefined;
      currentProtocol = "TCP";
      continue;
    }

    if (field === "c") {
      currentProcessName = value;
      continue;
    }

    if (field === "P") {
      currentProtocol = value || "TCP";
      continue;
    }

    if (field !== "n" || currentPid === undefined || Number.isNaN(currentPid)) {
      continue;
    }

    const parsedEndpoint = parseEndpoint(value);
    if (!parsedEndpoint) {
      continue;
    }

    const key = `${currentPid}:${parsedEndpoint.port}`;
    const existing = ports.get(key);

    if (existing) {
      existing.addressSet.add(parsedEndpoint.address);
      existing.addresses = Array.from(existing.addressSet).sort(compareAddress);
      continue;
    }

    const addressSet = new Set([parsedEndpoint.address]);
    ports.set(key, {
      port: parsedEndpoint.port,
      processName: currentProcessName || "Unknown Process",
      pid: currentPid,
      protocol: currentProtocol,
      addresses: Array.from(addressSet),
      addressSet,
    });
  }

  return Array.from(ports.values())
    .map((entry) => ({
      port: entry.port,
      processName: entry.processName,
      pid: entry.pid,
      protocol: entry.protocol,
      addresses: entry.addresses,
    }))
    .sort((a, b) => a.port - b.port || a.processName.localeCompare(b.processName) || a.pid - b.pid);
}

function parseEndpoint(endpoint: string): { address: string; port: number } | undefined {
  const match = endpoint.match(/:(\d+)$/);
  if (!match) {
    return undefined;
  }

  const port = Number.parseInt(match[1], 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }

  const rawAddress = endpoint.slice(0, -match[0].length);
  const address = rawAddress.length > 0 ? rawAddress : "*";

  return { address, port };
}

function compareAddress(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a === "*") {
    return -1;
  }
  if (b === "*") {
    return 1;
  }
  return a.localeCompare(b);
}

function OpenPortSubmenu(props: { port: OpenPort }) {
  const { port } = props;
  const localhostURL = `http://localhost:${port.port}`;
  const summary = `${port.protocol} ${port.port} · ${port.processName} (PID ${port.pid})`;
  const addresses = port.addresses.join(", ");
  const lsofCommand = `lsof -nP -iTCP:${port.port} -sTCP:LISTEN`;

  return (
    <MenuBarExtra.Submenu title={`${port.port} · ${port.processName} · PID ${port.pid}`}>
      <MenuBarExtra.Section title="Details">
        <MenuBarExtra.Item title="Process" subtitle={`${port.processName} (PID ${port.pid})`} />
        <MenuBarExtra.Item title="Addresses" subtitle={addresses} />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section title="Actions">
        <MenuBarExtra.Item
          title="Open localhost"
          subtitle={localhostURL}
          icon={Icon.Globe}
          onAction={() => open(localhostURL)}
        />
        <MenuBarExtra.Item
          title="Copy localhost URL"
          subtitle={localhostURL}
          icon={Icon.Clipboard}
          onAction={() => Clipboard.copy(localhostURL)}
        />
        <MenuBarExtra.Item
          title="Copy Summary"
          subtitle={summary}
          icon={Icon.Clipboard}
          onAction={() => Clipboard.copy(`${summary} · ${addresses}`)}
        />
        <MenuBarExtra.Item
          title="Copy lsof Command"
          subtitle={lsofCommand}
          icon={Icon.Clipboard}
          onAction={() => Clipboard.copy(lsofCommand)}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra.Submenu>
  );
}

function ActionsSection(props: { updatedAt: Date; onRefresh: () => Promise<void>; onQuit: () => Promise<void> }) {
  return (
    <MenuBarExtra.Section title="Actions">
      <MenuBarExtra.Item
        title="Refresh"
        subtitle={`Updated ${formatTime(props.updatedAt)}`}
        icon={Icon.Repeat}
        onAction={props.onRefresh}
      />
      <MenuBarExtra.Item title="Quit Open Ports Menu" icon={Icon.Power} onAction={props.onQuit} />
    </MenuBarExtra.Section>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
