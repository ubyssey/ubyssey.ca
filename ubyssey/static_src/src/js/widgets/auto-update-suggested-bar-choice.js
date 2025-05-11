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

function setSuggestBarOptionNames(options, categoryBlank) {
    for (let option of options) {
        if (option.value==="False") {
            if (categoryBlank) {
                option.innerText = "Section";
            } else {
                option.innerText = "Category";
            }
        }
    }
}

const updateSuggestedChoice = (mutationList, observer) => {
    const suggestedBarInput = document.getElementById("id_filter_by_tags");
    const options = Array.from(suggestedBarInput.children);
    const categoryBlank = mutationList[0].target.classList.contains("blank");

    setSuggestBarOptionNames(options, categoryBlank);

    for (let option of options) {
        option.selected = (option.value=="True" === categoryBlank);
        
        if (option.selected) {
            option.setAttribute("selected", "");
        } else {
            option.removeAttribute("selected");
        }
    }
};

const observer = new MutationObserver(updateSuggestedChoice); 

waitForElm("#id_category_page-chooser").then((targetNode) => {

    waitForElm("#id_filter_by_tags").then((suggestedBarInput) => {
        const options = Array.from(suggestedBarInput.children);
        const categoryBlank = targetNode.classList.contains("blank")
        setSuggestBarOptionNames(options, categoryBlank);
    })

    observer.observe(targetNode, {attributes: true});
});