import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let mm = gsap.matchMedia();
mm.add("(min-width: 1px), (min-height: 1px)", () => {

    // Attachments fade over the base attachment when scrolled into view
    var overlays = gsap.utils.toArray('.o-attachment-overlay--attachments');
    overlays.forEach((overlay) => {
        console.log(overlay);
        gsap.to(overlay, {
            scrollTrigger: {trigger: overlay, start: "40% center", end: "end center", scrub: true,  
                onEnter: self => {
                    self.trigger.classList.add("in-view");
                },
                onLeaveBack: self => {
                    self.trigger.classList.remove("in-view");
                },
            },
            immediateRender: false,
        });
    })
})