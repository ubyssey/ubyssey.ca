// Handles state

export class ManuscriptSession {
  constructor() {
    this.streamEditors = [];
    this.articleRichTextEditors = [];
    this.articleDirectTextEditors = [];
    this.articleDirectPlainTextEditors = [];
    this.articleBlockActions = null;
    this.richTextToolbar = null;
    this.commentSidebar = null;
    this.footnoteSidebar = null;
    this.selectedArticleBlock = null;
    this.revealSelectedArticleBlock = null;
    this.blockEditorModalOpen = false;
    this.blockEditorDirty = false;
    this.blockEditorEditing = false;
    this.preferredInsertTypes = new Map();
    this.schedulePreview = () => {};
    this.cancelPreviewRefresh = () => {};
    this.scheduleEditorUiRefresh = () => {};
    this.users = null;
    this.awareness = null;
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

    // Filters out unmounted editors
    return this.streamEditors.map((editor) => editor.view).filter(Boolean);
  }
}

export const manuscriptSession = new ManuscriptSession();
