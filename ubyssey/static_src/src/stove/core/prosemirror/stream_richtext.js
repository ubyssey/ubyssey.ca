import { TextSelection } from "prosemirror-state";
import { absolutePositionToRelativePosition, initProseMirrorDoc } from "y-prosemirror";

import { editableFieldInfoForSource } from "./fields.js";
import { topLevelBlockInfoByIdOrIndex } from "./blocks.js";

// Deals with special RichText behaviour like new block (create or split) on enter, delete (or back merge) with backspace, arrow keys between blocks
export function createStreamRichTextKeyHandler({state, streamSchema, createEmptyRichTextBlock, selectBlock}) {
  
  // Handles RichText Key Actions
  return function handleStreamRichTextKeyDown(activeView, event, source) {
    const historyAction = event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey) ? (event.shiftKey ? "redo" : "undo") : event.key.toLowerCase() === "y" && event.ctrlKey && !event.shiftKey ? "redo" : null;

    if (source && historyAction) {
      const handled = source.instance.history[historyAction]();
      if (handled) event.preventDefault();
      return handled;
    }

    if (!source?.streamRichText || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return false;

    if (["ArrowUp", "ArrowDown"].includes(event.key) && !event.shiftKey) {
      return navigateStreamRichTextBlock(activeView, source, event.key === "ArrowUp" ? -1 : 1);
    }

    if (["ArrowLeft", "ArrowRight"].includes(event.key) && !event.shiftKey) {
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      const atBlockEdge = direction < 0
        ? activeView.state.selection.from === 1
        : activeView.state.selection.to === activeView.state.doc.content.size - 1;
      if (atBlockEdge) return navigateStreamRichTextBlock(activeView, source, direction, false);
    }

    if (event.key === "Enter" && !event.shiftKey) {
      const handled = splitStreamRichTextBlock(activeView, source);
      if (handled) event.preventDefault();
      return handled;
    }

    if (event.key === "Backspace") {
      const handled = mergeStreamRichTextBlock(activeView, source);
      if (handled) event.preventDefault();
      return handled;
    }
    
    return false;
  }

  function splitStreamRichTextBlock(inlineView, source) {
    const sharedType = source.instance.fieldType(source.blockId, source.path || []);
    if (!sharedType) return false;

    const selection = inlineView.state.selection;
    const mapping = initProseMirrorDoc(sharedType, inlineView.state.schema).mapping;
    const relativePosition = (position) => absolutePositionToRelativePosition(
      position,
      sharedType,
      mapping,
    );
    const splitPosition = relativePosition(selection.from);
    const selectionFrom = selection.empty ? null : relativePosition(selection.from);
    const selectionTo = selection.empty ? null : relativePosition(selection.to);
    const block = streamSchema.nodeFromJSON(createEmptyRichTextBlock());

    source.instance.history.stopCapturing();
    const result = source.instance.splitRichTextBlock({
      blockId: source.blockId,
      path: source.path || [],
      splitPosition,
      selectionFrom,
      selectionTo,
      block,
    });
    source.instance.history.stopCapturing();

    if (!result) return false;
    if (!result.splittingAtStart) {
      focusRichTextEditor(source.instance, { blockId: result.blockId, position: 1 });
    } else {
      selectBlock({
        fieldName: source.instance.fieldName,
        blockId: source.blockId,
      }, inlineView.dom.getRootNode());
    }
    return true;
  }

  function mergeStreamRichTextBlock(inlineView, source) {
    if (!inlineView.state.selection.empty || inlineView.state.selection.from !== 1) return false;

    source.instance.history.stopCapturing();
    const result = source.instance.mergeRichTextBlock({
      blockId: source.blockId,
      path: source.path || [],
    });
    source.instance.history.stopCapturing();

    if (!result) return false;
    focusRichTextEditor(source.instance, {
      blockId: result.blockId,
      position: result.cursorPosition,
    });
    return true;
  }

  // Arrow key navigation between RichText Blocks
  function navigateStreamRichTextBlock(activeView, source, direction, vertical = true) {
    if (!activeView.state.selection.empty) return false;
    if (vertical && !activeView.endOfTextblock(direction < 0 ? "up" : "down")) return false;

    const doc = source.instance.doc;
    const currentBlock = topLevelBlockInfoByIdOrIndex(doc, source.blockId, source.blockIndex);
    const targetBlock = currentBlock && topLevelBlockInfoByIdOrIndex(doc, null, currentBlock.index + direction);
    if (targetBlock?.node.attrs?.blockType !== "richtext") return false;

    const targetEditor = state.pageRichTextEditors.find((editor) => (
      editor.streamSource?.instance === source.instance
      && editor.blockId === targetBlock.node.attrs.id
    ));
    if (!targetEditor?.streamSource?.streamRichText) return false;

    const edgePosition = direction < 0 ? targetEditor.view.state.doc.content.size - 1 : 1;
    let mappedPosition = edgePosition;
    if (vertical) {
      const currentCoordinates = activeView.coordsAtPos(activeView.state.selection.head);
      const edgeCoordinates = targetEditor.view.coordsAtPos(edgePosition);
      mappedPosition = targetEditor.view.posAtCoords({
        left: currentCoordinates.left,
        top: (edgeCoordinates.top + edgeCoordinates.bottom) / 2,
      }).pos;
    }

    return focusRichTextBlock({
      fieldName: source.instance.fieldName,
      blockId: targetBlock.node.attrs.id,
    }, mappedPosition ?? edgePosition);
  }

  function focusRichTextEditor(instance, { blockId, position }) {
    window.requestAnimationFrame(() => {
      const editor = state.pageRichTextEditors.find((item) => (
        item.streamSource?.instance === instance && item.blockId === blockId
      ));
      if (!editor) return;

      setEditorSelection(editor, position);
      selectBlock({
        fieldName: instance.fieldName,
        blockId,
      }, editor.view.dom.getRootNode());
    });
  }

  function focusRichTextBlock(descriptor, position) {
    const editor = state.pageRichTextEditors.find((item) => (
      item.fieldName === descriptor.fieldName && item.blockId === descriptor.blockId
    ));
    if (!editor) return false; 

    const selectionPosition = typeof position === "number" ? position : position === "end" ? editor.view.state.doc.content.size - 1 : 1;
    setEditorSelection(editor, selectionPosition);
    selectBlock(descriptor, editor.view.dom.getRootNode());
    return true;
  }

  function setEditorSelection(editor, position) {
    const cursor = Math.min(position, editor.view.state.doc.content.size);
    editor.view.dispatch(editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, cursor),
    ));
    editor.view.focus();
  }
}
