// Handles state

export class ManuscriptSession {
  constructor() {
    this.streamEditors = [];
    this.articleRichTextEditors = [];
    this.articleDirectTextEditors = [];
    this.articleBlockControls = null;
    this.richTextToolbar = null;
    this.commentSidebar = null;
    this.footnoteSidebar = null;
    this.selectedArticleBlock = null;
    this.revealSelectedArticleBlock = null;
    this.blockEditorModalOpen = false;
    this.suppressedHoverArticleBlock = null;
    this.suppressedHoverTimer = null;
    this.preferredInsertTypes = new Map();
    this.schedulePreview = () => {};
    this.cancelPreviewRefresh = () => {};
    this.websocket = null;
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

    return previewViews.length
      ? previewViews
      : this.streamEditors.map((editor) => editor.view);
  }

  setPreviewService({ schedule, cancel }) {
    this.schedulePreview = schedule;
    this.cancelPreviewRefresh = cancel;
  }
}

export const manuscriptSession = new ManuscriptSession();
