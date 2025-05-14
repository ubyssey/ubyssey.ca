let primaryTagOptions = [];

function waitForElm(selector) {
    // Source: https://stackoverflow.com/a/61511955
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function redoPrimaryTagSelection(){
    // Empties the primary tag dropdown and then fills it back up from the value of primaryTagOptions. 
    // Keeps same selected value if any.

    const select = document.getElementById("id_primary_tag_slug"); 
    let selected = Array.from(select.children).filter((child) => (child.selected)).map((child) => child.value);
    select.innerHTML = "";
    
    if (selected.length > 0) {
        selected = selected[0];
    }

    primaryTagOptions.forEach((option, index) => {
        const elem = document.createElement("option");
        elem.value = option[0];
        elem.innerText = option[1];
        if (selected === option[0] || selected.length===0 && index===0) {
            elem.selected = true;
            elem.setAttribute("selected", "");
        }
        select.appendChild(elem);
    });
}

waitForElm('#id_tags').then((elem) => {
    waitForElm('#id_primary_tag_slug').then((elem) => {
        setTimeout(() => {
            // Read all tags from the tags field
            const tags = Array.from($('#id_tags').tagit("instance").tagList.children()).map((tag) => tag.children[0].innerText.replaceAll('"', "")).filter((tag) => tag!="");
           
            // Start primaryTagOptions as everything in the primary tag dropdown. Then remove everything that isn't in the tags field.
            // This is somewhat redundant as the dropdown should start either be empty or include only the saved value (which should already be chosen from the tags field)
            primaryTagOptions = Array.from(elem.children).filter((child) => tags.includes(child.innerText)).map((child) => [child.value, child.innerText]);
            
            // Add every tag of the tags field that wasn't already in the primary tags dropdown
            for (const tag of tags) {
                if (primaryTagOptions.filter((t) => t.includes(tag)).length == 0) {
                    primaryTagOptions.push([tag, tag]);
                }
            }
            
            redoPrimaryTagSelection();
        
            // callbacks are defined here:  https://github.com/wagtail/wagtail/blob/main/wagtail/admin/static_src/wagtailadmin/js/vendor/tag-it.js
            
            // When a tag is removed, remove it from the dropdown
            $('#id_tags').tagit({"afterTagRemoved": function(event, tag) {
                primaryTagOptions = primaryTagOptions.filter((t) => !t.includes(tag.tagLabel));
                redoPrimaryTagSelection();
            }});
            
            // When a tag is added, add it to the dropdown
            $('#id_tags').tagit({"afterTagAdded": function(event,tag) {
                if (primaryTagOptions.filter((t) => t.includes(tag.tagLabel)).length == 0) {
                    primaryTagOptions.push([tag.tagLabel.replaceAll('"', ""), tag.tagLabel.replaceAll('"', "")]);
                    redoPrimaryTagSelection()
                }
            }});
        
        }, 100);

    });
    
});
