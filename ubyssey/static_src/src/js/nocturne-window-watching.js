import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let mm = gsap.matchMedia();
mm.add("(min-width: 1px), (min-height: 1px)", () => {
    var windowTriggers = gsap.utils.toArray('.window-trigger');
    windowTriggers.forEach((wt) => {
        console.log(wt);
        gsap.to(wt, {
            scrollTrigger: {trigger: wt, start: "start center", end: "bottom center", scrub: true,  
                onToggle: self => {
                    document.getElementById("windows").children[parseInt(self.trigger.getAttribute("window"))].classList.toggle("lighted");
                    self.trigger.classList.toggle("highlight");
                },
            },
            immediateRender: false,
        });
    })
});