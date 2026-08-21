import { createStreamEditorFactory } from "../../core/prosemirror/stream_editor.jsx";
import { mountBlockEditor } from "../../core/preview/block_editor.jsx";
import { createEmptyRichTextBlock, createStreamBlockNodeFromRegistry } from "../../core/prosemirror/serialization.js";
import { streamSchema } from "../../core/prosemirror/stream_schema.js";
import { blockTypeLabel, streamNodeViews } from "../../core/prosemirror/stream_node_views.jsx";

// Different default block for each StreamField
const createDefaultRichTextBlock = () => streamSchema.nodeFromJSON(createEmptyRichTextBlock());

const emptyBlockForField = {
  header: (streamEditor) => createStreamBlockNodeFromRegistry(streamEditor.blockTypes, "standard_header"),
  content: createDefaultRichTextBlock,
};

// Supplies image/document control options, everything else is left to core node views
const createManuscriptNodeViews = () => streamNodeViews({
  controlOptions: (kind) => 
    Array.from(document.querySelectorAll('[data-article-media-item][data-kind="' + window.CSS.escape(kind) + '"]'))
      .map((item) => ({ value: item.dataset.id, label: item.dataset.title })),
});

export function createBlockEditor(instance, descriptor, target) {
  return mountBlockEditor(instance, descriptor, target, {
    streamSchema,
    streamNodeViews: createManuscriptNodeViews,
  });
}

export const createEmptyBlock = (fieldName, streamEditor) => (emptyBlockForField[fieldName] || createDefaultRichTextBlock)(streamEditor);
// TODO stop passing createEmptyBlock and use direct import
export const { createStreamEditor, createStreamBlockDraft } = createStreamEditorFactory({ createEmptyBlock });
export { blockTypeLabel };
