// Handles state

export class ManuscriptSession {
  constructor() {
    this.streamEditors = [];
    this.articleRichTextEditors = [];
    this.articleDirectTextEditors = [];
    this.articleDirectPlainTextEditors = [];
    this.articleBlockControls = null;
    this.richTextToolbar = null;
    this.commentSidebar = null;
    this.footnoteSidebar = null;
    this.selectedArticleBlock = null;
    this.revealSelectedArticleBlock = null;
    this.blockEditorModalOpen = false;
    this.blockEditorDirty = false;
    this.blockEditorEditing = false;
    this.suppressedHoverArticleBlock = null;
    this.suppressedHoverTimer = null;
    this.preferredInsertTypes = new Map();
    this.schedulePreview = () => {};
    this.cancelPreviewRefresh = () => {};
    this.users = null;
    this.footnoteTexts = null;
  }

  registerStreamEditor(editor) {
    this.streamEditors.push(editor);
    return editor;
  }

  currentArticleTextViews() {
    const previewViews = [
      ...this.articleRichTextEditors,
      ...this.articleDirectTextEditors,
    ]
      .map((editor) => editor.view)
      .filter((view) => view.dom.isConnected);

    if (previewViews.length) {
      return previewViews.sort((a, b) => (
        a.dom.compareDocumentPosition(b.dom) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1
      ));
    }

    return this.streamEditors.map((editor) => editor.view);
  }

  // Returns hidden stream editors, which are the source of truth
  currentCollaborativeTextViews() {
    return this.streamEditors
      .map((editor) => editor.view)
      .filter(Boolean);
  }

  setPreviewService({ schedule, cancel }) {
    this.schedulePreview = schedule;
    this.cancelPreviewRefresh = cancel;
  }
}

export const manuscriptSession = new ManuscriptSession();
