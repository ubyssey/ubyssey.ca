import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

var views = ["vs-side-by-side","vs-over-image", "vs-over-image--left"];
var leftClasses = ["o-visual-essay__left-next","o-visual-essay__left-show","o-visual-essay__left-prev","o-visual-essay__left-first"];

function removeClasses(elem, classes) {
    for(let i=0;i<classes.length;i++) {
        elem.classList.remove(classes[i]);
    }
}

function setLeftPanel(left, i) {
    for(let a=0; a<left.children.length; a++) {
        var leftBlock = left.children[a];
        removeClasses(leftBlock, leftClasses);
        if (i == 0 && a==0) {
            leftBlock.classList.add("o-visual-essay__left-first");
        } else if(a==i){
            leftBlock.classList.add("o-visual-essay__left-show");
        } else if (a < i) {
            leftBlock.classList.add("o-visual-essay__left-prev");
        } else {
            leftBlock.classList.add("o-visual-essay__left-next");
        }
    }
}

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

    
    var containers = document.getElementsByClassName("o-visual-essay__content-container");

    for(let i=0; i < containers.length; i++) {
        
        var marks = Array.from(containers[i].getElementsByClassName("mark"));
        var left = containers[i].getElementsByClassName("o-visual-essay__left-container")[0];

        marks.forEach((mark, i) => {
            gsap.to(mark, {
                scrollTrigger: {trigger: mark, start: "top center", end: "bottom center", scrub: true, 
                    onEnter: self => {
                        setLeftPanel(left, i);
                    },
                    onLeaveBack: self => {
                        if (i > 0) {
                            setLeftPanel(left, i-1);
                        }
                    },
                },
                immediateRender: false,
            });
        })

    }
});