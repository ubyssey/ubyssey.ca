// Creates node views, ie checkbox for boolean, dropdown for choice

import { forwardRef, useState } from "react";
import { Fragment } from "prosemirror-model";
import {
  useEditorEventCallback,
  useEditorStateSelector,
  useIgnoreMutation,
  useStopEvent,
} from "@handlewithcare/react-prosemirror";
import {
  createStreamBlockNodeFromRegistry,
  listItemToPmNode,
} from "./serialization.js";
import {
  deleteTopLevelBlock,
  moveTopLevelBlock,
  topLevelBlockInfoAtPos,
} from "./commands.js";
import { streamSchema } from "./schema.js";

export function blockTypeLabel(blockType) {
  return String(blockType || "block").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function streamNodeViews({ blockTypes, availableBlockTypes }) {
  return {
    stream_block: StreamBlockNodeView({ blockTypes, availableBlockTypes }),
    editable_field: EditableFieldNodeView,
    struct_field: StructFieldNodeView,
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
      view.dispatch(deleteTopLevelBlock(
        view.state.tr,
        topLevelBlockInfoAtPos(view.state.doc, getPos()),
      ));
      view.focus();
    });
    const moveBlock = useEditorEventCallback((view, direction) => {
      const latest = topLevelBlockInfoAtPos(view.state.doc, getPos());
      const transaction = moveTopLevelBlock(view.state.tr, latest.index, direction);
      if (transaction) {
        view.dispatch(transaction);
        view.focus();
      }
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
                <option key={blockType} value={blockType}>{blockTypeLabel(blockType)}</option>
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

const StructFieldNodeView = forwardRef(function StructFieldNodeView({ children, nodeProps }, ref) {
  return (
    <div ref={ref} className="pm-struct-field">
      {/* TODO figure out styling in the modals */}
      <div className="pm-struct-field__label">{nodeProps.node.attrs.label}</div>
      <div className="pm-struct-field__content" ref={nodeProps.contentDOMRef}>{children}</div>
    </div>
  );
});

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
