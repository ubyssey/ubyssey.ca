import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);
gsap.registerPlugin(ScrollTrigger);

let invisibility, notPossible, pastPassing;

function setup() {
  invisibility = SplitText.create(".invisibility .subtitle", {type:"chars"});
  notPossible = SplitText.create(".not-possible .subtitle", {type:"words"});
  pastPassing = SplitText.create(".past-passing .subtitle", {type:"chars"});
}

setup();
window.addEventListener("resize", setup);


const safetytl = gsap.timeline();
safetytl.from(".banner.safety .subtitle", {
    opacity: 0,
    duration: 2, 
    ease: "power4",
});

ScrollTrigger.create({
    trigger: ".banner.safety header",
    start: 'top top',
    end: 'bottom bottom',
    animation: safetytl,
    pin: ".banner.safety header",
    scrub: true,
    markers: true,
    invalidateOnRefresh: true,
});

const pastPassingtl = gsap.timeline();
pastPassingtl.from(pastPassing.chars, {
    x: 50,
    y: 0,
    opacity: 0,
    duration: 2, 
    ease: "power4",
    stagger: 0.5
});
pastPassingtl.to(pastPassing.chars, {
    x: -50,
    y: 0,
    opacity: 0,
    duration: 2, 
    ease: "power4",
    stagger: 0.5
});
ScrollTrigger.create({
    trigger: ".banner.past-passing header",
    start: 'top top',
    end: 'bottom bottom',
    animation: pastPassingtl,
    pin: ".banner.past-passing header",
    scrub: true,
    markers: true,
    invalidateOnRefresh: true,
});

const invisibilitytl = gsap.timeline();
invisibilitytl.from(invisibility.chars, {
    x: 50,
    y: -50,
    opacity: 0,
    duration: 1, 
    ease: "power4",
    stagger: 0.04
});
invisibilitytl.to('.banner.invisibility .subtitle', {
    opacity: 0.5,
    duration: 0.25, 
    ease: "power4",
});
ScrollTrigger.create({
    trigger: ".banner.invisibility header",
    start: 'top top',
    end: 'bottom bottom',
    animation: invisibilitytl,
    pin: ".banner.invisibility header",
    scrub: true,
    markers: true,
    invalidateOnRefresh: true,
});

const notPossibletl = gsap.timeline();
notPossibletl.from(notPossible.words, {
    y: -50,
    opacity: 0,
    duration: 1, 
    ease: "expo",
    stagger: 1
});
ScrollTrigger.create({
    trigger: ".banner.not-possible header",
    start: 'top top',
    end: 'bottom bottom',
    animation: notPossibletl,
    pin: ".banner.not-possible header",
    scrub: true,
    markers: true,
    invalidateOnRefresh: true,
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