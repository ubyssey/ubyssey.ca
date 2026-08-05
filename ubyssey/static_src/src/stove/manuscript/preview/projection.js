// Inline to Stream editor projections and vice versa

import { Fragment } from "prosemirror-model";
import { Step, StepMap } from "prosemirror-transform";
import { manuscriptSession } from "../session.js";
import { EMPTY_RICH_TEXT, INLINE_EDITOR_META, STREAM_EDITOR_META } from "./constants.js";
import { currentEditableField } from "./sources.js";

// Writes inline editor content into streamfield
export function writeStreamFieldContent(source, fragment, sourceEditor = null) {
  const { view } = source.instance;
  const latestField = currentEditableField(source);
  if (latestField) {
    view.dispatch(view.state.tr
      .replaceWith(latestField.pos + 1, latestField.pos + 1 + latestField.node.content.size, fragment)
      .setMeta(INLINE_EDITOR_META, sourceEditor)
      .setMeta("skipPreview", true));
  }
}

// Maps transactions between inline and stream editors
// Inline: doc -> paragraph/list/heading…
// Stream: doc -> stream_block ->editable_field ->paragraph/list/heading…
function mapStep(step, schema, offset) {
  try {
    return Step.fromJSON(schema, step.toJSON()).map(StepMap.offset(offset));
  } catch {
    return null;
  }
}

// Projects inline editor transactions into related streamfield
function refreshFootnotesAfterProjection() {
  window.requestAnimationFrame(() => {
    manuscriptSession.footnoteSidebar?.update();
  });
}

export function projectInlineTransaction(source, inlineView, transaction) {
  const field = currentEditableField(source);
  if (!field) return;

  const streamTransaction = source.instance.view.state.tr;
  for (const step of transaction.steps) {
    const projectedStep = mapStep(step, source.instance.view.state.schema, field.pos + 1);
    if (!projectedStep || streamTransaction.maybeStep(projectedStep).failed) {
      const schema = source.instance.view.state.schema;
      const content = inlineView.state.doc.toJSON().content || EMPTY_RICH_TEXT;
      writeStreamFieldContent(source, Fragment.fromArray(content.map((node) => schema.nodeFromJSON(node))), inlineView);
      manuscriptSession.richTextToolbar?.setHistoryView(source.instance.view);
      refreshFootnotesAfterProjection();
      return;
    }
  }

  source.instance.view.dispatch(streamTransaction
    .setMeta(INLINE_EDITOR_META, inlineView)
    .setMeta("skipPreview", true));
  manuscriptSession.richTextToolbar?.setHistoryView(source.instance.view);
  refreshFootnotesAfterProjection();
}

// Reverse of above, projects stream into inline
export function syncArticlePreviewEditors({ transaction, instance }) {
  if (!transaction.docChanged) return;

  const sourceEditor = transaction.getMeta(INLINE_EDITOR_META);
  const editors = [
    ...manuscriptSession.articleRichTextEditors,
    ...manuscriptSession.articleDirectTextEditors,
  ].filter((editor) => editor.streamSource?.instance === instance && editor.view !== sourceEditor);

  for (const editor of editors) {
    const inlineTransaction = editor.view.state.tr;
    let changed = false;
    let projectionFailed = false;

    transaction.steps.forEach((step, index) => {
      const field = currentEditableField(editor.streamSource, transaction.docs[index]);
      const projectedStep = field && mapStep(step, editor.view.state.schema, -(field.pos + 1));
      if (!projectedStep || inlineTransaction.maybeStep(projectedStep).failed) {
        projectionFailed = true;
      } else {
        changed = true;
      }
    });

    let nextTransaction = changed && !projectionFailed ? inlineTransaction : null;
    if (projectionFailed) {
      const field = currentEditableField(editor.streamSource);
      if (!field) continue;

      const content = field.node.toJSON().content || EMPTY_RICH_TEXT;
      const fragment = Fragment.fromArray(content.map((node) => (
        editor.view.state.schema.nodeFromJSON(node)
      )));
      nextTransaction = editor.view.state.tr.replaceWith(
        0,
        editor.view.state.doc.content.size,
        fragment,
      );
    }

    if (nextTransaction) editor.view.dispatch(nextTransaction
      .setMeta(STREAM_EDITOR_META, true)
      .setMeta("addToHistory", false));
  }

  manuscriptSession.articleDirectPlainTextEditors
    .filter((editor) => editor.streamSource.instance === instance && editor.element !== sourceEditor)
    .forEach((editor) => {
      const field = currentEditableField(editor.streamSource);
      if (field) editor.element.textContent = field.textContent.trim();
    });
}

// Refreshes preview based on streamfield state
export function refreshArticlePreviewEditorsFromStream(instance, { preserveFocused = false } = {}) {
  const editors = [
    ...manuscriptSession.articleRichTextEditors,
    ...manuscriptSession.articleDirectTextEditors,
  ].filter((editor) => editor.streamSource?.instance === instance);

  for (const editor of editors) {
    if (preserveFocused && editor.view.hasFocus()) continue;
    const field = currentEditableField(editor.streamSource);
    if (!field) continue;

    const content = field.node.toJSON().content || EMPTY_RICH_TEXT;
    const nextDoc = editor.view.state.schema.nodeFromJSON({ type: "doc", content });
    if (editor.view.state.doc.eq(nextDoc)) continue;

    editor.view.dispatch(editor.view.state.tr
      .replaceWith(0, editor.view.state.doc.content.size, nextDoc.content)
      .setMeta(STREAM_EDITOR_META, true)
      .setMeta("addToHistory", false));
  }

  manuscriptSession.articleDirectPlainTextEditors
    .filter((editor) => editor.streamSource.instance === instance)
    .forEach((editor) => {
      if (preserveFocused && editor.element.getRootNode()?.activeElement === editor.element) return;
      const field = currentEditableField(editor.streamSource);
      const nextText = field?.textContent.trim();
      if (nextText !== undefined && editor.element.textContent !== nextText) {
        editor.element.textContent = nextText;
      }
  });
}
