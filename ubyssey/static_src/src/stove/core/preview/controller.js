import { pageEditorState } from "../state.js";
import { refreshPlainTextEditorsFromStream } from "./editables.jsx";
import { reconcilePreviewBlocks } from "./dom.js";
import { createPreviewRefresh, MODAL_PREVIEW_DEBOUNCE_MS } from "./refresh.js";

// Decides how stream change affects preview
export function createPreviewController({ form, pageRoot }) {
  const refresh = createPreviewRefresh(form, pageRoot);

  return {
    ...refresh,

    applyStreamChange(change) {
      const { before, doc, transaction, instance, kind } = change;
      const reconciliation = kind === "structure" ? reconcilePreviewBlocks({ before, doc, instance, pageRoot }) : { previewReconciled: false, structureChanged: false };
      const previewHandled = reconciliation.previewReconciled || Boolean(transaction?.getMeta("skipPreview"));

      if (kind === "remote") {
        refresh.refreshStream(instance.fieldName, { immediate: true });
      } else if (pageEditorState.blockEditorEditing) {
        pageEditorState.blockEditorDirty = true;
        refreshPlainTextEditorsFromStream(instance);

        refresh.refreshBlock(pageEditorState.selectedBlock, {
          debounceMs: MODAL_PREVIEW_DEBOUNCE_MS,
        });
      } else if (!pageEditorState.blockEditorModalOpen && !previewHandled) {
        const options = {
          deferIfPageFocused: true,
          immediate: reconciliation.structureChanged,
        };

        if (reconciliation.structureChanged) {
          refresh.refreshStream(instance.fieldName, options);
        } else {
          refresh.refreshDoc(options);
        }
      }
      pageEditorState.scheduleEditorUiRefresh();
    },
  };
}
