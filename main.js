d3.json("data/data.json").then(function(data) {
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
    // 'S': { color: "rgb(50, 159, 91)", label: "STAT" },
    'M': { color: "#e84855", label: "MATH" }, 
    'D': { color: "#FF7D00", label: "DSCI" }
  };

  var width = parseInt(d3.select("#course-map").style("width"));
  var height = parseInt(d3.select("#course-map").style("height")) - 20;
  var xscale = width/30;
  var yscale = height/18;
  
  // Coordinate transformation functions (zoom transform applied to container)
  var xcoord = x => x * xscale + width / 2;
  var ycoord = y => height - y * yscale - 1.5*yscale;
  
  var svg = d3.select("#course-map svg").attr("width",width).attr("height",height);
  var highlightColor1 = "rgb(0, 85, 183)";

  // Add checkboxes for prerequisite lines and fill circle
  var linesVisible = true; // Default state - lines visible
  // Removed fillCircles logic
  var prereqChainEnabled = false; // Default state - prerequisite chain highlighting disabled
  var burstEffectsEnabled = true; // Default state - burst effects enabled
  
  // Create checkbox container in top right of SVG canvas
  var checkboxContainer = svg.append("foreignObject")
    .attr("x", width - 180)
    .attr("y", 10)
    .attr("width", 170)
    .attr("height", 115)
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

  // Add click handlers for checkboxes
  linesRow.on("click", function(event) {
    if (event.target.tagName !== 'INPUT') {
      linesCheckbox.property("checked", !linesCheckbox.property("checked"));
    }
    linesVisible = linesCheckbox.property("checked");
    updateLineVisibility();
  });

  // Removed fillRow and fillCheckbox logic

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

  // Create legend (not affected by zoom)
  var legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width - 150}, ${height - 80})`);

  // Generate legend data from courseColors configuration
  var legendData = Object.keys(courseColors).map(key => courseColors[key]);

  // Legend background
  legend.append("rect")
    .attr("x", -10)
    .attr("y", -10)
    .attr("width", 120)
    .attr("height", 70)
    .attr("fill", "white")
    .attr("stroke", "#ccc")
    .attr("stroke-width", 1)
    .attr("rx", 5);

  // Legend items
  var legendItems = legend.selectAll(".legend-item")
    .data(legendData)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`);

  // Legend circles
  legendItems.append("circle")
    .attr("cx", 8)
    .attr("cy", 8)
    .attr("r", 6)
    .attr("fill", d => d.color)
    .attr("stroke", "#333")
    .attr("stroke-width", 1);

  // Legend text
  legendItems.append("text")
    .attr("x", 20)
    .attr("y", 8)
    .attr("dy", "0.35em")
    .attr("font-family", "Arial")
    .attr("font-size", "12px")
    .attr("fill", "#333")
    .text(d => d.label);

  var courseMapDiv = d3.select("#course-map");
  var programInfoDiv = d3.select("#program-info");
  var programInfo1Div = d3.select("#program-info1");
  var programInfo1Template = _.template(d3.select("#program-info1-template").html());
  var programInfo2Div = d3.select("#program-info2");
  var programInfo2Template = _.template(d3.select("#program-info2-template").html());
  var programInfoMoreDiv = d3.select("#program-info-more");
  var programInfo1MoreDiv = d3.select("#program-info1-more");
  var programInfo1MoreTemplate = _.template(d3.select("#program-info1-more-template").html());
  var programInfo2MoreDiv = d3.select("#program-info2-more");
  var programInfo2MoreTemplate = _.template(d3.select("#program-info2-more-template").html());
  var courseInfoDiv = d3.select("#course-info");
  var courseInfoTemplate = _.template(d3.select("#course-info-template").html());
  
  d3.select("#show-more").on("click",function (event) {
    programInfoDiv.style("z-index","-1");
    programInfoMoreDiv.style("z-index","1");
  });

  d3.select("#show-less").on("click",function (event) {
    programInfoDiv.style("z-index","1");
    programInfoMoreDiv.style("z-index","-1");
  });

  var programNav = d3.select("#program-track-nav");
  programs.forEach(function(program){
    programNav.append("div").classed("program",true).html(program.name).on("click",function (event) {
      d3.select("#program-track-nav div.highlight").classed("highlight",false);
      d3.select(this).classed("highlight",true);
      renderProgram(program,[],600);
      programInfo1Div.html(programInfo1Template(program));
      var reflection = _.sample(reflections.filter(reflection => reflection.program_id == program.program_id));
      programInfo2Div.html(programInfo2Template(reflection));
      programInfo1MoreDiv.html(programInfo1MoreTemplate(program));
      programInfo2MoreDiv.html(programInfo2MoreTemplate(reflection));
    });
    // tracks.filter(d => d.program_id == program.program_id).forEach(function(track){
    //   programNav.append("div").classed("track",true).html(track.name).on("click", function (event) {
    //     d3.select("#program-track-nav div.highlight").classed("highlight",false);
    //     d3.select(this).classed("highlight",true);
    //     var coursesTrack = coursesTracks.filter(d => d.track_id == track.track_id).map(d => d.course_number);
    //     renderProgram(program,coursesTrack,600);
    //     programInfo1Div.html(programInfo1Template(track));
    //     var reflection = _.sample(reflections.filter(reflection => reflection.track_id == track.track_id));
    //     programInfo2Div.html(programInfo2Template(reflection));
    //     programInfo1MoreDiv.html(programInfo1MoreTemplate(track));
    //     programInfo2MoreDiv.html(programInfo2MoreTemplate(reflection));
    //   });
    // });
  });

  function showCourseInfo (event,course) {
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
    var directPrereqs = data["requisites_program" + data.programs[0].program_id]
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    // Get prerequisite course numbers for this course (including recursive prereqs if enabled)
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return []; // Prevent infinite loops
      }
      visited.add(courseNumber);
      
      var directPrereqs = data["requisites_program" + data.programs[0].program_id]
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
          .attr("opacity", 1);
      });
    } else {
      // Only show lines from the hovered course to its direct prerequisites
      requisiteLines.selectAll("line")
        .filter(requisite => requisite.course_number == course.course_number && directPrereqs.includes(requisite.requisite_number))
        .attr("opacity", 1);
    }
    
    // Check for burst effect based on equivalencies data
    // Find all prerequisites (not including the hovered course) that have equivalencies defined
    var allBurstData = [];
    if (burstEffectsEnabled) {
      for (let courseNum of prerequisiteCourses) { // Only prereqs, not hovered course
        let courseEquivalencies = equivalencies.filter(eq => eq.course_number === courseNum);
        if (courseEquivalencies.length > 0) {
          let burstCourseData = data["courses_program" + data.programs[0].program_id].find(c => c.course_number == courseNum);
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
      
      var burstCircles = courseNodes.selectAll(`.burst-circle-${courseIndex}`)
        .data(equivalenciesToShow);

      burstCircles.enter()
        .append("circle")
        .attr("class", `burst-circle burst-circle-${courseIndex}`)
        .attr("cx", xcoord(burstInfo.data.x))
        .attr("cy", ycoord(burstInfo.data.y))
        .attr("r", 0)
        .attr("fill", "white")
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
        .attr("fill", "black")
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
    var directPrereqs = data["requisites_program" + data.programs[0].program_id]
      .filter(requisite => requisite.course_number == course.course_number)
      .map(requisite => requisite.requisite_number);
    
    function getPrerequisiteChain(courseNumber, visited = new Set()) {
      if (visited.has(courseNumber)) {
        return []; // Prevent infinite loops
      }
      visited.add(courseNumber);
      
      var directPrereqs = data["requisites_program" + data.programs[0].program_id]
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
      courseNodes.selectAll(".burst-circle")
        .transition()
        .duration(200)
        .attr("r", 0)
        .attr("opacity", 0)
        .remove();
      
      courseNumbers.selectAll(".burst-text")
        .transition()
        .duration(200)
        .attr("opacity", 0)
        .remove();
    }
  };

  function renderProgram (program,courseList,duration) {
    var course0 = {"number": "",
                   "title": "Course Information",
                   "description": "The course map presents all STAT, MATH, and DSCI courses along with prerequisite/corequisite connections. Hover over a course to view the course description, a complete list of prerequisites/corequisites, credit exclusions and notes. Select programs and streams in the menu above.<br><br>The course map was created by <a href='https://patrickwalls.github.io/'>Patrick Walls</a> with contributions from <a href='https://github.com/zzzzzyzzzzz'>Karen Zhou</a> and <a href='https://github.com/LeoLee5566'>Wuyang Li</a>.<br><br><a rel='license' href='http://creativecommons.org/licenses/by-nc-sa/4.0/'><img alt='Creative Commons Licence' style='border-width:0' src='https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png' /></a><br />This work is licensed under a <a rel='license' href='http://creativecommons.org/licenses/by-nc-sa/4.0/'>Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.",
                   "prereqs": [],
                   "coreqs": [], 
                   "notes": ""};
    courseInfoDiv.html(courseInfoTemplate(course0));

    var updateCoursesProgram = data["courses_program" + program.program_id];
    var updateRequisitesProgram = data["requisites_program" + program.program_id];

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
  programInfo1Div.html(programInfo1Template(programs[0]));
  var reflection = _.sample(reflections.filter(reflection => reflection.program_id == 1));
  programInfo2Div.html(programInfo2Template(reflection));
  programInfo1MoreDiv.html(programInfo1MoreTemplate(programs[0]));
  programInfo2MoreDiv.html(programInfo2MoreTemplate(reflection));  
  d3.select("#program-track-nav div:nth-child(1)").classed("highlight",true);
});