import { Clipboard, Icon, MenuBarExtra, Toast, open, showToast } from "@raycast/api";

const copiedText = "Menu Bar Command Template";
// Use a built-in Raycast API icon, or replace this with a single emoji such as "⚡".
const menuBarIcon = Icon.Bolt;

export default function Command() {
  const updatedAt = new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <MenuBarExtra icon={menuBarIcon} tooltip="Status Bar Menu Template">
      <MenuBarExtra.Section title="Status">
        <MenuBarExtra.Item title="Template Menu" subtitle={`Updated ${updatedAt}`} icon={Icon.CheckCircle} />
        <MenuBarExtra.Item
          title="Show Test Toast"
          icon={Icon.Bell}
          onAction={() =>
            showToast({
              style: Toast.Style.Success,
              title: "Menu action executed",
            })
          }
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Submenu title="Submenu" icon={Icon.List}>
        <MenuBarExtra.Item
          title="Copy Template Name"
          icon={Icon.Clipboard}
          onAction={async () => {
            await Clipboard.copy(copiedText);
            await showToast({
              style: Toast.Style.Success,
              title: "Copied template name",
            });
          }}
        />
        <MenuBarExtra.Item
          title="Open Raycast Docs"
          icon={Icon.Globe}
          onAction={() => open("https://developers.raycast.com/api-reference/menu-bar-commands")}
        />
      </MenuBarExtra.Submenu>
    </MenuBarExtra>
  );
}
