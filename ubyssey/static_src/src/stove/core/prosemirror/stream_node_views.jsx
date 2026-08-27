import { forwardRef } from "react";
import { Fragment } from "prosemirror-model";
import { useEditorEventCallback, useEditorStateSelector, useIgnoreMutation, useStopEvent } from "@handlewithcare/react-prosemirror";
import { listItemToPmNode } from "./serialization.js";
import { streamSchema } from "./stream_schema.js";

// Creates react node views, ie checkbox for boolean, dropdown for choice

// Converts _ and - to spaces and capitalizes so example_block becomes Example Block
export function blockTypeLabel(blockType) {
  return String(blockType || "block").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function streamNodeViews({ controlOptions = () => [] } = {}) {
  return {
    stream_block: StreamBlockNodeView,
    editable_field: EditableFieldNodeView,
    struct_field: StructFieldNodeView,
    control_field: ControlFieldNodeView(controlOptions),
    list_field: ListFieldNodeView,
    list_item: ListItemNodeView,
  };
}

const StreamBlockNodeView = forwardRef(function StreamBlock({ children, nodeProps }, ref) {
  const { node } = nodeProps;

  return (
    <section
      ref={ref}
      className="pm-stream-block"
      data-block-type={node.attrs.blockType}
      data-stream-block-id={node.attrs.id}
    >
      <div className="pm-stream-block__content" ref={nodeProps.contentDOMRef}>{children}</div>
    </section>
  );
});

const StructFieldNodeView = forwardRef(function StructFieldNodeView({ children, nodeProps }, ref) {
  return (
    <div ref={ref} className="pm-struct-field">
      <div className="pm-struct-field__label" contentEditable={false}>{nodeProps.node.attrs.label}</div>
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
      <div className="pm-list-field__header" contentEditable={false}>
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
      <div className="pm-list-item__header" contentEditable={false}>
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

function ControlFieldNodeView(controlOptions) {
  return forwardRef(function ControlFieldNodeView({ nodeProps }, ref) {
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
      <label className="pm-control-field__label" contentEditable={false}>{node.attrs.label}</label>
      <div className="pm-control-field__input" contentEditable="false">
        {controlType === "boolean" && (
          <label className="switch filter">
            <input
              type="checkbox"
              checked={Boolean(node.attrs.value)}
              onChange={(event) => { updateValue(event.currentTarget.checked); }}
            />
            <span className="slider round"></span>
          </label>
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
            <option value="">{controlType === "image" ? "No Image" : "No Document"}</option>
            {controlOptions(controlType).map((option) => (
              <option key={option.value} value={String(option.value)}>{option.label}</option>
            ))}
            {value && !controlOptions(controlType).some((option) => String(option.value) === String(value)) && (
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
}

const EditableFieldNodeView = forwardRef(function EditableFieldNodeView({ children, nodeProps }, ref) {
  const isStreamRoot = Boolean(nodeProps.node.attrs.streamRoot);

  return (
    <div ref={ref} className={`pm-editable-field${isStreamRoot ? " pm-editable-field--stream-root" : ""}`}>
      <div className="pm-editable-field__label" contentEditable={false}>{nodeProps.node.attrs.label || "Content"}</div>
      <div className="pm-editable-field__content" ref={nodeProps.contentDOMRef}>{children}</div>
    </div>
  );
});
