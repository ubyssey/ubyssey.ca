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
    const select = document.getElementById("id_primary_tag_slug"); 
    let selected = Array.from(select.children).filter((child) => child.hasAttribute("selected")).map((child) => child.value);
    select.innerHTML = "";
    
    if (selected.length > 0) {
        selected = selected[0];
    }

    for (option of primaryTagOptions) {
        const elem = document.createElement("option");
        elem.value = option[0];
        elem.innerText = option[1];
        if (selected === option[0]) {
            elem.setAttribute("selected", "");
        }
        select.appendChild(elem);
    }
}

waitForElm('#id_tags').then((elem) => {
    waitForElm('#id_primary_tag_slug').then((elem) => {
        setTimeout(() => {
            const primaryTags = Array.from($('#id_tags').tagit("instance").tagList.children()).map((tag) => tag.children[0].innerText.replaceAll('"', ""));
            primaryTagOptions = Array.from(elem.children).filter((child) => primaryTags.includes(child.innerText)).map((child) => [child.value, child.innerText]);
            
            for (tag of primaryTags) {
                if (primaryTagOptions.filter((t) => t.includes(tag)).length == 0) {
                    primaryTagOptions.push([tag, tag]);
                }
            }
            
            redoPrimaryTagSelection();
        
            $('#id_tags').tagit({"afterTagRemoved": function(event, tag) {
                primaryTagOptions = primaryTagOptions.filter((t) => !t.includes(tag.tagLabel));
                redoPrimaryTagSelection();
            }});
            
            $('#id_tags').tagit({"afterTagAdded": function(event,tag) {
                if (primaryTagOptions.filter((t) => t.includes(tag.tagLabel)).length == 0) {
                    primaryTagOptions.push([tag.tagLabel, tag.tagLabel]);
                    redoPrimaryTagSelection()
                }
            }});
        
        }, 100);

    });
    
});
