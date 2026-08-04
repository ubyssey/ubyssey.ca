// Handles non-stream form fields in the manuscript editor, including grouping and value setting/getting

import { FIELD_SELECTOR, TEXT_INPUT_TYPES } from "./constants.js";

// Grabs [data-collaborative-metadata] - see manuscript editor
export function fieldGroups(form) {
  const groups = new Map();
  form.querySelectorAll(FIELD_SELECTOR).forEach((field) => {
    if (field.disabled || field.type === "file" || field.type === "submit" || field.type === "button") return;
    const fields = groups.get(field.name) || [];
    fields.push(field);
    groups.set(field.name, fields);
  });
  return groups;
}

// Reads input values into JS
export function fieldValue(fields) {
  const first = fields[0];

  if (first.type === "checkbox") {
    return fields.length === 1 ? first.checked : fields.filter((field) => field.checked).map((field) => field.value);
  }
  if (first instanceof HTMLSelectElement && first.multiple) {
    return Array.from(first.selectedOptions, (option) => option.value);
  }

  return first.value;
}

// Decides whether field should be represented as Y.text, checks if in the text input type list below
export function isCollaborativeText(fields) {
  const first = fields[0];
  return first instanceof HTMLTextAreaElement || (first instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(first.type));
}

export function setFieldValue(fields, value) {
  const first = fields[0];
  if (first.type === "checkbox") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    fields.forEach((field) => {
      field.checked = fields.length === 1 ? Boolean(value) : selected.includes(field.value);
    });
    return;
  }
  if (first instanceof HTMLSelectElement && first.multiple) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    Array.from(first.options).forEach((option) => { option.selected = selected.includes(option.value); });
    return;
  }

  const nextValue = String(value ?? "");
  if (first instanceof HTMLSelectElement && nextValue && !Array.from(first.options).some((option) => option.value === nextValue)) {
    first.appendChild(new Option(`Selected item (${nextValue})`, nextValue));
  }
  first.value = nextValue;
}
