import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(ScrollTrigger);
gsap.registerPlugin(Flip);

const graph = document.getElementById("graph");

const style = `
<style>
.graph {
  height: 100%;
  margin: 5% 10%;
  border: 0.25em solid transparent;
  display: flex;
  justify-content: space-around;

  --slp: #ff9229;
  --pop: #d8d8d8;
  --prov: #f0debc;
  --prov-text: #944755;
}
.graph.bars {
    gap: 1em;
    background: linear-gradient(transparent calc(100% - 1px), var(--pop));
    background-size: 100% 10%;
}
.graph.dots {
    flex-wrap: wrap;
    gap: 0.1%;
}
.dot {
    margin-top: auto;
    border-radius: 100%;
    aspect-ratio: 1;
    width: 1%;
    height: auto;
}
.bar {
    position: relative;
    margin-top: auto;
    width: 10%;
    background: var(--prov);
    height: var(--value);
}
.bar::before {
    position: absolute;
    content: var(--name);
    bottom: calc(100% + 0.5em);
    left: 0;
    opacity: 0;
    text-align: left;
    font-size: 1.25em;
    white-space: nowrap;
    background: var(--background);
}

.bar::after {
    content: var(--abbreviation);
    position: absolute;
    text-align: center;
    bottom: 0.25em;
    left: 0;
    right: 0;
    color: var(--prov-text);
    font-size: 0.75em;
}

#bc::after, #bc::before {
    transition: opacity 0.5s 0.75s;
}

.bar:hover::after, .bar#bc::after {
    color: var(--prov);
}

.bar:hover {
    background: var(--slp);
    z-index: 100;
    cursor: pointer;
}

.bar:hover::before {
    opacity: 1;
}
.slp {
    background: var(--slp);
}
.population {
    background: var(--pop);
}

.dots #bc {
    display: contents;
}

.dots #bc::after, .dots #bc::before {
    opacity: 0;
    color: transparent;
}

.bars #bc {
    display: flex;
    flex-direction: column;
    background: none;
}

.bars #bc::before {
    opacity: 1;
}

.dots .bar {
    display: none;
}

.bars .population {
    display: none;
}
.bars .slp {
    width: 100%;
    border-radius: 0;
    flex-grow: 1;
    aspect-ratio: unset;
}

.bars::before {
    position: absolute;
    content: "Speech language pathologists per 100,000 population";
    font-size: 1.5em;
    font-family: librefranklin;
}

@media screen and (max-width: 780px) {
    .graph {
        flex-direction: column;
    }
    .graph.bars {
        background: linear-gradient(to left, transparent calc(100% - 1px), var(--pop));
        background-size: 10% 100%;
    }
    .dot {
        width: 2%;
    }
    .bar {
        width: calc(var(--value) * 2);
        height: auto;
        flex-grow: 1;
    }
    .bar::after {
        text-align: right;
        right: calc(100% + 0.5em);
        left: auto;
    }
    .bar::before {
        top: 50%;
        left: 0.5em;
        right: 1em;

        text-align: left;
        font-size: 0.75em;
        white-space: nowrap;
        line-height: 0;
        
        background: none;
        transform: translateY(-50%);
    }
    .bars::before {
        position: static;
    }
}


html[color-css-theme="dark"] .graph {
    --pop: #666;
}

</style>
`

graph.insertAdjacentHTML("afterend", style);

function setup(graph) {
    const data = [
        {abbreviation: "YT", province: "Yukon", pop: 55.6},
        {abbreviation: "QC", province: "Quebec", pop: 37.8},
        {abbreviation: "SK", province: "Saskatchewan", pop: 34.6},
        {abbreviation: "AB", province: "Alberta", pop: 32.4},
        {abbreviation: "NB", province: "New Brunswick", pop: 31.3},
        {abbreviation: "NL", province: "Newfoundland and Labrador", pop: 30.8},
        {abbreviation: "NS", province: "Nova Scotia", pop: 29.5},
        {abbreviation: "MB", province: "Manitoba", pop: 26.7},
        {abbreviation: "NT", province: "Northwest Territories", pop: 26.7},
        {abbreviation: "BC", province: "British Columbia", class: "bc", pop: 26.3},
        {abbreviation: "ON", province: "Ontario", pop: 23.7},
        {abbreviation: "PE", province: "Prince Edward Island", pop: 22.4},
        {abbreviation: "NU", province: "Nunavut", pop: 2.5},
    ]

    graph.classList.add("dots");

    for(const province of data){
        const provinceElem = document.createElement("div");
        provinceElem.classList.add("bar");
        if ("class" in province) {
            provinceElem.id = province['class'];
        }
        const height = "--value: " + String(province['pop']) + "%";
        const name = "--name: '" + province['pop'] + " per 100,000'"
        const abbreviation = "--abbreviation: '" + province['abbreviation'] + "'";

        provinceElem.style = [height, name, abbreviation].join("; ");
        graph.appendChild(provinceElem);
    }

    for(let i=0; i<1; i++) {
        let slp = document.createElement("div");
        slp.classList.add("slp");
        slp.classList.add("dot");
        slp.classList.add("flipped");
        document.getElementById("bc").appendChild(slp);
    }
    for(let i=0; i<3333; i++) {
        let pop = document.createElement("div");
        pop.classList.add("population");
        pop.classList.add("dot");
        graph.appendChild(pop);
    }
}

function dotGraph(graph) {
    console.log("hey ho here we go!");

    const state = Flip.getState(".flipped, .flipped::after, .flipped::before");

    graph.classList.remove("bars");
    graph.classList.add("dots");

    Flip.from(state, {
        duration: 1,
        ease: "power1.inOut",
        absolute: true,
    });
}

function provinceGraph(graph){

    console.log("WHAT THE HECK");

    const state = Flip.getState(".flipped, .flipped::after, .flipped::before");

    graph.classList.replace("dots", "bars");

    Flip.from(state, {
        duration: 1,
        ease: "power1.inOut",
        absolute: true,
    });
}

setup(graph);

gsap.to("#graph", {
    scrollTrigger:{
        trigger: '#provinceData',
        start: 'center center',
        onLeaveBack: self => {dotGraph(graph)},
        onEnter: self => {provinceGraph(graph)},
    },
    immediateRender: false,
});