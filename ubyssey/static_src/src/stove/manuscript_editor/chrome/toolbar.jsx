import { createEditorToolbar as createRichTextToolbar } from "../../core/richtext/toolbar.jsx";
import { pageEditorState } from "../../core/state.js";
import { topLevelBlockInfoByIdOrIndex } from "../../core/prosemirror/blocks.js";
import { blockTypeLabel } from "../../core/prosemirror/stream_node_views.jsx";

export function createManuscriptToolbar(root, options = {}) {
  return createRichTextToolbar(root, {
    ...options,
    renderExtraControls: () => <BlockControls actions={pageEditorState.blockActions} />,
    renderRightControls: () => <SelectedBlockLabel/>,
  });
}

function SelectedBlockLabel() {
  const selected = pageEditorState.selectedBlock;
  const instance = selected && pageEditorState.streamEditors.find((item) => item.fieldName === selected.fieldName);
  const block = instance && topLevelBlockInfoByIdOrIndex(instance.doc, selected.blockId, selected.blockIndex);
  if (!block) return null;

  return <span>{blockTypeLabel(block.node.attrs?.blockType)}</span>;
}

// This is the worst place for it, but I'll leave it for now
// Creates block only toolbar for homepage editor
export function createBlockToolbar(root, options = {}) {
  return createRichTextToolbar(root, {
    ...options,
    toolbarItems: [],
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
    ["insert", "+", "Add block", !state.selected],
    ["edit", "Edit", "Edit block", !state.selected || state.editDisabled],
    ["moveUp", "↑", "Move block up", state.upDisabled],
    ["moveDown", "↓", "Move block down", state.downDisabled],
    ["delete", "X", "Delete block", !state.selected],
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
