/* bubbleChart creation function. Returns a function that will
 * instantiate a new bubble chart given a DOM element to display
 * it in and a dataset to visualize.
 *
 * Organization and style inspired by:
 * http://vallandingham.me/bubble_chart_v4/#
 *
 */
function bubbleChart() {
  // Constants for sizing
  var width = 1200;
  var height = 600;

  // tooltip for mouseover functionality
  var tooltip = floatingTooltip('gates_tooltip', 240);

  // Locations to move bubbles towards, depending
  // on which view mode is selected.
  var center = { x: width / 2, y: height / 2 };

  var centers = {
    average: { x: width / 3, y: height / 2 },
    lowest: { x: width / 2, y: height / 2 },
    highest: { x: 2 * width / 3, y: height / 2 },
  };

  var percentileTitles = {
    average: 160,
    lowest: width / 2,
    highest: width - 160
  };

  var decileMaxs = {};

  var forceStrength = 0.1;

  // These will be set in create_nodes and create_vis
  var svg = null;
  var bubbles = null;
  var nodes = [];

  // Charge function that is called for each node.
  // As part of the ManyBody force.
  // This is what creates the repulsion between nodes.
  //
  // Charge is proportional to the diameter of the
  // circle (which is stored in the radius attribute
  // of the circle's associated data.
  //
  // This is done to allow for accurate collision
  // detection with nodes of different sizes.
  //
  // Charge is negative because we want nodes to repel.
  // Before the charge was a stand-alone attribute
  // of the force layout. In v5 we can use it as a separate force!
  function charge(d) {
    return -Math.pow(d.radius, 2.0) * forceStrength;
  }
  var attractForce = d3.forceManyBody().strength(30).distanceMax(1000)
    .distanceMin(1000);
  var collisionForce = d3.forceCollide(1).strength(.8).iterations(2);

  var simulation = d3.forceSimulation().alphaDecay(.01)
    .velocityDecay(0.2)
    .force('x', d3.forceX().strength(forceStrength).x(center.x))
    // .force("attractForce",attractForce)
    // .force("collisionForce",collisionForce)
    .force('y', d3.forceY().strength(forceStrength).y(center.y))
    .force('charge', d3.forceManyBody().strength(charge))
    .on('tick', ticked);

  // Force starts up automatically,
  // which we don't want as there aren't any nodes yet.
  simulation.stop();

  var fillColor = d3.scaleOrdinal(d3.schemeCategory10);

  //var fillColor2 = d3.scaleOrdinal()
    //.domain(['lowest', 'average', 'highest'])
    //.range(['#d84b2a', '#beccae', '#7aa25c']);

  /*
   * This data manipulation function takes the raw data from
   * the CSV file and converts it into an array of node objects.
   * Each node will store data and visualization values to visualize
   * a bubble.
   *
   * rawData is expected to be an array of data objects, read in from
   * one of d3's loading functions like d3.csv.
   *
   * This function returns the new node array, with a node in that
   * array for each element in the rawData input.
   */
  function createNodes(rawData) {
    var maxHigh = d3.max(rawData, function (d) { return +d.highest; });
    var maxLow = d3.max(rawData, function (d) { return +d.lowest; });
    var maxAvg = d3.max(rawData, function (d) { return +d.fifth; });
    var totalSpent = maxHigh + maxLow + maxAvg;
    document.getElementById("maxamt").innerHTML = " $" + totalSpent;
    decileMaxs = {
      lowest: maxLow,
      average: maxAvg,
      highest: maxHigh
    };
    var incomes = nodes.filter(node => node.cat == "Income after taxes");

    // Size bubbles based on area.
    var radiusScaleHigh = d3.scalePow()
      .exponent(0.5)
      .range([2, 85])
      .domain([0, maxHigh]);
    var radiusScaleLow = d3.scalePow()
      .exponent(0.5)
      .range([2, 85])
      .domain([0, maxLow]);
    var radiusScaleAvg = d3.scalePow()
      .exponent(0.5)
      .range([2, 85])
      .domain([0, maxAvg]);

    // Use map() to convert raw data into node data.
    var highestNodes = rawData.map(function (d) {
      var a = +d.highest / maxHigh * 100;
      var truncated = Math.floor(a * 100) / 100;
      return {
        cat: d.cat,
        radius: radiusScaleHigh(+d.highest),
        value: +d.highest,
        name: d.cat,
        group: "highest",
        percentTotal: truncated,
        x: Math.random() * 900,
        y: Math.random() * 800
      };
    });
    
    var lowestNodes = rawData.map(function (d) {
      var a = +d.lowest / maxLow * 100;
      var truncated = Math.floor(a * 100) / 100;
      return {
        cat: d.cat,
        radius: radiusScaleLow(+d.lowest),
        value: +d.lowest,
        name: d.cat,
        group: "lowest",
        percentTotal: truncated,
        x: Math.random() * 900,
        y: Math.random() * 800
      };
    });

    var avgNodes = rawData.map(function (d) {
      var a = +d.fifth / maxAvg * 100;
      var truncated = Math.floor(a * 100) / 100;
      return {
        cat: d.cat,
        radius: radiusScaleAvg(+d.fifth),
        value: +d.fifth,
        name: d.cat,
        group: "average",
        percentTotal: truncated,
        x: Math.random() * 900,
        y: Math.random() * 800
      };
    });
    
    nodes = lowestNodes.concat(highestNodes).concat(avgNodes);

    nodes = nodes.filter(node => node.cat != "Income after taxes");
    //sort them to prevent occlusion of smaller nodes.
    nodes.sort(function (a, b) { return b.value - a.value; });

    return nodes;
  }

  /*
   * Main entry point to the bubble chart 
   * It prepares the rawData for visualization
   * and adds an svg element to the provided selector and starts the
   * visualization creation process.
   *
   * selector is expected to be a DOM element or CSS selector that
   * points to the parent element of the bubble chart. Inside this
   * element, the code will add the SVG container for the visualization.
   *
   * rawData is expected to be an array of data objects as provided by
   * a d3 loading function like d3.csv.
   */
  var chart = function chart(selector, rawData) {
    // convert raw data into nodes data
    nodes = createNodes(rawData);
    // Create a SVG element inside the provided selector
    svg = d3.select(selector)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    // Bind nodes data to what will become DOM elements to represent them.
    bubbles = svg.selectAll('.bubble')
      .data(nodes, function (d) { return d.id; });
    // Create new circle elements each with class `bubble`.
    // There will be one circle.bubble for each object in the nodes array.
    // Initially, their radius (r attribute) will be 0.
    //  enter selection to apply our transtition to below.
    var bubblesE = bubbles.enter().append('circle')
      .classed('bubble', true)
      .attr('r', 0)
      .style("fill", function (d) {
        //get the value of the checked
        var value = d3.select('input[name="colorgroups"]:checked').node().value;
        if (value == "byCat") {
          return fillColor(d.cat);
        } else {
          return fillColor2(d.group);
        }
      })
      .attr('stroke', function (d) {
        //get the value of the checked
        var value = d3.select('input[name="colorgroups"]:checked').node().value;
        if (value == "byCat") {
          return d3.rgb(fillColor(d.cat)).darker();
        } else {
          return d3.rgb(fillColor2(d.group)).darker();
        }
      })
      .attr('stroke-width', 3)
      .on('mouseover', showDetail)
      .on('mouseout', hideDetail);

    // Merge the original empty selection and the enter selection
    bubbles = bubbles.merge(bubblesE);

    // Fancy transition to make bubbles appear, ending with the
    // correct radius
    bubbles.transition()
      .duration(2000)
      .attr('r', function (d) { return d.radius; });

    // Set the simulation's nodes to our newly created nodes array.
    // Once we set the nodes, the simulation will start running automatically!
    simulation.nodes(nodes);

    // Set initial layout to single group.
    groupBubbles();
    setupLegend();
  };

  function setupLegend() {
    clearLegend();
    var value = d3.select('input[name="colorgroups"]:checked').node().value;
    var legendData;
    if (value == "byCat") {
      legendData = fillColor;
    }
    else {
      legendData = fillColor2;
    }
    console.log(legendData + " " + value);
    var legendRectSize = 30;
    var legendSpacing = 10;
    var legend = d3.select('svg')
      .append("g")
      .attr('id', 'legend')
      .selectAll("g")
      .data(legendData.domain())
      .enter()
      .append('g')
      .attr('transform', function (d, i) {
        var height = legendRectSize;
        var x = -20;
        var y = i * height + 100;
        return 'translate(' + x + ',' + y + ')';
      });
    legend.append('rect')
      .attr('width', legendRectSize)
      .attr('height', legendRectSize)
      .style('fill', legendData)
      .style('stroke', legendData);

    legend.append('text')
      .attr('x', legendRectSize + legendSpacing)
      .attr('y', legendRectSize - legendSpacing)
      .text(function (d) { return d; });
    // .on("click", function(d){
    //     var newNodes = nodes.filter(node => node.cat == d);
    //     // d3.selectAll('.bubble')
    //     // .remove();
    //     enodes = [];
    //     simulation.nodes(enodes);
    //     bubbles = svg.selectAll('.bubble')
    //     .data(newNodes, function (d) { return d.id; });
    //     simulation.nodes(newNodes);
    //     console.log(simulation.nodes());
    //     simulation.nodes(nodes.filter(node => node.cat == d));


    // })
  }
  function clearLegend() {
    d3.select('#legend')
      .remove();
  }
  /*
   * Callback function that is called after every tick of the
   * force simulation.
   * Here we do the acutal repositioning of the SVG circles
   * based on the current x and y values of their bound node data.
   * These x and y values are modified by the force simulation.
   */
  function ticked() {

    bubbles
      .attr('cx', function (d) { return d.x; })
      .attr('cy', function (d) { return d.y; })
      .style("fill", function (d) {
        //get the value of the checked
        var value = d3.select('input[name="colorgroups"]:checked').node().value;
        if (value == "byCat") {
          return fillColor(d.cat);
        } else {
          return fillColor2(d.group);
        }
      });
    setupLegend();
  }

  /*
   * Provides a x value for each node to be used with the split by year
   * x force.
   */
  function nodeYearPos(d) {
    return centers[d.group].x;
  }


  /*
   * Sets visualization in "single group mode".
   * The percentile labels are hidden and the force layout
   * tick function is set to move all nodes to the
   * center of the visualization.
   */
  function groupBubbles() {
    hideLabels();
    // Reset the 'x' force to draw the bubbles to the center.
    simulation.force('x', d3.forceX().strength(forceStrength).x(center.x));
    // We can reset the alpha value and restart the simulation
    simulation.alpha(1).restart();
  }

  /*
   * Sets visualization in "split by Income Percentile mode".
   * The percentile labels are shown and the force layout
   * tick function is set to move nodes to the
   * center of their data's income percentile.
   */
  function splitBubbles() {
    showLabels();
    //Reset the 'x' force to draw the bubbles to their year centers
    simulation.force('x', d3.forceX().strength(forceStrength).x(nodeYearPos));
    //We can reset the alpha value and restart the simulation
    simulation.alpha(1).restart();
  }

  // Hides percentile Labels.
  function hideLabels() {
    svg.selectAll('.year').remove();
  }

  // Shows Labels.
  function showLabels() {
    var percentileData = d3.keys(percentileTitles);
    var years = svg.selectAll('.year')
      .data(percentileData);
    years.enter().append('text')
      .attr('class', 'year')
      .attr('x', function (d) { return percentileTitles[d]; })
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .text(function (d) { return d + "\n | avg_inc: $" + decileMaxs[d]; })
  }

  /*
   * Function called on mouseover to display the
   * details of a bubble in the tooltip.
   */
  function showDetail(d) {
    // change outline to indicate hover state.
    d3.select(this).attr('stroke', 'black');

    var content = '<span class="name">Title: </span><span class="value">' +
      d.name +
      '</span><br/>' +
      '<span class="name">Amount: </span><span class="value">$' +
      addCommas(d.value) +
      '</span><br/>' +
      '<span class="name">Percent of Total Income: </span><span class="value">' +
      d.percentTotal +
      '%</span>';

    tooltip.showTooltip(content, d3.event);
  }

  /*
   * Hides tooltip
   */
  function hideDetail(d) {
    // reset outline
    d3.select(this)
      .attr('stroke', d3.rgb(fillColor(d.cat)).darker());

    tooltip.hideTooltip();
  }

  /*
   * Externally accessible function (this is attached to the
   * returned chart function). Allows the visualization to toggle
   * between "single group" and "split by income percentile" modes.
   *
   * displayName is expected to be a string
   */
  chart.toggleDisplay = function (displayName) {
    if (displayName === 'year') {
      splitBubbles();
    } else {
      groupBubbles();
    }
  };
  // return the chart function from closure.
  return chart;
}

/*
 * Below is the initialization code as well as some helper functions
 * to create a new bubble chart instance, load the data, and display it.
 */
var myBubbleChart = bubbleChart();

/*
 * Function called once data is loaded from CSV.
 * Calls bubble chart function to display inside #vis div.
 */
function display(data) {
  myBubbleChart('#vis', data);
}

/*
 * Sets up the layout buttons to allow for toggling between view modes.
 */
function setupButtons() {
  d3.select('#toolbar')
    .selectAll('.button')
    .on('click', function () {
      // Remove active class from all buttons
      d3.selectAll('.button').classed('active', false);
      // Find the button just clicked
      var button = d3.select(this);

      // Set it as the active button
      button.classed('active', true);

      // Get the id of the button
      var buttonId = button.attr('id');

      // Toggle the bubble chart based on
      // the currently clicked button.
      myBubbleChart.toggleDisplay(buttonId);
    });
}

/*
 * Helper function to convert a number into a string
 * and add commas to it to improve presentation.
 */
function addCommas(nStr) {
  nStr += '';
  var x = nStr.split('.');
  var x1 = x[0];
  var x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2');
  }

  return x1 + x2;
}

function main() {
  // Load the data.
  // d3.csv('spending_clean.csv', display);
  d3.csv('spending_clean.csv')
    .then(function (data) {
      myBubbleChart('#vis', data);
    })
    .catch(function (error) {
      console.log(error);
    })
}

main();
// setup the buttons.
setupButtons();
