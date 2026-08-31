import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import Select from "react-select";

import { addListener } from "../../core/events.js";
import { AUTHORS_CHANGED_EVENT, AUTHORS_UPDATED_EVENT } from "./events.js";
import { fetchAuthorOptions } from "./authors_options.js";

// Creates and manages Author Panel
export function useAuthorsPanel() {
  useEffect(() => {
    const panel = document.querySelector("[data-article-authors-panel]");
    if (!panel) return undefined;

    const rows = panel.querySelector("[data-article-author-rows]");
    const form = panel.closest("form");
    const selectRoots = new Map();
    const notifyChanged = () => {
      panel.dispatchEvent(new Event(AUTHORS_CHANGED_EVENT, { bubbles: true }));
      form.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const setupAuthorSelect = (select) => {
      const options = Array.from(select.options).map((option) => ({
        label: option.text,
        value: option.value,
      }));
      const container = document.createElement("div");
      const root = createRoot(container);

      container.className = "pm-author-panel__select";
      select.hidden = true;
      select.parentNode.insertBefore(container, select.nextSibling);
      root.render(
        <Select
          classNamePrefix="pm-author-panel-select"
          isDisabled={select.dataset.authorsLoading === "true"}
          defaultValue={options.find((option) => option.value === select.value)}
          options={options}
          onChange={(option) => {
            select.value = option.value;
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }}
        />,
      );
      selectRoots.set(container, root);
    };

    const applyCollaborativeRows = (event) => {
      const existingRow = rows.querySelector("[data-article-author-row]");
      if (!existingRow) return;

      const template = existingRow.cloneNode(true);
      template.querySelector(".pm-author-panel__select")?.remove();
      selectRoots.forEach((root) => root.unmount());
      selectRoots.clear();
      rows.replaceChildren();

      const collaborativeRows = event.detail?.length ? event.detail : [{ authorId: "", role: "author" }];
      collaborativeRows.forEach((item) => {
        const row = template.cloneNode(true);
        row.querySelector(".pm-author-panel__select")?.remove();
        const authorSelect = row.querySelector("[data-article-author-select]");
        const roleSelect = row.querySelector("[name='article_authors-role']");
        const authorId = String(item.authorId || "");

        authorSelect.dataset.selectedAuthorId = authorId;
        authorSelect.value = authorId;
        roleSelect.value = item.role || "author";
        rows.appendChild(row);
        setupAuthorSelect(authorSelect);
      });
    };

    panel.querySelectorAll("[data-article-author-select]").forEach(setupAuthorSelect);
    const refreshAuthorSelect = (select) => {
      const container = select.nextElementSibling;
      const root = selectRoots.get(container);
      if (root) {
        root.unmount();
        selectRoots.delete(container);
        container.remove();
      }
      setupAuthorSelect(select);
    };

    const loadAuthorOptions = async () => {
      try {
        const payload = await fetchAuthorOptions(form);

        const options = [
          { value: "", label: "Select author" },
          ...(payload.authors || []).map((author) => ({ value: author.id, label: author.label })),
        ];

        panel.querySelectorAll("[data-article-author-select]").forEach((select) => {
          const selectedAuthorId = select.dataset.selectedAuthorId || "";
          select.replaceChildren(...options.map((item) => {
            const option = document.createElement("option");
            option.value = item.value;
            option.textContent = item.label;
            return option;
          }));
          select.value = selectedAuthorId;
          delete select.dataset.authorsLoading;
          refreshAuthorSelect(select);
        });
      } catch (error) {
        console.error(error);
        panel.querySelectorAll("[data-article-author-select]").forEach((select) => {
          select.options[0].textContent = "Failed to fetch authors";
          refreshAuthorSelect(select);
        });
      }
    };

    loadAuthorOptions();

    const cleanups = [
      addListener(panel, "click", (event) => {
        const addButton = event.target.closest("[data-article-author-add]");
        const removeButton = event.target.closest("[data-article-author-remove]");
        if (!addButton && !removeButton) return;

        event.preventDefault();

        if (addButton) {
          const row = rows.querySelector("[data-article-author-row]").cloneNode(true);
          row.querySelector(".pm-author-panel__select").remove();
          row.querySelectorAll("label > span").forEach((label) => { label.remove(); });
          row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
          const authorSelect = row.querySelector("[data-article-author-select]");
          authorSelect.dataset.selectedAuthorId = "";
          authorSelect.value = "";
          rows.appendChild(row);
          setupAuthorSelect(row.querySelector("[data-article-author-select]"));
          window.requestAnimationFrame(() => {
            row.querySelector(".pm-author-panel-select__input input")?.focus();
          });
        } else {
          const row = removeButton.closest("[data-article-author-row]");
          const allRows = rows.querySelectorAll("[data-article-author-row]");
          const authorSelect = row.querySelector("[data-article-author-select]");
          const container = authorSelect.nextElementSibling;

          selectRoots.get(container).unmount();
          selectRoots.delete(container);
          container.remove();
          if (allRows.length === 1) {
            row.querySelectorAll("select").forEach((select) => { select.selectedIndex = 0; });
            authorSelect.dataset.selectedAuthorId = "";
            authorSelect.value = "";
            setupAuthorSelect(authorSelect);
          } else {
            row.remove();
          }
        }

        notifyChanged();
      }),
      addListener(panel, "change", notifyChanged),
      // Handles incoming author updated above sends
      addListener(panel, AUTHORS_UPDATED_EVENT, applyCollaborativeRows),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      selectRoots.forEach((root) => root.unmount());
    };
  }, []);
}
