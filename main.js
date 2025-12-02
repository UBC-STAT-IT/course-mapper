var currentDepartment = 'stats';
var appState = null;

function loadDepartmentData(department, isInitialLoad) {
  var dataFile = department === 'stats' ? 'data/data.json' : 'data/dsci_data.json';
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
        programNav.selectAll("div").classed("highlight", false);
        d3.select(this).classed("highlight", true);
        appState.currentSelectedProgram = program;
        appState.renderProgram(program, [], 600, newData);
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
  appState.programRequirementsHTML = programRequirementsHTML;
  
  var svg = d3.select("#course-map svg");
  svg.transition().duration(300).call(appState.zoom.transform, d3.zoomIdentity);
  
  appState.renderProgram(programs[0], [], 600, newData);
  
  setTimeout(() => {
    appState.fitMapToView(true);
  }, 1300);
}

function initializeVisualization(data) {
  const courses = data.courses;
  const requisites = data.requisites;
  const programs = data.programs;
  const tracks = data.tracks;
  const coursesTracks = data.courses_tracks;
  const reflections = data.reflections;
  const equivalencies = data.equivalencies;

  var courseColors = {
    'S': { color: "#00a896", label: "STAT" },  
    'M': { color: "#e84855", label: "MATH" }, 
    'D': { color: "#FF7D00", label: "DSCI" },
    'C': { color: "#6a4c93", label: "CPSC" }
  };

  var width = parseInt(d3.select("#course-map").style("width"));
  var height = parseInt(d3.select("#course-map").style("height")) - 20;
  
  function calculateScaling(dataSource) {
    if (!dataSource || !dataSource.courses_program1) {
      return {
        xscale: width / 10,
        yscale: height / 8,
        xoffset: width / 2,
        yoffset: height * 0.1
      };
    }
    
    const courses = dataSource.courses_program1;
    if (courses.length === 0) return { 
      xscale: width / 10, 
      yscale: height / 8,
      xoffset: width / 2,
      yoffset: height * 0.1
    };
    
    const xCoords = courses.map(c => c.x);
    const yCoords = courses.map(c => c.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    
    const padding = 0.2;
    const usableWidth = width * (1 - padding);
    const usableHeight = height * (1 - padding);
    
    const xs = xRange > 0 ? usableWidth / xRange : width / 10;
    const ys = yRange > 0 ? usableHeight / yRange : height / 8;
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    return {
      xscale: xs,
      yscale: ys,
      xoffset: width / 2 - centerX * xs,
      yoffset: height / 2 + centerY * ys
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
      return appState.yoffset - y * appState.yscale;
    }
    return yoffset - y * yscale; 
  }
  
  var svg = d3.select("#course-map svg").attr("width",width).attr("height",height);
  var highlightColor1 = "rgb(0, 85, 183)";

  var linesVisible = true;
  var prereqChainEnabled = false;
  var burstEffectsEnabled = true;
  var hierarchicalLayout = false;
  
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

  linesRow.on("click", function(event) {
    if (event.target.tagName !== 'INPUT') {
      linesCheckbox.property("checked", !linesCheckbox.property("checked"));
    }
    linesVisible = linesCheckbox.property("checked");
    updateLineVisibility();
  });

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

  function getCourseType(courseNumber) {
    var firstChar = courseNumber.toString().charAt(0).toUpperCase();
    return firstChar;
  }
  
  function getCourseColor(courseNumber, isRequired, isInList) {
    if (isRequired || isInList) {
      var courseType = getCourseType(courseNumber);
      return courseColors[courseType] ? courseColors[courseType].color : highlightColor1;
    }
    return "white";
  }
  
  function getCourseStrokeColor(courseNumber, isRequired, isInList) {
    var courseType = getCourseType(courseNumber);
    if (isRequired || isInList) {
      return courseColors[courseType] ? courseColors[courseType].color : highlightColor1;
    }
    return courseColors[courseType] ? courseColors[courseType].color : "black";
  }
  
  function getNumericPart(courseNumber) {
    return courseNumber.toString().substring(1);
  }

  function getCurrentDataSource() {
    if (appState && appState.data) {
      return appState.data;
    }
    return hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
  }

  var zoomContainer = svg.append("g").attr("class", "zoom-container");
  
  var requisiteLines = zoomContainer.append("g");
  var courseNodes = zoomContainer.append("g");
  var courseNumbers = zoomContainer.append("g");
  var infoNodes = zoomContainer.append("g");
  
  var zoom = d3.zoom()
    .scaleExtent([0.1, 5])
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

  function fitMapToView(animate) {
    const nodes = svg.selectAll(".zoom-container circle:not(.burst-circle)").nodes();
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

    const padding = 50;
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
      svg.transition().duration(400).call(zoom.transform, transform);
    } else {
      svg.call(zoom.transform, transform);
    }
  }

  function getResponsiveLegendConfig(viewportWidth, viewportHeight) {
    const isSmall = viewportWidth < 1000;
    const isMedium = viewportWidth >= 1000 && viewportWidth < 1400;
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
  
  const legendData = Object.keys(courseColors).map(key => courseColors[key]);
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
        const circleSpacing = 14;
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
  
  var legendInfo = createLegend(svg, LEGEND_CONFIG, legendItemsData, width, height);

  var courseMapDiv = d3.select("#course-map");
  var courseInfoDiv = d3.select("#course-info");
  var courseInfoTemplate = _.template(d3.select("#course-info-template").html());
  var programNav = d3.select("#program-track-nav");
  
  var currentSelectedProgram = null;
  
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
      d3.select("#program-track-nav div.highlight").classed("highlight",false);
      d3.select(this).classed("highlight",true);
      
      currentSelectedProgram = program;
      
      renderProgram(program,[],600);
      
      if (programRequirementsHTML[program.program_id]) {
        courseInfoDiv.html(programRequirementsHTML[program.program_id]);
      }
    });
  });

  function showCourseInfo (event,course) {
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
    var currentData = appState ? appState.data : data;
    var courseInfo = currentData.courses.find(d => d.course_number == course.course_number);
    var requisiteInfo = currentData.requisites.filter(r => r.course_number == course.course_number);
    
    if (!courseInfo) return;
    
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
    
    var numericPart = courseNumberStr.substring(1);
    
    var courseInfoObject = {"number": coursePrefix + " " + numericPart + ":",
                            "title": courseInfo.title,
                            "description": courseInfo.description,
                            "prereqs": requisiteInfo.filter(requisite => requisite.type == "pre"),
                            "coreqs": requisiteInfo.filter(requisite => requisite.type == "co"),
                            "notes": courseInfo.notes};
    courseInfoDiv.html(courseInfoTemplate(courseInfoObject));
    
    var currentDataSource = getCurrentDataSource();
    var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return [];
      }
      visited.add(courseNumber);
      
      var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
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
    
    courseNodes.selectAll("circle")
      .filter(d => coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .attr("r", 16);
    
    courseNodes.selectAll("circle")
      .filter(d => !coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .style("opacity", 0.3);
    
    courseNumbers.selectAll("text")
      .filter(d => coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .attr("font-size", 14);
    
    courseNumbers.selectAll("text")
      .filter(d => !coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .style("opacity", 0.3);
    
    infoNodes.selectAll("circle")
      .filter(d => coursesToHighlight.includes(d.course_number))
      .transition()
      .duration(200)
      .attr("r", 16);
    
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
      requisiteLines.selectAll("line")
        .filter(requisite => requisite.course_number == course.course_number && directPrereqs.includes(requisite.requisite_number))
        .attr("opacity", 1)
        .attr("stroke-dasharray", function(requisite) {
          return requisite.requisite_is_primary == 1 ? null : "6,4";
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
    
    allBurstData.forEach((burstInfo, courseIndex) => {
      var equivalenciesToShow = burstInfo.equivalencies.slice(0, 4);

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
          return xcoord(burstInfo.data.x) + 60 + i * 45;
        })
        .attr("cy", function(d, i) {
          return ycoord(burstInfo.data.y);
        });

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
          return xcoord(burstInfo.data.x) + 60 + i * 45;
        })
        .attr("y", function(d, i) {
          return ycoord(burstInfo.data.y);
        });
    });
  };

  function hideCourseInfo (event,course) {
    courseNodes.selectAll("circle")
      .interrupt()
      .transition()
      .duration(200)
      .attr("r", 12)
      .style("opacity", 1);
    
    courseNumbers.selectAll("text")
      .interrupt()
      .transition()
      .duration(200)
      .attr("font-size", 11)
      .style("opacity", 1);
    
    infoNodes.selectAll("circle")
      .interrupt()
      .transition()
      .duration(200)
      .attr("r", 12);
    
    var currentDataSource = getCurrentDataSource();
    var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return [];
      }
      visited.add(courseNumber);
      
      var directPrereqs = currentDataSource["requisites_program" + currentDataSource.programs[0].program_id]
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
    
    if (prereqChainEnabled) {
      allCoursesToHide.forEach(courseNum => {
        requisiteLines
          .selectAll("line")
          .filter(requisite => requisite.course_number == courseNum && allCoursesToHide.includes(requisite.requisite_number))
          .attr("opacity", linesVisible ? (requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0) : 0);
      });
    } else {
      requisiteLines
        .selectAll("line")
        .filter(requisite => requisite.course_number == course.course_number && directPrereqs.includes(requisite.requisite_number))
        .attr("opacity", linesVisible ? (requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0) : 0);
    }
    
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

    if (currentSelectedProgram && programRequirementsHTML[currentSelectedProgram.program_id]) {
      courseInfoDiv.html(programRequirementsHTML[currentSelectedProgram.program_id]);
    }
  };

  function renderProgram (program,courseList,duration,dataSource) {
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
  currentSelectedProgram = programs[0];
  
  if (programRequirementsHTML[programs[0].program_id]) {
    courseInfoDiv.html(programRequirementsHTML[programs[0].program_id]);
  }
  
  var reflection = _.sample(reflections.filter(reflection => reflection.program_id == 1));
  d3.select("#program-track-nav div:nth-child(1)").classed("highlight",true);
  
  setTimeout(() => {
    fitMapToView();
  }, 100);
  
  var resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      var newWidth = parseInt(d3.select("#course-map").style("width"));
      var newHeight = parseInt(d3.select("#course-map").style("height")) - 20;
      
      if (Math.abs(newWidth - width) > 50 || Math.abs(newHeight - height) > 50) {
        width = newWidth;
        height = newHeight;
        
        var currentDataSource = hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
        var newScales = calculateScaling(currentDataSource);
        xscale = newScales.xscale;
        yscale = newScales.yscale;
        
        svg.attr("width", width).attr("height", height);
        
        LEGEND_CONFIG = getResponsiveLegendConfig(width, height);
        createLegend(svg, LEGEND_CONFIG, legendItemsData, width, height);
        
        checkboxContainer.attr("x", width - 180);
        
        var currentDataSource = hierarchicalLayout && hierarchicalData ? hierarchicalData : data;
        renderProgram(programs[0], [], 300, currentDataSource);
        
        setTimeout(() => {
          fitMapToView();
        }, 350);
      }
    }, 150);
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
    calculateScaling: function(dataSource, w, h) {
      if (!dataSource || !dataSource.courses_program1) {
        return { xscale: w / 10, yscale: h / 8, xoffset: w / 2, yoffset: h * 0.1 };
      }
      const courses = dataSource.courses_program1;
      if (courses.length === 0) return { xscale: w / 10, yscale: h / 8, xoffset: w / 2, yoffset: h * 0.1 };
      const xCoords = courses.map(c => c.x);
      const yCoords = courses.map(c => c.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      const xRange = maxX - minX;
      const yRange = maxY - minY;
      const padding = 0.2;
      const usableWidth = w * (1 - padding);
      const usableHeight = h * (1 - padding);
      const xs = xRange > 0 ? usableWidth / xRange : w / 10;
      const ys = yRange > 0 ? usableHeight / yRange : h / 8;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      return {
        xscale: xs,
        yscale: ys,
        xoffset: w / 2 - centerX * xs,
        yoffset: h / 2 + centerY * ys
      };
    },
    currentSelectedProgram: currentSelectedProgram,
    programRequirementsHTML: programRequirementsHTML
  };
}

// Initialize with Data Science by default
loadDepartmentData('stats', true);