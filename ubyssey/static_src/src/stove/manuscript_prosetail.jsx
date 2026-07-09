// Schema, Node Views, Serialization for Wagtail StreamFields in Prosemirror
// Wagtail StreamField - Prosemirror integration

import { forwardRef, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { DOMParser, DOMSerializer, Fragment, Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { ProseMirror, ProseMirrorDoc, reactKeys, useEditorEffect, useEditorEventCallback, useEditorStateSelector, useIgnoreMutation, useStopEvent } from "@handlewithcare/react-prosemirror";
import { v4 as uuidv4 } from "uuid";
import { baseNodesWithLists, createEditorToolbar, editorPlugins, marks, richTextSchema } from "./manuscript_prosemirror.jsx";

// Document Schema
const streamNodes = baseNodesWithLists.remove("doc").append({
  doc: {
    content: "stream_block+",
  },

  stream_block: {
    content: "(editable_field | control_field | list_field)*",
    isolating: true,
    defining: true,
    attrs: {
      id: { default: null },
      blockType: { default: null },
      originalValue: { default: null },
      blockComments: { default: [] },
    },

    toDOM(node) {
      return [
        "section",
        {
          class: "pm-stream-block",
          "data-block-type": node.attrs.blockType || "",
        },
        [
          "div",
          { class: "pm-stream-block__label" },
          node.attrs.blockType || "block",
        ],
        ["div", { class: "pm-stream-block__body" }, 0],
      ];
    },
  },

  editable_field: {
    content: "block*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "Content" },
      mode: { default: "richtext" },
      manuscriptOwned: { default: false },
    },

    toDOM(node) {
      return [
        "div",
        {
          class: "pm-editable-field",
          "data-field-label": node.attrs.label || "Content",
        },
        [
          "div",
          { class: "pm-editable-field__label" },
          node.attrs.label || "Content",
        ],
        ["div", { class: "pm-editable-field__body" }, 0],
      ];
    },
  },

  control_field: {
    atom: true,
    selectable: false,
    isolating: true,
    attrs: {
      path: { default: [] },
      label: { default: "Field" },
      controlType: { default: "text" },
      value: { default: null },
      options: { default: null },
    },

    toDOM(node) {
      return [
        "div",
        {
          class: "pm-control-field",
          "data-field-label": node.attrs.label || "Field",
          "data-control-type": node.attrs.controlType || "text",
        },
      ];
    },
  },

  list_field: {
    content: "list_item*",
    isolating: true,
    defining: true,
    attrs: {
      path: { default: [] },
      label: { default: "List" },
      itemValue: { default: null },
      itemFields: { default: [] },
    },

    toDOM(node) {
      return [
        "div",
        { class: "pm-list-field", "data-field-label": node.attrs.label || "List" },
        ["div", { class: "pm-list-field__label" }, node.attrs.label || "List"],
        ["div", { class: "pm-list-field__items" }, 0],
      ];
    },
  },

  list_item: {
    content: "(editable_field | control_field | list_field)*",
    isolating: true,
    defining: true,
    attrs: {
      originalValue: { default: null },
    },

    toDOM() {
      return ["div", { class: "pm-list-item" }, ["div", { class: "pm-list-item__content" }, 0]];
    },
  },
});

const streamSchema = new Schema({
  nodes: streamNodes,
  marks,
});

// Converts between editor data, ProseMirror docs, and Wagtail StreamField JSON


// Destroys but Preserves Children
const RICH_TEXT_WRAPPER_SELECTORS = [
  ".pm-stream-block",
  ".pm-stream-block__content",
  ".pm-editable-field",
  ".pm-editable-field__content",
];

// Destroyed with Children (editor only stuff not useful for wagtail)
const RICH_TEXT_CHROME_SELECTORS = [
  ".pm-stream-block__header",
  ".pm-stream-block__label",
  ".pm-stream-block__title",
  ".pm-stream-block__id",
  ".pm-stream-block__meta",
  ".pm-article-block-controls",
  ".pm-article-block-controls-layer",
  ".pm-article-block-outline",
  ".pm-editor-toolbar",
  ".pm-editable-field__label",
];

function createEmptyRichTextBlock() {
  return streamBlockToPmNode({
    type: "richtext",
    id: uuidv4(),
    value: "",
    fields: [{
      kind: "editable",
      path: [],
      label: "Rich text",
      mode: "richtext",
      value: "",
    }],
  });
}

function createStreamBlockNodeFromRegistry(blockTypes, blockType) {
  const blockDefinition = blockTypes?.[blockType] || {};
  const defaultValue = blockDefinition.defaultValue !== undefined ? blockDefinition.defaultValue : "";
  return streamSchema.nodeFromJSON(streamBlockToPmNode({
    type: blockType,
    id: uuidv4(),
    value: clone(defaultValue),
    fields: clone(blockDefinition.defaultFields || []),
  }));
}

export function pmDocToStreamValue(pmDoc) {
  return (pmDoc.content || []).filter((node) => node.type === "stream_block").map(pmStreamBlockToWagtailBlock);
}

function streamBlockToPmNode(block) {
  const blockType = block?.type || "unknown";

  return {
    type: "stream_block",
    attrs: {
      id: block?.id || uuidv4(),
      blockType,
      originalValue: clone(block?.value),
      blockComments: clone(block?.blockComments || block?.comments || []),
    },
    content: (block?.fields || []).map((field) => fieldToPmNode(field, blockType)),
  };
}

function fieldToPmNode(field, blockType = null) {
  if (field.kind === "list") {
    return {
      type: "list_field",
      attrs: {
        path: field.path,
        label: field.label,
        itemValue: field.itemValue,
        itemFields: field.itemFields || [],
      },
      content: (field.items || []).map((item) => listItemToPmNode(field, item)),
    };
  }

  if (field.kind === "control") {
    return {
      type: "control_field",
      attrs: {
        path: field.path,
        label: field.label,
        controlType: field.controlType,
        value: field.value,
        options: field.options || null,
      },
    };
  }

  let content;
  if (field.mode === "plain_text") {
    const text = String(field.value || "");
    content = text.trim() ? text.split(/\n{2,}/).map((paragraphText) => ({
        type: "paragraph",
        content: paragraphText ? [{ type: "text", text: paragraphText }] : undefined,
    })) : [{ type: "paragraph" }];
  } else {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = field.value || "";
    wrapper.querySelectorAll(RICH_TEXT_CHROME_SELECTORS.join(",")).forEach((element) => {
      element.remove();
    });
    wrapper.querySelectorAll(RICH_TEXT_WRAPPER_SELECTORS.join(",")).forEach((element) => {
      element.replaceWith(...Array.from(element.childNodes));
    });

    const json = DOMParser.fromSchema(richTextSchema).parse(wrapper).toJSON();
    content = Array.isArray(json.content) && json.content.length ? json.content : [{ type: "paragraph" }];
  }

  return {
    type: "editable_field",
    attrs: {
      path: field.path,
      label: field.label,
      mode: field.mode,
      manuscriptOwned: blockType === "richtext" && field.mode === "richtext" && JSON.stringify(field.path || []) === "[]",
    },
    content,
  };
}

function listItemToPmNode(field, item = null) {
  const value = item ? item.value : clone(field.itemValue);
  return {
    type: "list_item",
    attrs: { originalValue: clone(value) },
    content: ((item && item.fields) || field.itemFields || []).map(fieldToPmNode),
  };
}

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pmStreamBlockToWagtailBlock(node) {
  const attrs = node.attrs || {};
  const block = {
    type: attrs.blockType || "unknown",
    value: clone(attrs.originalValue),
  };

  if (attrs.id) {
    block.id = attrs.id;
  }

  const blockComments = (Array.isArray(attrs.blockComments) ? attrs.blockComments : [])
    .filter((thread) => !thread.pending && Array.isArray(thread.comments) && thread.comments.length);
  if (blockComments.length) {
    block.comments = clone(blockComments);
  }

  for (const childNode of node.content || []) {
    const fieldAttrs = childNode.attrs || {};
    const path = Array.isArray(fieldAttrs.path) ? fieldAttrs.path : [];

    if (childNode.type === "editable_field") {
      setBlockValue(block, path, editableFieldValue(childNode, fieldAttrs.mode));
    } else if (childNode.type === "control_field") {
      setBlockValue(block, path, controlFieldValue(fieldAttrs, getValueAtPath(block.value, path)));
    } else if (childNode.type === "list_field") {
      setBlockValue(block, path, listFieldValue(childNode));
    }
  }

  return block;
}

function listFieldValue(node) {
  return (node.content || [])
    .filter((item) => item.type === "list_item")
    .map((item) => {
      let value = clone(item.attrs?.originalValue);
      if (value === undefined) value = clone(node.attrs?.itemValue);

      for (const childNode of item.content || []) {
        const fieldAttrs = childNode.attrs || {};
        const path = Array.isArray(fieldAttrs.path) ? fieldAttrs.path : [];

        if (childNode.type === "editable_field") {
          value = setFieldValue(value, path, editableFieldValue(childNode, fieldAttrs.mode));
        } else if (childNode.type === "control_field") {
          value = setFieldValue(value, path, controlFieldValue(fieldAttrs, getValueAtPath(value, path)));
        } else if (childNode.type === "list_field") {
          value = setFieldValue(value, path, listFieldValue(childNode));
        }
      }
      return value;
    });
}

function editableFieldValue(node, mode = "richtext") {
  if (mode === "plain_text") {
    return (node.content || [])
      .map((pmBlock) => streamSchema.nodeFromJSON(pmBlock).textContent)
      .join("\n\n");
  }

  const richTextNodes = (node.content || [])
    .filter((block) => !["stream_block", "editable_field", "control_field"].includes(block.type))
    .map((block) => richTextSchema.nodeFromJSON(block));
  const domFragment = DOMSerializer
    .fromSchema(richTextSchema)
    .serializeFragment(Fragment.fromArray(richTextNodes));
  const wrapper = document.createElement("div");
  wrapper.appendChild(domFragment);
  return wrapper.innerHTML;
}

function controlFieldValue(fieldAttrs, originalValue) {
  let value = fieldAttrs.value;
  const controlType = fieldAttrs.controlType || "text";

  if (controlType === "boolean") {
    value = Boolean(value);
  }

  if (["image", "document"].includes(controlType) && value === "") {
    value = null;
  }

  if (controlType === "number") {
    value = value === "" || value == null ? null : Number(value);
  }

  return Array.isArray(originalValue) ? [value] : value;
}

function setBlockValue(block, path, value) {
  block.value = setFieldValue(block.value, path, value);
}

function setFieldValue(root, path, value) {
  if (path.length === 0) return value;

  let current = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    if (current == null || typeof current !== "object") return root;
    current = current[key];
  }

  const finalKey = path[path.length - 1];
  if (current && typeof current === "object") current[finalKey] = value;
  return root;
}

function getValueAtPath(root, path) {
  let current = root;

  for (const key of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function topLevelBlockInfo(doc, matcher) {
  let offset = 0;

  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index);
    const start = offset;
    const end = start + node.nodeSize;

    if (matcher({ node, index, start, end })) {
      return { node, index, start, end };
    }

    offset = end;
  }

  return null;
}

function topLevelBlockInfoAtPos(doc, pos) {
  return topLevelBlockInfo(doc, ({ start }) => pos === start);
}

export function topLevelBlockInfoByIdOrIndex(doc, blockId, blockIndex) {
  const byId = blockId && topLevelBlockInfo(doc, ({ node }) => node.attrs?.id === blockId);
  return byId || topLevelBlockInfo(doc, ({ index }) => index === blockIndex);
}

export function moveTopLevelBlock(view, fromIndex, direction) {
  const targetIndex = fromIndex + direction;
  if (targetIndex < 0 || targetIndex >= view.state.doc.childCount) return false;

  const blocks = [];
  for (let index = 0; index < view.state.doc.childCount; index += 1) {
    blocks.push(view.state.doc.child(index));
  }

  [blocks[fromIndex], blocks[targetIndex]] = [blocks[targetIndex], blocks[fromIndex]];
  view.dispatch(view.state.tr.replaceWith(
    0,
    view.state.doc.content.size,
    Fragment.fromArray(blocks),
  ));
  return true;
}

export function deleteTopLevelBlock(view, info) {
  const { doc, tr } = view.state;

  if (doc.childCount <= 1) {
    view.dispatch(tr.replaceWith(info.start, info.end, streamSchema.nodeFromJSON(createEmptyRichTextBlock())));
    return "replaced";
  }

  view.dispatch(tr.delete(info.start, info.end));
  return "deleted";
}

function streamNodeViews({ blockTypes, availableBlockTypes }) {
  return {
    stream_block: StreamBlockNodeView({ blockTypes, availableBlockTypes }),
    editable_field: EditableFieldNodeView,
    control_field: ControlFieldNodeView,
    list_field: ListFieldNodeView,
    list_item: ListItemNodeView,
  };
}
function StreamBlockNodeView({ blockTypes, availableBlockTypes }) {
  return forwardRef(function StreamBlock({ children, nodeProps }, ref) {
    const { node, getPos } = nodeProps;
    const [insertType, setInsertType] = useState(availableBlockTypes[0]);
    const blockIndex = useEditorStateSelector((state) => topLevelBlockInfoAtPos(state.doc, getPos()).index);
    const blockCount = useEditorStateSelector((state) => state.doc.childCount);
    const insertBlock = useEditorEventCallback((view) => {
      const pmNode = createStreamBlockNodeFromRegistry(blockTypes, insertType);
      view.dispatch(view.state.tr.insert(getPos() + node.nodeSize, pmNode));
      view.focus();
    });
    const deleteBlock = useEditorEventCallback((view) => {
      deleteTopLevelBlock(view, topLevelBlockInfoAtPos(view.state.doc, getPos()));
      view.focus();
    });
    const moveBlock = useEditorEventCallback((view, direction) => {
      const latest = topLevelBlockInfoAtPos(view.state.doc, getPos());
      if (moveTopLevelBlock(view, latest.index, direction)) view.focus();
    });

    useStopEvent((view, event) => ["BUTTON", "SELECT", "OPTION"].includes(event.target.nodeName));
    useIgnoreMutation((view, mutation) => mutation.target.classList?.contains("pm-stream-block__header") || mutation.target.closest?.(".pm-stream-block__header"));

    return (
      <section
        ref={ref}
        className="pm-stream-block"
        data-block-type={node.attrs.blockType}
        data-stream-block-id={node.attrs.id}
        data-stream-block-index={String(blockIndex)}
      >
        <div className="pm-stream-block__header">
          <div className="pm-stream-block__controls">
            <select
              className="pm-stream-block__insert-select"
              aria-label="Block type to insert"
              value={insertType}
              onChange={(event) => { setInsertType(event.currentTarget.value); }}
            >
              {availableBlockTypes.map((blockType) => (
                <option key={blockType} value={blockType}>{blockType}</option>
              ))}
            </select>
            <button type="button" title="Insert" className="pm-stream-block__button" onClick={insertBlock}>+</button>
            <button type="button" title="Up" className="pm-stream-block__button" disabled={blockIndex === 0} onClick={() => { moveBlock(-1); }}>↑</button>
            <button type="button" title="Down" className="pm-stream-block__button" disabled={blockIndex === blockCount - 1} onClick={() => { moveBlock(1); }}>↓</button>
            <button type="button" title="Delete" className="pm-stream-block__button pm-stream-block__button--danger" onClick={deleteBlock}>Del</button>
          </div>
        </div>
        <div className="pm-stream-block__content" ref={nodeProps.contentDOMRef}>{children}</div>
      </section>
    );
  });
}

const ListFieldNodeView = forwardRef(function ListFieldNodeView({ children, nodeProps }, ref) {
  const { node, getPos } = nodeProps;
  const addItem = useEditorEventCallback((view) => {
    const item = streamSchema.nodeFromJSON(listItemToPmNode(node.attrs));
    view.dispatch(view.state.tr.insert(getPos() + node.nodeSize - 1, item));
    view.focus();
  });

  useStopEvent((view, event) => event.target.nodeName === "BUTTON");
  useIgnoreMutation((view, mutation) => mutation.target.classList?.contains("pm-list-field__header") || mutation.target.closest?.(".pm-list-field__header"));

  return (
    <div ref={ref} className="pm-list-field">
      <div className="pm-list-field__header">
        <div className="pm-list-field__label">{node.attrs.label}</div>
        <button type="button" title="Add" onClick={addItem}>+</button>
      </div>
      <div className="pm-list-field__items" ref={nodeProps.contentDOMRef}>{children}</div>
    </div>
  );
});

const ListItemNodeView = forwardRef(function ListItemNodeView({ children, nodeProps }, ref) {
  const { getPos } = nodeProps;
  const itemIndex = useEditorStateSelector((state) => state.doc.resolve(getPos()).index());
  const itemCount = useEditorStateSelector((state) => state.doc.resolve(getPos()).parent.childCount);
  const deleteItem = useEditorEventCallback((view) => {
    const latest = listItemInfo(view.state.doc, getPos());
    view.dispatch(view.state.tr.delete(latest.start, latest.end));
    view.focus();
  });
  const moveItem = useEditorEventCallback((view, direction) => {
    const latest = listItemInfo(view.state.doc, getPos());
    const targetIndex = latest.index + direction;
    if (targetIndex < 0 || targetIndex >= latest.parent.childCount) return;

    const items = [];
    for (let index = 0; index < latest.parent.childCount; index += 1) {
      items.push(latest.parent.child(index));
    }

    [items[latest.index], items[targetIndex]] = [items[targetIndex], items[latest.index]];
    view.dispatch(view.state.tr.replaceWith(
      latest.parentStart,
      latest.parentEnd,
      Fragment.fromArray(items),
    ));
    view.focus();
  });

  useStopEvent((view, event) => event.target.nodeName === "BUTTON");
  useIgnoreMutation((view, mutation) => mutation.target.classList?.contains("pm-list-item__header") || mutation.target.closest?.(".pm-list-item__header"));

  return (
    <div ref={ref} className="pm-list-item">
      <div className="pm-list-item__header">
        <div className="pm-list-item__title">#{itemIndex + 1}</div>
        <button type="button" title="Up" disabled={itemIndex === 0} onClick={() => { moveItem(-1); }}>↑</button>
        <button type="button" title="Down" disabled={itemIndex === itemCount - 1} onClick={() => { moveItem(1); }}>↓</button>
        <button type="button" title="Delete" onClick={deleteItem}>Del</button>
      </div>
      <div className="pm-list-item__content" ref={nodeProps.contentDOMRef}>{children}</div>
    </div>
  );
});

function listItemInfo(doc, pos) {
  const resolved = doc.resolve(pos);
  const parent = resolved.parent;
  const index = resolved.index();
  let start = resolved.start();
  const parentStart = start;
  const parentEnd = resolved.end();

  for (let itemIndex = 0; itemIndex < index; itemIndex += 1) {
    start += parent.child(itemIndex).nodeSize;
  }

  const node = parent.child(index);
  return { parent, index, node, start, end: start + node.nodeSize, parentStart, parentEnd };
}

const ControlFieldNodeView = forwardRef(function ControlFieldNodeView({ nodeProps }, ref) {
  const { node, getPos } = nodeProps;
  const controlType = node.attrs.controlType;
  const value = node.attrs.value ?? "";
  const updateValue = useEditorEventCallback((view, nextValue) => {
    view.dispatch(view.state.tr.setNodeMarkup(getPos(), undefined, {
      ...node.attrs,
      value: nextValue,
    }));
  });

  useStopEvent((view, event) => ["INPUT", "SELECT", "OPTION", "LABEL", "BUTTON"].includes(event.target.nodeName));
  useIgnoreMutation(() => true);

  return (
    <div ref={ref} className={`pm-control-field pm-control-field--${controlType}`}>
      <label className="pm-control-field__label">{node.attrs.label}</label>
      <div className="pm-control-field__input">
        {controlType === "boolean" && (
          <input
            type="checkbox"
            checked={Boolean(node.attrs.value)}
            onChange={(event) => { updateValue(event.currentTarget.checked); }}
          />
        )}

        {controlType === "choice" && (
          <select
            value={String(value)}
            onChange={(event) => { updateValue(event.currentTarget.value); }}
          >
            {node.attrs.options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>{option.label}</option>
            ))}
          </select>
        )}

        {controlType === "number" && (
          <input
            type="number"
            value={value}
            onInput={(event) => {
              const rawValue = event.currentTarget.value.trim();
              const nextValue = rawValue === "" ? null : Number(rawValue);
              updateValue(Number.isNaN(nextValue) ? null : nextValue);
            }}
          />
        )}

        {(controlType === "image" || controlType === "document") && (
          <select
            value={value ?? ""}
            onChange={(event) => {
              const nextValue = event.currentTarget.value ? Number(event.currentTarget.value) : null;
              updateValue(Number.isNaN(nextValue) ? null : nextValue);
            }}
          >
            <option value="">{controlType === "image" ? "No image" : "No document"}</option>
            {articleMediaOptions(controlType).map((option) => (
              <option key={option.value} value={String(option.value)}>{option.label}</option>
            ))}
            {value && !articleMediaOptions(controlType).some((option) => String(option.value) === String(value)) && (
              <option value={String(value)}>{controlType} #{value}</option>
            )}
          </select>
        )}

        {!(["boolean", "choice", "number", "image", "document"].includes(controlType)) && (
          <input
            type="text"
            value={value}
            onInput={(event) => { updateValue(event.currentTarget.value); }}
          />
        )}
      </div>
    </div>
  );
});

function articleMediaOptions(kind) {
  return Array.from(document.querySelectorAll(`[data-article-media-item][data-kind="${window.CSS.escape(kind)}"]`))
    .map((item) => ({ value: item.dataset.id, label: item.dataset.title }));
}

const EditableFieldNodeView = forwardRef(function EditableFieldNodeView({ children, nodeProps }, ref) {
  const isManuscriptOwned = Boolean(nodeProps.node.attrs.manuscriptOwned);

  return (
    <div ref={ref} className={`pm-editable-field${isManuscriptOwned ? " pm-editable-field--manuscript-owned" : ""}`}>
      <div className="pm-editable-field__label">{nodeProps.node.attrs.label || "Content"}</div>
      <div className="pm-editable-field__content" ref={nodeProps.contentDOMRef}>{children}</div>
    </div>
  );
});

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
