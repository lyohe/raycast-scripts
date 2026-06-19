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
import { useEffect, useState } from "react";

const copiedText = "Menu Bar Command Template";
const hiddenStorageKey = "status-bar-menu-template.hidden";
// Use a built-in Raycast API icon, or replace this with a single emoji such as "⚡".
const menuBarIcon = Icon.Bolt;

export default function Command() {
  const [isHidden, setIsHidden] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    async function initialize() {
      const storedHiddenValue = await LocalStorage.getItem<string>(hiddenStorageKey);
      const storedHidden = storedHiddenValue === "true";

      if (storedHidden && environment.launchType === LaunchType.UserInitiated) {
        await LocalStorage.removeItem(hiddenStorageKey);
        setIsHidden(false);
        return;
      }

      setIsHidden(storedHidden);
    }

    initialize();
  }, []);

  if (isHidden === undefined) {
    return <MenuBarExtra icon={menuBarIcon} tooltip="Status Bar Menu Template" isLoading />;
  }

  if (isHidden) {
    return null;
  }

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

      <MenuBarExtra.Section title="Actions">
        <MenuBarExtra.Item
          title="Quit Template Menu"
          icon={Icon.XMarkCircle}
          onAction={async () => {
            await LocalStorage.setItem(hiddenStorageKey, "true");
            setIsHidden(true);
          }}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
