// Saves accordian open/closed state so it persists across reloads

const SIDEBAR_ACCORDION_STORAGE_KEY = "stove:manuscript-sidebar-accordion";

export function setupSidebarAccordion() {
  const items = document.querySelectorAll("[data-sidebar-accordion-item][data-sidebar-accordion-key]");
  let savedState = {};

  const storedState = window.localStorage.getItem(SIDEBAR_ACCORDION_STORAGE_KEY);
  if (storedState) {
    const parsedState = JSON.parse(storedState);
    if (parsedState) savedState = parsedState;
  }

  items.forEach((item) => {
    const key = item.dataset.sidebarAccordionKey;
    if (key in savedState) item.open = Boolean(savedState[key]);

    item.addEventListener("toggle", () => {
      savedState[key] = item.open;
      window.localStorage.setItem(SIDEBAR_ACCORDION_STORAGE_KEY, JSON.stringify(savedState));
    });
  });
}