// Creates StreamField Editors

import { useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { EditorState } from "prosemirror-state";
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEffect,
} from "@handlewithcare/react-prosemirror";

import { editorPlugins } from "../rich_text/index.jsx";
import { createEditorToolbar } from "../rich_text/toolbar.jsx";
import {
  createEmptyRichTextBlock,
  createStreamBlockNodeFromRegistry,
  streamBlockToPmNode,
} from "./serialization.js";
import { streamSchema } from "./schema.js";
import { streamNodeViews } from "./node_views.jsx";

export { blockTypeLabel } from "./node_views.jsx";
export { clone, pmDocToStreamValue } from "./serialization.js";
export {
  deleteTopLevelBlock,
  moveTopLevelBlock,
  topLevelBlockInfoByIdOrIndex,
} from "./commands.js";

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

  const defaultState = EditorState.create({
    doc: streamSchema.nodeFromJSON({
      type: "doc",
      content: content.length ? content : [createEmptyRichTextBlock()],
    }),
    plugins: [
      reactKeys(),
      ...editorPlugins(streamSchema),
    ],
  });

  const toolbarMount = document.createElement("div");
  toolbarMount.className = "pm-sidebar-toolbar";
  mount.before(toolbarMount);

  const instance = {
    fieldName,
    textarea,
    view: null,
    mount,
    blockTypes,
    availableBlockTypes,
  };
  let sidebarToolbar = null;

  const root = createRoot(mount);
  flushSync(() => {
    root.render(
      <StreamEditor
        defaultState={defaultState}
        instance={instance}
        blockTypes={blockTypes}
        availableBlockTypes={availableBlockTypes}
        onTransaction={onTransaction}
        onDocChanged={onDocChanged}
        updateToolbar={() => { sidebarToolbar.update(); }}
      />,
    );
  });

  sidebarToolbar = createToolbar(toolbarMount, { view: instance.view });
  return instance;
}

function StreamEditor({
  defaultState,
  instance,
  blockTypes,
  availableBlockTypes,
  onTransaction,
  onDocChanged,
  updateToolbar,
}) {
  const transactions = useRef([]);

  return (
    <ProseMirror
      defaultState={defaultState}
      dispatchTransaction={(transaction) => {
        transactions.current.push(transaction);
      }}
      nodeViewComponents={streamNodeViews({ blockTypes, availableBlockTypes })}
    >
      <StreamEditorViewBridge
        instance={instance}
        transactions={transactions}
        onTransaction={onTransaction}
        onDocChanged={onDocChanged}
        updateToolbar={updateToolbar}
      />
      <ProseMirrorDoc />
    </ProseMirror>
  );
}

function StreamEditorViewBridge({ instance, transactions, onTransaction, onDocChanged, updateToolbar }) {
  useEditorEffect((view) => {
    instance.view = view;

    transactions.current.forEach((transaction) => {
      updateToolbar();
      onTransaction({ transaction, instance, view });
      if (transaction.docChanged) {
        onDocChanged({ transaction, instance, view });
      }
    });
    transactions.current = [];
  });

  return null;
}

export function createStreamBlockNode(instance, blockType) {
  return createStreamBlockNodeFromRegistry(instance.blockTypes, blockType);
}
