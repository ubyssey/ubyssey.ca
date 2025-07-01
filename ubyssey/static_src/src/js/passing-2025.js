import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);
gsap.registerPlugin(ScrollTrigger);

let invisibility, notPossible;

function setup() {
  invisibility = SplitText.create(".invisibility", {type:"chars"});
  notPossible = SplitText.create(".not-possible", {type:"words"})
}

setup();
window.addEventListener("resize", setup);

const tl = gsap.timeline();

tl.from(invisibility.chars, {
    x: 50,
    y: -50,
    opacity: 0,
    duration: 1, 
    ease: "power4",
    stagger: 0.04
});

tl.from(notPossible.words, {
    y: -50,
    opacity: 0,
    duration: 1, 
    ease: "expo",
    stagger: 1
});

tl.to('.invisibility', {
    opacity: 0.5,
    duration: 0.25, 
    ease: "power4",
});

ScrollTrigger.create({
    trigger: '.banner',
	start: 'top top',
    animation: tl,
    pin: true,
    scrub: true,
});

const footertl = gsap.timeline();

footertl.from('footer', {
    y: 200,
    duration: 1, 
    ease: "power4",
});

ScrollTrigger.create({
    trigger: 'footer',
	start: 'top bottom',
    animation: footertl,
    scrub: true,
});