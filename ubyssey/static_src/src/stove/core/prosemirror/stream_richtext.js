import { TextSelection } from "prosemirror-state";
import { Fragment } from "prosemirror-model";
import { absolutePositionToRelativePosition, initProseMirrorDoc } from "y-prosemirror";

import { editableFieldInfoForSource } from "./fields.js";
import { topLevelBlockInfoByIdOrIndex } from "./blocks.js";

// Richtext blocks are separate Y.XmlElements, so splitting and merging require special handling to preserve cursors + suggestions
export function joinRichTextContent(leftContent, rightContent) {
  const leftNodes = [];
  const rightNodes = [];
  leftContent.forEach((node) => leftNodes.push(node));
  rightContent.forEach((node) => rightNodes.push(node));

  const left = leftNodes[leftNodes.length - 1];
  const right = rightNodes[0];

  if (left?.isTextblock && right?.isTextblock && left.sameMarkup(right)) {
    leftNodes[leftNodes.length - 1] = left.copy(left.content.append(right.content));
    rightNodes.shift();
  }
  return Fragment.fromArray([...leftNodes, ...rightNodes]);
}

function joinCursorPosition(leftContent, rightContent) {
  const left = leftContent.lastChild;
  const right = rightContent.firstChild;
  return left?.isTextblock && right?.isTextblock && left.sameMarkup(right) ? leftContent.size - 1 : leftContent.size + 1;
}

function sourceForBlock(source, block) {
  return {
    ...source,
    blockId: block.node.attrs?.id,
    blockIndex: block.index,
  };
}

function fieldInfoForSource(source, doc) {
  return editableFieldInfoForSource(source, doc)?.node || null;
}

function clampSelectionPosition(doc, position) {
  return Math.max(1, Math.min(position, Math.max(1, doc.content.size - 1)));
}

function selectionForTarget(selection, targetDoc, mapPosition) {
  return {
    anchor: clampSelectionPosition(targetDoc, mapPosition(selection.anchor)),
    head: clampSelectionPosition(targetDoc, mapPosition(selection.head)),
  };
}

function splitInfoForSource(beforeDoc, afterDoc, source) {
  const beforeBlock = topLevelBlockInfoByIdOrIndex(beforeDoc, source.blockId, source.blockIndex);
  const afterBlock = topLevelBlockInfoByIdOrIndex(afterDoc, source.blockId, source.blockIndex);
  if (!beforeBlock || !afterBlock || beforeBlock.node.attrs?.blockType !== "richtext" || afterBlock.node.attrs?.blockType !== "richtext") return null;

  const insertedBlock = topLevelBlockInfoByIdOrIndex(afterDoc, null, afterBlock.index + 1);
  const insertedId = insertedBlock?.node.attrs?.id;
  if (!insertedBlock || !insertedId || topLevelBlockInfoByIdOrIndex(beforeDoc, insertedId, null) || insertedBlock.node.attrs?.blockType !== "richtext") return null;

  const beforeField = fieldInfoForSource(sourceForBlock(source, beforeBlock), beforeDoc);
  const retainedField = fieldInfoForSource(sourceForBlock(source, afterBlock), afterDoc);
  const insertedSource = sourceForBlock(source, insertedBlock);
  const insertedField = fieldInfoForSource(insertedSource, afterDoc);
  if (!beforeField || !retainedField || !insertedField) return null;

  // Enters while selected first delete the selection so extra math
  const prefixEnd = beforeField.content.findDiffStart(retainedField.content);
  const suffixDifference = beforeField.content.findDiffEnd(insertedField.content);
  const selectionFrom = prefixEnd === null ? beforeField.content.size - 1 : prefixEnd;
  const selectionTo = suffixDifference ? suffixDifference.a : 1;

  if (
    selectionFrom < 1
    || selectionTo < selectionFrom
    || !beforeField.slice(0, selectionFrom).content.eq(retainedField.content)
    || !beforeField.slice(selectionTo).content.eq(insertedField.content)
  ) return null;

  return {
    insertedSource,
    insertedField,
    retainedSource: sourceForBlock(source, afterBlock),
    retainedField,
    selectionFrom,
    selectionTo,
  };
}

function mergeInfoForSource(beforeDoc, afterDoc, source) {
  const sourceBefore = topLevelBlockInfoByIdOrIndex(beforeDoc, source.blockId, source.blockIndex);
  const sourceAfter = topLevelBlockInfoByIdOrIndex(afterDoc, source.blockId, source.blockIndex);
  if (!sourceBefore || sourceBefore.node.attrs?.blockType !== "richtext") return null;

  // A focused editor can either be the block being removed or the preceding
  // block whose content is rebuilt by the merge.
  const deletedBefore = sourceAfter ? topLevelBlockInfoByIdOrIndex(beforeDoc, null, sourceBefore.index + 1) : sourceBefore;
  const previousBefore = sourceAfter ? sourceBefore : topLevelBlockInfoByIdOrIndex(beforeDoc, null, sourceBefore.index - 1);
  if (!deletedBefore || !previousBefore || deletedBefore.node.attrs?.blockType !== "richtext" || previousBefore.node.attrs?.blockType !== "richtext" || topLevelBlockInfoByIdOrIndex(afterDoc, deletedBefore.node.attrs?.id, null)) return null;

  const previousSource = sourceForBlock(source, previousBefore);
  const previousAfter = topLevelBlockInfoByIdOrIndex(afterDoc, previousSource.blockId, previousSource.blockIndex);
  if (!previousAfter || previousAfter.node.attrs?.blockType !== "richtext") return null;

  const previousField = fieldInfoForSource(previousSource, beforeDoc);
  const deletedField = fieldInfoForSource(sourceForBlock(source, deletedBefore), beforeDoc);
  const mergedField = fieldInfoForSource(sourceForBlock(source, previousAfter), afterDoc);
  if (!previousField || !deletedField || !mergedField) return null;

  const mergedContent = joinRichTextContent(previousField.content, deletedField.content);
  if (!mergedField.content.eq(mergedContent)) return null;

  return {
    sourceDeleted: !sourceAfter,
    previousSource: sourceForBlock(source, previousAfter),
    previousField: mergedField,
    cursorPosition: joinCursorPosition(previousField.content, deletedField.content),
  };
}

// Maps selections through a RichText split/merge
export function remapRichTextSelections(beforeDoc, afterDoc, selections = []) {
  return selections.flatMap(({ source, selection }) => {
    if (!source?.streamRichText || !selection) return [];

    const split = splitInfoForSource(beforeDoc, afterDoc, source);
    if (split) {
      const followsInsertedBlock = selection.head >= split.selectionTo && selection.head > split.selectionFrom;
      const targetSource = followsInsertedBlock ? split.insertedSource : split.retainedSource;
      const targetField = followsInsertedBlock ? split.insertedField : split.retainedField;
      const mappedSelection = selectionForTarget(selection, targetField, followsInsertedBlock
        ? (position) => position <= split.selectionTo ? 1 : position - split.selectionTo + 1
        : (position) => Math.min(position, split.selectionFrom));

      return [{ source: targetSource, fromSource: source, selection: mappedSelection }];
    }

    const merge = mergeInfoForSource(beforeDoc, afterDoc, source);
    if (!merge) return [];

    if (merge.sourceDeleted) {
      return [{
        source: merge.previousSource,
        fromSource: source,
        selection: selectionForTarget(
          selection,
          merge.previousField,
          (position) => merge.cursorPosition + position - 1,
        ),
      }];
    }

    // The prior block survives a merge, but its Y content is rebuilt, so restore the selection
    const sourceAfter = topLevelBlockInfoByIdOrIndex(afterDoc, source.blockId, source.blockIndex);
    if (!sourceAfter) return [];
    const sourceField = fieldInfoForSource(sourceForBlock(source, sourceAfter), afterDoc);
    if (!sourceField) return [];
    return [{
      source: sourceForBlock(source, sourceAfter),
      fromSource: source,
      selection: selectionForTarget(selection, sourceField, (position) => position),
    }];
  });
}


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
      const targetPosition = targetEditor.view.posAtCoords({
        left: currentCoordinates.left,
        top: (edgeCoordinates.top + edgeCoordinates.bottom) / 2,
      });
      if (targetPosition) mappedPosition = targetPosition.pos;
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
    const maxPosition = Math.max(1, editor.view.state.doc.content.size - 1);
    const cursor = Math.max(1, Math.min(position, maxPosition));
    editor.view.dispatch(editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, cursor),
    ));
    editor.view.focus();
  }
}
