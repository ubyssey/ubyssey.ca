import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

let split, animation;

function setup() {
  split && split.revert();
  animation && animation.revert();
  split = SplitText.create(".subtitle", {type:"chars,words,lines"});
}

setup();
window.addEventListener("resize", setup);

let tl = gsap.from(split.chars, {
    x: 150,
    opacity: 0,
    duration: 0.7, 
    ease: "power4",
    stagger: 0.04
})

ScrollTrigger.create({
    trigger: '.banner',
	start: 'top top',
    animation: tl,
})