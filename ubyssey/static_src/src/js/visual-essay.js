var views = ["vs-side-by-side","vs-over-image"];
var leftClasses = ["o-visual-essay__left-next","o-visual-essay__left-show","o-visual-essay__left-prev","o-visual-essay__left-first"];
var pastViewCount = 0;
var pastCount = 0;

document.body.onscroll = function () {
    var count = 0;
    var viewCount = 0;

    var containers = document.getElementsByClassName("o-visual-essay__content-container");

    for(let i=0; i < containers.length; i++) {
        var scrolled = document.documentElement.scrollTop + document.body.offsetHeight*(0.5);
        if (containers[i].offsetTop + containers[i].offsetHeight < scrolled) {
            containers[i].classList.remove("o-visual-essay__content-container-show");
            containers[i].classList.add("o-visual-essay__content-container-hide");
            var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];

        } else {
            containers[i].classList.add("o-visual-essay__content-container-show");
            containers[i].classList.remove("o-visual-essay__content-container-hide");

            var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];
            var right = containers[i].getElementsByClassName("o-visual-essay__right-container")[0];
    
            for(let i=0; i<right.children.length; i++) {
                var block = right.children[i];

                if(block.classList.contains("script_block")){
                    if (block.getAttribute("activated") == "false") {
                        if(block.offsetTop < scrolled) {
                            eval(block.getAttribute("script"));
                            block.setAttribute("activated", "true");
                        }
                    } else {
                        if(block.offsetTop > scrolled) {
                            eval(block.getAttribute("reversescript"));
                            block.setAttribute("activated", "false");
                        }
                    }
                }

                if(block.classList.contains("mark")){
                    if(block.offsetTop <scrolled) {
                        count = count + 1;
                    }
                }

                if(block.classList.contains("switch_view")){
                    if(block.offsetTop <scrolled) {
                        viewCount = viewCount + 1;
                    }
                }
            }
            
            if(viewCount == 0) {
                viewCount = 1;
            }

            if (pastViewCount != viewCount) {
                pastViewCount = viewCount;
                removeClasses(containers[i], views);
                containers[i].classList.add(containers[i].getElementsByClassName("switch_view")[viewCount-1].getAttribute("view"));
            }
            
            if (pastCount != count) {
                pastCount = count;

                for(let a=0; a<left.children.length; a++) {
                    var leftBlock = left.children[a];
                    removeClasses(leftBlock, leftClasses);
                    if (count == 0 && a==0) {
                        leftBlock.classList.add("o-visual-essay__left-first");
                    } else if(a==count-1){
                        leftBlock.classList.add("o-visual-essay__left-show");
                    } else if (a < count-1) {
                        leftBlock.classList.add("o-visual-essay__left-prev");
                    } else {
                        leftBlock.classList.add("o-visual-essay__left-next");
                    }
                }
            }
        }
    }
};

function removeClasses(elem, classes) {
    for(let i=0;i<classes.length;i++) {
        elem.classList.remove(classes[i]);
    }
}