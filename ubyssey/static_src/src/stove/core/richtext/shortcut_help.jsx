// Shortcut documentation for the guide
// Maybe rename if we add more stuff, like guide.jsx

import { createRoot } from "react-dom/client";

const shortcutDefinitions = [
  { label: "Undo", key: "Mod-z" },
  { label: "Redo", key: "Mod-Shift-z" },
  { label: "Bold", key: "Mod-b" },
  { label: "Italic", key: "Mod-i" },
  { label: "Underline", key: "Mod-u" },
  { label: "Insert Link", key: "Mod-k" },
];

export function mountShortcutDocumentation(container) {
  createRoot(container).render(<ShortcutDocumentation />);
}

function ShortcutDocumentation() {
  const modifierKeyPrefix = navigator.platform.startsWith("Mac") || navigator.platform === "iPhone" ? "⌘" : "Ctrl";
  return (
    <div className="shortcut-documentation">
      <h3>Shortcuts</h3>
      <ul>
        {shortcutDefinitions.map((shortcut) => {
          const formattedKey = shortcut.key.replace("Mod", modifierKeyPrefix);
          return (
            <li key={shortcut.key}><b>{shortcut.label}:</b> {formattedKey}</li>
          );
        })}
      </ul>
    </div>
  );
}
