import { createEditorToolbar as createRichTextToolbar } from "../../core/richtext/toolbar.jsx";
import { pageEditorState } from "../../core/state.js";

export function createManuscriptToolbar(root, options = {}) {
  return createRichTextToolbar(root, {
    ...options,
    renderExtraControls: () => <BlockControls actions={pageEditorState.blockActions} />,
  });
}

// Not adding to core for now, though might make sense depending on how LiveBlog/Homepage go
function BlockControls({ actions }) {
  const state = actions?.getState() || {
    selected: false,
    upDisabled: true,
    downDisabled: true,
    editDisabled: true,
  };
  const buttons = [
    ["delete", "X", "Delete block", !state.selected],
    ["moveUp", "↑", "Move block up", state.upDisabled],
    ["moveDown", "↓", "Move block down", state.downDisabled],
    ["edit", "Edit", "Edit block", !state.selected || state.editDisabled],
    ["insert", "+", "Add block", !state.selected],
  ];

  return (
    <>
      <span className="pm-editor-toolbar__separator" aria-hidden="true" />
      {buttons.map(([action, label, title, disabled]) => (
        <button
          key={action}
          type="button"
          className={"pm-editor-toolbar__button pm-editor-toolbar__button--block-" + action}
          title={title}
          aria-label={title}
          disabled={disabled}
          onMouseDown={(event) => { event.preventDefault(); }}
          onClick={() => { actions?.[action](); }}
        >
          {label}
        </button>
      ))}
    </>
  );
}
