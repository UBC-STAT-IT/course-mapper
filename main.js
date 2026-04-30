const CONFIG = {
  DATA_FILES: {
    STATS: 'data/data.json',
    DSCI: 'data/dsci_data.json'
  },
  
  COURSE_COLORS: {
    'S': { color: "#00a896", label: "STAT" },
    'M': { color: "#e84855", label: "MATH" },
    'D': { color: "#FF7D00", label: "DSCI" },
    'C': { color: "#6a4c93", label: "CPSC" }
  },
  
  COURSE_NODE: {
    DEFAULT_RADIUS: 16,
    HOVER_RADIUS: 20,
    STROKE_WIDTH: 1.25,
    DEFAULT_FILL: "white",
    DEFAULT_STROKE: "black"
  },
  
  COURSE_TEXT: {
    FONT_FAMILY: "Arial",
    PREFIX_SIZE: 8,
    NUMBER_SIZE: 11,
    PREFIX_HOVER_SIZE: 9,
    NUMBER_HOVER_SIZE: 13,
    PREFIX_DY: "-0.35em",
    NUMBER_DY: "1.1em"
  },
  
  ANIMATIONS: {
    HOVER_DURATION: 200,
    BURST_DURATION: 300,
    TRANSITION_DURATION: 600,
    ZOOM_RESET_DURATION: 300,
    FIT_VIEW_DURATION: 400,
    RESIZE_DEBOUNCE: 150,
    INITIAL_FIT_DELAY: 100,
    POST_TRANSITION_FIT_DELAY: 1300,
    RESIZE_FIT_DELAY: 350
  },
  
  TRANSITIONS: {
    ENTER_DELAY_MULTIPLIER: 0,
    UPDATE_DELAY_MULTIPLIER: 0,
    TRANSITION_BUFFER: 100
  },
  
  LINES: {
    DEFAULT_OPACITY: 0.05,
    PRIMARY_VISIBLE_OPACITY: 0.2,
    HOVER_OPACITY: 0.6,
    DASH_ARRAY: "6,4"
  },
  
  BURST: {
    MAX_EQUIVALENCIES: 4,
    HORIZONTAL_OFFSET: 60,
    SPACING: 45,
    FALLBACK_COLOR: "#ffba49"
  },
  
  ZOOM: {
    MIN_SCALE: 0.1,
    MAX_SCALE: 5,
    FIT_PADDING: 50
  },
  
  SCALING: {
    DEFAULT_X_DIVISOR: 10,
    DEFAULT_Y_DIVISOR: 8,
    DEFAULT_Y_OFFSET_MULTIPLIER: 0.1,
    PADDING_RATIO: 0.2
  },
  
  LAYOUT: {
    CANVAS_HEIGHT_OFFSET: 20,
    RESIZE_THRESHOLD: 50
  },
  
  CHECKBOX: {
    X_OFFSET: 180,
    Y_OFFSET: 60,
    WIDTH: 170,
    HEIGHT: 50
  },
  
  HOVER_EFFECTS: {
    NON_HIGHLIGHTED_OPACITY: 0.05
  },
  
  LEGEND: {
    CIRCLE_SPACING: 14,
    BREAKPOINTS: {
      SMALL: 1000,
      MEDIUM: 1400
    }
  }
};

var currentDepartment = 'stats';
var appState = null;
var isTransitioning = false;
var isDepartmentTransitioning = false;

function loadDepartmentData(department, isInitialLoad) {
  var dataFile = department === 'stats' ? CONFIG.DATA_FILES.STATS : CONFIG.DATA_FILES.DSCI;
  currentDepartment = department;
  
  if (isInitialLoad || !appState) {
    d3.select("#course-map svg").selectAll("*").remove();
    d3.select("#program-track-nav").html("");
    d3.select("#course-info").html("");
  }
  
  d3.json(dataFile).then(function(newData) {
    if (appState && !isInitialLoad) {
      smoothTransition(newData);
      return;
    }
    initializeVisualization(newData);
  });
}

function smoothTransition(newData) {
  isTransitioning = true;
  isDepartmentTransitioning = true;
  
  var programs = newData.programs;
  var programRequirementsHTML = {};
  
  programs.forEach(function(p) {
    if (p.requirements_html) {
      programRequirementsHTML[p.program_id] = p.requirements_html;
    }
  });
  if (newData.program_requirements) {
    newData.program_requirements.forEach(function(pr) {
      programRequirementsHTML[pr.program_id] = pr.requirements_html;
    });
  }
  
  d3.select("#program-track-nav").html("");
  var programNav = d3.select("#program-track-nav");
  var courseInfoDiv = d3.select("#course-info");
  
  programs.forEach(function(program, i) {
    programNav.append("div")
      .classed("program", true)
      .classed("highlight", i === 0)
      .html(program.name)
      .on("click", function() {
        if (isDepartmentTransitioning) return;
        
        programNav.selectAll("div").classed("highlight", false);
        d3.select(this).classed("highlight", true);
        appState.currentSelectedProgram = program;
        appState.renderProgram(program, [], CONFIG.ANIMATIONS.TRANSITION_DURATION, newData);
        if (programRequirementsHTML[program.program_id]) {
          courseInfoDiv.html(programRequirementsHTML[program.program_id]);
        }
      });
  });
  
  if (programRequirementsHTML[programs[0].program_id]) {
    courseInfoDiv.html(programRequirementsHTML[programs[0].program_id]);
  }
  
  var width = appState.width;
  var height = appState.height;
  var newScales = appState.calculateScaling(newData, width, height);
  appState.xscale = newScales.xscale;
  appState.yscale = newScales.yscale;
  appState.xoffset = newScales.xoffset;
  appState.yoffset = newScales.yoffset;
  
  appState.data = newData;
  appState.currentSelectedProgram = programs[0];
  if (typeof appState.clearInteractionState === 'function') {
    appState.clearInteractionState();
  }
  appState.programRequirementsHTML = programRequirementsHTML;
  
  var svg = d3.select("#course-map svg");
  // Reset zoom immediately so department switch does a single visible camera move.
  svg.call(appState.zoom.transform, d3.zoomIdentity);
  
  appState.renderProgram(programs[0], [], CONFIG.ANIMATIONS.TRANSITION_DURATION, newData);
  
  setTimeout(() => {
    appState.fitMapToView(true);
    isTransitioning = false;
    isDepartmentTransitioning = false;
  }, CONFIG.ANIMATIONS.TRANSITION_DURATION * (CONFIG.TRANSITIONS.ENTER_DELAY_MULTIPLIER + 1) + CONFIG.TRANSITIONS.TRANSITION_BUFFER + 100);
}

function initializeVisualization(data) {
  const courses = data.courses;
  const requisites = data.requisites;
  const programs = data.programs;
  const tracks = data.tracks || [];
  const coursesTracks = data.courses_tracks || [];
  const reflections = data.reflections || [];
  const equivalencies = data.equivalencies;

  var courseColors = CONFIG.COURSE_COLORS;

  var width = parseInt(d3.select("#course-map").style("width"));
  var height = parseInt(d3.select("#course-map").style("height")) - CONFIG.LAYOUT.CANVAS_HEIGHT_OFFSET;

  function isMobileView() {
    return window.innerWidth < 768;
  }
  
  function calculateScaling(dataSource) {
    if (!dataSource || !dataSource.courses_program1) {
      return {
        xscale: width / CONFIG.SCALING.DEFAULT_X_DIVISOR,
        yscale: height / CONFIG.SCALING.DEFAULT_Y_DIVISOR,
        xoffset: width / 2,
        yoffset: height * CONFIG.SCALING.DEFAULT_Y_OFFSET_MULTIPLIER
      };
    }
    
    const courses = dataSource.courses_program1;
    if (courses.length === 0) return { 
      xscale: width / CONFIG.SCALING.DEFAULT_X_DIVISOR, 
      yscale: height / CONFIG.SCALING.DEFAULT_Y_DIVISOR,
      xoffset: width / 2,
      yoffset: height * CONFIG.SCALING.DEFAULT_Y_OFFSET_MULTIPLIER
    };
    
    const xCoords = courses.map(c => c.x);
    const yCoords = courses.map(c => c.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    
    const padding = CONFIG.SCALING.PADDING_RATIO;
    const usableWidth = width * (1 - padding);
    const usableHeight = height * (1 - padding);
    
    const mobileScaleBoost = window.innerWidth < 768
      ? (currentDepartment === 'dsci' ? 1.6 : 1.4)
      : 1;
    const xs = (xRange > 0 ? usableWidth / xRange : width / CONFIG.SCALING.DEFAULT_X_DIVISOR) * mobileScaleBoost;
    const ys = (yRange > 0 ? usableHeight / yRange : height / CONFIG.SCALING.DEFAULT_Y_DIVISOR) * mobileScaleBoost;
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    return {
      xscale: xs,
      yscale: ys,
      xoffset: width / 2 - centerX * xs,
      yoffset: isMobileView() ? height / 2 - centerY * ys : height / 2 + centerY * ys
    };
  }
  
  var scales = calculateScaling(data);
  var xscale = scales.xscale;
  var yscale = scales.yscale;
  var xoffset = scales.xoffset;
  var yoffset = scales.yoffset;
  
  function xcoord(x) { 
    if (appState && appState.xscale !== undefined) {
      return x * appState.xscale + appState.xoffset;
    }
    return x * xscale + xoffset; 
  }
  function ycoord(y) { 
    if (appState && appState.yscale !== undefined) {
      return isMobileView() ? y * appState.yscale + appState.yoffset : appState.yoffset - y * appState.yscale;
    }
    return isMobileView() ? y * yscale + yoffset : yoffset - y * yscale; 
  }
  
  var svg = d3.select("#course-map svg").attr("width",width).attr("height",height);
  
  // Firefox SVG rendering fix: ensure proper namespace and rendering attributes
  svg.attr("xmlns", "http://www.w3.org/2000/svg")
     .style("shape-rendering", "geometricPrecision");
     
  var highlightColor1 = "rgb(0, 85, 183)";

  var prereqChainEnabled = false;
  var burstEffectsEnabled = true;
  var hierarchicalLayout = false;

  // Expose a tiny dev hook for toggling advanced options
  window.__courseMapperDev = window.__courseMapperDev || {};
  window.__courseMapperDev.setPrereqChain = function(enabled) { prereqChainEnabled = !!enabled; };
  window.__courseMapperDev.setBurstEffects = function(enabled) { burstEffectsEnabled = !!enabled; };

  function updateCircleColors() {
    courseNodes.selectAll("circle")
      .attr("fill", function(d) {
        return getCourseColor(d.course_number, d.required, false);
      });
    courseNumbers.selectAll("text")
      .attr("fill", function(d) {
        return d.required ? "white" : "black";
      });
  }

  function getCourseType(courseNumber) {
    var firstChar = courseNumber.toString().charAt(0).toUpperCase();
    return firstChar;
  }

  function getCourseColors() {
    var cData = getCurrentDataSource();
    if (cData && cData.courseColors) {
      return cData.courseColors;
    }
    return CONFIG.COURSE_COLORS;
  }

  function getCoursePrefixLabel(courseNumber) {
    var firstChar = courseNumber.toString().charAt(0).toUpperCase();
    var colors = getCourseColors();
    if (colors[firstChar] && colors[firstChar].label) {
      return colors[firstChar].label;
    }
    return firstChar;
  }
  
  function getCourseColor(courseNumber, isRequired, isInList) {
    if (isRequired || isInList) {
      var courseType = getCourseType(courseNumber);
      var colors = getCourseColors();
      return colors[courseType] ? colors[courseType].color : highlightColor1;
    }
    return CONFIG.COURSE_NODE.DEFAULT_FILL;
  }
  
  function getCourseStrokeColor(courseNumber, isRequired, isInList) {
    var courseType = getCourseType(courseNumber);
    var colors = getCourseColors();
    if (isRequired || isInList) {
      return colors[courseType] ? colors[courseType].color : highlightColor1;
    }
    return colors[courseType] ? colors[courseType].color : CONFIG.COURSE_NODE.DEFAULT_STROKE;
  }
  
  function getNumericPart(courseNumber) {
    return courseNumber.toString().substring(1);
  }

  function buildCourseLabel(textSelection, courseNumber, sizes) {
    var prefix = getCoursePrefixLabel(courseNumber);
    var number = getNumericPart(courseNumber);
    textSelection.selectAll("tspan").remove();
    textSelection.append("tspan")
      .attr("class", "course-prefix")
      .attr("x", 0)
      .attr("dy", CONFIG.COURSE_TEXT.PREFIX_DY)
      .attr("font-size", sizes.prefix)
      .text(prefix);
    textSelection.append("tspan")
      .attr("class", "course-number")
      .attr("x", 0)
      .attr("dy", CONFIG.COURSE_TEXT.NUMBER_DY)
      .attr("font-size", sizes.number)
      .text(number);
  }

  function getCurrentDataSource() {
    if (appState && appState.data) {
      return appState.data;
    }
    return hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
  }

  var zoomContainer = svg.append("g").attr("class", "zoom-container");
  
  // Add invisible background rect FIRST (at bottom of z-order) to capture clicks on empty space
  var background = zoomContainer.append("rect")
    .attr("class", "background-rect")
    .attr("x", -10000)
    .attr("y", -10000)
    .attr("width", 20000)
    .attr("height", 20000)
    .attr("fill", "transparent")
    .style("pointer-events", "all");
  
  // Add click/touch handler for background
  background.on("click touchstart", function(event) {
    if (window.innerWidth < 1024 || event.type === 'click') {
      // Clear highlights and reset to program info
      courseNodes.selectAll("circle")
        .interrupt()
        .transition()
        .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
        .attr("r", CONFIG.COURSE_NODE.DEFAULT_RADIUS)
        .style("opacity", 1);
      
      courseNumbers.selectAll("text")
        .interrupt()
        .transition()
        .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
        .style("opacity", 1);
      courseNumbers.selectAll("tspan.course-prefix")
        .interrupt()
        .transition()
        .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
        .attr("font-size", CONFIG.COURSE_TEXT.PREFIX_SIZE);
      courseNumbers.selectAll("tspan.course-number")
        .interrupt()
        .transition()
        .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
        .attr("font-size", CONFIG.COURSE_TEXT.NUMBER_SIZE);
      
      infoNodes.selectAll("circle")
        .interrupt()
        .transition()
        .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
        .attr("r", window.innerWidth < 1024 ? CONFIG.COURSE_NODE.DEFAULT_RADIUS + 4 : CONFIG.COURSE_NODE.DEFAULT_RADIUS);
      
      requisiteLines.selectAll("line")
        .attr("opacity", CONFIG.LINES.PRIMARY_VISIBLE_OPACITY);
      
      courseNodes.selectAll(".burst-circle").remove();
      courseNumbers.selectAll(".burst-text").remove();
      requisiteLines.selectAll(".cpsc-ghost-line").remove();
      
      // Clear the currently selected course
      pinnedCourseNumber = null;
      currentSelectedCourse = null;
      if (appState) appState.currentSelectedCourse = null;
      updateCourseInteractivityCursors();
      
      // Reset course info to program requirements
      if (appState && appState.currentSelectedProgram && appState.programRequirementsHTML[appState.currentSelectedProgram.program_id]) {
        courseInfoDiv.html(appState.programRequirementsHTML[appState.currentSelectedProgram.program_id]);
      } else if (currentSelectedProgram && programRequirementsHTML[currentSelectedProgram.program_id]) {
        courseInfoDiv.html(programRequirementsHTML[currentSelectedProgram.program_id]);
      }
    }
  });
  
  // Now add the content groups on top of the background
  var requisiteLines = zoomContainer.append("g");
  var courseNodes = zoomContainer.append("g");
  var courseNumbers = zoomContainer.append("g");
  var infoNodes = zoomContainer.append("g");
  
  var zoom = d3.zoom()
    .scaleExtent([CONFIG.ZOOM.MIN_SCALE, CONFIG.ZOOM.MAX_SCALE])
    .on("start", function(event) {
      if (event.sourceEvent && event.sourceEvent.type === "mousedown") {
        svg.style("cursor", "grabbing");
      }
    })
    .on("zoom", function(event) {
      zoomContainer.attr("transform", event.transform);
    })
    .on("end", function(event) {
      svg.style("cursor", "default");
    });
  
  svg.call(zoom)
    .style("cursor", "default");
  
  // Remove any old clear handlers - background rect in zoomContainer handles this now
  svg.on("click.clear touchstart.clear", null);

  function fitMapToView(animate) {
    const nodes = svg.selectAll(".zoom-container circle:not(.burst-circle):not(.grid-dot)").nodes();
    if (nodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const cx = parseFloat(node.getAttribute('cx'));
      const cy = parseFloat(node.getAttribute('cy'));
      if (!isNaN(cx) && !isNaN(cy)) {
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
      }
    });

    if (minX === Infinity) return;

    const padding = CONFIG.ZOOM.FIT_PADDING;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = width / contentWidth;
    const scaleY = height / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const translateX = width / 2 - centerX * scale;
    const translateY = height / 2 - centerY * scale;

    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    if (animate) {
      svg.transition().duration(CONFIG.ANIMATIONS.FIT_VIEW_DURATION).call(zoom.transform, transform);
    } else {
      svg.call(zoom.transform, transform);
    }
  }

  function getResponsiveLegendConfig(viewportWidth, viewportHeight) {
    const isSmall = viewportWidth < CONFIG.LEGEND.BREAKPOINTS.SMALL;
    const isMedium = viewportWidth >= CONFIG.LEGEND.BREAKPOINTS.SMALL && viewportWidth < CONFIG.LEGEND.BREAKPOINTS.MEDIUM;
    const isLarge = viewportWidth >= 1400;
    
    const baseConfig = {
      padding: isSmall ? 
        { top: 10, right: 10, bottom: 10, left: 10 } : 
        isMedium ? 
        { top: 15, right: 15, bottom: 15, left: 15 } :
        { top: 18, right: 18, bottom: 18, left: 18 },
      
      margin: { 
        fromEdge: isSmall ? 10 : isMedium ? 15 : 20 
      },
      
      rowHeight: isSmall ? 18 : isMedium ? 22 : 24,
      rowSpacing: 0,
      
      circle: { 
        radius: isSmall ? 5 : isMedium ? 6 : 7, 
        strokeWidth: 1.25 
      },
      line: { 
        length: isSmall ? 35 : isMedium ? 42 : 50, 
        strokeWidth: isSmall ? 1.5 : 2, 
        y: isSmall ? 7 : isMedium ? 9 : 10 
      },
      
      icon: { 
        x: isSmall ? 25 : isMedium ? 30 : 35, 
        y: isSmall ? 7 : isMedium ? 9 : 10 
      },
      label: { 
        x: isSmall ? 60 : isMedium ? 75 : 90, 
        y: isSmall ? 7 : isMedium ? 9 : 10, 
        dy: "0.35em" 
      },
      
      background: { 
        fill: "white", 
        stroke: "#ccc", 
        strokeWidth: 1, 
        borderRadius: 5 
      },
      text: { 
        fontFamily: "Arial", 
        fontSize: isSmall ? "11px" : isMedium ? "13px" : "14px", 
        fill: "#333",
        anchor: "start"
      },
      
      contentWidth: isSmall ? 210 : isMedium ? 245 : 280,
      
      anchor: "top-right"
    };
    
    return baseConfig;
  }
  
  var LEGEND_CONFIG = getResponsiveLegendConfig(width, height);
  
  const currentColors = getCourseColors();
  const legendData = Object.keys(currentColors).map(key => currentColors[key]);
  const legendItemsData = [
    {
      type: 'required',
      colors: legendData.map(d => d.color),
      label: 'Required Course'
    },
    {
      type: 'line-solid',
      label: 'Prerequisites'
    },
    {
      type: 'line-dashed',
      label: 'Co-requisites'
    }
  ];
  
  function calculateLegendDimensions(config, itemsData) {
    const numRows = itemsData.length;
    const contentHeight = numRows * (config.rowHeight + config.rowSpacing);
    const contentWidth = config.contentWidth;
    
    const totalWidth = contentWidth + config.padding.left + config.padding.right;
    const totalHeight = contentHeight + config.padding.top + config.padding.bottom;
    
    return {
      width: totalWidth,
      height: totalHeight,
      contentWidth: contentWidth,
      contentHeight: contentHeight
    };
  }
  
  function calculateLegendPosition(config, dimensions, svgWidth, svgHeight) {
    const { width: legendWidth, height: legendHeight } = dimensions;
    const margin = config.margin.fromEdge;
    
    let x, y;
    
    switch(config.anchor) {
      case "top-left":
        x = margin;
        y = margin;
        break;
      case "top-right":
        x = svgWidth - legendWidth - margin;
        y = margin;
        break;
      case "bottom-left":
        x = margin;
        y = svgHeight - legendHeight - margin;
        break;
      case "bottom-right":
        x = svgWidth - legendWidth - margin;
        y = svgHeight - legendHeight - margin;
        break;
      default:
        x = margin;
        y = svgHeight - legendHeight - margin;
    }
    
    return { x, y };
  }
  
  function createLegend(svg, config, itemsData, svgWidth, svgHeight) {
    const dimensions = calculateLegendDimensions(config, itemsData);
    const position = calculateLegendPosition(config, dimensions, svgWidth, svgHeight);
    
    svg.select(".legend").remove();
    
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${position.x}, ${position.y})`);
    
    legend.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("fill", config.background.fill)
      .attr("stroke", config.background.stroke)
      .attr("stroke-width", config.background.strokeWidth)
      .attr("rx", config.background.borderRadius);
    
    const itemGroups = legend.selectAll(".legend-item")
      .data(itemsData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => {
        const y = config.padding.top + i * (config.rowHeight + config.rowSpacing);
        return `translate(${config.padding.left}, ${y})`;
      });
    
    itemGroups.each(function(d, i) {
      const group = d3.select(this);
      
      if (d.type === 'course-type') {
        group.append("circle")
          .attr("cx", config.icon.x)
          .attr("cy", config.icon.y)
          .attr("r", config.circle.radius)
          .attr("fill", "white")
          .attr("stroke", d.color)
          .attr("stroke-width", config.circle.strokeWidth);
        
        group.append("text")
          .attr("x", config.label.x)
          .attr("y", config.label.y)
          .attr("dy", config.label.dy)
          .attr("font-family", config.text.fontFamily)
          .attr("font-size", config.text.fontSize)
          .attr("fill", config.text.fill)
          .attr("text-anchor", config.text.anchor)
          .text(d.label);
          
      } else if (d.type === 'required') {
        const numCircles = d.colors.length;
        const circleSpacing = CONFIG.LEGEND.CIRCLE_SPACING;
        const totalWidth = (numCircles - 1) * circleSpacing;
        const startX = config.icon.x - totalWidth / 2;
        
        d.colors.forEach((color, idx) => {
          group.append("circle")
            .attr("cx", startX + idx * circleSpacing)
            .attr("cy", config.icon.y)
            .attr("r", config.circle.radius)
            .attr("fill", color)
            .attr("stroke", color)
            .attr("stroke-width", config.circle.strokeWidth);
        });
        
        group.append("text")
          .attr("x", config.label.x)
          .attr("y", config.label.y)
          .attr("dy", config.label.dy)
          .attr("font-family", config.text.fontFamily)
          .attr("font-size", config.text.fontSize)
          .attr("fill", config.text.fill)
          .attr("text-anchor", config.text.anchor)
          .text(d.label);
          
      } else if (d.type === 'line-solid') {
        const lineStartX = config.icon.x - config.line.length / 2;
        const lineEndX = config.icon.x + config.line.length / 2;
        
        group.append("line")
          .attr("x1", lineStartX)
          .attr("y1", config.line.y)
          .attr("x2", lineEndX)
          .attr("y2", config.line.y)
          .attr("stroke", "#333")
          .attr("stroke-width", config.line.strokeWidth);
        
        group.append("text")
          .attr("x", config.label.x)
          .attr("y", config.label.y)
          .attr("dy", config.label.dy)
          .attr("font-family", config.text.fontFamily)
          .attr("font-size", config.text.fontSize)
          .attr("fill", config.text.fill)
          .attr("text-anchor", config.text.anchor)
          .text(d.label);
          
      } else if (d.type === 'line-dashed') {
        const lineStartX = config.icon.x - config.line.length / 2;
        const lineEndX = config.icon.x + config.line.length / 2;
        
        group.append("line")
          .attr("x1", lineStartX)
          .attr("y1", config.line.y)
          .attr("x2", lineEndX)
          .attr("y2", config.line.y)
          .attr("stroke", "#333")
          .attr("stroke-width", config.line.strokeWidth)
          .attr("stroke-dasharray", "6,4");
        
        group.append("text")
          .attr("x", config.label.x)
          .attr("y", config.label.y)
          .attr("dy", config.label.dy)
          .attr("font-family", config.text.fontFamily)
          .attr("font-size", config.text.fontSize)
          .attr("fill", config.text.fill)
          .attr("text-anchor", config.text.anchor)
          .text(d.label);
      }
    });
    
    return { element: legend, dimensions, position };
  }
  
  function updateLegendPosition(svg, config, itemsData, svgWidth, svgHeight) {
    const dimensions = calculateLegendDimensions(config, itemsData);
    const position = calculateLegendPosition(config, dimensions, svgWidth, svgHeight);
    
    svg.select(".legend")
      .attr("transform", `translate(${position.x}, ${position.y})`);
  }
  
  function populateHTMLLegend(itemsData) {
    const legendContent = document.getElementById('legend-content');
    
    let html = '<div style="padding: 10px;">';
    html += '<h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #002145;">Legend</h3>';
    
    itemsData.forEach(item => {
      html += '<div style="display: flex; align-items: center; margin-bottom: 16px;">';
      
      if (item.type === 'course-type') {
        html += `<svg width="70" height="30" style="margin-right: 12px; flex-shrink: 0;">
          <circle cx="35" cy="15" r="10" fill="white" stroke="${item.color}" stroke-width="2"/>
        </svg>`;
        html += `<span style="font-size: 14px; color: #333;">${item.label}</span>`;
      } else if (item.type === 'required') {
        html += '<svg width="70" height="30" style="margin-right: 12px; flex-shrink: 0;">';
        const spacing = 16;
        const startX = 10;
        item.colors.forEach((color, idx) => {
          html += `<circle cx="${startX + idx * spacing}" cy="15" r="7" fill="${color}" stroke="${color}" stroke-width="2"/>`;
        });
        html += '</svg>';
        html += `<span style="font-size: 14px; color: #333;">${item.label}</span>`;
      } else if (item.type === 'line-solid') {
        html += `<svg width="70" height="30" style="margin-right: 12px; flex-shrink: 0;">
          <line x1="25" y1="15" x2="45" y2="15" stroke="#333" stroke-width="2"/>
        </svg>`;
        html += `<span style="font-size: 14px; color: #333;">${item.label}</span>`;
      } else if (item.type === 'line-dashed') {
        html += `<svg width="70" height="30" style="margin-right: 12px; flex-shrink: 0;">
          <line x1="25" y1="15" x2="45" y2="15" stroke="#333" stroke-width="2" stroke-dasharray="4,3"/>
        </svg>`;
        html += `<span style="font-size: 14px; color: #333;">${item.label}</span>`;
      }
      
      html += '</div>';
    });
    
    html += '</div>';
    legendContent.innerHTML = html;
  }
  
  var legendInfo = createLegend(svg, LEGEND_CONFIG, legendItemsData, width, height);
  populateHTMLLegend(legendItemsData);

  var courseMapDiv = d3.select("#course-map");
  var courseInfoDiv = d3.select("#course-info");
  var courseInfoTemplate = _.template(d3.select("#course-info-template").html());
  var programNav = d3.select("#program-track-nav");
  
  var currentSelectedProgram = null;
  var currentSelectedCourse = null;
  var pinnedCourseNumber = null;
  
  var programRequirementsHTML = {};
  
  programs.forEach(function(program) {
    if (program.requirements_html && program.requirements_html.trim() !== '') {
      programRequirementsHTML[program.program_id] = program.requirements_html;
    }
  });
  
  if (data.program_requirements) {
    data.program_requirements.forEach(function(req) {
      if (req.html_content && req.html_content.trim() !== '') {
        programRequirementsHTML[req.program_id] = req.html_content;
      }
    });
  }
  
  programs.forEach(function(program){
    programNav.append("div").classed("program",true).html(program.name).on("click",function (event) {
      if (isDepartmentTransitioning) return;
      
      d3.select("#program-track-nav div.highlight").classed("highlight",false);
      d3.select(this).classed("highlight",true);
      
      currentSelectedProgram = program;
      pinnedCourseNumber = null;
      currentSelectedCourse = null;
      if (appState) appState.currentSelectedCourse = null;
      updateCourseInteractivityCursors();
      if (appState) {
        appState.currentSelectedProgram = program;
      }
      
      renderProgram(program,[],CONFIG.ANIMATIONS.TRANSITION_DURATION);
      
      if (programRequirementsHTML[program.program_id]) {
        courseInfoDiv.html(programRequirementsHTML[program.program_id]);
      }
    });
  });

  function showCourseInfo (event,course,options) {
    options = options || {};
    var suppressAnimation = !!options.suppressAnimation;
    var transitionFromCourse = options.transitionFromCourse || null;
    var useCrossfadeTransition = !!transitionFromCourse;
    var hoverDuration = suppressAnimation ? 0 : CONFIG.ANIMATIONS.HOVER_DURATION;
    var burstDuration = suppressAnimation ? 0 : CONFIG.ANIMATIONS.BURST_DURATION;
    if (isTransitioning) return;
    if (pinnedCourseNumber && event && event.type !== 'click' && event.type !== 'touchstart') {
      return;
    }
    
    // Set the currently selected course
    currentSelectedCourse = course.course_number;
    if (appState) appState.currentSelectedCourse = course.course_number;
    
    // First, clear any existing highlights from previous course
    // For crossfade transitions, keep current visual state and animate between highlight sets.
    if (!useCrossfadeTransition) {
      courseNodes.selectAll("circle")
        .interrupt()
        .attr("r", CONFIG.COURSE_NODE.DEFAULT_RADIUS)
        .style("opacity", 1);
      courseNumbers.selectAll("text")
        .interrupt()
        .style("opacity", 1);
      courseNumbers.selectAll("tspan.course-prefix")
        .interrupt()
        .attr("font-size", CONFIG.COURSE_TEXT.PREFIX_SIZE);
      courseNumbers.selectAll("tspan.course-number")
        .interrupt()
        .attr("font-size", CONFIG.COURSE_TEXT.NUMBER_SIZE);
      infoNodes.selectAll("circle")
        .interrupt()
        .attr("r", window.innerWidth < 1024 ? CONFIG.COURSE_NODE.DEFAULT_RADIUS + 4 : CONFIG.COURSE_NODE.DEFAULT_RADIUS);
    } else {
      courseNodes.selectAll("circle").interrupt();
      courseNumbers.selectAll("text").interrupt();
      courseNumbers.selectAll("tspan.course-prefix").interrupt();
      courseNumbers.selectAll("tspan.course-number").interrupt();
      infoNodes.selectAll("circle").interrupt();
    }
    
    // Clear all prerequisite lines
    requisiteLines.selectAll("line")
      .attr("opacity", CONFIG.LINES.PRIMARY_VISIBLE_OPACITY);
    
    // Remove any existing burst circles
    courseNodes.selectAll(".burst-circle").remove();
    courseNumbers.selectAll(".burst-text").remove();
    requisiteLines.selectAll(".cpsc-ghost-line").remove();
    
    // Now show info for the new course
    var currentData = appState ? appState.data : data;
    var courseInfo = currentData.courses.find(d => d.course_number == course.course_number);
    var requisiteInfo = currentData.requisites.filter(r => r.course_number == course.course_number);
    
    if (!courseInfo) return;
    
    var courseNumberStr = course.course_number.toString();
    var coursePrefix = getCoursePrefixLabel(courseNumberStr);
    var numericPart = courseNumberStr.substring(1);
    
    var courseInfoObject = {"number": coursePrefix + " " + numericPart + ":",
                            "title": courseInfo.title,
                            "description": courseInfo.description,
                            "prereqs": requisiteInfo.filter(requisite => requisite.type == "pre"),
                            "coreqs": requisiteInfo.filter(requisite => requisite.type == "co"),
                            "notes": courseInfo.notes};
    courseInfoDiv.html(courseInfoTemplate(courseInfoObject));
    
    var currentDataSource = getCurrentDataSource();
    var directPrereqs = (currentDataSource.requisites_programs || currentDataSource["requisites_program" + currentDataSource.programs[0].program_id])
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return [];
      }
      visited.add(courseNumber);
      
      var directPrereqs = (currentDataSource.requisites_programs || currentDataSource["requisites_program" + currentDataSource.programs[0].program_id])
        .filter(requisite => requisite.course_number == courseNumber)
        .map(requisite => requisite.requisite_number);
      
      var allPrereqs = [...directPrereqs];
      
      directPrereqs.forEach(prereq => {
        var chainPrereqs = getPrerequisiteChain(prereq, new Set(visited));
        allPrereqs = allPrereqs.concat(chainPrereqs);
      });
      
      return [...new Set(allPrereqs)];
    }
    
    var prerequisiteCourses = prereqChainEnabled ? getPrerequisiteChain(course.course_number) : directPrereqs;
    
    var coursesToHighlight = [course.course_number, ...prerequisiteCourses];
    
    if (useCrossfadeTransition) {
      courseNodes.selectAll("circle")
        .transition()
        .duration(hoverDuration)
        .attr("r", function(d) {
          return coursesToHighlight.includes(d.course_number) ? CONFIG.COURSE_NODE.HOVER_RADIUS : CONFIG.COURSE_NODE.DEFAULT_RADIUS;
        })
        .style("opacity", function(d) {
          return coursesToHighlight.includes(d.course_number) ? 1 : CONFIG.HOVER_EFFECTS.NON_HIGHLIGHTED_OPACITY;
        });

      courseNumbers.selectAll("text")
        .transition()
        .duration(hoverDuration)
        .style("opacity", function(d) {
          return coursesToHighlight.includes(d.course_number) ? 1 : CONFIG.HOVER_EFFECTS.NON_HIGHLIGHTED_OPACITY;
        });

      courseNumbers.selectAll("text")
        .selectAll("tspan.course-prefix")
        .transition()
        .duration(hoverDuration)
        .attr("font-size", function() {
          var parentData = d3.select(this.parentNode).datum();
          return coursesToHighlight.includes(parentData.course_number) ? CONFIG.COURSE_TEXT.PREFIX_HOVER_SIZE : CONFIG.COURSE_TEXT.PREFIX_SIZE;
        });

      courseNumbers.selectAll("text")
        .selectAll("tspan.course-number")
        .transition()
        .duration(hoverDuration)
        .attr("font-size", function() {
          var parentData = d3.select(this.parentNode).datum();
          return coursesToHighlight.includes(parentData.course_number) ? CONFIG.COURSE_TEXT.NUMBER_HOVER_SIZE : CONFIG.COURSE_TEXT.NUMBER_SIZE;
        });

      infoNodes.selectAll("circle")
        .transition()
        .duration(hoverDuration)
        .attr("r", function(d) {
          return coursesToHighlight.includes(d.course_number)
            ? CONFIG.COURSE_NODE.HOVER_RADIUS
            : (window.innerWidth < 1024 ? CONFIG.COURSE_NODE.DEFAULT_RADIUS + 4 : CONFIG.COURSE_NODE.DEFAULT_RADIUS);
        });
    } else {
      courseNodes.selectAll("circle")
        .filter(d => coursesToHighlight.includes(d.course_number))
        .transition()
        .duration(hoverDuration)
        .attr("r", CONFIG.COURSE_NODE.HOVER_RADIUS);
      
      courseNodes.selectAll("circle")
        .filter(d => !coursesToHighlight.includes(d.course_number))
        .transition()
        .duration(hoverDuration)
        .style("opacity", CONFIG.HOVER_EFFECTS.NON_HIGHLIGHTED_OPACITY);
      
      courseNumbers.selectAll("text")
        .filter(d => coursesToHighlight.includes(d.course_number))
        .selectAll("tspan.course-prefix")
        .transition()
        .duration(hoverDuration)
        .attr("font-size", CONFIG.COURSE_TEXT.PREFIX_HOVER_SIZE);
      courseNumbers.selectAll("text")
        .filter(d => coursesToHighlight.includes(d.course_number))
        .selectAll("tspan.course-number")
        .transition()
        .duration(hoverDuration)
        .attr("font-size", CONFIG.COURSE_TEXT.NUMBER_HOVER_SIZE);
      
      courseNumbers.selectAll("text")
        .filter(d => !coursesToHighlight.includes(d.course_number))
        .transition()
        .duration(hoverDuration)
        .style("opacity", CONFIG.HOVER_EFFECTS.NON_HIGHLIGHTED_OPACITY);
      
      infoNodes.selectAll("circle")
        .filter(d => coursesToHighlight.includes(d.course_number))
        .transition()
        .duration(hoverDuration)
        .attr("r", CONFIG.COURSE_NODE.HOVER_RADIUS);
    }
    
    if (prereqChainEnabled) {
      coursesToHighlight.forEach(courseNum => {
        requisiteLines.selectAll("line")
          .filter(requisite => requisite.course_number == courseNum && coursesToHighlight.includes(requisite.requisite_number))
          .attr("opacity", CONFIG.LINES.HOVER_OPACITY)
          .attr("stroke-dasharray", function(requisite) {
            return requisite.requisite_is_co == 1 ? CONFIG.LINES.DASH_ARRAY : null;
          });
      });
    } else {
      requisiteLines.selectAll("line")
        .attr("opacity", CONFIG.LINES.DEFAULT_OPACITY)
        .filter(requisite => requisite.course_number == course.course_number && directPrereqs.includes(requisite.requisite_number))
        .attr("opacity", CONFIG.LINES.HOVER_OPACITY)
        .attr("stroke-dasharray", function(requisite) {
          return requisite.requisite_is_co == 1 ? CONFIG.LINES.DASH_ARRAY : null;
        });
    }
    
    var allBurstData = [];
    if (burstEffectsEnabled) {
      for (let courseNum of prerequisiteCourses) {
        let courseEquivalencies = equivalencies.filter(eq => eq.course_number === courseNum);
        if (courseEquivalencies.length > 0) {
          let burstCourseData = currentDataSource["courses_program" + currentDataSource.programs[0].program_id].find(c => c.course_number == courseNum);
          if (burstCourseData) {
            allBurstData.push({
              course: courseNum,
              data: burstCourseData,
              equivalencies: courseEquivalencies.map(eq => eq.equivalency_number)
            });
          }
        }
      }
    }

    var highlightedCourseCoords = (currentDataSource["courses_program" + currentDataSource.programs[0].program_id] || [])
      .filter(c => coursesToHighlight.includes(c.course_number))
      .map(c => ({
        x: xcoord(c.x),
        y: ycoord(c.y)
      }));

    function countBurstOverlapsForDirection(burstCourseData, equivalenciesCount, direction) {
      var overlapCount = 0;
      var minDistance = CONFIG.COURSE_NODE.HOVER_RADIUS * 2;
      var minDistanceSq = minDistance * minDistance;

      for (var i = 0; i < equivalenciesCount; i++) {
        var burstX = xcoord(burstCourseData.x) + direction * (CONFIG.BURST.HORIZONTAL_OFFSET + i * CONFIG.BURST.SPACING);
        var burstY = ycoord(burstCourseData.y);

        var overlapsHighlighted = highlightedCourseCoords.some(coord => {
          var dx = coord.x - burstX;
          var dy = coord.y - burstY;
          return (dx * dx + dy * dy) < minDistanceSq;
        });

        if (overlapsHighlighted) {
          overlapCount += 1;
        }
      }

      return overlapCount;
    }
    
    allBurstData.forEach((burstInfo, courseIndex) => {
      var equivalenciesToShow = burstInfo.equivalencies.slice(0, CONFIG.BURST.MAX_EQUIVALENCIES);
      var rightOverlapCount = countBurstOverlapsForDirection(burstInfo.data, equivalenciesToShow.length, 1);
      var leftOverlapCount = countBurstOverlapsForDirection(burstInfo.data, equivalenciesToShow.length, -1);
      var burstDirection = 1;

      if (rightOverlapCount > 0 && leftOverlapCount === 0) {
        burstDirection = -1;
      } else if (leftOverlapCount > 0 && rightOverlapCount === 0) {
        burstDirection = 1;
      } else if (leftOverlapCount < rightOverlapCount) {
        burstDirection = -1;
      }

      var originalNode = courseNodes.selectAll("circle")
        .filter(d => d.course_number === burstInfo.course);
      var originalFill = originalNode.attr("fill");

      var burstCircles = courseNodes.selectAll(`.burst-circle-${courseIndex}`)
        .data(equivalenciesToShow);

      burstCircles.enter()
        .append("circle")
        .attr("class", `burst-circle burst-circle-${courseIndex}`)
        .attr("cx", xcoord(burstInfo.data.x))
        .attr("cy", ycoord(burstInfo.data.y))
        .attr("r", 0)
        .attr("fill", function(d) {
          var courseType = getCourseType(d);
          var currentCourseColors = getCourseColors();
          return originalFill !== CONFIG.COURSE_NODE.DEFAULT_FILL ? (currentCourseColors[courseType] ? currentCourseColors[courseType].color : CONFIG.BURST.FALLBACK_COLOR) : CONFIG.COURSE_NODE.DEFAULT_FILL;
        })
        .attr("stroke", function(d) {
          var courseType = getCourseType(d);
          var currentCourseColors = getCourseColors();
          return currentCourseColors[courseType] ? currentCourseColors[courseType].color : CONFIG.BURST.FALLBACK_COLOR;
        })
        .attr("stroke-width", CONFIG.COURSE_NODE.STROKE_WIDTH)
        .transition()
        .duration(burstDuration)
        .attr("r", CONFIG.COURSE_NODE.HOVER_RADIUS)
        .attr("cx", function(d, i) {
          return xcoord(burstInfo.data.x) + burstDirection * (CONFIG.BURST.HORIZONTAL_OFFSET + i * CONFIG.BURST.SPACING);
        })
        .attr("cy", function(d, i) {
          return ycoord(burstInfo.data.y);
        });

      var burstText = courseNumbers.selectAll(`.burst-text-${courseIndex}`)
        .data(equivalenciesToShow);

      burstText.enter()
        .append("text")
        .attr("class", `burst-text burst-text-${courseIndex}`)
        .attr("transform", `translate(${xcoord(burstInfo.data.x)}, ${ycoord(burstInfo.data.y)})`)
        .attr("text-anchor", "middle")
        .attr("font-family", CONFIG.COURSE_TEXT.FONT_FAMILY)
        .attr("fill", function(d) {
          var courseType = getCourseType(d);
          var currentCourseColors = getCourseColors();
          var burstFill = originalFill !== CONFIG.COURSE_NODE.DEFAULT_FILL ? (currentCourseColors[courseType] ? currentCourseColors[courseType].color : CONFIG.BURST.FALLBACK_COLOR) : CONFIG.COURSE_NODE.DEFAULT_FILL;
          return burstFill !== CONFIG.COURSE_NODE.DEFAULT_FILL ? CONFIG.COURSE_NODE.DEFAULT_FILL : CONFIG.COURSE_NODE.DEFAULT_STROKE;
        })
        .attr("opacity", 0)
        .each(function(d) {
          buildCourseLabel(d3.select(this), d, {
            prefix: CONFIG.COURSE_TEXT.PREFIX_HOVER_SIZE,
            number: CONFIG.COURSE_TEXT.NUMBER_HOVER_SIZE
          });
        })
        .transition()
        .duration(burstDuration)
        .attr("opacity", 1)
        .attr("transform", function(d, i) {
          const x = xcoord(burstInfo.data.x) + burstDirection * (CONFIG.BURST.HORIZONTAL_OFFSET + i * CONFIG.BURST.SPACING);
          const y = ycoord(burstInfo.data.y);
          return `translate(${x}, ${y})`;
        });
    });

    // Special logic for STAT 406 to show CPSC 340
    if (course.course_number === "S406") {
      var s406 = currentDataSource["courses_program" + currentDataSource.programs[0].program_id].find(c => c.course_number === "S406");
      var s306 = currentDataSource["courses_program" + currentDataSource.programs[0].program_id].find(c => c.course_number === "S306");
      var s344 = currentDataSource["courses_program" + currentDataSource.programs[0].program_id].find(c => c.course_number === "S344");
      
      if (s406 && s306 && s344) {
        var dx = Math.abs(xcoord(s306.x) - xcoord(s344.x)) * 0.6;
        var targetX = xcoord(s306.x) + dx;
        var targetY = ycoord(s306.y);
        
        var startX = xcoord(s406.x);
        var startY = ycoord(s406.y);
        
        var cpscGhost = courseNodes.selectAll(".cpsc-ghost").data(["C340"]);
        
        cpscGhost.enter()
          .append("circle")
          .attr("class", "burst-circle cpsc-ghost")
          .attr("cx", startX)
          .attr("cy", startY)
          .attr("r", 0)
          .attr("fill", CONFIG.COURSE_NODE.DEFAULT_FILL)
          .attr("stroke", CONFIG.COURSE_COLORS["C"].color)
          .attr("stroke-width", CONFIG.COURSE_NODE.STROKE_WIDTH)
          .transition()
          .duration(burstDuration)
          .attr("r", CONFIG.COURSE_NODE.HOVER_RADIUS)
          .attr("cx", targetX)
          .attr("cy", targetY);

        var cpscTextEnter = courseNumbers.selectAll(".cpsc-ghost-text").data(["C340"])
          .enter()
          .append("text")
          .attr("class", "burst-text cpsc-ghost-text")
          .attr("font-family", CONFIG.COURSE_TEXT.FONT_FAMILY)
          .attr("text-anchor", "middle")
          .style("opacity", 0)
          .style("pointer-events", "none")
          .attr("transform", `translate(${startX}, ${startY})`);
          
        cpscTextEnter.append("tspan")
          .attr("class", "course-prefix")
          .attr("x", 0)
          .attr("dy", CONFIG.COURSE_TEXT.PREFIX_DY)
          .attr("font-size", CONFIG.COURSE_TEXT.PREFIX_HOVER_SIZE)
          .text("CPSC");

        cpscTextEnter.append("tspan")
          .attr("class", "course-number")
          .attr("x", 0)
          .attr("dy", CONFIG.COURSE_TEXT.NUMBER_DY)
          .attr("font-size", CONFIG.COURSE_TEXT.NUMBER_HOVER_SIZE)
          .text("340");
          
        cpscTextEnter.transition()
          .duration(burstDuration)
          .style("opacity", 1)
          .attr("transform", `translate(${targetX}, ${targetY})`);
          
        requisiteLines.append("line")
          .attr("class", "cpsc-ghost-line")
          .attr("x1", startX)
          .attr("y1", startY)
          .attr("x2", startX)
          .attr("y2", startY)
          .attr("stroke", "black")
          .attr("stroke-width", CONFIG.COURSE_NODE.STROKE_WIDTH)
          .attr("opacity", 0)
          .transition()
          .duration(burstDuration)
          .attr("x2", targetX)
          .attr("y2", targetY)
          .attr("opacity", CONFIG.LINES.HOVER_OPACITY);
      }
    }
  };

  function hideCourseInfo (event,course) {
    if (isTransitioning) return;
    if (pinnedCourseNumber) return;
    
    courseNodes.selectAll("circle")
      .interrupt()
      .transition()
      .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
      .attr("r", CONFIG.COURSE_NODE.DEFAULT_RADIUS)
      .style("opacity", 1);
    
    courseNumbers.selectAll("text")
      .interrupt()
      .transition()
      .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
      .style("opacity", 1);
    courseNumbers.selectAll("tspan.course-prefix")
      .interrupt()
      .transition()
      .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
      .attr("font-size", CONFIG.COURSE_TEXT.PREFIX_SIZE);
    courseNumbers.selectAll("tspan.course-number")
      .interrupt()
      .transition()
      .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
      .attr("font-size", CONFIG.COURSE_TEXT.NUMBER_SIZE);
    
    infoNodes.selectAll("circle")
      .interrupt()
      .transition()
      .duration(CONFIG.ANIMATIONS.HOVER_DURATION)
      .attr("r", CONFIG.COURSE_NODE.DEFAULT_RADIUS);
    
    var currentDataSource = getCurrentDataSource();
    var directPrereqs = (currentDataSource.requisites_programs || currentDataSource["requisites_program" + currentDataSource.programs[0].program_id])
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return [];
      }
      visited.add(courseNumber);
      
      var directPrereqs = (currentDataSource.requisites_programs || currentDataSource["requisites_program" + currentDataSource.programs[0].program_id])
        .filter(requisite => requisite.course_number == courseNumber)
        .map(requisite => requisite.requisite_number);
      
      var allPrereqs = [...directPrereqs];
      
      directPrereqs.forEach(prereq => {
        var chainPrereqs = getPrerequisiteChain(prereq, new Set(visited));
        allPrereqs = allPrereqs.concat(chainPrereqs);
      });
      
      return [...new Set(allPrereqs)];
    }
    
    var prerequisiteChain = prereqChainEnabled ? getPrerequisiteChain(course.course_number) : directPrereqs;
    var allCoursesToHide = [course.course_number, ...prerequisiteChain];
    
    // On hide, restore all lines to their default visible opacity
    requisiteLines
      .selectAll("line")
      .attr("opacity", CONFIG.LINES.PRIMARY_VISIBLE_OPACITY);
    
    var shouldRemoveBurst = false;
    for (let courseNum of allCoursesToHide) {
      if (equivalencies.some(eq => eq.course_number === courseNum)) {
        shouldRemoveBurst = true;
        break;
      }
    }
    if (shouldRemoveBurst) {
      courseNodes.selectAll(".burst-circle").remove();
      courseNumbers.selectAll(".burst-text").remove();
      requisiteLines.selectAll(".cpsc-ghost-line").remove();
    }
    
    // Clear the currently selected course
    currentSelectedCourse = null;
    if (appState) appState.currentSelectedCourse = null;

    if (appState && appState.currentSelectedProgram && appState.programRequirementsHTML[appState.currentSelectedProgram.program_id]) {
      courseInfoDiv.html(appState.programRequirementsHTML[appState.currentSelectedProgram.program_id]);
    } else if (currentSelectedProgram && programRequirementsHTML[currentSelectedProgram.program_id]) {
      courseInfoDiv.html(programRequirementsHTML[currentSelectedProgram.program_id]);
    }
  };

  function getHighlightedCourseNumbersFor(courseNumber) {
    var currentDataSource = getCurrentDataSource();
    var requisitesSource = currentDataSource.requisites_programs || currentDataSource["requisites_program" + currentDataSource.programs[0].program_id];

    function getPrerequisiteChain(targetCourseNumber, visited = new Set()) {
      if (visited.has(targetCourseNumber)) {
        return [];
      }
      visited.add(targetCourseNumber);

      var directPrereqs = requisitesSource
        .filter(requisite => requisite.course_number == targetCourseNumber)
        .map(requisite => requisite.requisite_number);

      var allPrereqs = [...directPrereqs];
      directPrereqs.forEach(prereq => {
        var chainPrereqs = getPrerequisiteChain(prereq, new Set(visited));
        allPrereqs = allPrereqs.concat(chainPrereqs);
      });

      return [...new Set(allPrereqs)];
    }

    var directPrereqs = requisitesSource
      .filter(requisite => requisite.course_number == courseNumber)
      .map(requisite => requisite.requisite_number);

    var prerequisiteCourses = prereqChainEnabled ? getPrerequisiteChain(courseNumber) : directPrereqs;
    return new Set([courseNumber, ...prerequisiteCourses]);
  }

  function updateCourseInteractivityCursors() {
    var hitAreas = infoNodes.selectAll("circle");
    if (!pinnedCourseNumber) {
      hitAreas.style("cursor", "pointer");
      return;
    }

    var highlightedWhilePinned = getHighlightedCourseNumbersFor(pinnedCourseNumber);
    hitAreas.style("cursor", function(d) {
      return highlightedWhilePinned.has(d.course_number) ? "pointer" : "default";
    });
  }

  function renderProgram (program,courseList,duration,dataSource) {
    if (duration > 0) {
      isTransitioning = true;
      setTimeout(() => {
        isTransitioning = false;
      }, duration * (CONFIG.TRANSITIONS.ENTER_DELAY_MULTIPLIER + 1) + CONFIG.TRANSITIONS.TRANSITION_BUFFER);
    }
    
    var currentData = dataSource || (appState && appState.data ? appState.data : data);

    var updateCoursesProgram = currentData["courses_program" + program.program_id];
    var updateRequisitesProgram = currentData.requisites_programs || currentData["requisites_program" + program.program_id];

    courseNodes
      .selectAll("circle")
      .data(updateCoursesProgram,course => course.course_number)
      .join(function (enter) {
        enter.append("circle")
          .attr("r",CONFIG.COURSE_NODE.DEFAULT_RADIUS)
          .attr("fill",CONFIG.COURSE_NODE.DEFAULT_FILL)
          .attr("stroke",CONFIG.COURSE_NODE.DEFAULT_STROKE)
          .attr("stroke-width", CONFIG.COURSE_NODE.STROKE_WIDTH)
          .style("opacity",0)
          .attr("cx",course => xcoord(course.x))
          .attr("cy",course => ycoord(course.y))
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.ENTER_DELAY_MULTIPLIER).duration(duration)
          .style("opacity",1)
          .attr("fill",course => getCourseColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke",course => getCourseStrokeColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke-width", CONFIG.COURSE_NODE.STROKE_WIDTH);
      },function (update) {
        update
          .attr("fill",course => getCourseColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke",course => getCourseStrokeColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke-width", CONFIG.COURSE_NODE.STROKE_WIDTH)
          .style("opacity", 1)
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.UPDATE_DELAY_MULTIPLIER).duration(duration)
          .attr("r", CONFIG.COURSE_NODE.DEFAULT_RADIUS)
          .attr("cx",course => xcoord(course.x))
          .attr("cy",course => ycoord(course.y));
      },function (exit) {
        exit.transition()
          .duration(duration)
          .attr("fill",CONFIG.COURSE_NODE.DEFAULT_FILL)
          .attr("stroke",CONFIG.COURSE_NODE.DEFAULT_STROKE)
          .style("opacity",0)
          .remove();
      });

    courseNumbers
      .selectAll("text")
      .data(updateCoursesProgram,course => course.course_number)
      .join(function (enter) {
        enter.append("text")
          .attr("transform", course => `translate(${xcoord(course.x)}, ${ycoord(course.y)})`)
          .attr("text-anchor","middle")
          .attr("font-family",CONFIG.COURSE_TEXT.FONT_FAMILY)
          .attr("fill",course => (course.required || courseList.includes(course.course_number)) ? "white" : "black")
          .style("opacity",0)
          .each(function(d) {
            buildCourseLabel(d3.select(this), d.course_number, {
              prefix: CONFIG.COURSE_TEXT.PREFIX_SIZE,
              number: CONFIG.COURSE_TEXT.NUMBER_SIZE
            });
          })
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.ENTER_DELAY_MULTIPLIER).duration(duration)
          .style("opacity",1);
      },function (update) {
        update
          .attr("fill",course => (course.required || courseList.includes(course.course_number)) ? "white" : "black")
          .style("opacity", 1)
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.UPDATE_DELAY_MULTIPLIER).duration(duration)
          .attr("transform", course => `translate(${xcoord(course.x)}, ${ycoord(course.y)})`);

        update
          .selectAll("tspan.course-prefix")
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.UPDATE_DELAY_MULTIPLIER).duration(duration)
          .attr("font-size", CONFIG.COURSE_TEXT.PREFIX_SIZE);

        update
          .selectAll("tspan.course-number")
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.UPDATE_DELAY_MULTIPLIER).duration(duration)
          .attr("font-size", CONFIG.COURSE_TEXT.NUMBER_SIZE);
      },function (exit) {
        exit.transition()
          .duration(duration)
          .style("opacity",0)
          .remove();
      });

    infoNodes
      .selectAll("circle")
      .data(updateCoursesProgram,course => course.course_number)
      .join("circle")
      .attr("r", function() {
        // Larger touch target on mobile/tablet
        return window.innerWidth < 1024 ? CONFIG.COURSE_NODE.DEFAULT_RADIUS + 4 : CONFIG.COURSE_NODE.DEFAULT_RADIUS;
      })
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("opacity","0")
      .style("cursor", "pointer")
      .transition()
      .delay(duration * CONFIG.TRANSITIONS.UPDATE_DELAY_MULTIPLIER).duration(duration)
      .attr("cx",course => xcoord(course.x))
      .attr("cy",course => ycoord(course.y));

    infoNodes
      .selectAll("circle")
      .on("mouseover",showCourseInfo)
      .on("mouseout",hideCourseInfo)
      .on("click touchstart", function(event, d) {
        if (isTransitioning) return;
        event.preventDefault();
        event.stopPropagation();

        if (pinnedCourseNumber && pinnedCourseNumber !== d.course_number) {
          var highlightedWhilePinned = getHighlightedCourseNumbersFor(pinnedCourseNumber);
          if (!highlightedWhilePinned.has(d.course_number)) {
            var currentDataSource = getCurrentDataSource();
            var pinnedCourseData = (currentDataSource["courses_program" + currentDataSource.programs[0].program_id] || [])
              .find(course => course.course_number == pinnedCourseNumber);
            pinnedCourseNumber = null;
            if (pinnedCourseData) {
              hideCourseInfo(event, pinnedCourseData);
            }
            updateCourseInteractivityCursors();
            return;
          }
        }

        if (pinnedCourseNumber === d.course_number) {
          pinnedCourseNumber = null;
          hideCourseInfo(event, d);
          updateCourseInteractivityCursors();
          return;
        }

        var currentlyHighlightedCourse = appState ? appState.currentSelectedCourse : currentSelectedCourse;
        var previouslyPinnedCourse = pinnedCourseNumber;
        var hadPinnedCourse = !!previouslyPinnedCourse;
        pinnedCourseNumber = d.course_number;
        // If this course is already in the hovered state, pin it without replaying animations.
        if (currentlyHighlightedCourse !== d.course_number) {
          showCourseInfo(event, d, {
            suppressAnimation: false,
            transitionFromCourse: hadPinnedCourse ? previouslyPinnedCourse : null
          });
        }
        updateCourseInteractivityCursors();
      });

    requisiteLines
      .selectAll("line")
      .data(updateRequisitesProgram,requisite => requisite.course_requisite_number)
      .join(function (enter) {
        enter.append("line")
          .attr("x1",requisite => xcoord(requisite.course_x))
          .attr("y1",requisite => ycoord(requisite.course_y))
          .attr("x2",requisite => xcoord(requisite.requisite_x))
          .attr("y2",requisite => ycoord(requisite.requisite_y))
          .attr("stroke","black")
          .attr("opacity",0)
          .attr("stroke-dasharray", requisite => requisite.requisite_is_co == 1 ? CONFIG.LINES.DASH_ARRAY : null)
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.ENTER_DELAY_MULTIPLIER).duration(duration)
          .attr("opacity", CONFIG.LINES.PRIMARY_VISIBLE_OPACITY);
      },function (update) {
        update
          .attr("stroke-dasharray", requisite => requisite.requisite_is_co == 1 ? CONFIG.LINES.DASH_ARRAY : null)
          .transition()
          .delay(duration * CONFIG.TRANSITIONS.UPDATE_DELAY_MULTIPLIER).duration(duration)
          .attr("x1",requisite => xcoord(requisite.course_x))
          .attr("y1",requisite => ycoord(requisite.course_y))
          .attr("x2",requisite => xcoord(requisite.requisite_x))
          .attr("y2",requisite => ycoord(requisite.requisite_y))
          .attr("opacity", CONFIG.LINES.PRIMARY_VISIBLE_OPACITY);
      },function (exit) {
        exit.transition()
          .duration(duration)
          .attr("opacity",0).remove();
      });

    updateCourseInteractivityCursors();

  };

  function highlight (courseList) {
    courseNodes.selectAll("circle")
      .attr("fill",course => getCourseColor(course.course_number, course.required, false))
      .attr("stroke",course => getCourseStrokeColor(course.course_number, course.required, false))
      .filter(course => courseList ? courseList.includes(course.course_number) : false)
      .attr("fill",highlightColor1)
      .attr("stroke",highlightColor1);
    courseNumbers.selectAll("text")
      .attr("fill",course => course.required ? "white" : "black")
      .filter(course => courseList ? courseList.includes(course.course_number) : false)
      .attr("fill","white");
  };

  renderProgram(programs[0],[],0);
  currentSelectedProgram = programs[0];
  
  if (programRequirementsHTML[programs[0].program_id]) {
    courseInfoDiv.html(programRequirementsHTML[programs[0].program_id]);
  }
  
  d3.select("#program-track-nav div:nth-child(1)").classed("highlight",true);
  
  setTimeout(() => {
    fitMapToView();
  }, CONFIG.ANIMATIONS.INITIAL_FIT_DELAY);
  
  var resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      var newWidth = parseInt(d3.select("#course-map").style("width"));
      var newHeight = parseInt(d3.select("#course-map").style("height")) - CONFIG.LAYOUT.CANVAS_HEIGHT_OFFSET;
      
      if (Math.abs(newWidth - width) > CONFIG.LAYOUT.RESIZE_THRESHOLD || Math.abs(newHeight - height) > CONFIG.LAYOUT.RESIZE_THRESHOLD) {
        width = newWidth;
        height = newHeight;
        
        var currentDataSource = hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
        var newScales = calculateScaling(currentDataSource);
        xscale = newScales.xscale;
        yscale = newScales.yscale;
        
        svg.attr("width", width).attr("height", height);
        
        LEGEND_CONFIG = getResponsiveLegendConfig(width, height);
        createLegend(svg, LEGEND_CONFIG, legendItemsData, width, height);
        populateHTMLLegend(legendItemsData);
        
        var currentDataSource = hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
        renderProgram(programs[0], [], CONFIG.ANIMATIONS.ZOOM_RESET_DURATION, currentDataSource);
        
        setTimeout(() => {
          fitMapToView();
        }, CONFIG.ANIMATIONS.RESIZE_FIT_DELAY);
      }
    }, CONFIG.ANIMATIONS.RESIZE_DEBOUNCE);
  });
  
  appState = {
    data: data,
    width: width,
    height: height,
    xscale: xscale,
    yscale: yscale,
    xoffset: xoffset,
    yoffset: yoffset,
    zoom: zoom,
    renderProgram: renderProgram,
    fitMapToView: fitMapToView,
    xcoord: xcoord,
    ycoord: ycoord,
    calculateScaling: function(dataSource, w, h) {
      if (!dataSource || !dataSource.courses_program1) {
        return { xscale: w / CONFIG.SCALING.DEFAULT_X_DIVISOR, yscale: h / CONFIG.SCALING.DEFAULT_Y_DIVISOR, xoffset: w / 2, yoffset: h * CONFIG.SCALING.DEFAULT_Y_OFFSET_MULTIPLIER };
      }
      const courses = dataSource.courses_program1;
      if (courses.length === 0) return { xscale: w / CONFIG.SCALING.DEFAULT_X_DIVISOR, yscale: h / CONFIG.SCALING.DEFAULT_Y_DIVISOR, xoffset: w / 2, yoffset: h * CONFIG.SCALING.DEFAULT_Y_OFFSET_MULTIPLIER };
      const xCoords = courses.map(c => c.x);
      const yCoords = courses.map(c => c.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      const xRange = maxX - minX;
      const yRange = maxY - minY;
      const padding = CONFIG.SCALING.PADDING_RATIO;
      const usableWidth = w * (1 - padding);
      const usableHeight = h * (1 - padding);
      const mobileScaleBoost = window.innerWidth < 768
        ? (currentDepartment === 'dsci' ? 1.6 : 1.4)
        : 1;
      const xs = (xRange > 0 ? usableWidth / xRange : w / CONFIG.SCALING.DEFAULT_X_DIVISOR) * mobileScaleBoost;
      const ys = (yRange > 0 ? usableHeight / yRange : h / CONFIG.SCALING.DEFAULT_Y_DIVISOR) * mobileScaleBoost;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      return {
        xscale: xs,
        yscale: ys,
        xoffset: w / 2 - centerX * xs,
        yoffset: isMobileView() ? h / 2 - centerY * ys : h / 2 + centerY * ys
      };
    },
    currentSelectedProgram: currentSelectedProgram,
    currentSelectedCourse: currentSelectedCourse,
    clearInteractionState: function() {
      pinnedCourseNumber = null;
      currentSelectedCourse = null;
      this.currentSelectedCourse = null;
      updateCourseInteractivityCursors();
    },
    programRequirementsHTML: programRequirementsHTML,
    screenToData: function(screenX, screenY) {
      const transform = d3.zoomTransform(svg.node());
      const localX = (screenX - transform.x) / transform.k;
      const localY = (screenY - transform.y) / transform.k;
      return {
        x: (localX - this.xoffset) / this.xscale,
        y: isMobileView() ? (localY - this.yoffset) / this.yscale : (this.yoffset - localY) / this.yscale
      };
    },
    dataToScreen: function(dataX, dataY) {
      return {
        x: dataX * this.xscale + this.xoffset,
        y: isMobileView() ? dataY * this.yscale + this.yoffset : this.yoffset - dataY * this.yscale
      };
    },
    layers: {
      svg: svg,
      zoomContainer: zoomContainer,
      requisiteLines: requisiteLines,
      courseNodes: courseNodes,
      courseNumbers: courseNumbers,
      infoNodes: infoNodes
    }
  };
}

// Initialize with Data Science by default
loadDepartmentData('stats', true);