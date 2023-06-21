document.body.onscroll = function () {
    var count = 0;

    var containers = document.getElementsByClassName("o-visual-essay__content-container");

    for(let i=0; i < containers.length; i++) {
        // containers[i].offsetTop > document.documentElement.scrollTop + document.body.offsetHeight/2 || 
        if (containers[i].offsetTop + containers[i].offsetHeight < document.documentElement.scrollTop + document.body.offsetHeight/2) {
            containers[i].classList.remove("o-visual-essay__content-container-show");
            containers[i].classList.add("o-visual-essay__content-container-hide");
            var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];

            //for(let a=0; a<left.children.length - 1; a++) {
            //    left.children[a].classList.add("o-visual-essay__left-hide");
            //    left.children[a].classList.remove("o-visual-essay__left-show");
            //}

        } else {
            containers[i].classList.add("o-visual-essay__content-container-show");
            containers[i].classList.remove("o-visual-essay__content-container-hide");

            var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];
            var right = containers[i].getElementsByClassName("o-visual-essay__right-container")[0];
    
            for(let i=0; i<right.children.length; i++) {
                if(right.children[i].classList.contains("mark")){
                    if(right.children[i].offsetTop < document.documentElement.scrollTop + document.body.offsetHeight/2) {
                    count = count + 1;
                    }
                }
            }
            
            //if(count == 0) {
            //    count = 1;
            //}
    
            for(let a=0; a<left.children.length; a++) {
                //console.log("count: " + count);
                if(a==count-1){
                    left.children[a].classList.add("o-visual-essay__left-show");
                    left.children[a].classList.remove("o-visual-essay__left-next");
                    left.children[a].classList.remove("o-visual-essay__left-prev");
                } else if (a < count-1) {
                    left.children[a].classList.add("o-visual-essay__left-prev");
                    left.children[a].classList.remove("o-visual-essay__left-show");
                    left.children[a].classList.remove("o-visual-essay__left-next");
                } else {
                    left.children[a].classList.add("o-visual-essay__left-next");
                    left.children[a].classList.remove("o-visual-essay__left-show");
                    left.children[a].classList.remove("o-visual-essay__left-prev");
                }
            }
        }
    }
};