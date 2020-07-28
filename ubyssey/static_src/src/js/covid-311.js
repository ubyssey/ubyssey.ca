//Covid data
const covid_data = [
    ['Access to Food Inquiry', 0, 9],
    ['Business Community Support - City Inq', 0, 45],
    ['Business Community Support - Financial', 0, 2],
    ['Business Community Support Case', 0, 47],
    ['Business Community Support -to Federal', 0, 7],
    ['Business Community Support -to Province', 0, 18],
    ['Business Complaint Case', 158, 434],
    ['COV Employee Inquiry', 0, 1],
    ['Departmental Service Changes Inquiry', 0, 446],
    ['Donations & Volunteering Inquiry', 0, 23],
    ['Emergency Response Shelters', 11, 19],
    ['Give a Hand Inquiry', 0, 42],
    ['COVID-19 Inquiry', 1736, 1645],
    ['Referral to 211', 2, 8],
    ['Referral to 811', 38, 5],
    ['Referral to Federal Government', 0, 12],
    ['Referral to Province', 123, 85],
    ['Referral to VCH', 98, 39],
    ['Social Distancing - Business Complaint', 0, 4],
    ['Social Distancing - City Complaint', 0, 2],
    ['Social Distancing - Parks Complaint', 0, 15],
    ['Social Distancing - Private Complaint', 0, 3],
    ['Social Distancing Inquiry', 0, 394],
    ['Violation of Park Facility Closure Case', 299, 1012],
    ['COVID-19 Case', 2774, 1919],
    ['COVID-19 Referral to WorkSafeBC', 13, 55]
]

const calls_1920_data = {
    'Total': [91657, 88497, 71104, 65162],
    'Complaint': [2961, 3059, 2694, 3305],
    'Event': [441, 352, 225, 124],
    'Donation': [41, 32, 23, 57],
    'Film': [67, 49, 65, 14],
    'Traffic': [419, 412, 241, 199],
    'Homelessness': [949, 932, 797, 1740],
    'Noise complaint': [532, 637, 555, 986],
    'Volunteer': [14, 10, 28, 43],
    'Transit': [1189, 1260, 704, 834]
}

// Visualization 1 of 2: The different types of covid-19-related calls
// Create the title of the graph
d3.select("#covid_call_types_chart1")
    .select("#chart_title")
    .append("h3")
    .text("Vancouver 3-1-1 Calls relating to COVID-19: March 2020");

// Define the size of the graph
var height = 300,
    barWidth = 30,
    scaleChart1 = function(n) {
        let scale = d3.scaleLinear()
            .domain([0, 2774])
            .range([1, height - 50])
        return scale(n);
    };

// Create the graph element
var graph1 = d3.select("#covid_call_types_chart1")
    .select("#chart_body")
    .append("svg")
    .attr("width", (barWidth * covid_data.length))
    .attr("height", height);

// Create the bar elements, stretch them to the height of each data point,
//  add data points to each element in the HTML
for (let i=0; i<covid_data.length; i++) {
    let dataPoint = scaleChart1(covid_data[i][1]);

    let barX = i * barWidth;
    let barY = Math.round(height-dataPoint);

    let bar = graph1.append("g")
        .attr("x", barX)
        .attr("y", barY)
        .attr("transform", function() {
            return "translate(" + barX + ',' + barY + ')';
        })
    bar.append("rect").attr("height", function() {
        return Math.round(dataPoint);
    })
    .attr("width", barWidth - 10)
    .attr("fill", "steelblue");

    // Add labels to each bar, representing the number of calls of that type for each month
    bar.append("text")
        .attr("x", barWidth / 2)
        .attr("y", -10)
        .text(covid_data[i][1])
        .style("fill", 'black')
        .style("text-anchor", "middle")
        .style("font", "10px sans-serif");
}

// functions for updating the graph
function updateChart1Height(index) {
    graph1.selectAll("g").each(function(d, i) {
        // update the top corners of the bars
        var dataPoint = covid_data[i][index];
        var newY = 0;
        d3.select(this)
            .transition()
            .attr("transform", function() {
                newY = Math.round(height-scaleChart1(dataPoint));
                return("translate(" + d3.select(this).attr("x") + ',' + newY + ")");
            })
            .attr("y", newY);
        
        // Update the bottoms to stay at the bottom of the chart
        d3.select(this)
            .select("rect")
            .transition()
            .attr("height", function() {
                return Math.round(scaleChart1(dataPoint));
            });

        // Update the labels
        d3.select(this)
            .select("text")
            .transition()
            .text(function() {
                return dataPoint;
            })

    });

    // Update the title label
    d3.select("#covid_call_types_chart1")
        .select("#chart_title")
        .select("h3")
        .text(function() {
            if (index === 1) {
                return "Vancouver 3-1-1 Calls relating to COVID-19: March 2020";
            } else {
                return "Vancouver 3-1-1 Calls relating to COVID-19: April 2020"
            }
        });
}

// Create the axis
var labels = []
for (let i = 0; i < covid_data.length; i++) {
    labels.push(covid_data[i][0]);
}
var linearScale = d3.scaleLinear()
    .domain([0, covid_data.length])
    .range([0, barWidth * covid_data.length]);

var axis1 = d3.select("#covid_call_types_chart1")
    .select("#chart_labels")
    .append('svg')
    .attr("width", barWidth * covid_data.length)
    .attr("height", 250);
for (var i = 0; i < covid_data.length; i++) {
    axis1.append("text")
        //.attr('x', linearScale(i))
        .attr('y', 10)
        .text(covid_data[i][0])
        .style("text-anchor", "end")
        .style("font", "12px sans-serif")
        .attr("dx", "-1em")
        .attr("dy", (linearScale(i) / 10) + "em")
        .attr("transform", "rotate(-90)");
    }

// Visualization 2 of 2: the different trends in the data based off of keyword filters

// Create the title of the graph
d3.select("#covid_call_types_chart2")
    .select("#chart_title")
    .append("h3")
    .text("Vancouver 311 interactions by keyword: Mar/Apr 2019 and Mar/Apr 2020");

// Create the keyword
d3.select("#covid_call_types_chart2")
    .select("#chart_keyword")
    .append("h4")
    .text("Total interactions");

// Define the size of the graph
var height = 300,
    barWidth = 60,
    yearSpace = 60,
    scaleChart2 = function(n, data) {
        let scale = d3.scaleLinear()
            .domain([1, d3.max(data)])
            .range([0, height - 50])
        return scale(n);
    };

// Create the graph element
var graph2 = d3.select("#covid_call_types_chart2")
    .select("#chart_body")
    .append("svg")
    .attr("width", (barWidth * calls_1920_data['Total'].length) + yearSpace)
    .attr("height", height);

// Create the bar elements, stretch them to the height of each data point,
//  add data points to each element in the HTML
for (let i=0; i<4; i++) {
    let dataPoint = scaleChart2(calls_1920_data['Total'][i], calls_1920_data['Total']);
    let spacing;
    if (i > 1) {
        spacing = yearSpace;
    } else {
        spacing = 0;
    }

    let barX = i * barWidth + spacing;
    let barY = Math.round(height-dataPoint);

    let bar = graph2.append("g")
        .attr("x", barX)
        .attr("y", barY)
        .attr("transform", function() {
            return "translate(" + barX + ',' + barY + ')';
        })
    bar.append("rect").attr("height", function() {
        return Math.round(dataPoint);
    })
    .attr("width", barWidth - 10)
    .attr("fill", function() {
        if (spacing) {
            return "orangered";
        } else {
            return "steelblue";
        }
    });

    // Add labels to each bar, representing the number of calls of that type for each month
    bar.append("text")
        .attr("x", barWidth / 2)
        .attr("y", -10)
        .text(calls_1920_data['Total'][i])
        .style("fill", 'black')
        .style("text-anchor", "middle")
        .style("font", "14px sans-serif");
}

// functions for updating the graph
function updateChart2Height(key) {
    console.log('check');
    graph2.selectAll("g").each(function(d, i) {
        // update the top corners of the bars
        var dataPoint = calls_1920_data[key][i];
        var newY = 0;
        d3.select(this)
            .transition()
            .attr("transform", function() {
                newY = Math.round(height-scaleChart2(dataPoint, calls_1920_data[key]));
                return("translate(" + d3.select(this).attr("x") + ',' + newY + ")");
            })
            .attr("y", newY);
        
        // Update the bottoms to stay at the bottom of the chart
        d3.select(this)
            .select("rect")
            .transition()
            .attr("height", function() {
                return Math.round(scaleChart2(dataPoint, calls_1920_data[key]));
            });

        // Update the labels
        d3.select(this)
            .select("text")
            .transition()
            .text(function() {
                return dataPoint;
            })

    });

    // Update the keyword label
    d3.select("#covid_call_types_chart2")
        .select("#chart_keyword")
        .select("h4")
        .text(function() {
            if (key != 'Total') {
                return key + "-related interactions"
            } else{
                return "Total interactions"
            }
        });
}

// Write the month labels
var axis = d3.select("#covid_call_types_chart2")
    .select("#chart_labels")
    .append("svg")
    .attr("width", graph2.attr("width"))
    .attr("height", 50);

var month_labels = ["March", "April", "March", "April"];
var year_labels = ["2019", "2019", "2020", "2020"]

graph2.selectAll("g").each(function(d, i) {
    axis.append("text")
        .attr("x", Number(d3.select(this).attr("x")) + 10)
        .attr("y", 15)
        .append('svg:tspan')
        .attr("x", Number(d3.select(this).attr("x")) + 10)
        .attr("dy", 0)
        .text(month_labels[i])
        .style("fill", 'black')
        .style("font", "12px sans-serif")
        .append('svg:tspan')
        .attr("x", Number(d3.select(this).attr("x")) + 10)
        .attr('dy', 20)
        .text(year_labels[i])
        .style("fill", 'black')
        .style("font", "12px sans-serif");
})

function setButton2OnClick(button) {
    button.addEventListener('click', function(){
        updateChart2Height(button.id);
    });
}

var button1 = document.getElementById('Total');
var button2 = document.getElementById('Complaint');
var button3 = document.getElementById('Event');
var button4 = document.getElementById('Film');
var button5 = document.getElementById('Traffic');
var button6 = document.getElementById('Noise complaint');
var button7 = document.getElementById('Homelessness');
var button8 = document.getElementById('Donation');
var button9 = document.getElementById('Volunteer');
var button10 = document.getElementById('March2020');
var button11 = document.getElementById('April2020');
var button12 = document.getElementById('Transit');
setButton2OnClick(button1);
setButton2OnClick(button2);
setButton2OnClick(button3);
setButton2OnClick(button4);
setButton2OnClick(button5);
setButton2OnClick(button6);
setButton2OnClick(button7);
setButton2OnClick(button8);
setButton2OnClick(button9);
setButton2OnClick(button12);

button10.addEventListener('click', function(){
    updateChart1Height(1);
});

button11.addEventListener('click', function(){
    updateChart1Height(2);
});




