import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

console.log("hello?");
gsap.registerPlugin(ScrollTrigger);

let mm = gsap.matchMedia();
mm.add("(min-width: 1px)", () => {
    var covers = gsap.utils.toArray('.fade-in-out');
    covers.forEach((cover) => {
        console.log(cover);
        gsap.to(cover, {
            scrollTrigger: {trigger: cover, start: "start center", end: "bottom center", scrub: true,  
                onToggle: self => {self.trigger.classList.toggle('visible');console.log("huh????");}
            },
            immediateRender: false,
        });
    })
});