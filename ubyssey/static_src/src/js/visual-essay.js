document.body.onscroll = function () {
    var count = 0;

    var containers = document.getElementsByClassName("o-visual-essay__content-container");
    for(let i=0; i < containers.length; i++) {

        var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];
        var right = containers[i].getElementsByClassName("o-visual-essay__right-container")[0];

        for(let i=0; i<right.children.length; i++) {
            if(right.children[i].classList.contains("mark")){
                if(right.children[i].offsetTop < document.documentElement.scrollTop + document.body.offsetHeight/2) {
                count = count + 1;
                }
            }
        }
        
        if(count == 0) {
            count = 1;
        }

        for(let a=0; a<left.children.length; a++) {
            //console.log("count: " + count);
            if(a==count-1){
                left.children[a].style.opacity = "1";
            } else {
                left.children[a].style.opacity = "0";
            }
        }
    }
};