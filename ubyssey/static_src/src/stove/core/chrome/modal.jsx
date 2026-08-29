// Shared modal helpers

// The first input within the modal, used to focus into first field (should test to see if this is actually useful)
export const focusableSelector = "input:not([type='hidden']), select, textarea, button";

export function setModalOpen(modal, isOpen, focusTarget = null) {
  modal.hidden = !isOpen;
  document.body.classList.toggle(
    "page-editor-modal-open",
    document.querySelector(".page-editor-modal:not([hidden])"),
  );

  if (isOpen) {
    window.requestAnimationFrame(() => {
      (focusTarget || modal.querySelector(focusableSelector)).focus();
    });
  }
}

// Basic Modal Template
export function Modal({ modalRef, open, title, closeLabel, onClose, children }) {
  return (
    <div
      ref={modalRef}
      className="page-editor-modal page-block-editor-modal"
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="page-editor-modal__backdrop page-block-editor-modal__backdrop" aria-hidden="true" onPointerDown={onClose} />
      <section className="page-editor-modal__panel page-editor-modal__panel--settings page-block-editor-modal__panel" onClick={(event) => { event.stopPropagation(); }}>
        <header className="page-editor-modal__header page-block-editor-modal__header">
          <h2>{title}</h2>
          <button type="button" className="page-editor-modal__close page-block-editor-modal__close" aria-label={closeLabel} onClick={onClose}>x</button>
        </header>
        <div className="page-block-editor-modal__body">{children}</div>
      </section>
    </div>
  );
}
