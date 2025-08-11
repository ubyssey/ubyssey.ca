var views = ["vs-side-by-side","vs-over-image", "vs-over-image--left"];
var leftClasses = ["o-visual-essay__left-next","o-visual-essay__left-show","o-visual-essay__left-prev","o-visual-essay__left-first"];
var pastViewCount = 0;
var pastCount = 0;

document.body.onscroll = function () {
    var count = 0;
    var viewCount = 0;

    var containers = document.getElementsByClassName("o-visual-essay__content-container");

    for(let i=0; i < containers.length; i++) {
        var scrolled = document.documentElement.scrollTop + window.innerHeight*(0.5);
        if (containers[i].offsetTop + containers[i].offsetHeight < scrolled) {
            //containers[i].classList.remove("o-visual-essay__content-container-show");
            //containers[i].classList.add("o-visual-essay__content-container-hide");
            var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];

        } else {
            containers[i].classList.add("o-visual-essay__content-container-show");
            containers[i].classList.remove("o-visual-essay__content-container-hide");

            var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];
            var right = containers[i].getElementsByClassName("o-visual-essay__right-container")[0];
    
            for(let i=0; i<right.children.length; i++) {
                var block = right.children[i];

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

            if (pastViewCount != viewCount) {
                pastViewCount = viewCount;
                removeClasses(containers[i], views);
                const viewClasses = containers[i].getElementsByClassName("switch_view")[viewCount-1].getAttribute("view").split(" ");
                for (const viewClass of viewClasses) {
                    containers[i].classList.add(viewClass);
                }
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



import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let mm = gsap.matchMedia();
mm.add("(min-width: 1px), (min-height: 1px)", () => {
    var covers = gsap.utils.toArray('.o-visual-essay__right-div');
    covers.forEach((cover) => {
        console.log(cover);
        gsap.to(cover, {
            scrollTrigger: {trigger: cover, start: "-=100 bottom", end: "+=200 start", scrub: true,  
                onToggle: self => {self.trigger.classList.toggle('in-view');}
            },
            immediateRender: false,
        });
    })
});