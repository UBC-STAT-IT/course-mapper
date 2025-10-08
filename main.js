d3.json("data/data.json").then(function(data) {
  const courses = data.courses;
  const requisites = data.requisites;
  const programs = data.programs;
  const tracks = data.tracks;
  const coursesTracks = data.courses_tracks;
  const reflections = data.reflections;

  // Color configuration - change colors here to update both nodes and legend
  var courseColors = {
    'S': { color: "rgb(220, 53, 69)", label: "STAT" },   // Red for STAT courses
    'M': { color: "rgb(40, 167, 69)", label: "MATH" },   // Green for MATH courses  
    'D': { color: "rgb(0, 123, 255)", label: "DSCI" }    // Blue for DSCI courses
  };

  var width = parseInt(d3.select("#course-map").style("width"));
  var height = parseInt(d3.select("#course-map").style("height")) - 20;
  var xscale = width/18;
  var yscale = height/10;
  
  // Coordinate transformation functions (zoom transform applied to container)
  var xcoord = x => x * xscale + width / 2;
  var ycoord = y => height - y * yscale - 1.5*yscale;
  
  var svg = d3.select("#course-map svg").attr("width",width).attr("height",height);
  var highlightColor1 = "rgb(0, 85, 183)";

  // Helper functions for course type detection and coloring
  function getCourseType(courseNumber) {
    var firstChar = courseNumber.toString().charAt(0).toUpperCase();
    return firstChar;
  }
  
  function getCourseColor(courseNumber, isRequired, isInList) {
    if (isRequired || isInList) {
      return highlightColor1; // Keep highlight behavior for required courses
    }
    
    var courseType = getCourseType(courseNumber);
    return courseColors[courseType] ? courseColors[courseType].color : "white";
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
    requisiteLines.selectAll("line").filter(requisite => requisite.course_number == course.course_number).attr("opacity",1);
  };

  function hideCourseInfo (event,course) {
    requisiteLines
      .selectAll("line")
      .filter(requisite => requisite.course_number == course.course_number)
      .attr("opacity",requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0);
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
          .attr("stroke",course => (course.required || courseList.includes(course.course_number)) ? highlightColor1 : "black");
      },function (update) {
        update
          .attr("fill",course => getCourseColor(course.course_number, course.required, courseList.includes(course.course_number)))
          .attr("stroke",course => (course.required || courseList.includes(course.course_number)) ? highlightColor1 : "black")
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
          .attr("opacity",requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0);
      },function (update) {
        update
          .transition()
          .delay(duration).duration(duration)
          .attr("x1",requisite => xcoord(requisite.course_x))
          .attr("y1",requisite => ycoord(requisite.course_y))
          .attr("x2",requisite => xcoord(requisite.requisite_x))
          .attr("y2",requisite => ycoord(requisite.requisite_y))
          .attr("opacity",requisite => requisite.requisite_is_primary == 1 ? 0.2 : 0);
      },function (exit) {
        exit.transition()
          .duration(duration)
          .attr("opacity",0).remove();
      });

  };

  function highlight (courseList) {
    courseNodes.selectAll("circle")
      .attr("fill",course => getCourseColor(course.course_number, course.required, false))
      .attr("stroke",course => course.required ? highlightColor1 : "black")
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