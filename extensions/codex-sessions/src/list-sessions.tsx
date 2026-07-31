import { Action, ActionPanel, Color, Icon, Keyboard, List, getPreferenceValues } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { CodexThread, ThreadStatus, listCodexThreads } from "./app-server";

type Preferences = {
  codexCliPath: string;
};

export default function Command() {
  const { codexCliPath } = getPreferenceValues<Preferences>();
  const { data: threads = [], error, isLoading, revalidate } = usePromise(listCodexThreads, [codexCliPath]);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Codexセッションを検索">
      {error ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Codexセッションを取得できませんでした"
          description={error.message}
          actions={
            <ActionPanel>
              <Action title="再読み込み" icon={Icon.RotateClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      ) : threads.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Message}
          title="Codexセッションがありません"
          description="CodexアプリまたはCLIでセッションを作成すると、ここに表示されます。"
          actions={
            <ActionPanel>
              <Action title="再読み込み" icon={Icon.RotateClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      ) : (
        threads.map((thread) => <SessionItem key={thread.id} thread={thread} revalidate={revalidate} />)
      )}
    </List>
  );
}

function SessionItem({ thread, revalidate }: { thread: CodexThread; revalidate: () => void }) {
  const status = presentStatus(thread.status);
  const title = thread.name?.trim() || thread.preview.trim() || "名称未設定のセッション";
  const deepLink = `codex://threads/${encodeURIComponent(thread.id)}`;

  return (
    <List.Item
      title={title}
      subtitle={thread.cwd}
      icon={thread.isPinned ? Icon.Pin : Icon.Message}
      keywords={[thread.preview, thread.cwd, thread.id]}
      accessories={[
        { tag: { value: status.label, color: status.color }, tooltip: status.tooltip },
        { date: new Date(thread.createdAt * 1000), tooltip: "作成日時" },
      ]}
      actions={
        <ActionPanel>
          <Action.Open title="Codexで開く" target={deepLink} icon={Icon.ArrowNe} />
          <Action
            title="再読み込み"
            icon={Icon.RotateClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
          <Action.CopyToClipboard title="セッションIDをコピー" content={thread.id} />
        </ActionPanel>
      }
    />
  );
}

function presentStatus(status: ThreadStatus): { label: string; color: Color; tooltip: string } {
  if (status.type === "active") {
    if (status.activeFlags.includes("waitingOnApproval")) {
      return { label: "承認待ち", color: Color.Orange, tooltip: "Codexが操作の承認を待っています" };
    }
    if (status.activeFlags.includes("waitingOnUserInput")) {
      return { label: "入力待ち", color: Color.Blue, tooltip: "Codexがユーザー入力を待っています" };
    }
    return { label: "実行中", color: Color.Green, tooltip: "Codexが処理中です" };
  }

  switch (status.type) {
    case "idle":
      return { label: "待機中", color: Color.Blue, tooltip: "セッションは読み込まれています" };
    case "systemError":
      return { label: "エラー", color: Color.Red, tooltip: "Codexでシステムエラーが発生しました" };
    case "notLoaded":
      return { label: "保存済み", color: Color.SecondaryText, tooltip: "保存済みのセッションです" };
  }
}
