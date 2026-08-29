import { setupPageShadow } from "./dom.js";
import { createPreviewController } from "./controller.js";
import { destroyPagePreviewEditors, setupPagePreviewEditors } from "./editables.jsx";
import { setupBlockEditorActions } from "./block_editor.jsx";
import { findPageBlock, setupPageBlockKeyboard } from "./selection.js";
import { setupHistoryPreviewButtons } from "./refresh.js";

export { setupPageShadow };

// The manuscript editor interacts with the preview through this object.
export function createPagePreview({ form, pageRoot, blockTypeLabel, createBlockEditor, createStreamBlockDraft }) {
  const controller = createPreviewController({ form, pageRoot });
  let blockActions = null;
  let removeKeyboard = null;
  let mounted = false;

  return {
    applyStreamChange: controller.applyStreamChange,
    refreshDoc: controller.refreshDoc,
    refreshStream: controller.refreshStream,
    refreshBlock: controller.refreshBlock,
    cancel: controller.cancel,
    findBlock: findPageBlock,

    mount() {
      if (mounted) return;
      setupPagePreviewEditors(pageRoot);
      blockActions = setupBlockEditorActions(pageRoot, {
        blockTypeLabel,
        createBlockEditor,
        createStreamBlockDraft,
        preview: controller,
      });
      removeKeyboard = setupPageBlockKeyboard(pageRoot);
      mounted = true;
    },

    setupHistory() {
      setupHistoryPreviewButtons(pageRoot, controller.cancel);
    },

    destroy() {
      if (!mounted) return;
      controller.destroy();
      blockActions.cleanup();
      removeKeyboard();
      destroyPagePreviewEditors();
      mounted = false;
    },
  };
}
