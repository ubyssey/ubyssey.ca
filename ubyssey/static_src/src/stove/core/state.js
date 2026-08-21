// Handles state

export class PageEditorState {
  constructor() {
    this.streamEditors = [];
    this.pageRichTextEditors = [];
    this.pageDirectRichTextEditors = [];
    this.pageDirectPlainTextEditors = [];
    this.blockActions = null;
    this.richTextToolbar = null;
    this.commentSidebar = null;
    this.footnoteSidebar = null;
    this.selectedBlock = null;
    this.revealSelectedBlock = null;
    this.blockEditorModalOpen = false;
    this.blockEditorDirty = false;
    this.blockEditorEditing = false;
    this.blockEditorView = null;
    this.preferredInsertTypes = new Map();
    this.scheduleEditorUiRefresh = () => {};
    this.users = null;
    this.awareness = null;
    this.footnoteTexts = null;
    this.history = null;
  }

  registerStreamEditor(editor) {
    this.streamEditors.push(editor);
    return editor;
  }

  currentPageTextViews() {
    const previewViews = [
      ...this.pageRichTextEditors,
      ...this.pageDirectRichTextEditors,
    ]
      .map((editor) => editor.view)
      .filter((view) => view.dom.isConnected);

    if (previewViews.length) {
      return previewViews.sort((a, b) => (
        a.dom.compareDocumentPosition(b.dom) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1
      ));
    }

    return this.blockEditorView ? [this.blockEditorView] : [];
  }
}

export const pageEditorState = new PageEditorState();
