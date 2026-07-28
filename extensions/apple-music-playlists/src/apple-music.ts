import { runAppleScript } from "@raycast/utils";

export type MusicPlaylist = {
  persistentId: string;
  name: string;
};

const listPlaylistsScript = String.raw`
set fieldSeparator to ASCII character 31
set recordSeparator to ASCII character 30

tell application "Music"
  set playlistRows to {}

  repeat with musicPlaylist in every user playlist
    if class of musicPlaylist is not folder playlist then
      set playlistId to persistent ID of musicPlaylist
      set playlistName to name of musicPlaylist
      set end of playlistRows to playlistId & fieldSeparator & playlistName
    end if
  end repeat
end tell

set previousDelimiters to AppleScript's text item delimiters
set AppleScript's text item delimiters to recordSeparator
set output to playlistRows as text
set AppleScript's text item delimiters to previousDelimiters
return output
`;

const playPlaylistScript = String.raw`
on run argv
  set targetPersistentId to item 1 of argv

  tell application "Music"
    set matchedPlaylists to every user playlist whose persistent ID is targetPersistentId

    if (count of matchedPlaylists) is 0 then
      error "Playlist not found"
    end if

    play item 1 of matchedPlaylists
  end tell
end run
`;

export async function listPlaylists(): Promise<MusicPlaylist[]> {
  const output = await runAppleScript(listPlaylistsScript);

  return parsePlaylistRows(output).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export async function playPlaylist(persistentId: string): Promise<void> {
  await runAppleScript(playPlaylistScript, [persistentId]);
}

export function parsePlaylistRows(output: string): MusicPlaylist[] {
  if (!output) {
    return [];
  }

  return output
    .split("\u001e")
    .filter(Boolean)
    .map((row) => {
      const separatorIndex = row.indexOf("\u001f");
      if (separatorIndex < 1) {
        throw new Error("Music returned an invalid playlist record");
      }

      return {
        persistentId: row.slice(0, separatorIndex),
        name: row.slice(separatorIndex + 1),
      };
    });
}
