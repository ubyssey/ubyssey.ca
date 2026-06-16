// Public StreamField editor API that assembles schema, node views, and serialization.

import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createEditorToolbar, editorPlugins } from "./prosemirror_base";
import { streamSchema, ControlFieldView, EditableFieldView, ListFieldView, ListItemView, StreamBlockView, refreshMoveControls } from "./stream_schema";
import { createEmptyRichTextBlock, createStreamBlockNodeFromRegistry, streamBlockToPmNode } from "./stream_serialization";

// Creates a prosemirror editor for each streamfield textarea (ie header or content for StandardArticle)
export function createStreamEditor(textarea, streamEditor, options = {}) {
  const {
    createToolbar = createEditorToolbar,
    onDocChanged = () => {},
    onTransaction = () => {},
  } = options;
  const fieldName = textarea.dataset.streamField;
  const mount = document.querySelector(`[data-stream-editor="${window.CSS.escape(fieldName)}"]`);
  const blockTypes = streamEditor.blockTypes || {};
  const blocks = streamEditor.blocks || [];

  const content = blocks.map(streamBlockToPmNode);
  const availableBlockTypes = Array.from(new Set([
    ...Object.keys(blockTypes),
    ...blocks.map((block) => block.type),
  ])).sort((a, b) => a.localeCompare(b));

  const doc = {
    type: "doc",
    content: content.length ? content : [createEmptyRichTextBlock()],
  };

  let instance;
  let sidebarToolbar;
  let view;
  view = new EditorView(mount, {
    state: EditorState.create({
      doc: streamSchema.nodeFromJSON(doc),
      plugins: editorPlugins(streamSchema),
    }),

    // On update of editor state, updates preview and sidebar
    dispatchTransaction(transaction) {
      view.updateState(view.state.apply(transaction));
      sidebarToolbar?.update();
      onTransaction({ transaction, instance, view });
      if (transaction.docChanged) {
        refreshMoveControls(view);
        onDocChanged({ transaction, instance, view });
      }
    },

    nodeViews: {
      stream_block(node, view, getPos) {
        return new StreamBlockView(node, view, getPos, {
          blockTypes,
          availableBlockTypes,
        });
      },

      editable_field(node) {
        return new EditableFieldView(node);
      },

      list_field(node, view, getPos) {
        return new ListFieldView(node, view, getPos);
      },

      list_item(node, view, getPos) {
        return new ListItemView(node, view, getPos);
      },

      control_field(node, view, getPos) {
        return new ControlFieldView(node, view, getPos);
      },
    },
  });

  const toolbarMount = document.createElement("div");
  toolbarMount.className = "pm-sidebar-toolbar";
  mount.before(toolbarMount);
  sidebarToolbar = createToolbar(toolbarMount, { view });

  instance = {
    fieldName,
    textarea,
    view,
    mount,
    blockTypes,
    availableBlockTypes,
  };

  return instance;
}

export function createStreamBlockNode(instance, blockType) {
  return createStreamBlockNodeFromRegistry(instance.blockTypes, blockType);
}
