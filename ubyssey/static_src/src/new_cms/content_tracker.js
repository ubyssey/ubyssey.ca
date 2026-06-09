const { filter } = require("keymaster");
const { redirect } = require("react-router");

document.addEventListener("DOMContentLoaded", () => {

    setupMetadataResize();
    setupStatus();
    setupFilters();
    setupPreview();
    setupSidebar();
});

var focusedAssignment = -1;

function setupPreview() {
    var elements = document.getElementsByClassName("preview-icon");
    console.log(elements.length);
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('click', handlePreviewClicked, false);
    }
}

function handlePreviewClicked(event) {
    previewButtonElement = event.target;
    assignmentId = getWagtailId(previewButtonElement.id);

    setFocusedAssignment(assignmentId);
    selectSidebarPanel("preview");
    updatePreviewPane();
}

function setupSidebar() {

    var elements = document.getElementsByClassName("metadata-nav-button");
    console.log("SIDEBAR: " + elements.length);
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('click', handleSidebarNavClicked, false);
        if (elements[i].id != "metadata-selection-create") {
            elements[i].classList.add("selection-option-disabled");
        }
    }
}

function handleSidebarNavClicked(event) {
    var triggerringButton = event.target;
    var panel = triggerringButton.name;
    if (!triggerringButton.parentElement.classList.contains("selection-option-disabled")) {
        selectSidebarPanel(panel);
    }

}



// this actually is more complicated than I'd like: https://lincolnloop.com/blog/how-wagtail-stores-draft-previews-and-why-your-links-break/
function updatePreviewPane() {
    // TODO: make this actually good
    var urlStart = "http://localhost:8000/admin/pages/";
    var urlEnd = "/edit/preview/";

    var previewPanel = document.getElementById("article-preview-pane");
    if (focusedAssignment != -1) {
        previewPanel.src = urlStart + focusedAssignment + urlEnd;
    }
}

function setFocusedAssignment(wagtailId) {
    focusedAssignment = wagtailId;
    var noneSelected = focusedAssignment === -1;
    var elements = document.getElementsByClassName("sidebar-nav");

    for (var i = 0; i < elements.length; i++) {
        console.log("NONE SELECTED: " + noneSelected);
        if (noneSelected && elements[i].id != "metadata-selection-create") {
            elements[i].classList.add("selection-option-disabled");
        } else {
            elements[i].classList.remove("selection-option-disabled");
        }
    }

    var selectedRows = document.getElementsByClassName("content-row-selected")
    for (var i = 0; i < selectedRows.length; i++) {
        selectedRows[i].classList.remove("content-row-selected");
    }
    

    document.getElementById("content-row-"+wagtailId).classList.add("content-row-selected");
}

function getWagtailId(elementId) {
    return elementId.replace(/\D/g, "");
}

function selectSidebarPanel(selectedPanel) {
    var idPrefix = "metadata-selection-"

    var metadataSelectionElement = document.getElementById("metadata-panel-select");
    var selectionOptions = metadataSelectionElement.querySelectorAll(".selection-option");

    for (var i = 0; i < selectionOptions.length; i++) {
        var option = selectionOptions[i];
        if (option.id === idPrefix + selectedPanel) {
            option.classList.remove("selection-option-inactive");
            option.classList.add("selection-option-active");
            document.getElementById(option.id + "-pane").hidden = false;
        } else {
            option.classList.remove("selection-option-active");
            option.classList.add("selection-option-inactive");
            document.getElementById(option.id + "-pane").hidden = true;

        }
    }
}


function setupFilters() {
    var elements = document.getElementsByClassName("filter");

    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('change', filterAssignments, false);
    }

    filterAssignments();
}

// TODO: if possible make this a query with wagtail
function filterAssignments() {
    var onlyMe = document.getElementById("show-assigned-to-me").checked;
    var includePublished = document.getElementById("show-published").checked;


    var elements = document.getElementsByClassName("content-row");
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        // var elementId = elements[i].id;
        // var articleId = elementId.replace(/\D/g, "");
        if (onlyMe && !isAssignedToMe(element)) {
            element.hidden = true;
        } else if (!includePublished && isPublished(element)) {
            element.hidden = true;
        } else {
            element.hidden=false;
        }
    }
}

function isAssignedToMe(element) {
    var bylineElement = element.querySelector('.byline-field');
    return bylineElement.value === "Quyen Schroeder";
}

function isPublished(element) {
    var statusElement = element.querySelector('.status-field');
    return statusElement.value === "published";
}

function setupStatus() {
    var elements = document.getElementsByClassName("status-field");

    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('change', updateStatus, false);
        setStatusColor(elements[i]);
    }
}

function updateStatus(event) { 
    setStatusColor(event.target);
    // TODO: update on backend
}

const statusColors = new Map();

statusColors.set("assigned", "pink");
statusColors.set("filed", "lightyellow");
statusColors.set("editing", "yellow");
statusColors.set("copy", "#CBC3E3"); // light purple
statusColors.set("ready", "#AFE1AF");
statusColors.set("published", "lime");



function setStatusColor(element) {
    element.style.background = determineStatusColor(element.value);
}

function determineStatusColor(statusName) {
    return statusColors.get(statusName) || "lightgray";
}







function selectMetadataTab(selected) {
  for (const tab of document.querySelectorAll("[data-metadata-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.metadataTab === selected));
  }
  for (const panel of document.querySelectorAll("[data-metadata-panel]")) {
    panel.hidden = panel.dataset.metadataPanel !== selected;
  }
}

function setupMetadataResize() {
  const editor = document.querySelector("[data-manuscript-editor]");
  const handle = document.querySelector("[data-metadata-resize-handle]");
  const aside = document.querySelector("[data-metadata-editor]");
  if (!editor || !handle || !aside) return;

  const setWidth = (width) => {
    const max = Math.min(1080, window.innerWidth - 180);
    editor.style.setProperty("--metadata-width", `${Math.max(280, Math.min(max, width))}px`);
  };

  setWidth(Number(localStorage.getItem("metadataEditorWidth")) || aside.getBoundingClientRect().width);

  handle.addEventListener("pointerdown", (event) => {
    handle.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent) => {
      const width = editor.getBoundingClientRect().right - moveEvent.clientX;
      setWidth(width);
      localStorage.setItem("metadataEditorWidth", Math.round(width));
    };

    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}
