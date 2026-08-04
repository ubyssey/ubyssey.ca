// Block editing UI

import { blockTypeLabel } from "../stream/index.jsx";

// Floating block controls
export function ArticleBlockControlsLayer({ refs, ui, actions }) {
  return (
    <div ref={(element) => { refs.controlsWrapper = element; }} className="pm-article-block-controls-wrapper">
      <div
        ref={(element) => { refs.topControls = element; }}
        className="pm-article-block-controls pm-article-block-controls--top"
        onClick={(event) => { event.stopPropagation(); }}
        onMouseDown={(event) => { event.stopPropagation(); }}
        onPointerDown={(event) => { event.stopPropagation(); }}
        onMouseUp={(event) => { event.stopPropagation(); }}
        onChange={(event) => { event.stopPropagation(); }}
        onInput={(event) => { event.stopPropagation(); }}
      >
        <button type="button" title="Delete" className="pm-article-block-controls__button pm-article-block-controls__button--danger" onClick={actions.delete}>X</button>
        <button type="button" title="Move up" className="pm-article-block-controls__button pm-article-block-controls__button--move pm-article-block-controls__button--up" disabled={ui.upDisabled} onClick={actions.moveUp} />
        <button type="button" title="Move down" className="pm-article-block-controls__button pm-article-block-controls__button--move pm-article-block-controls__button--down" disabled={ui.downDisabled} onClick={actions.moveDown} />
        <button type="button" title="Toggle suggestion mode" className="pm-article-block-controls__button pm-article-block-controls__button--suggestion" aria-pressed={String(ui.suggestionMode)} onClick={actions.toggleSuggestion}><b>Suggest</b></button>
        <button type="button" title="Comment" className="pm-article-block-controls__button pm-article-block-controls__button--comment" onClick={actions.comment}>💬</button>
        {ui.blockType !== "richtext" && <button type="button" title="Edit block" className="pm-article-block-controls__button pm-article-block-controls__button--edit" onClick={actions.edit}>Edit</button>}
        <button type="button" title="Add block" className="pm-article-block-controls__button pm-article-block-controls__button--insert" onClick={actions.insert}>+</button>
      </div>
    </div>
  );
}

// Modal for Add/Delete/Edit
export function ArticleBlockModals({ refs, ui, actions }) {
  return (
    <>
      <ArticleBlockModal
        modalRef={(element) => { refs.blockEditorModal = element; }}
        open={ui.blockEditorOpen}
        title={`Edit ${blockTypeLabel(ui.blockType)} block`}
        closeLabel="Close block editor"
        onClose={actions.done}
      >
        <div ref={(element) => { refs.blockEditorContent = element; }} className="pm-article-block-dialog__editor" />
      </ArticleBlockModal>

      <ArticleBlockModal
        modalRef={(element) => { refs.insertDialog = element; }}
        open={ui.insertOpen}
        title={`Add block to ${ui.fieldName}`}
        closeLabel="Close add block"
        onClose={actions.cancelInsert}
      >
        <select
          ref={(element) => { refs.insertSelect = element; }}
          className="pm-article-block-controls__select"
          aria-label="Block type to insert"
          value={ui.insertType}
          onChange={(event) => { actions.setInsertType(event.currentTarget.value); }}
        >
          {ui.blockTypes.map((blockType) => <option key={blockType} value={blockType}>{blockTypeLabel(blockType)}</option>)}
        </select>
        <div ref={(element) => { refs.insertEditorBody = element; }} className="pm-article-block-dialog__editor" />
        <footer className="article-media-modal__footer article-block-editor-modal__footer">
          <button type="button" className="pm-article-block-dialog__button--primary" onClick={actions.commitInsert}>Add</button>
          <button type="button" onClick={actions.cancelInsert}>Cancel</button>
        </footer>
      </ArticleBlockModal>

      <ArticleBlockModal
        modalRef={(element) => { refs.deleteDialog = element; }}
        open={ui.deleteOpen}
        title={`Are you sure you want to delete this ${blockTypeLabel(ui.blockType)} block?`}
        closeLabel="Close delete block"
        onClose={actions.closeDialogs}
      >
        <footer className="article-media-modal__footer article-block-editor-modal__footer">
          <button type="button" className="pm-article-block-dialog__button--danger" onClick={actions.confirmDelete}>Delete</button>
          <button type="button" onClick={actions.closeDialogs}>Cancel</button>
        </footer>
      </ArticleBlockModal>
    </>
  );
}

// Shared block modal backdrop
function ArticleBlockModal({ modalRef, open, title, closeLabel, onClose, children }) {
  return (
    <div
      ref={modalRef}
      className="article-media-modal article-block-editor-modal"
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="article-media-modal__backdrop article-block-editor-modal__backdrop" aria-hidden="true" onPointerDown={onClose} />
      <section className="article-media-modal__panel article-media-modal__panel--settings article-block-editor-modal__panel" onClick={(event) => { event.stopPropagation(); }}>
        <header className="article-media-modal__header article-block-editor-modal__header">
          <h2>{title}</h2>
          <button type="button" className="article-media-modal__close article-block-editor-modal__close" aria-label={closeLabel} onClick={onClose}>x</button>
        </header>
        <div className="article-block-editor-modal__body">{children}</div>
      </section>
    </div>
  );
}
