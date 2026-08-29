import { Fragment } from "prosemirror-model";
import { TextSelection } from "prosemirror-state";

import { editableFieldInfoForSource } from "./fields.js";
import { topLevelBlockInfoByIdOrIndex } from "./blocks.js";
import { deleteBlock, insertBlock, insertBlockBefore, setFieldContent } from "./document.js";

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
    const block = topLevelBlockInfoByIdOrIndex(source.instance.doc, source.blockId, source.blockIndex);
    if (!block) return false;

    let transaction = inlineView.state.tr;
    if (!transaction.selection.empty) transaction = transaction.deleteSelection();
    const splitAt = transaction.selection.from;
    const before = transaction.doc.slice(0, splitAt).content;
    const after = transaction.doc.slice(splitAt).content;
    const splittingAtStart = splitAt === 1;
    const newBlock = richTextBlockWithContent(streamRichTextContent(splittingAtStart ? before : after));

    source.instance.history.stopCapturing();
    source.instance.transact(() => {
      if (splittingAtStart) {
        setFieldContent(source.instance, {
          blockId: source.blockId,
          path: source.path || [],
          content: streamRichTextContent(after),
        });
        insertBlockBefore(source.instance, { before: source, block: newBlock });
      } else {
        setFieldContent(source.instance, {
          blockId: source.blockId,
          path: source.path || [],
          content: streamRichTextContent(before),
        });
        insertBlock(source.instance, { after: source, block: newBlock });
      }
    }, { kind: "structure" });
    source.instance.history.stopCapturing();

    if (!splittingAtStart) {
      focusRichTextEditor(source.instance, { blockId: newBlock.attrs.id, position: 1 });
    }
    return true;
  }

  // Creates a RichText block containing supplied content
  function richTextBlockWithContent(content) {
    const block = streamSchema.nodeFromJSON(createEmptyRichTextBlock());
    return block.copy(Fragment.from(block.child(0).copy(content)));
  }

  // Converts PM fragment into streamSchema nodes, if none, returns one paragraph
  function streamRichTextContent(content) {
    const nodes = (content.toJSON() || []).map((node) => streamSchema.nodeFromJSON(node));
    return Fragment.fromArray(nodes.length ? nodes : [streamSchema.nodes.paragraph.create()]);
  }

  function mergeStreamRichTextBlock(inlineView, source) {
    if (!inlineView.state.selection.empty || inlineView.state.selection.from !== 1) return false;

    const doc = source.instance.doc;
    const block = topLevelBlockInfoByIdOrIndex(doc, source.blockId, source.blockIndex);
    const previousBlock = block && topLevelBlockInfoByIdOrIndex(doc, null, block.index - 1);
    if (!previousBlock || previousBlock.node.attrs?.blockType !== "richtext") return false;

    const previousSource = { ...source, blockId: previousBlock.node.attrs.id, blockIndex: previousBlock.index };
    const previousField = editableFieldInfoForSource(previousSource, doc);
    if (!previousField) return false;

    const cursorPosition = previousField.node.content.size - 1;
    const content = joinRichTextContent(previousField.node.content, streamRichTextContent(inlineView.state.doc.content));

    source.instance.history.stopCapturing();
    source.instance.transact(() => {
      setFieldContent(source.instance, {
        blockId: previousSource.blockId,
        path: previousSource.path || [],
        content,
      });
      deleteBlock(source.instance, source);
    }, { kind: "structure" });

    source.instance.history.stopCapturing();
    
    focusRichTextEditor(source.instance, {
      blockId: previousSource.blockId,
      position: cursorPosition,
    });
    return true;
  }

  function joinRichTextContent(before, after) {
    const beforeNodes = [];
    const afterNodes = [];
    before.forEach((node) => { beforeNodes.push(node); });
    after.forEach((node) => { afterNodes.push(node); });

    const left = beforeNodes[beforeNodes.length - 1];
    const right = afterNodes[0];
    if (left?.isTextblock && right?.isTextblock && left.sameMarkup(right)) {
      beforeNodes[beforeNodes.length - 1] = left.copy(left.content.append(right.content));
      afterNodes.shift();
    }
    return Fragment.fromArray([...beforeNodes, ...afterNodes]);
  }

  // Arrow key navigation between RichText Blocks
  function navigateStreamRichTextBlock(activeView, source, direction) {
    if (!activeView.state.selection.empty) return false;
    if (!activeView.endOfTextblock(direction < 0 ? "up" : "down")) return false;

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
    const currentCoordinates = activeView.coordsAtPos(activeView.state.selection.head);
    const edgeCoordinates = targetEditor.view.coordsAtPos(edgePosition);
    const mappedPosition = targetEditor.view.posAtCoords({
      left: currentCoordinates.left,
      top: (edgeCoordinates.top + edgeCoordinates.bottom) / 2,
    }).pos;

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
