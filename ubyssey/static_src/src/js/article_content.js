import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// D3 Stuff - Is it more efficient to do it this way?
import { select } from "d3-selection";
import { scaleLinear, scaleTime, scaleOrdinal } from "d3-scale";
import { extent, max, bin } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { timeParse } from "d3-time-format";
import { pie, arc } from "d3-shape";
import { csvParse } from "d3-dsv";

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

// D3 Rendering

// Handle Dates
function parseData(data) {
    const parseTime = timeParse("%Y-%m-%d");
    return data.map(d => {
        const processed = {};
        for (let key in d) {
            const val = d[key].trim();
            const dateVal = parseTime(val);
            if (dateVal) {
                processed[key] = dateVal;
            } else if (!isNaN(val) && val !== "") {
                processed[key] = +val;
            } else {
                processed[key] = val;
            }
        }
        return processed;
    });
}

// Draw Charts
const CHART_CONFIG = {
    width: 400,
    height: 300,
    margin: { top: 20, right: 0, bottom: 50, left: 0 },
    pieMargin: 10
};

function createBaseSvg(id, isSquare = false) {
    const { width, height, margin } = CHART_CONFIG;
    const activeHeight = isSquare ? width : height;

    const svg = select(`#${id}`)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${activeHeight}`)
        .attr("preserveAspectRatio", "xMinYMin meet");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    return {
        g,
        innerWidth: width - margin.left - margin.right,
        innerHeight: activeHeight - margin.top - margin.bottom
    };
}

function renderScatter(id, data) {
    if (!data || !data.length) return;
    const { g, innerWidth, innerHeight } = createBaseSvg(id);

    const keys = Object.keys(data[0]);
    const xKey = keys[0], yKey = keys[1];

    const xScale = (data[0][xKey] instanceof Date) 
        ? scaleTime().domain(extent(data, d => d[xKey])).range([0, innerWidth])
        : scaleLinear().domain(extent(data, d => d[xKey])).range([0, innerWidth]);

    const yScale = scaleLinear()
        .domain([0, max(data, d => d[yKey])]).range([innerHeight, 0]);

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(axisBottom(xScale));
    g.append("g").call(axisLeft(yScale));

    g.selectAll("circle").data(data).enter().append("circle")
        .attr("cx", d => xScale(d[xKey]))
        .attr("cy", d => yScale(d[yKey]))
        .attr("r", 5)
        .style("fill", "#006DCC")
        .style("opacity", 0.7);
}

function renderPie(id, data) {
    if (!data || !data.length) return;
    const { width } = CHART_CONFIG;
    const radius = (width / 2) - CHART_CONFIG.pieMargin;

    const svg = select(`#${id}`).append("svg")
        .attr("viewBox", `0 0 ${width} ${width}`)
        .append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    const keys = Object.keys(data[0]);
    
    // From SCSS files
    const ubysseyPalette = ["#0071c9", "#006DCC", "#BBE3F1", "#01283D", "#0073A9"];
    const color = scaleOrdinal(ubysseyPalette);

    const newpie = pie().value(d => d[keys[1]]).sort(null);
    const newarc = arc().innerRadius(0).outerRadius(radius);

    svg.selectAll('path')
        .data(newpie(data))
        .join('path')
        .attr('d', newarc)
        .attr('fill', (d, i) => color(i));
}

function renderHistogram(id, data) {
    if (!data || !data.length) return;
    const { g, innerWidth, innerHeight } = createBaseSvg(id);

    const key = Object.keys(data[0])[0];
    const x = scaleLinear().domain(extent(data, d => d[key])).range([0, innerWidth]);

    const bins = bin().value(d => d[key]).domain(x.domain()).thresholds(x.ticks(10))(data);

    const y = scaleLinear()
        .domain([0, max(bins, d => d.length)]).range([innerHeight, 0]);

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(axisBottom(x));
    g.append("g").call(axisLeft(y));

    g.selectAll("rect").data(bins).enter().append("rect")
        .attr("transform", d => `translate(${x(d.x0)},${y(d.length)})`)
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", d => innerHeight - y(d.length))
}

const charts = document.querySelectorAll('.d3-chart-container');

charts.forEach(container => {
    const id = container.id;
    const type = container.dataset.type;
    const rawDataElement = document.getElementById(`data-${id}`);
    
    if (!rawDataElement) return;

    const rawData = rawDataElement.textContent.trim();
    const csvData = csvParse(rawData);
    // Checks for Dates/Strings
    const cleanData = parseData(csvData);

    if (type === 'pie-chart') {
        renderPie(id, cleanData);
    } else if (type === 'scatter-plot') {
        renderScatter(id, cleanData);
    } else if (type === 'histogram') {
        renderHistogram(id, cleanData);
    }
});
