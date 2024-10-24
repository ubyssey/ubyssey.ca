import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let mm = gsap.matchMedia();
mm.add("(min-width: 1px), (min-height: 1px)", () => {
    var covers = gsap.utils.toArray('.fade-in-out');
    covers.forEach((cover) => {
        console.log(cover);
        gsap.to(cover, {
            scrollTrigger: {trigger: cover, start: "start center", end: "bottom +=300", scrub: true,  
                onToggle: self => {self.trigger.classList.toggle('visible');}
            },
            immediateRender: false,
        });
    })
});