const { filter } = require("keymaster");
const { redirect } = require("react-router");

var beats = JSON.parse(document.getElementById('beats-data').textContent);
// var pages = JSON.parse(document.getElementById('pages-data').textContent);

document.addEventListener("DOMContentLoaded", () => {

    setupMetadataResize();
    setupStatus();
    setupFilters();
    setupPreview();
    setupEditPanel();
    setupSidebar();
    setupBeats();
    console.log(pages)
    console.log(pages[11])

    console.log(requiredHeader)
});

function setupBeats() {
    var elements = document.getElementsByClassName("beat-input");
    console.log(elements.length);

    for (var i = 0; i < elements.length; i++) {
        autocomplete(elements[i], beats);
    }
}

var focusedAssignment = -1;

function setupEditPanel() {
    var elements = document.getElementsByClassName("edit-icon");
    for (var i = 0; i < elements.length; i++) {
        elements[i].addEventListener('click', handleEditClicked, false);
    }
}

function handleEditClicked(event) {
    previewButtonElement = event.target;
    assignmentId = getWagtailId(previewButtonElement.id);

    setFocusedAssignment(assignmentId);
    selectSidebarPanel("edit");
    updateEditPane()
}

function updateEditPane() {


    document.getElementById("edit-title").value = pages[focusedAssignment].title;
    // if (focusedAssignment != -1) {
    //     previewPanel.src = urlStart + focusedAssignment + urlEnd;
    // }
}
var button = document.getElementById("edit-submit")
button.addEventListener("click", async () => {
    const titleInput = document.getElementById("edit-title");
    try {
        let headers = {content_type: "application/json"}
        for (key of Object.keys(requiredHeader)) {
            console.log(key)
            headers[key] = requiredHeader[key]
        }

        let body = {"title": titleInput.value, "testing": true}

      const response = await fetch(updateEndpoint.replace("1918", focusedAssignment.toString()), { method: "POST", headers: headers, body: JSON.stringify(body),
        credentials: "same-origin"});
      const payload = await response.json();
      console.log(response)
      console.log(payload)
      if (!response.ok) {
        alert(`Upload failed: ${JSON.stringify(payload.errors || payload)}`);
        return;
      }

    //   document.querySelector("[data-article-media-gallery]").outerHTML = payload.gallery;
    //   const selector = `.pm-control-field--${payload.item.kind} select${payload.item.kind === "image" ? ",select[name='featured_media-image']" : ""}`;
    //   for (const select of document.querySelectorAll(selector)) {
    //     const option = Array.from(select.options).find((item) => String(item.value) === String(payload.item.id)) || select.appendChild(new Option());
    //     option.value = payload.item.id;
    //     option.textContent = payload.item.title;
    //   }

    //   closeUploadModal();
    } catch (error) {
        alert(error)
    //   alert("Upload failed.");
    } finally {
    //   button.disabled = false;
    }
  });

function setupPreview() {
    var elements = document.getElementsByClassName("preview-icon");
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

    if (selectedPanel == "edit") updateEditPane();
    if (selectedPanel == "preview") updatePreviewPane();

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

// =======================================
// ----------------STATUS-----------------
// =======================================

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


// =======================================
// ----------------BEAT-------------------
// =======================================




// =======================================
// --------------SIDEBAR------------------
// =======================================
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

////=============


function autocomplete(inp, arr) {
  /*the autocomplete function takes two arguments,
  the text field element and an array of possible autocompleted values:*/
  var currentFocus;
  /*execute a function when someone writes in the text field:*/
  inp.addEventListener("input", createDropdown);
  inp.addEventListener("click", createDropdown)

  function createDropdown(e) {
      var a, b, i, val = this.value;
      var limit = false;
      /*close any already open lists of autocompleted values*/
      closeAllLists();
      if (!val) { limit = true;}
      currentFocus = -1;
      /*create a DIV element that will contain the items (values):*/
      a = document.createElement("DIV");
      a.setAttribute("id", this.id + "autocomplete-list");
      a.setAttribute("class", "autocomplete-items");
      /*append the DIV element as a child of the autocomplete container:*/
      this.parentNode.appendChild(a);
      /*for each item in the array...*/
      var itemsAdded = 0;
      for (i = 0; i < arr.length; i++) { //todo make this not just the start
        /*check if the item starts with the same letters as the text field value:*/
        if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
          /*create a DIV element for each matching element:*/
          b = document.createElement("DIV");
          /*make the matching letters bold:*/
          b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
          b.innerHTML += arr[i].substr(val.length);
          /*insert a input field that will hold the current array item's value:*/
          b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
          /*execute a function when someone clicks on the item value (DIV element):*/
              b.addEventListener("click", function(e) {
              /*insert the value for the autocomplete text field:*/
              inp.value = this.getElementsByTagName("input")[0].value;
              /*close the list of autocompleted values,
              (or any other open lists of autocompleted values:*/
              closeAllLists();
          });
          a.appendChild(b);
          itemsAdded++;

          if (limit && itemsAdded > 10) return;
        }
      }
  }

  /*execute a function presses a key on the keyboard:*/
  inp.addEventListener("keydown", function(e) {
      var x = document.getElementById(this.id + "autocomplete-list");
      if (x) x = x.getElementsByTagName("div");
      if (e.keyCode == 40) {
        /*If the arrow DOWN key is pressed,
        increase the currentFocus variable:*/
        currentFocus++;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 38) { //up
        /*If the arrow UP key is pressed,
        decrease the currentFocus variable:*/
        currentFocus--;
        /*and and make the current item more visible:*/
        addActive(x);
      } else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x) x[currentFocus].click();
        }
      }
  });
  function addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    removeActive(x);
    if (currentFocus >= x.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (x.length - 1);
    /*add class "autocomplete-active":*/
    x[currentFocus].classList.add("autocomplete-active");
  }
  function removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  function closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
    except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != inp) {
      x[i].parentNode.removeChild(x[i]);
    }
  }

} 

/*execute a function when someone clicks in the document:*/
document.addEventListener("click", function (e) {
    closeAllLists(e.target); //TODO make this not scuffed
});
}
