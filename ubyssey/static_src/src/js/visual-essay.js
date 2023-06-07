document.body.onscroll = function () {
    var text = document.getElementById("o-visual-essay__text-container");
    var imagescontainer = document.getElementById("o-visual-essay__images-container");
    var count = 0;
    for(let i=0; i<text.children.length; i++) {
        //console.log("marks:" + text.children[i].offsetTop);
        //console.log("scroll:" + document.documentElement.scrollTop);
        if(text.children[i].classList.contains("mark")){
            if(text.children[i].offsetTop < document.documentElement.scrollTop + document.body.offsetHeight/2) {
            count = count + 1;
            }
        }
    }
    
    if(count == 0) {
        count = 1;
    }

    for(let a=0; a<imagescontainer.children.length; a++) {
        //console.log("count: " + count);
        if(a==count-1){
            console.log("a:" + a)
            imagescontainer.children[a].style.opacity = "1";
        } else {
            imagescontainer.children[a].style.opacity = "0";
        }
    }
};