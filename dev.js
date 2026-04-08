// Developer tooling for the Course Mapper.
// Provides an interactive panel to add/update courses, drag nodes, and export JSON.

(function() {
  const DEV_DATA_FILES = {
    stats: 'data/data.json',
    dsci: 'data/dsci_data.json'
  };

  const PROGRAM_KEYS = ['courses_program1', 'courses_program2', 'courses_program3', 'courses_program4'];

  const devState = {
    currentDept: 'stats',
    loadRequestId: 0,
    statsGridSize: null,
    hasUnexportedChanges: false,
    workingData: null,
    baseData: null,
    baseGridSize: null,
    placingCourse: null,
    dragEnabled: false,
    gridSnap: true,
    gridSize: 1
  };

  // ---------- Utility helpers ----------
  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  const toastEl = document.getElementById('dev-toast');
  function toast(message, duration = 1800) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  function syncDeptUI() {
    const statsEl = document.getElementById('dept-stats');
    const dsciEl = document.getElementById('dept-dsci');
    if (!statsEl || !dsciEl) return;
    statsEl.classList.toggle('active', devState.currentDept === 'stats');
    dsciEl.classList.toggle('active', devState.currentDept === 'dsci');
    const select = document.getElementById('dev-department');
    if (select) select.value = devState.currentDept;
  }

  function getCourseOptions() {
    return devState.workingData ? devState.workingData.courses || [] : [];
  }

  function setUnexportedChanges(hasChanges) {
    devState.hasUnexportedChanges = !!hasChanges;
  }

  function confirmDatasetSwitch(nextDept) {
    if (!devState.hasUnexportedChanges) return true;
    const nextLabel = nextDept === 'dsci' ? 'Data Science' : 'Statistics';
    return window.confirm(`You have unexported changes that have not been downloaded. Switch to ${nextLabel} anyway?`);
  }

  // Allow multi-select with simple clicks (no Ctrl/Cmd) by toggling options manually
  function enableClickMultiSelect(selectId) {
    const el = document.getElementById(selectId);
    if (!el) return;
    let lockedScrollTop = null;
    let lockTimer = null;

    const releaseLock = () => {
      lockedScrollTop = null;
      if (lockTimer) {
        clearTimeout(lockTimer);
        lockTimer = null;
      }
    };

    const lockScroll = (top) => {
      lockedScrollTop = top;
      if (lockTimer) clearTimeout(lockTimer);
      lockTimer = setTimeout(releaseLock, 120);
    };

    const restoreScroll = () => {
      if (lockedScrollTop === null) return;
      if (el.scrollTop === lockedScrollTop) return;
      el.scrollTop = lockedScrollTop;
    };

    el.addEventListener('mousedown', (e) => {
      const opt = e.target;
      if (opt && opt.tagName === 'OPTION') {
        lockScroll(el.scrollTop);
        e.preventDefault();
        opt.selected = !opt.selected;
        restoreScroll();
      }
    });
    el.addEventListener('scroll', restoreScroll);
    el.addEventListener('change', restoreScroll);
    el.addEventListener('blur', releaseLock);
  }

  function parseCourseNumber(value) {
    const str = (value || '').toString().trim();
    const prefix = str.charAt(0).toUpperCase();
    const numPart = parseInt(str.slice(1), 10);
    return {
      prefix,
      num: Number.isNaN(numPart) ? Number.MAX_SAFE_INTEGER : numPart,
      raw: str
    };
  }

  function compareCourseNumbers(a, b) {
    const aInfo = parseCourseNumber(a.course_number);
    const bInfo = parseCourseNumber(b.course_number);
    if (aInfo.prefix !== bInfo.prefix) {
      return aInfo.prefix.localeCompare(bInfo.prefix);
    }
    if (aInfo.num !== bInfo.num) {
      return aInfo.num - bInfo.num;
    }
    return aInfo.raw.localeCompare(bInfo.raw);
  }

  function ensureOptionVisible(select, courseNumber) {
    if (!select || !courseNumber) return;
    const options = Array.from(select.options);
    const target = options.find((o) => o.value === courseNumber);
    if (!target) return;
    const optionTop = target.offsetTop;
    const optionBottom = optionTop + target.offsetHeight;
    if (optionTop < select.scrollTop) {
      select.scrollTop = optionTop;
    } else if (optionBottom > select.scrollTop + select.clientHeight) {
      select.scrollTop = optionBottom - select.clientHeight;
    }
  }

  function refreshCourseOptions(focusCourseNumber = '') {
    const courses = getCourseOptions().slice().sort(compareCourseNumbers);
    const prereqSelect = document.getElementById('dev-prereqs');
    const coreqSelect = document.getElementById('dev-coreqs');
    const existingSelect = document.getElementById('dev-existing');

    const preserveMultiSelect = (select) => {
      if (!select) return { selected: [], scrollTop: 0 };
      return {
        selected: Array.from(select.selectedOptions).map((o) => o.value),
        scrollTop: select.scrollTop
      };
    };

    const fill = (select, prevState) => {
      if (!select) return;
      select.innerHTML = '';
      courses.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.course_number;
        opt.textContent = `${c.course_number} — ${c.title}`;
        if (prevState?.selected?.includes(c.course_number)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
      if (prevState) {
        requestAnimationFrame(() => {
          select.scrollTop = prevState.scrollTop;
        });
      }
    };

    const prereqState = preserveMultiSelect(prereqSelect);
    const coreqState = preserveMultiSelect(coreqSelect);

    fill(prereqSelect, prereqState);
    fill(coreqSelect, coreqState);

    ensureOptionVisible(prereqSelect, focusCourseNumber);
    ensureOptionVisible(coreqSelect, focusCourseNumber);

    if (existingSelect) {
      existingSelect.innerHTML = '<option value="">-- New course --</option>';
      courses.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.course_number;
        opt.textContent = c.course_number;
        existingSelect.appendChild(opt);
      });
      if (focusCourseNumber) {
        existingSelect.value = focusCourseNumber;
      }
    }
  }

  // Derive a natural grid step from existing coordinates, robust to decimal values.
  function computeGridStep(data) {
    if (!data) return 1;
    const xs = [];
    const ys = [];
    PROGRAM_KEYS.forEach((key) => {
      (data[key] || []).forEach((c) => {
        if (Number.isFinite(c.x)) xs.push(c.x);
        if (Number.isFinite(c.y)) ys.push(c.y);
      });
    });
    const epsilon = 1e-6;
    const collectDeltas = (values) => {
      const sortedUnique = Array.from(new Set(values.map((v) => Number(v.toFixed(4))))).sort((a, b) => a - b);
      const deltas = [];
      for (let i = 1; i < sortedUnique.length; i++) {
        const delta = sortedUnique[i] - sortedUnique[i - 1];
        if (delta > epsilon) deltas.push(delta);
      }
      return deltas;
    };

    const deltas = collectDeltas(xs).concat(collectDeltas(ys));
    if (!deltas.length) return 1;

    const minDelta = Math.min(...deltas);
    const step = Number(minDelta.toFixed(3));
    return Math.max(0.2, step || 1);
  }

  function getAllCourseCoords(data) {
    const coords = [];
    PROGRAM_KEYS.forEach((key) => {
      (data[key] || []).forEach((c) => coords.push({ x: c.x, y: c.y }));
    });
    return coords;
  }

  function getGridBounds(data) {
    const coords = getAllCourseCoords(data);
    if (coords.length === 0) return null;
    const xs = coords.map((c) => c.x);
    const ys = coords.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY };
  }

  function setFormFromCourse(courseNumber) {
    const course = getCourseOptions().find((c) => c.course_number === courseNumber);
    if (!course) return;
    document.getElementById('dev-course-number').value = course.course_number || '';
    document.getElementById('dev-course-title').value = course.title || '';
    document.getElementById('dev-course-credits').value = course.credits || '';
    document.getElementById('dev-course-vector').value = course.vector || '';
    document.getElementById('dev-course-description').value = course.description || '';
    document.getElementById('dev-course-notes').value = course.notes || '';
  const prereqTextEl = document.getElementById('dev-prereq-text');
  const coreqTextEl = document.getElementById('dev-coreq-text');
  if (prereqTextEl) prereqTextEl.value = '';
  if (coreqTextEl) coreqTextEl.value = '';

    // Equivalencies
    const eq = (devState.workingData?.equivalencies || [])
      .filter((e) => e.course_number === course.course_number)
      .map((e) => e.equivalency_number)
      .join(',');
    document.getElementById('dev-course-equivalencies').value = eq;

    // Programs present / required
    const requiredFlags = document.querySelectorAll('#dev-required-flags input[type="checkbox"]');
    const programFlags = document.querySelectorAll('#dev-program-flags input[type="checkbox"]');

    PROGRAM_KEYS.forEach((key, idx) => {
      const programArr = devState.workingData?.[key] || [];
      const record = programArr.find((c) => c.course_number === course.course_number);
      const hasProgram = !!record;
      const isReq = !!record?.required;
      const pf = programFlags[idx];
      const rf = requiredFlags[idx];
      if (pf) pf.checked = hasProgram;
      if (rf) rf.checked = isReq;
    });

    // Prereqs/Coreqs selections
    const existingReqs = devState.workingData?.requisites?.filter((r) => r.course_number === course.course_number) || [];
    const preTextLines = existingReqs.filter((r) => r.type === 'pre' && r.is_text);
    const coTextLines = existingReqs.filter((r) => r.type === 'co' && r.is_text);
    if (prereqTextEl) {
      prereqTextEl.value = preTextLines.map((r) => r.description.replace(/^Prerequisite:\s*/i, '')).join('\n');
    }
    if (coreqTextEl) {
      coreqTextEl.value = coTextLines.map((r) => r.description.replace(/^Corequisite:\s*/i, '')).join('\n');
    }
    const prereqSelect = document.getElementById('dev-prereqs');
    const coreqSelect = document.getElementById('dev-coreqs');
    if (prereqSelect) {
      const prereqs = existingReqs.filter((r) => r.type === 'pre').map((r) => r.description.replace('Prerequisite: ', '').trim());
      Array.from(prereqSelect.options).forEach((opt) => {
        opt.selected = prereqs.includes(opt.value);
      });
    }
    if (coreqSelect) {
      const coreqs = existingReqs.filter((r) => r.type === 'co').map((r) => r.description.replace('Corequisite: ', '').trim());
      Array.from(coreqSelect.options).forEach((opt) => {
        opt.selected = coreqs.includes(opt.value);
      });
    }
  }

  function selectedValues(selectId) {
    const el = document.getElementById(selectId);
    if (!el) return [];
    return Array.from(el.selectedOptions).map((o) => o.value);
  }

  function getProgramSelections() {
    const programs = Array.from(document.querySelectorAll('#dev-program-flags input[type="checkbox"]')).filter((c) => c.checked).map((c) => Number(c.value));
    const required = Array.from(document.querySelectorAll('#dev-required-flags input[type="checkbox"]')).filter((c) => c.checked).map((c) => Number(c.value));
    // If nothing selected, default to all programs so courses don't vanish when switching views
    const normalizedPrograms = programs.length ? programs : [1, 2, 3, 4];
    const normalizedRequired = required.filter((r) => normalizedPrograms.includes(r));
    return { programs: normalizedPrograms, required: normalizedRequired };
  }

  function getFormPayload() {
    const number = document.getElementById('dev-course-number').value.trim();
    const title = document.getElementById('dev-course-title').value.trim();
    const credits = document.getElementById('dev-course-credits').value.trim();
    const vector = document.getElementById('dev-course-vector').value.trim();
    const description = document.getElementById('dev-course-description').value.trim();
    const notes = document.getElementById('dev-course-notes').value.trim();
    const prereqText = (document.getElementById('dev-prereq-text')?.value || '').trim();
    const coreqText = (document.getElementById('dev-coreq-text')?.value || '').trim();
    const equivalencies = document.getElementById('dev-course-equivalencies').value.trim();
    const prereqs = selectedValues('dev-prereqs');
    const coreqs = selectedValues('dev-coreqs');
    const programSelection = getProgramSelections();

    const prereqTextLines = prereqText ? prereqText.split(/\n+/).map((s) => s.trim()).filter(Boolean) : [];
    const coreqTextLines = coreqText ? coreqText.split(/\n+/).map((s) => s.trim()).filter(Boolean) : [];

    return {
      number,
      title,
      credits,
      vector,
      description,
      notes,
      prereqTextLines,
      coreqTextLines,
      equivalencies,
      prereqs,
      coreqs,
      programs: programSelection.programs,
      requiredPrograms: programSelection.required
    };
  }

  function computeCenterCoords() {
    if (!appState) return { x: 0, y: 0 };
    const cx = appState.width / 2;
    const cy = appState.height / 2;
    const dataX = (cx - appState.xoffset) / appState.xscale;
    const dataY = (appState.yoffset - cy) / appState.yscale;
    return { x: dataX, y: dataY };
  }

  function getGridSteps() {
    const baseStep = devState.gridSize || 1;
    const isStats = devState.currentDept === 'stats';
    return {
      xStep: isStats ? baseStep / 2 : baseStep,
      yStep: baseStep
    };
  }

  function findAvailableCoords(basePoint) {
    const { xStep, yStep } = getGridSteps();
    const snappedBase = snapDataPoint(basePoint);
    const occupied = new Set();
    getAllCourseCoords(devState.workingData).forEach(({ x, y }) => {
      occupied.add(`${x},${y}`);
    });

    const isFree = (x, y) => !occupied.has(`${x},${y}`);

    if (isFree(snappedBase.x, snappedBase.y)) return snappedBase;

    // Spiral search outward for the first free grid point
    const maxRadius = 50; // generous search bound
    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // only check perimeter of the square ring
          const candidate = {
            x: snappedBase.x + dx * xStep,
            y: snappedBase.y + dy * yStep
          };
          if (isFree(candidate.x, candidate.y)) return candidate;
        }
      }
    }
    return snappedBase;
  }

  function ensureProgramRecord(courseNumber, coords, requiredSet, programsSet) {
    PROGRAM_KEYS.forEach((key, idx) => {
      const programId = idx + 1;
      const arr = devState.workingData[key];
      if (!Array.isArray(arr)) return;
      const existing = arr.find((c) => c.course_number === courseNumber);
      const shouldExist = programsSet.includes(programId);
      if (shouldExist && !existing) {
        arr.push({ course_number: courseNumber, x: coords.x, y: coords.y, required: requiredSet.includes(programId) ? 1 : 0 });
      } else if (shouldExist && existing) {
        existing.x = coords.x;
        existing.y = coords.y;
        existing.required = requiredSet.includes(programId) ? 1 : 0;
      } else if (!shouldExist && existing) {
        const idxToRemove = arr.indexOf(existing);
        arr.splice(idxToRemove, 1);
      }
    });
  }

  function updateCourseMetadata(payload, coords) {
    const courses = devState.workingData.courses || [];
    let existing = courses.find((c) => c.course_number === payload.number);
    if (!existing) {
      existing = {
        course_number: payload.number,
        title: payload.title || 'Untitled',
        credits: payload.credits || '',
        vector: payload.vector || '',
        description: payload.description || '',
        notes: payload.notes || ''
      };
      courses.push(existing);
    } else {
      existing.title = payload.title || existing.title;
      existing.credits = payload.credits || existing.credits;
      existing.vector = payload.vector || existing.vector;
      existing.description = payload.description || existing.description;
      existing.notes = payload.notes || existing.notes;
    }

    // Equivalencies
    devState.workingData.equivalencies = devState.workingData.equivalencies || [];
    devState.workingData.equivalencies = devState.workingData.equivalencies.filter((e) => e.course_number !== payload.number);
    if (payload.equivalencies) {
      const eqs = payload.equivalencies.split(',').map((s) => s.trim()).filter(Boolean);
      eqs.forEach((eq, i) => {
        devState.workingData.equivalencies.push({
          equivalency_id: `${payload.number}-eq-${i}-${Date.now()}`,
          course_number: payload.number,
          equivalency_number: eq
        });
      });
    }

    ensureProgramRecord(payload.number, coords, payload.requiredPrograms, payload.programs);
  }

  function removeExistingRequisites(courseNumber) {
    if (!devState.workingData) return;
    devState.workingData.requisites = (devState.workingData.requisites || []).filter((r) => r.course_number !== courseNumber);
    devState.workingData.requisites_programs = (devState.workingData.requisites_programs || []).filter((r) => r.course_number !== courseNumber);
    devState.workingData.course_requisites = (devState.workingData.course_requisites || []).filter((r) => r.course_number !== courseNumber);
  }

  function getCoordsForCourse(courseNumber) {
    for (const key of PROGRAM_KEYS) {
      const arr = devState.workingData[key];
      if (!Array.isArray(arr)) continue;
      const hit = arr.find((c) => c.course_number === courseNumber);
      if (hit) return { x: hit.x, y: hit.y };
    }
    return computeCenterCoords();
  }

  function snapDataPoint(point) {
    if (!devState.gridSnap || (devState.gridSize || 1) <= 0) return point;
    const { xStep, yStep } = getGridSteps();
    return {
      x: Math.round(point.x / xStep) * xStep,
      y: Math.round(point.y / yStep) * yStep
    };
  }

  function ensureGridLayer() {
    if (!appState || !appState.layers) return null;
    const zc = appState.layers.zoomContainer;
    let grid = zc.select('.dev-grid');
    if (grid.empty()) {
      // place above background but below lines/nodes by inserting after the background rect
      const bg = zc.select('.background-rect');
      if (!bg.empty()) {
        grid = zc.insert('g', function() { return bg.node().nextSibling; }).attr('class', 'dev-grid');
      } else {
        grid = zc.insert('g', ':first-child').attr('class', 'dev-grid');
      }
    }
    return grid;
  }

  function updateGridOverlay() {
    const gridLayer = devState.gridSnap ? ensureGridLayer() : null;
    if (!gridLayer) {
      appState?.layers?.zoomContainer.select('.dev-grid').remove();
      return;
    }
    gridLayer.selectAll('*').remove();
    const bounds = getGridBounds(devState.workingData);
    if (!bounds) return;
    const baseStep = devState.gridSize || 1;
    const { xStep, yStep } = getGridSteps();
    const padding = baseStep * 20; // extend far beyond current map (20 steps each direction)
    const xs = [];
    for (let x = Math.floor((bounds.minX - padding) / xStep) * xStep; x <= bounds.maxX + padding; x += xStep) {
      xs.push(x);
    }
    const ys = [];
    for (let y = Math.floor((bounds.minY - padding) / yStep) * yStep; y <= bounds.maxY + padding; y += yStep) {
      ys.push(y);
    }
    const MAX_GRID_POINTS = 15000;
    const totalPoints = xs.length * ys.length;
    const stride = totalPoints > MAX_GRID_POINTS
      ? Math.ceil(Math.sqrt(totalPoints / MAX_GRID_POINTS))
      : 1;
    const sampledXs = stride > 1 ? xs.filter((_, i) => i % stride === 0) : xs;
    const sampledYs = stride > 1 ? ys.filter((_, i) => i % stride === 0) : ys;
    const points = [];
    sampledXs.forEach((x) => {
      sampledYs.forEach((y) => points.push({ x, y }));
    });
    const circles = gridLayer.selectAll('circle').data(points);
    circles.enter()
      .append('circle')
      .attr('class', 'grid-dot')
      .attr('r', 5)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(0,0,0,0.08)')
      .attr('stroke-width', 1)
      .attr('cx', (d) => appState.dataToScreen(d.x, d.y).x)
      .attr('cy', (d) => appState.dataToScreen(d.x, d.y).y);
  }

  function addRequisites(courseNumber, prereqs, coreqs, coords, prereqTextLines = [], coreqTextLines = []) {
    devState.workingData.requisites = devState.workingData.requisites || [];
    devState.workingData.requisites_programs = devState.workingData.requisites_programs || [];

    const addEntry = (req, type) => {
      const reqCoords = getCoordsForCourse(req);
      const id = `${courseNumber}-${type}-${req}-${Date.now()}`;
      devState.workingData.requisites.push({
        requisite_id: id,
        course_number: courseNumber,
        type: type,
        description: `${type === 'co' ? 'Corequisite' : 'Prerequisite'}: ${req}`,
        "Unnamed: 4": ''
      });
      devState.workingData.requisites_programs.push({
        requisite_id: id,
        course_number: courseNumber,
        requisite_number: req,
        course_x: coords.x,
        course_y: coords.y,
        requisite_x: reqCoords.x,
        requisite_y: reqCoords.y,
        requisite_is_primary: 1,
        requisite_is_co: type === 'co' ? 1 : 0,
        course_requisite_number: `${courseNumber}${req}`
      });
    };

    prereqs.forEach((p) => addEntry(p, 'pre'));
    coreqs.forEach((c) => addEntry(c, 'co'));

    // Freeform bullet lines (no map lines drawn)
    prereqTextLines.forEach((line, idx) => {
      devState.workingData.requisites.push({
        requisite_id: `${courseNumber}-pretext-${Date.now()}-${idx}`,
        course_number: courseNumber,
        type: 'pre',
        is_text: true,
        description: `Prerequisite: ${line}`,
        "Unnamed: 4": ''
      });
    });

    coreqTextLines.forEach((line, idx) => {
      devState.workingData.requisites.push({
        requisite_id: `${courseNumber}-cotext-${Date.now()}-${idx}`,
        course_number: courseNumber,
        type: 'co',
        is_text: true,
        description: `Corequisite: ${line}`,
        "Unnamed: 4": ''
      });
    });
  }

  function persistCoursePosition(courseNumber, x, y) {
    PROGRAM_KEYS.forEach((key) => {
      const arr = devState.workingData[key];
      if (!Array.isArray(arr)) return;
      const target = arr.find((c) => c.course_number === courseNumber);
      if (target) {
        target.x = x;
        target.y = y;
      }
    });

    (devState.workingData.requisites_programs || []).forEach((r) => {
      if (r.course_number === courseNumber) {
        r.course_x = x;
        r.course_y = y;
      }
      if (r.requisite_number === courseNumber) {
        r.requisite_x = x;
        r.requisite_y = y;
      }
    });
  }

  function clearHoverVisuals() {
    if (!appState || !appState.layers) return;
    const { courseNodes, courseNumbers, requisiteLines } = appState.layers;
    courseNodes.selectAll('circle')
      .interrupt()
      .attr('r', CONFIG.COURSE_NODE.DEFAULT_RADIUS)
      .style('opacity', 1);
    courseNumbers.selectAll('text')
      .interrupt()
      .style('opacity', 1);
    courseNumbers.selectAll('tspan.course-prefix')
      .interrupt()
      .attr('font-size', CONFIG.COURSE_TEXT.PREFIX_SIZE);
    courseNumbers.selectAll('tspan.course-number')
      .interrupt()
      .attr('font-size', CONFIG.COURSE_TEXT.NUMBER_SIZE);
    requisiteLines.selectAll('line')
      .attr('opacity', CONFIG.LINES.PRIMARY_VISIBLE_OPACITY);
    courseNodes.selectAll('.burst-circle').remove();
    courseNumbers.selectAll('.burst-text').remove();
  }

  function disableHoverInteractions() {
    if (!appState || !appState.layers) return;
    clearHoverVisuals();
    appState.layers.infoNodes.selectAll('circle')
      .on('mouseover', null)
      .on('mouseout', null)
      .on('click', null)
      .on('touchstart', null);
  }

  function restoreHoverInteractions() {
    if (!appState || !devState.workingData) return;
    const fallbackProgram = devState.workingData.programs?.[0] || { program_id: 1, name: 'All Courses' };
    const program = appState.currentSelectedProgram || fallbackProgram;
    appState.renderProgram(program, [], 0, devState.workingData);
  }

  function applyWorkingData(animate = true, opts = {}) {
    const { refit = true } = opts;
    if (!devState.workingData) return;
    if (!appState) {
      setTimeout(() => applyWorkingData(animate, opts), 200);
      return;
    }

    // Keep grid size anchored to the original dataset to avoid shrinking when half-step columns are used
    if (!devState.gridSize) {
      devState.gridSize = devState.baseGridSize || computeGridStep(devState.workingData);
    }

    // Refresh scales with new data
    const newScales = appState.calculateScaling(devState.workingData, appState.width, appState.height);
    appState.xscale = newScales.xscale;
    appState.yscale = newScales.yscale;
    appState.xoffset = newScales.xoffset;
    appState.yoffset = newScales.yoffset;

    // Program requirements HTML map
    const programRequirementsHTML = {};
    (devState.workingData.programs || []).forEach((p) => {
      if (p.requirements_html) programRequirementsHTML[p.program_id] = p.requirements_html;
    });
    (devState.workingData.program_requirements || []).forEach((pr) => {
      if (pr.html_content) programRequirementsHTML[pr.program_id] = pr.html_content;
    });

    appState.data = devState.workingData;
    appState.programRequirementsHTML = programRequirementsHTML;

    const programs = devState.workingData.programs || [];
    const preservedId = appState.currentSelectedProgram?.program_id;
    const fallbackProgram = programs[0] || { program_id: 1, name: 'All Courses' };
    const selectedProgram = programs.find((p) => p.program_id === preservedId) || fallbackProgram;
    appState.currentSelectedProgram = selectedProgram;

    // In drag mode, avoid transitions so disableHoverInteractions can't interrupt exit-removal.
    const renderDuration = (animate && !devState.dragEnabled) ? CONFIG.ANIMATIONS.TRANSITION_DURATION : 0;

    // Render with latest data
    appState.renderProgram(selectedProgram, [], renderDuration, devState.workingData);
    currentDepartment = devState.currentDept;

    setTimeout(() => {
      if (refit) appState.fitMapToView(animate);
      if (devState.dragEnabled) {
        disableHoverInteractions();
        attachDragHandlers();
        document.body.classList.add('drag-mode');
      } else {
        document.body.classList.remove('drag-mode');
      }
      rebuildProgramNav();
      updateGridOverlay();
    }, renderDuration > 0 ? CONFIG.ANIMATIONS.POST_TRANSITION_FIT_DELAY / 4 : 50);
  }

  function rebuildProgramNav() {
    if (!devState.workingData) return;
    const programNav = d3.select('#program-track-nav');
    const courseInfoDiv = d3.select('#course-info');
    const programs = devState.workingData.programs || [];
    const selectedId = appState?.currentSelectedProgram?.program_id;

    programNav.html('');
    programs.forEach((program, index) => {
      programNav.append('div')
        .classed('program', true)
        .classed('highlight', program.program_id === selectedId || (!selectedId && index === 0))
        .html(program.name)
        .on('click', function() {
          if (isDepartmentTransitioning) return;
          programNav.selectAll('div').classed('highlight', false);
          d3.select(this).classed('highlight', true);
          if (appState) appState.currentSelectedProgram = program;
          const renderDuration = devState.dragEnabled ? 0 : CONFIG.ANIMATIONS.TRANSITION_DURATION;
          appState?.renderProgram(program, [], renderDuration, devState.workingData);
          if (devState.dragEnabled) {
            setTimeout(() => {
              disableHoverInteractions();
              attachDragHandlers();
              document.body.classList.add('drag-mode');
            }, 0);
          }
          if (appState?.programRequirementsHTML?.[program.program_id]) {
            courseInfoDiv.html(appState.programRequirementsHTML[program.program_id]);
          }
        });
    });

    if (appState?.programRequirementsHTML?.[selectedId]) {
      courseInfoDiv.html(appState.programRequirementsHTML[selectedId]);
    }
  }

  // ---------- Drag handling ----------
  function attachDragHandlers() {
    if (!appState || !devState.workingData || !devState.dragEnabled) return;
    const infoCircles = appState.layers.infoNodes.selectAll('circle');
    infoCircles.on('.dev-drag', null);

    // Convert screen coords to the local (pre-zoom) coords of the zoomContainer
    function screenToLocal(event) {
      const svgNode = appState.layers.svg.node();
      const ctm = appState.layers.zoomContainer.node().getScreenCTM();
      if (!ctm) return [event.x, event.y];
      const pt = svgNode.createSVGPoint();
      const se = event.sourceEvent || event;
      pt.x = se.clientX;
      pt.y = se.clientY;
      const local = pt.matrixTransform(ctm.inverse());
      return [local.x, local.y];
    }

    const dragBehavior = d3.drag()
      .on('start.dev-drag', function(event) {
        if (!devState.dragEnabled) return;
        event.sourceEvent?.stopPropagation();
      })
      .on('drag.dev-drag', function(event, d) {
        if (!devState.dragEnabled) return;
        const [lx, ly] = screenToLocal(event);
        const rawDataPoint = {
          x: (lx - appState.xoffset) / appState.xscale,
          y: (appState.yoffset - ly) / appState.yscale
        };
        const screenPt = appState.dataToScreen(rawDataPoint.x, rawDataPoint.y);
        const sx = screenPt.x;
        const sy = screenPt.y;
        // Move visuals freely while dragging (no snap)
        appState.layers.courseNodes.selectAll('circle')
          .filter((c) => c.course_number === d.course_number)
          .attr('cx', sx)
          .attr('cy', sy);
        appState.layers.courseNumbers.selectAll('text')
          .filter((c) => c.course_number === d.course_number)
          .attr('transform', `translate(${sx}, ${sy})`)
          .attr('x', null)
          .attr('y', null);
        appState.layers.requisiteLines.selectAll('line')
          .filter((r) => r.course_number === d.course_number)
          .attr('x1', sx)
          .attr('y1', sy);
        appState.layers.requisiteLines.selectAll('line')
          .filter((r) => r.requisite_number === d.course_number)
          .attr('x2', sx)
          .attr('y2', sy);
        d3.select(this).attr('cx', sx).attr('cy', sy);
      })
      .on('end.dev-drag', function(event, d) {
        if (!devState.dragEnabled) return;
        const [lx, ly] = screenToLocal(event);
        const rawDataPoint = {
          x: (lx - appState.xoffset) / appState.xscale,
          y: (appState.yoffset - ly) / appState.yscale
        };
        const snapped = snapDataPoint(rawDataPoint);
        persistCoursePosition(d.course_number, snapped.x, snapped.y);
        setUnexportedChanges(true);
        toast(`Saved position for ${d.course_number}${devState.gridSnap ? ' (snapped to grid)' : ''}`);
        applyWorkingData(false, { refit: false });
      });

    infoCircles.call(dragBehavior);
  }

  // ---------- Actions ----------
  function placeCourseOnMap() {
    const payload = getFormPayload();
    if (!payload.number) {
      toast('Course number is required');
      return;
    }
    const coords = findAvailableCoords(computeCenterCoords());
    updateCourseMetadata(payload, coords);
    removeExistingRequisites(payload.number);
    addRequisites(payload.number, payload.prereqs, payload.coreqs, coords, payload.prereqTextLines, payload.coreqTextLines);
    setUnexportedChanges(true);
    applyWorkingData(false, { refit: false });
    refreshCourseOptions(payload.number);
    toast('Course placed. Drag to adjust, then save.');
  }

  function saveCourse(options = {}) {
    const { skipRefresh = false, silent = false } = options;
    const payload = getFormPayload();
    if (!payload.number) {
      if (!silent) toast('Course number is required');
      return;
    }
    const coords = getCoordsForCourse(payload.number);
    updateCourseMetadata(payload, coords);
    removeExistingRequisites(payload.number);
    addRequisites(payload.number, payload.prereqs, payload.coreqs, coords, payload.prereqTextLines, payload.coreqTextLines);
    setUnexportedChanges(true);
    applyWorkingData(false, { refit: false });
    if (!skipRefresh) {
      refreshCourseOptions(payload.number);
    }
    if (!silent) {
      toast(`Saved ${payload.number}`);
    }
  }

  function resetWorkingData() {
    if (!devState.baseData) return;
    devState.workingData = deepClone(devState.baseData);
    devState.gridSize = devState.baseGridSize || computeGridStep(devState.workingData);
    setUnexportedChanges(false);
    applyWorkingData(true);
    refreshCourseOptions();
    toast('Reverted to last loaded file');
  }

  function downloadJSON() {
    if (!devState.workingData) return;
    const blob = new Blob([JSON.stringify(devState.workingData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const filename = devState.currentDept === 'stats' ? 'data.json' : 'dsci_data.json';
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    setUnexportedChanges(false);
    toast('Downloaded updated JSON');
  }

  function importJSONFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        devState.workingData = deepClone(data);
        devState.baseData = deepClone(data);
        devState.baseGridSize = computeGridStep(devState.baseData);
        devState.gridSize = devState.baseGridSize;
        setUnexportedChanges(false);
        applyWorkingData(true);
        refreshCourseOptions();
        toast('Loaded custom JSON');
      } catch (err) {
        toast('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  async function loadDataset(dept, resetBase = true) {
    const requestId = ++devState.loadRequestId;
    devState.currentDept = dept;
    currentDepartment = dept;
    syncDeptUI();

    try {
      const data = await d3.json(DEV_DATA_FILES[dept]);
      if (requestId !== devState.loadRequestId) {
        return;
      }

      devState.workingData = deepClone(data);
      if (resetBase) {
        devState.baseData = deepClone(data);
        if (dept === 'stats') {
          devState.statsGridSize = computeGridStep(devState.baseData);
        }
        const computedGridSize = computeGridStep(devState.baseData);
        devState.baseGridSize = dept === 'dsci'
          ? (devState.statsGridSize || computedGridSize)
          : computedGridSize;
        devState.gridSize = devState.baseGridSize;
      } else {
        const computedGridSize = computeGridStep(devState.workingData);
        const targetGridSize = devState.baseGridSize || (dept === 'dsci'
          ? (devState.statsGridSize || computedGridSize)
          : computedGridSize);
        devState.gridSize = targetGridSize;
      }
      applyWorkingData(true, { refit: true });
      refreshCourseOptions();
      setUnexportedChanges(false);
      toast(`Loaded ${dept.toUpperCase()} dataset`);
    } catch (err) {
      console.warn('Failed to load dataset', dept, err);
      if (requestId === devState.loadRequestId) {
        toast(`Failed to load ${dept.toUpperCase()} dataset`);
      }
    }
  }

  // ---------- UI wiring ----------
  function setupChromeInteractions() {
    // Sidebar (mobile)
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('program-track-nav');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleSidebar = () => {
      hamburger?.classList.toggle('active');
      sidebar?.classList.toggle('active');
      overlay?.classList.toggle('active');
    };
    hamburger?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    // Legend panel
    const legendToggle = document.getElementById('legend-toggle');
    const legendPanel = document.getElementById('legend-panel');
    const legendClose = document.getElementById('legend-close');
    const toggleLegend = () => legendPanel?.classList.toggle('active');
    legendToggle?.addEventListener('click', toggleLegend);
    legendClose?.addEventListener('click', toggleLegend);

    // Dept toggles
    document.getElementById('dept-stats')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (devState.currentDept === 'stats') return;
      if (!confirmDatasetSwitch('stats')) return;
      loadDataset('stats');
    });
    document.getElementById('dept-dsci')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (devState.currentDept === 'dsci') return;
      if (!confirmDatasetSwitch('dsci')) return;
      loadDataset('dsci');
    });
  }

  function setupDevPanel() {
    const panel = document.getElementById('dev-panel');
    const toggleBtn = document.getElementById('dev-panel-toggle');
    const closeBtn = document.getElementById('dev-panel-close');
    const openPanel = () => panel?.classList.add('active');
    const closePanel = () => panel?.classList.remove('active');
    toggleBtn?.addEventListener('click', openPanel);
    closeBtn?.addEventListener('click', closePanel);

    document.getElementById('dev-reload-base')?.addEventListener('click', () => loadDataset(devState.currentDept, true));
    document.getElementById('dev-department')?.addEventListener('change', (e) => {
      const nextDept = e.target.value;
      if (nextDept === devState.currentDept) return;
      if (!confirmDatasetSwitch(nextDept)) {
        e.target.value = devState.currentDept;
        return;
      }
      loadDataset(nextDept);
    });
    document.getElementById('dev-import')?.addEventListener('change', (e) => importJSONFile(e.target.files[0]));
    document.getElementById('dev-export')?.addEventListener('click', downloadJSON);
    document.getElementById('dev-fit')?.addEventListener('click', () => appState?.fitMapToView(true));
    document.getElementById('dev-reset')?.addEventListener('click', resetWorkingData);
    document.getElementById('dev-place-course')?.addEventListener('click', placeCourseOnMap);
    document.getElementById('dev-save-course')?.addEventListener('click', saveCourse);

  // Make prereq/coreq multi-selects togglable with simple clicks
  enableClickMultiSelect('dev-prereqs');
  enableClickMultiSelect('dev-coreqs');

    // Auto-apply requisite changes when a course number is present
    const prereqSelect = document.getElementById('dev-prereqs');
    const coreqSelect = document.getElementById('dev-coreqs');
    const courseNumberInput = document.getElementById('dev-course-number');
    const autoSaveRequisites = () => {
      if (!courseNumberInput?.value.trim()) return;
      saveCourse({ skipRefresh: true, silent: true });
    };
    prereqSelect?.addEventListener('change', autoSaveRequisites);
    coreqSelect?.addEventListener('change', autoSaveRequisites);

    document.getElementById('dev-existing')?.addEventListener('change', (e) => {
      if (!e.target.value) return;
      setFormFromCourse(e.target.value);
    });

    // Drag toggle
    const dragToggle = document.getElementById('dev-drag-toggle');
    dragToggle?.addEventListener('change', (e) => {
      devState.dragEnabled = e.target.checked;
      if (devState.dragEnabled) {
        document.body.classList.add('drag-mode');
        disableHoverInteractions();
        attachDragHandlers();
      } else {
        document.body.classList.remove('drag-mode');
        appState?.layers?.infoNodes.selectAll('circle').on('.dev-drag', null);
        restoreHoverInteractions();
      }
    });

    // Grid snap toggle
    const gridToggle = document.getElementById('dev-grid-toggle');
    if (gridToggle) {
      gridToggle.checked = devState.gridSnap;
      gridToggle.addEventListener('change', (e) => {
        devState.gridSnap = e.target.checked;
        // Ensure dragging stays off if the drag toggle is off
        if (!devState.dragEnabled) {
          appState?.layers?.infoNodes.selectAll('circle').on('.dev-drag', null);
        }
        updateGridOverlay();
        if (devState.gridSnap) {
          const { xStep, yStep } = getGridSteps();
          toast(`Grid snap on (X step ${xStep}, Y step ${yStep})`);
        } else {
          toast('Freeform dragging enabled');
        }
      });
    }

    // Prereq chain toggle (if available)
    document.getElementById('dev-prereq-chain')?.addEventListener('change', (e) => {
      if (window.__courseMapperDev?.setPrereqChain) {
        window.__courseMapperDev.setPrereqChain(e.target.checked);
      }
    });
  }

  async function init() {
    document.body.classList.add('dev-mode');
    setupChromeInteractions();
    setupDevPanel();
    await loadDataset('stats', true);
    toast('Developer mode ready');
  }

  // Wait for main map to load before initializing
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
