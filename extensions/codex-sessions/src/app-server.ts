import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface, Interface } from "node:readline";

export type ThreadActiveFlag = "waitingOnApproval" | "waitingOnUserInput";

export type ThreadStatus =
  | { type: "notLoaded" }
  | { type: "idle" }
  | { type: "systemError" }
  | { type: "active"; activeFlags: ThreadActiveFlag[] };

export type CodexThread = {
  id: string;
  preview: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  recencyAt: number | null;
  status: ThreadStatus;
  cwd: string;
  name: string | null;
};

type ThreadListResponse = {
  data: CodexThread[];
  nextCursor: string | null;
};

type RpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

const REQUEST_TIMEOUT_MS = 15_000;

class AppServerClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: Interface;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly stderr: string[] = [];
  private nextRequestId = 1;
  private closed = false;

  constructor(codexCliPath: string) {
    this.child = spawn(codexCliPath, ["app-server", "--listen", "stdio://"], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.lines = createInterface({ input: this.child.stdout });

    this.lines.on("line", (line) => this.handleLine(line));
    this.child.stderr.on("data", (chunk: Buffer) => this.stderr.push(chunk.toString()));
    this.child.on("error", (error) => this.failAll(error));
    this.child.on("exit", (code, signal) => {
      if (!this.closed) {
        const detail = this.stderr.join("").trim();
        const reason = detail || `Codex App Server exited (code: ${code ?? "none"}, signal: ${signal ?? "none"}).`;
        this.failAll(new Error(reason));
      }
    });
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: {
        name: "raycast_codex_sessions",
        title: "Raycast Codex Sessions",
        version: "0.1.0",
      },
      capabilities: null,
    });
    this.send({ method: "initialized" });
  }

  async listThreads(cursor: string | null): Promise<ThreadListResponse> {
    return this.request<ThreadListResponse>("thread/list", {
      cursor,
      limit: 100,
      sortKey: "created_at",
      sortDirection: "desc",
      sourceKinds: ["appServer", "cli", "vscode"],
      archived: false,
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.lines.close();
    this.child.stdin.end();
    this.child.kill();
    this.failAll(new Error("Codex App Server connection closed."));
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextRequestId++;

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });
      this.send({ method, id, params });
    });
  }

  private send(message: unknown) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string) {
    let response: RpcResponse;

    try {
      response = JSON.parse(line) as RpcResponse;
    } catch {
      this.failAll(new Error(`Codex App Server returned invalid JSON: ${line}`));
      return;
    }

    if (response.id === undefined) return;

    const pending = this.pending.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pending.delete(response.id);

    if (response.error) {
      pending.reject(new Error(`Codex App Server error ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  private failAll(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export async function listCodexThreads(codexCliPath: string): Promise<CodexThread[]> {
  await access(codexCliPath, constants.X_OK).catch(() => {
    throw new Error(`Codex CLIを実行できません: ${codexCliPath}`);
  });

  const client = new AppServerClient(codexCliPath);

  try {
    await client.initialize();

    const threads: CodexThread[] = [];
    const cursors = new Set<string>();
    let cursor: string | null = null;

    do {
      const response = await client.listThreads(cursor);
      threads.push(...response.data);
      cursor = response.nextCursor;

      if (cursor && cursors.has(cursor)) {
        throw new Error("Codex App Server returned the same pagination cursor twice.");
      }
      if (cursor) cursors.add(cursor);
    } while (cursor);

    return threads.sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    client.close();
  }
}
