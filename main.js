// Global variable to track current department and store the initialization function
var currentDepartment = 'dsci';
var initializeApp = null;
var isTransitioning = false;

function loadDepartmentData(department) {
  if (isTransitioning || department === currentDepartment) return;
  isTransitioning = true;
  
  var dataFile = department === 'stats' ? 'data/data.json' : 'data/dsci_data.json';
  currentDepartment = department;
  
  var transitionDuration = 300;
  
  // Fade out existing content
  d3.select("#course-map").transition().duration(transitionDuration).style("opacity", 0);
  d3.select("#program-track-nav").transition().duration(transitionDuration).style("opacity", 0);
  d3.select("#course-info").transition().duration(transitionDuration).style("opacity", 0);
  
  // After fade out, clear and load new data
  setTimeout(function() {
    d3.select("#course-map svg").selectAll("*").remove();
    d3.select("#program-track-nav").html("");
    d3.select("#course-info").html("");
    
    // Keep opacity at 0 before loading new content
    d3.select("#course-map").style("opacity", 0);
    d3.select("#program-track-nav").style("opacity", 0);
    d3.select("#course-info").style("opacity", 0);
    
    loadNewData(dataFile, transitionDuration);
  }, transitionDuration);
}

function loadNewData(dataFile, transitionDuration) {
  d3.json(dataFile).then(function(data) {
  const courses = data.courses;
  const requisites = data.requisites;
  const programs = data.programs;
  const tracks = data.tracks;
  const coursesTracks = data.courses_tracks;
  const reflections = data.reflections;
  const equivalencies = data.equivalencies;

  // Color configuration - change colors here to update both nodes and legend
  var courseColors = {
    'S': { color: "#00a896", label: "STAT" },  
    'M': { color: "#e84855", label: "MATH" }, 
    'D': { color: "#FF7D00", label: "DSCI" },
    'C': { color: "#6a4c93", label: "CPSC" }
  };

  var width = parseInt(d3.select("#course-map").style("width"));
  var height = parseInt(d3.select("#course-map").style("height")) - 20;
  
  // Function to calculate scaling based on data coordinate ranges
  function calculateScaling(dataSource) {
    if (!dataSource || !dataSource.courses_program1) {
      // Fallback for original data
      return {
        xscale: width / 10,
        yscale: height / 8
      };
    }
    
    const courses = dataSource.courses_program1;
    if (courses.length === 0) return { xscale: width / 10, yscale: height / 8 };
    
    // Find the actual coordinate ranges in the data
    const xCoords = courses.map(c => c.x);
    const yCoords = courses.map(c => c.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    // Calculate ranges
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    
    // Add some padding (20% on each side)
    const padding = 0.2;
    const usableWidth = width * (1 - padding);
    const usableHeight = height * (1 - padding);
    
    // Calculate scale to fit the data with padding
    return {
      xscale: xRange > 0 ? usableWidth / xRange : width / 10,
      yscale: yRange > 0 ? usableHeight / yRange : height / 8
    };
  }
  
  // Initial scaling for original data
  var scales = calculateScaling(data);
  var xscale = scales.xscale;
  var yscale = scales.yscale;
  
  // Coordinate transformation functions (zoom transform applied to container)
  function xcoord(x) { return x * xscale + width / 2; }
  function ycoord(y) { return height - y * yscale; }
  
  var svg = d3.select("#course-map svg").attr("width",width).attr("height",height);
  var highlightColor1 = "rgb(0, 85, 183)";

  // Add checkboxes for prerequisite lines and fill circle
  var linesVisible = true; // Default state - lines visible
  var prereqChainEnabled = false; // Default state - prerequisite chain highlighting disabled
  var burstEffectsEnabled = true; // Default state - burst effects enabled
  var hierarchicalLayout = false; // Default state - use original layout
  
  // Create checkbox container in bottom right of SVG canvas
  var checkboxContainer = svg.append("foreignObject")
    .attr("x", width - 180)
    .attr("y", height - 60)
    .attr("width", 170)
    .attr("height", 50)
    .append("xhtml:div")
    .style("background", "rgba(255, 255, 255, 0.9)")
    .style("padding", "6px 10px")
    .style("font-family", "Arial")
    .style("font-size", "12px")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "6px")
    .style("user-select", "none");

  // First checkbox row for lines
  var linesRow = checkboxContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px")
    .style("cursor", "pointer");

  var linesCheckbox = linesRow.append("input")
    .attr("type", "checkbox")
    .attr("checked", linesVisible)
    .style("cursor", "pointer");

  linesRow.append("span")
    .text("TESTING: show lines")
    .style("color", "#333")
    .style("cursor", "pointer");


  // COMMENTED OUT - TESTING COMPLETE
  /*
  // Third checkbox row for prerequisite chain
  var chainRow = checkboxContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px")
    .style("cursor", "pointer");

  var chainCheckbox = chainRow.append("input")
    .attr("type", "checkbox")
    .property("checked", prereqChainEnabled)
    .style("cursor", "pointer");

  chainRow.append("span")
    .text("TESTING: prereq chain")
    .style("color", "#333")
    .style("cursor", "pointer");

  // Fourth checkbox row for burst effects
  var burstRow = checkboxContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px")
    .style("cursor", "pointer");

  var burstCheckbox = burstRow.append("input")
    .attr("type", "checkbox")
    .attr("checked", burstEffectsEnabled)
    .style("cursor", "pointer");

  burstRow.append("span")
    .text("TESTING: burst effects")
    .style("color", "#333")
    .style("cursor", "pointer");

  // Fifth checkbox row for hierarchical layout
  var hierarchicalRow = checkboxContainer.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px")
    .style("cursor", "pointer");

  var hierarchicalCheckbox = hierarchicalRow.append("input")
    .attr("type", "checkbox")
    .property("checked", hierarchicalLayout)
    .style("cursor", "pointer");

  hierarchicalRow.append("span")
    .text("TESTING: hierarchical")
    .style("color", "#333")
    .style("cursor", "pointer");
  */

  // Add click handlers for checkboxes
  linesRow.on("click", function(event) {
    if (event.target.tagName !== 'INPUT') {
      linesCheckbox.property("checked", !linesCheckbox.property("checked"));
    }
    linesVisible = linesCheckbox.property("checked");
    updateLineVisibility();
  });

  // COMMENTED OUT - TESTING COMPLETE
  /*
  chainRow.on("click", function(event) {
    if (event.target.tagName !== 'INPUT') {
      chainCheckbox.property("checked", !chainCheckbox.property("checked"));
    }
    prereqChainEnabled = chainCheckbox.property("checked");
  });

  burstRow.on("click", function(event) {
    if (event.target.tagName !== 'INPUT') {
      burstCheckbox.property("checked", !burstCheckbox.property("checked"));
    }
    burstEffectsEnabled = burstCheckbox.property("checked");
  });

  hierarchicalRow.on("click", function(event) {
    if (event.target.tagName !== 'INPUT') {
      hierarchicalCheckbox.property("checked", !hierarchicalCheckbox.property("checked"));
    }
    hierarchicalLayout = hierarchicalCheckbox.property("checked");
    
    // Switch to hierarchical layout if available
    if (hierarchicalLayout && hierarchicalData) {
      console.log("Switching to hierarchical layout");
      // Recalculate scaling for hierarchical data
      var newScales = calculateScaling(hierarchicalData);
      xscale = newScales.xscale;
      yscale = newScales.yscale;
      renderProgram(programs[0], [], 600, hierarchicalData);
      // Fit the map to view after layout switch
      setTimeout(() => {
        fitMapToView();
      }, 700); // Wait for transition to complete
    } else {
      console.log("Switching to original layout");
      // Recalculate scaling for original data
      var newScales = calculateScaling(data);
      xscale = newScales.xscale;
      yscale = newScales.yscale;
      renderProgram(programs[0], [], 600, data);
      // Fit the map to view after layout switch
      setTimeout(() => {
        fitMapToView();
      }, 700); // Wait for transition to complete
    }
  });
  */

  function updateLineVisibility() {
    requisiteLines.selectAll("line")
      .attr("opacity", function(d) {
        if (linesVisible) {
          return d.requisite_is_primary == 1 ? 0.2 : 0;
        } else {
          return 0;
        }
      });
  }

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

  // Helper functions for course type detection and coloring
  function getCourseType(courseNumber) {
    var firstChar = courseNumber.toString().charAt(0).toUpperCase();
    return firstChar;
  }
  
  function getCourseColor(courseNumber, isRequired, isInList) {
    if (isRequired || isInList) {
      // Fill required courses with their specific color
      var courseType = getCourseType(courseNumber);
      return courseColors[courseType] ? courseColors[courseType].color : highlightColor1;
    }
    // By default, only show outline (fill is white)
    return "white";
  }
  
  function getCourseStrokeColor(courseNumber, isRequired, isInList) {
    var courseType = getCourseType(courseNumber);
    if (isRequired || isInList) {
      // Outline for required/filled courses is their specific color
      return courseColors[courseType] ? courseColors[courseType].color : highlightColor1;
    }
    return courseColors[courseType] ? courseColors[courseType].color : "black";
  }
  
  function getNumericPart(courseNumber) {
    return courseNumber.toString().substring(1);
  }

  // Helper function to get current data source
  function getCurrentDataSource() {
    return hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
  }

  // Create zoom container group
  var zoomContainer = svg.append("g").attr("class", "zoom-container");
  
  // Add all drawing groups to the zoom container
  var requisiteLines = zoomContainer.append("g");
  var courseNodes = zoomContainer.append("g");
  var courseNumbers = zoomContainer.append("g");
  var infoNodes = zoomContainer.append("g");
  
  // Define zoom behavior
  var zoom = d3.zoom()
    .scaleExtent([0.1, 5]) // Allow zoom from 10% to 500%
    .on("start", function(event) {
      // Show grabbing cursor when starting to pan
      if (event.sourceEvent && event.sourceEvent.type === "mousedown") {
        svg.style("cursor", "grabbing");
      }
    })
    .on("zoom", function(event) {
      zoomContainer.attr("transform", event.transform);
    })
    .on("end", function(event) {
      // Return to normal cursor when done panning
      svg.style("cursor", "default");
    });
  
  // Apply zoom behavior to SVG and set default cursor
  svg.call(zoom)
    .style("cursor", "default");

  // Function to fit the entire map in the viewport
  function fitMapToView() {
    // Get all course nodes to calculate bounds
    const nodes = svg.selectAll(".zoom-container circle").nodes();
    if (nodes.length === 0) return;

    // Calculate bounding box of all nodes
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

    // Add padding
    const padding = 50;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    // Calculate scale to fit content in viewport
    const scaleX = width / contentWidth;
    const scaleY = height / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    // Calculate translation to center the content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const translateX = width / 2 - centerX * scale;
    const translateY = height / 2 - centerY * scale;

    // Apply the transform
    const transform = d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    svg.call(zoom.transform, transform);
  }

  // ============================================================================
  // LEGEND CONFIGURATION AND CREATION
  // ============================================================================
  
  /**
   * Get responsive legend configuration based on viewport size
   * Scales the legend appropriately for different screen sizes
   */
  function getResponsiveLegendConfig(viewportWidth, viewportHeight) {
    // Define breakpoints
    const isSmall = viewportWidth < 1000;
    const isMedium = viewportWidth >= 1000 && viewportWidth < 1400;
    const isLarge = viewportWidth >= 1400;
    
    // Base configuration that scales with viewport
    const baseConfig = {
      // Spacing & Sizing (scales with viewport)
      padding: isSmall ? 
        { top: 10, right: 10, bottom: 10, left: 15 } : 
        isMedium ? 
        { top: 15, right: 15, bottom: 15, left: 20 } :
        { top: 18, right: 18, bottom: 18, left: 25 },
      
      margin: { 
        fromEdge: isSmall ? 10 : isMedium ? 15 : 20 
      },
      
      rowHeight: isSmall ? 18 : isMedium ? 22 : 24,
      rowSpacing: 0,
      
      // Icon properties (scale with viewport)
      circle: { 
        radius: isSmall ? 5 : isMedium ? 6 : 7, 
        strokeWidth: 1.25 
      },
      line: { 
        length: isSmall ? 35 : isMedium ? 42 : 50, 
        strokeWidth: isSmall ? 1.5 : 2, 
        y: isSmall ? 7 : isMedium ? 9 : 10 
      },
      
      // Positioning within each row (scales with viewport)
      icon: { 
        x: isSmall ? 30 : isMedium ? 38 : 45, 
        y: isSmall ? 7 : isMedium ? 9 : 10 
      },
      label: { 
        x: isSmall ? 65 : isMedium ? 83 : 100, 
        y: isSmall ? 7 : isMedium ? 9 : 10, 
        dy: "0.35em" 
      },
      
      // Styling (font size scales with viewport)
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
      
      // Content width scales with viewport - increased to fit all text
      contentWidth: isSmall ? 210 : isMedium ? 245 : 280,
      
      // Position anchor point
      anchor: "top-right"
    };
    
    return baseConfig;
  }
  
  // Get initial responsive config
  var LEGEND_CONFIG = getResponsiveLegendConfig(width, height);
  
  // Find which course types actually exist in the data
  const existingCourseTypes = new Set(courses.map(c => c.course_number.charAt(0)));
  
  // Filter courseColors to only include types that exist
  const filteredCourseColors = Object.keys(courseColors)
    .filter(key => existingCourseTypes.has(key))
    .reduce((obj, key) => {
      obj[key] = courseColors[key];
      return obj;
    }, {});
  
  // Define legend items as data
  const legendData = Object.keys(filteredCourseColors).map(key => filteredCourseColors[key]);
  const legendItemsData = [
    ...legendData.map((courseType, index) => ({
      type: 'course-type',
      color: courseType.color,
      label: courseType.label,
      index: index
    })),
    {
      type: 'required',
      colors: legendData.map(d => d.color),
      label: 'Required Course'
    },
    {
      type: 'line-solid',
      label: 'Recommended Prerequisites'
    },
    {
      type: 'line-dashed',
      label: 'Alternative Prerequisites'
    }
  ];
  
  /**
   * Calculate legend dimensions based on content
   */
  function calculateLegendDimensions(config, itemsData) {
    const numRows = itemsData.length;
    const contentHeight = numRows * (config.rowHeight + config.rowSpacing);
    const contentWidth = config.contentWidth; // Use responsive width from config
    
    const totalWidth = contentWidth + config.padding.left + config.padding.right;
    const totalHeight = contentHeight + config.padding.top + config.padding.bottom;
    
    return {
      width: totalWidth,
      height: totalHeight,
      contentWidth: contentWidth,
      contentHeight: contentHeight
    };
  }
  
  /**
   * Calculate legend position based on anchor point and SVG dimensions
   */
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
  
  /**
   * Create or update the legend
   */
  function createLegend(svg, config, itemsData, svgWidth, svgHeight) {
    // Calculate dimensions and position
    const dimensions = calculateLegendDimensions(config, itemsData);
    const position = calculateLegendPosition(config, dimensions, svgWidth, svgHeight);
    
    // Remove existing legend if it exists
    svg.select(".legend").remove();
    
    // Create legend group
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${position.x}, ${position.y})`);
    
    // Add background
    legend.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("fill", config.background.fill)
      .attr("stroke", config.background.stroke)
      .attr("stroke-width", config.background.strokeWidth)
      .attr("rx", config.background.borderRadius);
    
    // Create groups for each legend item
    const itemGroups = legend.selectAll(".legend-item")
      .data(itemsData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => {
        const y = config.padding.top + i * (config.rowHeight + config.rowSpacing);
        return `translate(${config.padding.left}, ${y})`;
      });
    
    // Render items based on type
    itemGroups.each(function(d, i) {
      const group = d3.select(this);
      
      if (d.type === 'course-type') {
        // Outline circle for course types
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
        // Multiple filled circles for required courses
        const numCircles = d.colors.length;
        const circleSpacing = 22;
        const startX = config.icon.x - ((numCircles - 1) * circleSpacing) / 2;
        
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
        // Solid line for recommended prerequisites
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
        // Dashed line for alternative prerequisites
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
  
  /**
   * Update legend position (for resize events)
   */
  function updateLegendPosition(svg, config, itemsData, svgWidth, svgHeight) {
    const dimensions = calculateLegendDimensions(config, itemsData);
    const position = calculateLegendPosition(config, dimensions, svgWidth, svgHeight);
    
    svg.select(".legend")
      .attr("transform", `translate(${position.x}, ${position.y})`);
  }
  
  // Create the legend initially
  var legendInfo = createLegend(svg, LEGEND_CONFIG, legendItemsData, width, height);

  var courseMapDiv = d3.select("#course-map");
  // program-info-more and related divs removed
  var courseInfoDiv = d3.select("#course-info");
  var courseInfoTemplate = _.template(d3.select("#course-info-template").html());
  var programNav = d3.select("#program-track-nav");
  
  // Track currently selected program (defaults to program_id 1 = "All Courses")
  var currentSelectedProgram = null;
  
  // Build a lookup for program requirements HTML from data
  // Two possible sources: programs.requirements_html OR program_requirements sheet
  var programRequirementsHTML = {};
  
  // Option 1: If requirements_html column exists in programs sheet
  programs.forEach(function(program) {
    if (program.requirements_html && program.requirements_html.trim() !== '') {
      programRequirementsHTML[program.program_id] = program.requirements_html;
    }
  });
  
  // Option 2: If separate program_requirements sheet exists
  if (data.program_requirements) {
    data.program_requirements.forEach(function(req) {
      if (req.html_content && req.html_content.trim() !== '') {
        programRequirementsHTML[req.program_id] = req.html_content;
      }
    });
  }
  
  programs.forEach(function(program){
    programNav.append("div").classed("program",true).html(program.name).on("click",function (event) {
      d3.select("#program-track-nav div.highlight").classed("highlight",false);
      d3.select(this).classed("highlight",true);
      
      // Store the currently selected program
      currentSelectedProgram = program;
      
      renderProgram(program,[],600);
      
      // Show program-specific HTML content from data
      if (programRequirementsHTML[program.program_id]) {
        courseInfoDiv.html(programRequirementsHTML[program.program_id]);
      }
    });
  });

  function showCourseInfo (event,course) {
    // Interrupt and reset all transitions to ensure new highlight always appears
    courseNodes.selectAll("circle")
      .interrupt()
      .attr("r", 12)
      .style("opacity", 1);
    courseNumbers.selectAll("text")
      .interrupt()
      .attr("font-size", 11)
      .style("opacity", 1);
    infoNodes.selectAll("circle")
      .interrupt()
      .attr("r", 12);
    var courseInfo = courses.find(d => d.course_number == course.course_number);
    var requisiteInfo = requisites.filter(r => r.course_number == course.course_number);
    
    // Determine course prefix based on first character of course number
    var courseNumberStr = course.course_number.toString();
    var firstChar = courseNumberStr.charAt(0).toUpperCase();
    var coursePrefix = "";
    
    if (firstChar === 'S') {
      coursePrefix = "STAT";
    } else if (firstChar === 'M') {
      coursePrefix = "MATH";
    } else if (firstChar === 'D') {
      coursePrefix = "DSCI";
    }
    
    // Remove the first character from the course number
    var numericPart = courseNumberStr.substring(1);
    
    var courseInfoObject = {"number": coursePrefix + " " + numericPart + ":",
                            "title": courseInfo.title,
                            "description": courseInfo.description,
                            "prereqs": requisiteInfo.filter(requisite => requisite.type == "pre"),
                            "coreqs": requisiteInfo.filter(requisite => requisite.type == "co"),
                            "notes": courseInfo.notes};
    courseInfoDiv.html(courseInfoTemplate(courseInfoObject));
    
    // Get direct prerequisites for this course
    var currentDataSource = getCurrentDataSource();
    var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    // Get prerequisite course numbers for this course (including recursive prereqs if enabled)
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return []; // Prevent infinite loops
      }
      visited.add(courseNumber);
      
      var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
        .filter(requisite => requisite.course_number == courseNumber)
        .map(requisite => requisite.requisite_number);
      
      var allPrereqs = [...directPrereqs];
      
      // Recursively get prerequisites of prerequisites
      directPrereqs.forEach(prereq => {
        var chainPrereqs = getPrerequisiteChain(prereq, new Set(visited));
        allPrereqs = allPrereqs.concat(chainPrereqs);
      });
      
      return [...new Set(allPrereqs)]; // Remove duplicates
    }
    
    var prerequisiteCourses = prereqChainEnabled ? getPrerequisiteChain(course.course_number) : directPrereqs;
    
    // Add the current course to the list
    var coursesToHighlight = [course.course_number, ...prerequisiteCourses];
    
    // Make the hovered course and its prerequisites bigger
    courseNodes.selectAll("circle")
      .filter(d => coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .attr("r", 16); // Increase from 12 to 16
    
    // Reduce opacity of all other courses
    courseNodes.selectAll("circle")
      .filter(d => !coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .style("opacity", 0.3);
    
    // Make the course numbers bigger too
    courseNumbers.selectAll("text")
      .filter(d => coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .attr("font-size", 14); // Increase from 11 to 14
    
    // Reduce opacity of other course numbers
    courseNumbers.selectAll("text")
      .filter(d => !coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .style("opacity", 0.3);
    
    // Update invisible info nodes to match
    infoNodes.selectAll("circle")
      .filter(d => coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .attr("r", 16);
    
    // Show prerequisite lines for this course and its chain when hovering, regardless of toggle state
    // When chain is enabled: show all lines within the highlighted set
    // When chain is disabled: only show lines directly from the hovered course to its direct prereqs
    if (prereqChainEnabled) {
      coursesToHighlight.forEach(courseNum => {
        requisiteLines.selectAll("line")
          .filter(requisite => requisite.course_number == courseNum && coursesToHighlight.includes(requisite.requisite_number))
          .attr("opacity", 1)
          .attr("stroke-dasharray", function(requisite) {
            return requisite.requisite_is_primary == 1 ? null : "6,4";
          });
      });
    } else {
      // Only show lines from the hovered course to its direct prerequisites
      requisiteLines.selectAll("line")
        .filter(requisite => requisite.course_number == course.course_number && directPrereqs.includes(requisite.requisite_number))
        .attr("opacity", 1)
        .attr("stroke-dasharray", function(requisite) {
          return requisite.requisite_is_primary == 1 ? null : "6,4";
        });
    }
    
    // Check for burst effect based on equivalencies data
    // Find all prerequisites (not including the hovered course) that have equivalencies defined
    var allBurstData = [];
    if (burstEffectsEnabled) {
      for (let courseNum of prerequisiteCourses) { // Only prereqs, not hovered course
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
    
    // Create burst effects for all courses that have equivalencies
    allBurstData.forEach((burstInfo, courseIndex) => {
      // Limit to first 4 equivalencies to match the original design
      var equivalenciesToShow = burstInfo.equivalencies.slice(0, 4);

      // Determine fill state of the original course dynamically
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
          // If original is filled, use bursting course's color; if outline, use white
          return originalFill !== "white" ? (courseColors[courseType] ? courseColors[courseType].color : "#ffba49") : "white";
        })
        .attr("stroke", function(d) {
          var courseType = getCourseType(d);
          return courseColors[courseType] ? courseColors[courseType].color : "#ffba49";
        })
        .attr("stroke-width", 1.25)
        .transition()
        .duration(300)
        .attr("r", 16)
        .attr("cx", function(d, i) {
          // Lay out burst circles in a horizontal line to the right with reduced spacing
          return xcoord(burstInfo.data.x) + 60 + i * 45;
        })
        .attr("cy", function(d, i) {
          // All on the same y level as the main course
          return ycoord(burstInfo.data.y);
        });

      // Add text to burst circles showing the actual course numbers
      var burstText = courseNumbers.selectAll(`.burst-text-${courseIndex}`)
        .data(equivalenciesToShow);

      burstText.enter()
        .append("text")
        .attr("class", `burst-text burst-text-${courseIndex}`)
        .attr("x", xcoord(burstInfo.data.x))
        .attr("y", ycoord(burstInfo.data.y))
        .attr("text-anchor", "middle")
        .attr("dy", "2.5px")
        .attr("font-family", "Arial")
        .attr("font-size", 14)
        .attr("fill", function(d) {
          var courseType = getCourseType(d);
          var burstFill = originalFill !== "white" ? (courseColors[courseType] ? courseColors[courseType].color : "#ffba49") : "white";
          return burstFill !== "white" ? "white" : "black";
        })
        .attr("opacity", 0)
        .text(d => getNumericPart(d))
        .transition()
        .duration(300)
        .attr("opacity", 1)
        .attr("x", function(d, i) {
          // Lay out burst text in a horizontal line to the right with reduced spacing
          return xcoord(burstInfo.data.x) + 60 + i * 45;
        })
        .attr("y", function(d, i) {
          // All on the same y level as the main course
          return ycoord(burstInfo.data.y);
        });
    });
  };

  function hideCourseInfo (event,course) {
    // Return course circles to normal size - interrupt any ongoing transitions
    courseNodes.selectAll("circle")
      .interrupt()
      .transition()
      .duration(200)
      .attr("r", 12) // Back to normal size for ALL courses
      .style("opacity", 1); // Restore opacity
    
    // Return course numbers to normal size - interrupt any ongoing transitions
    courseNumbers.selectAll("text")
      .interrupt()
      .transition()
      .duration(200)
      .attr("font-size", 11) // Back to normal size for ALL course numbers
      .style("opacity", 1); // Restore opacity
    
    // Return invisible info nodes to normal size - interrupt any ongoing transitions
    infoNodes.selectAll("circle")
      .interrupt()
      .transition()
      .duration(200)
      .attr("r", 12); // Back to normal size for ALL info nodes
    
    // Hide the prerequisite lines when hover ends
    // Get direct prerequisites for this course
    var currentDataSource = getCurrentDataSource();
    var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return []; // Prevent infinite loops
      }
      visited.add(courseNumber);
      
      var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
        .filter(requisite => requisite.course_number == courseNumber)
        .map(requisite => requisite.requisite_number);
      
      var allPrereqs = [...directPrereqs];
      
      // Recursively get prerequisites of prerequisites
      directPrereqs.forEach(prereq => {
        var chainPrereqs = getPrerequisiteChain(prereq, new Set(visited));
        allPrereqs = allPrereqs.concat(chainPrereqs);
      });
      
      return [...new Set(allPrereqs)]; // Remove duplicates
    }
    
    var prerequisiteChain = prereqChainEnabled ? getPrerequisiteChain(course.course_number) : directPrereqs;
    var allCoursesToHide = [course.course_number, ...prerequisiteChain];
    
    // Hide lines based on the same logic as showing them
    if (prereqChainEnabled) {
      allCoursesToHide.forEach(courseNum => {
        requisiteLines
          .selectAll("line")
          .filter(requisite => requisite.course_number == courseNum && allCoursesToHide.includes(requisite.requisite_number))
          .attr("opacity", linesVisible ? (requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0) : 0);
      });
    } else {
      // Only hide lines from the hovered course to its direct prerequisites
      requisiteLines
        .selectAll("line")
        .filter(requisite => requisite.course_number == course.course_number && directPrereqs.includes(requisite.requisite_number))
        .attr("opacity", linesVisible ? (requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0) : 0);
    }
    
    // Remove burst circles if any course in the chain has equivalencies
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
    }

    // Reset course info panel to selected program's HTML
    if (currentSelectedProgram && programRequirementsHTML[currentSelectedProgram.program_id]) {
      courseInfoDiv.html(programRequirementsHTML[currentSelectedProgram.program_id]);
    }
  };

  function renderProgram (program,courseList,duration,dataSource) {
    // Use provided data source or fall back to original data
    var currentData = dataSource || data;

    var updateCoursesProgram = currentData["courses_program" + program.program_id];
    var updateRequisitesProgram = currentData["requisites_program" + program.program_id];

    courseNodes
      .selectAll("circle")
      .data(updateCoursesProgram,course => course.course_number)
      .join(function (enter) {
        enter.append("circle")
          .attr("r",12)
          .attr("fill","white")
          .attr("stroke","rgba(0,0,0,0)")
          .attr("opacity",0)
          .attr("cx",course => xcoord(course.x))
          .attr("cy",course => ycoord(course.y))
          .transition()
          .delay(2*duration).duration(duration)
          .style("opacity",1)
          .attr("fill",course => getCourseColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke",course => getCourseStrokeColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke-width", 1.25);
      },function (update) {
        update
          .attr("fill",course => getCourseColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke",course => getCourseStrokeColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke-width", 1.25)
          .transition()
          .delay(duration).duration(duration)
          .attr("cx",course => xcoord(course.x))
          .attr("cy",course => ycoord(course.y));
      },function (exit) {
        exit.transition()
          .duration(duration)
          .attr("fill","white")
          .attr("stroke","rgba(0,0,0,0)")
          .attr("opacity",0)
          .remove();
      });

    courseNumbers
      .selectAll("text")
      .data(updateCoursesProgram,course => course.course_number)
      .join(function (enter) {
        enter.append("text")
          .attr("x",course => xcoord(course.x))
          .attr("y",course => ycoord(course.y))
          .attr("text-anchor","middle").attr("dy","2.5px")
          .attr("font-family","Arial").attr("font-size",11)
          .attr("fill",course => (course.required || courseList.includes(course.course_number)) ? "white" : "black")
          .attr("opacity",0)
          .text(d => getNumericPart(d.course_number))
          .transition()
          .delay(2*duration).duration(duration)
          .attr("opacity",1);
      },function (update) {
        update
          .attr("fill",course => (course.required || courseList.includes(course.course_number)) ? "white" : "black")
          .transition()
          .delay(duration).duration(duration)
          .attr("x",course => xcoord(course.x))
          .attr("y",course => ycoord(course.y));
      },function (exit) {
        exit.transition()
          .duration(duration)
          .attr("fill","rgba(0,0,0,0)").remove();
      });

    infoNodes
      .selectAll("circle")
      .data(updateCoursesProgram,course => course.course_number)
      .join("circle")
      .attr("r", 12).style("opacity","0").style("stroke-opacity",0)
      .transition()
      .delay(duration).duration(duration)
      .attr("cx",course => xcoord(course.x))
      .attr("cy",course => ycoord(course.y));

    infoNodes
      .selectAll("circle")
      .on("mouseover",showCourseInfo)
      .on("mouseout",hideCourseInfo);

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
          .transition()
          .delay(2*duration).duration(duration)
          .attr("opacity",requisite => linesVisible ? (requisite.requisite_is_primary == 1 ? 0.2 : 0) : 0);
      },function (update) {
        update
          .transition()
          .delay(duration).duration(duration)
          .attr("x1",requisite => xcoord(requisite.course_x))
          .attr("y1",requisite => ycoord(requisite.course_y))
          .attr("x2",requisite => xcoord(requisite.requisite_x))
          .attr("y2",requisite => ycoord(requisite.requisite_y))
          .attr("opacity",requisite => linesVisible ? (requisite.requisite_is_primary == 1 ? 0.2 : 0) : 0);
      },function (exit) {
        exit.transition()
          .duration(duration)
          .attr("opacity",0).remove();
      });

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
  currentSelectedProgram = programs[0]; // Set initial selected program
  
  // Set initial HTML content for "All Courses" program
  if (programRequirementsHTML[programs[0].program_id]) {
    courseInfoDiv.html(programRequirementsHTML[programs[0].program_id]);
  }
  
  var reflection = _.sample(reflections.filter(reflection => reflection.program_id == 1));
  d3.select("#program-track-nav div:nth-child(1)").classed("highlight",true);
  
  // Fit the map to view after initial render
  setTimeout(() => {
    fitMapToView();
  }, 100); // Small delay to ensure rendering is complete
  
  // Add resize listener for responsive scaling
  var resizeTimeout;
  window.addEventListener('resize', function() {
    // Debounce resize events
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      // Recalculate dimensions
      var newWidth = parseInt(d3.select("#course-map").style("width"));
      var newHeight = parseInt(d3.select("#course-map").style("height")) - 20;
      
      // Only update if dimensions actually changed significantly
      if (Math.abs(newWidth - width) > 50 || Math.abs(newHeight - height) > 50) {
        // Update dimensions and recalculate scaling based on current data
        width = newWidth;
        height = newHeight;
        
        // Recalculate scaling for current data source
        var currentDataSource = hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
        var newScales = calculateScaling(currentDataSource);
        xscale = newScales.xscale;
        yscale = newScales.yscale;
        
        // Update SVG dimensions
        svg.attr("width", width).attr("height", height);
        
        // Recalculate responsive legend config and recreate legend
        LEGEND_CONFIG = getResponsiveLegendConfig(width, height);
        createLegend(svg, LEGEND_CONFIG, legendItemsData, width, height);
        
        // Update checkbox container position
        checkboxContainer.attr("x", width - 180);
        
        // Re-render with new coordinates
        var currentDataSource = hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
        renderProgram(programs[0], [], 300, currentDataSource); // Shorter transition for resize
        
        // Fit the map to the new viewport size
        setTimeout(() => {
          fitMapToView();
        }, 350); // Wait for transition to complete
      }
    }, 150); // 150ms debounce
  });
  
  // Fade in new content
  if (transitionDuration > 0) {
    d3.select("#course-map").transition().duration(transitionDuration).style("opacity", 1);
    d3.select("#program-track-nav").transition().duration(transitionDuration).style("opacity", 1);
    d3.select("#course-info").transition().duration(transitionDuration).style("opacity", 1);
  } else {
    d3.select("#course-map").style("opacity", 1);
    d3.select("#program-track-nav").style("opacity", 1);
    d3.select("#course-info").style("opacity", 1);
  }
  
  isTransitioning = false;
});
}

// Initial load (no transition needed)
function initialLoad() {
  var dataFile = currentDepartment === 'stats' ? 'data/data.json' : 'data/dsci_data.json';
  loadNewData(dataFile, 0);
}

initialLoad();