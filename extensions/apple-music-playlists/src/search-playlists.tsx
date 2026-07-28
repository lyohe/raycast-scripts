import { Action, ActionPanel, Icon, List, Toast, showHUD, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";

import { MusicPlaylist, listPlaylists, playPlaylist } from "./apple-music";

export default function Command() {
  const { data: playlists = [], error, isLoading, revalidate } = usePromise(listPlaylists);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="プレイリスト名を入力">
      {error ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="プレイリストを取得できませんでした"
          description={error.message}
          actions={
            <ActionPanel>
              <Action title="再読み込み" icon={Icon.RotateClockwise} onAction={revalidate} />
            </ActionPanel>
          }
        />
      ) : (
        playlists.map((playlist) => <PlaylistItem key={playlist.persistentId} playlist={playlist} />)
      )}
    </List>
  );
}

function PlaylistItem({ playlist }: { playlist: MusicPlaylist }) {
  async function handlePlay() {
    try {
      await playPlaylist(playlist.persistentId);
      await showHUD(`再生中: ${playlist.name}`);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "プレイリストを再生できませんでした",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <List.Item
      title={playlist.name}
      icon={Icon.Music}
      actions={
        <ActionPanel>
          <Action title="プレイリストを再生" icon={Icon.Play} onAction={handlePlay} />
        </ActionPanel>
      }
    />
  );
}
