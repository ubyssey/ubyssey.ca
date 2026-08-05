// This maps metadata into YJS

import * as Y from "yjs";

import {
  AUTHORS_CHANGED_EVENT,
  AUTHORS_KEY,
  AUTHORS_UPDATED_EVENT,
  FIELD_APPLIED_EVENT,
  FIELD_PREFIX,
  FIELD_SELECTOR,
} from "./constants.js";
import {
  authorRows,
  newSharedAuthors,
  updateSharedAuthors,
} from "./authors.js";
import {
  fieldGroups,
  fieldValue,
  isCollaborativeText,
  setFieldValue,
} from "./fields.js";
import {
  mapUpdatedTextSelection,
  newSharedText,
  sameValue,
  sharedValue,
  updateSharedText,
} from "./shared.js";

// Initializes YJS metadata from the form
export function seedMetadata(ydoc, form) {
  const metadata = ydoc.getMap("metadata");

  ydoc.transact(() => {
    fieldGroups(form).forEach((fields, name) => {
      const key = `${FIELD_PREFIX}${name}`;
      if (!metadata.has(key)) {
        const value = fieldValue(fields);
        metadata.set(key, isCollaborativeText(fields) ? newSharedText(value) : value);
      } else if (isCollaborativeText(fields) && !(metadata.get(key) instanceof Y.Text)) {
        metadata.set(key, newSharedText(metadata.get(key)));
      }
    });

    if (!metadata.has(AUTHORS_KEY)) {
      metadata.set(AUTHORS_KEY, newSharedAuthors(authorRows(form)));
    } else if (!(metadata.get(AUTHORS_KEY) instanceof Y.Array)) {
      const rows = Array.isArray(metadata.get(AUTHORS_KEY)) ? metadata.get(AUTHORS_KEY) : [];
      metadata.set(AUTHORS_KEY, newSharedAuthors(rows));
    }

  }, "metadata-initialization");
  return metadata;
}

// Binds metadata forms to YJS and applies remote YJS updates back to the DOM
export function setupMetadataCollaboration(form, metadata) {
  if (!metadata) return () => {};
  let applyingRemote = false;
  const textObservers = new Map();
  let authorsObserver = null;

  const applyField = (name, value, { remote = false } = {}) => {
    const fields = fieldGroups(form).get(name);
    const nextValue = sharedValue(value);
    if (!fields?.length) return;
    const previousValue = fieldValue(fields);
    if (sameValue(previousValue, nextValue)) return;

    const first = fields[0];
    const preserveSelection = document.activeElement === first
      && typeof previousValue === "string"
      && typeof nextValue === "string"
      && Number.isInteger(first.selectionStart);
    const selectionStart = preserveSelection ? mapUpdatedTextSelection(previousValue, nextValue, first.selectionStart) : null;
    const selectionEnd = preserveSelection ? mapUpdatedTextSelection(previousValue, nextValue, first.selectionEnd) : null;

    setFieldValue(fields, nextValue);
    if (preserveSelection) first.setSelectionRange(selectionStart, selectionEnd);
    first.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new CustomEvent(FIELD_APPLIED_EVENT, {
      bubbles: true,
      detail: { name, value: nextValue, remote },
    }));
  };

  const applyAuthors = (authors) => {
    const rows = sharedValue(authors);
    const panel = form.querySelector("[data-article-authors-panel]");
    if (!panel || sameValue(authorRows(form), rows)) return;
    panel.dispatchEvent(new CustomEvent(AUTHORS_UPDATED_EVENT, {
      detail: Array.isArray(rows) ? rows : [],
    }));
  };

  // Removes Y.text observer
  const unbindText = (key) => {
    const binding = textObservers.get(key);
    if (binding) binding.text.unobserve(binding.observer);
    textObservers.delete(key);
  };

  const bindText = (key, value) => {
    unbindText(key);
    if (!(value instanceof Y.Text)) return;
    const observer = (event) => {
      applyingRemote = true;
      try {
        applyField(key.slice(FIELD_PREFIX.length), value, {
          remote: event.transaction.origin !== "metadata-input",
        });
      } finally {
        applyingRemote = false;
      }
    };
    value.observe(observer);
    textObservers.set(key, { text: value, observer });
  };

  const bindAuthors = (authors) => {
    if (authorsObserver) authorsObserver.authors.unobserveDeep(authorsObserver.observer);
    authorsObserver = null;
    if (!(authors instanceof Y.Array)) return;
    const observer = () => {
      applyingRemote = true;
      try {
        applyAuthors(authors);
      } finally {
        applyingRemote = false;
      }
    };
    authors.observeDeep(observer);
    authorsObserver = { authors, observer };
  };

  // Applies all metadata on setup
  const applyAll = () => {
    applyingRemote = true;
    try {
      metadata.forEach((value, key) => {
        if (key === AUTHORS_KEY) {
          bindAuthors(value);
          applyAuthors(value);
        } else if (key.startsWith(FIELD_PREFIX)) {
          bindText(key, value);
          applyField(key.slice(FIELD_PREFIX.length), value);
        }
      });
    } finally {
      applyingRemote = false;
    }
  };

  // Handles YJS updates and directs to field/author update
  const onMetadata = (event) => {
    applyingRemote = true;
    try {
      event.keysChanged.forEach((key) => {
        const value = metadata.get(key);
        if (key === AUTHORS_KEY) {
          bindAuthors(value);
          applyAuthors(value);
        } else if (key.startsWith(FIELD_PREFIX)) {
          bindText(key, value);
          applyField(key.slice(FIELD_PREFIX.length), value);
        }
      });
    } finally {
      applyingRemote = false;
    }
  };

  // Writes form field changes to YJS
  const onFieldChanged = (event) => {
    if (applyingRemote) return;
    const field = event.target.closest?.(FIELD_SELECTOR);
    if (!field?.name) return;
    const fields = fieldGroups(form).get(field.name);
    if (!fields) return;

    const key = `${FIELD_PREFIX}${field.name}`;
    const previous = metadata.get(key);
    const next = fieldValue(fields);
    if (sameValue(previous, next)) return;
    if (previous instanceof Y.Text && typeof next === "string") updateSharedText(metadata, previous, next);
    else metadata.set(key, next);
  };

  // Writes local author row changes to YJS
  const onAuthorsChanged = () => {
    if (applyingRemote) return;
    const rows = authorRows(form);
    const authors = metadata.get(AUTHORS_KEY);
    if (sameValue(authors, rows)) return;
    if (authors instanceof Y.Array) updateSharedAuthors(metadata, authors, rows);
    else metadata.set(AUTHORS_KEY, newSharedAuthors(rows));
  };

  metadata.observe(onMetadata);
  form.addEventListener("input", onFieldChanged);
  form.addEventListener("change", onFieldChanged);
  form.addEventListener(AUTHORS_CHANGED_EVENT, onAuthorsChanged);
  applyAll();

  return () => {
    metadata.unobserve(onMetadata);
    textObservers.forEach(({ text, observer }) => text.unobserve(observer));
    if (authorsObserver) authorsObserver.authors.unobserveDeep(authorsObserver.observer);
    form.removeEventListener("input", onFieldChanged);
    form.removeEventListener("change", onFieldChanged);
    form.removeEventListener(AUTHORS_CHANGED_EVENT, onAuthorsChanged);
  };
}

export { AUTHORS_CHANGED_EVENT, AUTHORS_UPDATED_EVENT, FIELD_APPLIED_EVENT };
