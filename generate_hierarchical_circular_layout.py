#!/usr/bin/env python3
"""
Hierarchical Circular Arc Layout Generator
Generates a hierarchical layout where each layer forms a circular arc.
The original hierarchical structure is preserved but arranged in circular arcs with increasing radii.
"""

import json
import numpy as np
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Set
import copy

def load_data(filename: str) -> dict:
    """Load the course data from JSON file."""
    with open(filename, 'r') as f:
        return json.load(f)

def get_course_level(course_number: str) -> int:
    """Extract the course level (100, 200, 300, 400) from course number."""
    numeric_part = course_number[1:]
    level = int(numeric_part[0]) * 100
    return level

def assign_topological_levels(courses: List[str], prereq_graph: Dict[str, List[str]]) -> Dict[str, int]:
    """Assign levels using topological sorting to ensure prerequisites appear before dependents."""
    from collections import deque
    
    # Build reverse graph (dependents)
    dependents = defaultdict(list)
    in_degree = defaultdict(int)
    
    # Initialize all courses
    for course in courses:
        in_degree[course] = 0
    
    # Build dependency graph
    for course, prereqs in prereq_graph.items():
        if course in courses:
            for prereq in prereqs:
                if prereq in courses:
                    dependents[prereq].append(course)
                    in_degree[course] += 1
    
    # Topological sort with level assignment
    queue = deque()
    levels = {}
    
    # Start with courses that have no prerequisites
    for course in courses:
        if in_degree[course] == 0:
            queue.append(course)
            levels[course] = 0
    
    while queue:
        current = queue.popleft()
        current_level = levels[current]
        
        # Process all dependents
        for dependent in dependents[current]:
            in_degree[dependent] -= 1
            
            if dependent not in levels:
                levels[dependent] = current_level + 1
            else:
                levels[dependent] = max(levels[dependent], current_level + 1)
            
            if in_degree[dependent] == 0:
                queue.append(dependent)
    
    # Handle any remaining courses
    for course in courses:
        if course not in levels:
            original_level = get_course_level(course)
            levels[course] = original_level // 100
    
    # Apply special positioning rules
    if 'S449' in levels:
        max_level = max(levels.values()) if levels else 0
        levels['S449'] = max_level + 1
    
    # S307 and S308 should be on the same level
    if 'S307' in levels and 'S308' in levels:
        levels['S308'] = levels['S307']
    
    return levels

def map_levels_to_display(topological_levels: Dict[str, int]) -> Dict[str, int]:
    """Map topological levels to display levels."""
    unique_levels = sorted(set(topological_levels.values()))
    
    level_mapping = {}
    for i, topo_level in enumerate(unique_levels):
        display_level = (i + 1) * 100
        level_mapping[topo_level] = display_level
    
    display_levels = {}
    for course, topo_level in topological_levels.items():
        display_levels[course] = level_mapping[topo_level]
    
    return display_levels, len(unique_levels)

def get_department(course_number: str) -> str:
    """Get department from course number (S=STAT, M=MATH, D=DSCI)."""
    return course_number[0].upper()

def build_prerequisite_graph(requisites: List[dict]) -> Dict[str, List[str]]:
    """Build a prerequisite graph from requisites data."""
    prereq_graph = defaultdict(list)
    
    for req in requisites:
        course = req['course_number']
        prereq = req['requisite_number']
        prereq_graph[course].append(prereq)
    
    return dict(prereq_graph)

def barycenter_method(courses_by_level: Dict[int, List[str]], 
                     prereq_graph: Dict[str, List[str]], 
                     max_iterations: int = 10) -> Dict[str, int]:
    """Apply barycenter method to minimize crossings."""
    
    positions = {}
    levels = sorted(courses_by_level.keys())
    
    # Group by department within each level for initial positioning
    for level in levels:
        courses = courses_by_level[level]
        dept_groups = defaultdict(list)
        
        for course in courses:
            dept = get_department(course)
            dept_groups[dept].append(course)
        
        pos = 0
        dept_order = ['S', 'M', 'D']
        
        for dept in dept_order:
            if dept in dept_groups:
                dept_courses = sorted(dept_groups[dept])
                
                # Special handling for S307 and S308
                if 'S307' in dept_courses and 'S308' in dept_courses:
                    dept_courses = [c for c in dept_courses if c not in ['S307', 'S308']]
                    dept_courses = ['S307', 'S308'] + dept_courses
                
                for i, course in enumerate(dept_courses):
                    positions[course] = pos + i
                pos += len(dept_groups[dept]) + 1
    
    # Apply barycenter method
    for iteration in range(max_iterations):
        new_positions = positions.copy()
        
        for direction in ['up', 'down']:
            level_order = levels if direction == 'up' else reversed(levels)
            
            for level in level_order:
                courses = courses_by_level[level]
                level_positions = []
                
                for course in courses:
                    connected_positions = []
                    
                    if direction == 'up':
                        if course in prereq_graph:
                            for prereq in prereq_graph[course]:
                                if prereq in positions:
                                    connected_positions.append(positions[prereq])
                    else:
                        for other_course, other_prereqs in prereq_graph.items():
                            if course in other_prereqs and other_course in positions:
                                connected_positions.append(positions[other_course])
                    
                    if connected_positions:
                        barycenter = sum(connected_positions) / len(connected_positions)
                    else:
                        barycenter = positions[course]
                    
                    level_positions.append((barycenter, course))
                
                level_positions.sort(key=lambda x: x[0])
                for i, (_, course) in enumerate(level_positions):
                    new_positions[course] = i
        
        positions = new_positions
    
    return positions

def generate_circular_coordinates(courses_by_level: Dict[int, List[str]], 
                                  positions: Dict[str, int],
                                  num_levels: int) -> Dict[str, Tuple[float, float]]:
    """Generate x, y coordinates for circular arc layout.
    
    Each level forms a circular arc, with inner levels having smaller radii
    and outer levels having larger radii.
    """
    coordinates = {}
    
    levels = sorted(courses_by_level.keys())
    
    # Base radius for innermost level
    base_radius = 5.0
    radius_increment = 4.0  # How much to increase radius per level
    
    # Arc configuration
    # We'll use a semicircular arc (180 degrees) for spreading courses
    arc_span = np.pi  # 180 degrees in radians
    arc_start = -np.pi / 2  # Start from bottom (-90 degrees)
    
    for level_idx, level in enumerate(levels):
        # Calculate radius for this level (inner to outer)
        radius = base_radius + (level_idx * radius_increment)
        
        courses = courses_by_level[level]
        
        # Get positions for this level
        level_courses_with_pos = [(positions[course], course) for course in courses]
        level_courses_with_pos.sort()
        
        num_courses_in_level = len(courses)
        
        if num_courses_in_level == 1:
            # Single course - place at the top center of the arc
            angles = [arc_start + arc_span / 2]
        else:
            # Distribute courses evenly along the arc
            angle_spacing = arc_span / (num_courses_in_level - 1)
            angles = [arc_start + (i * angle_spacing) for i in range(num_courses_in_level)]
        
        # Convert polar to Cartesian coordinates
        for i, (_, course) in enumerate(level_courses_with_pos):
            angle = angles[i]
            x = radius * np.cos(angle)
            y = radius * np.sin(angle)
            
            coordinates[course] = (x, y)
    
    return coordinates

def update_program_data(data: dict, coordinates: Dict[str, Tuple[float, float]], program_id: int = 1) -> dict:
    """Update the program data with new coordinates."""
    new_data = copy.deepcopy(data)
    
    courses_program_key = f"courses_program{program_id}"
    if courses_program_key in new_data:
        for course_data in new_data[courses_program_key]:
            course_number = course_data['course_number']
            if course_number in coordinates:
                x, y = coordinates[course_number]
                course_data['x'] = x
                course_data['y'] = y
    
    requisites_program_key = f"requisites_program{program_id}"
    if requisites_program_key in new_data:
        for req_data in new_data[requisites_program_key]:
            course_number = req_data['course_number']
            requisite_number = req_data['requisite_number']
            
            if course_number in coordinates:
                x, y = coordinates[course_number]
                req_data['course_x'] = x
                req_data['course_y'] = y
            
            if requisite_number in coordinates:
                x, y = coordinates[requisite_number]
                req_data['requisite_x'] = x
                req_data['requisite_y'] = y
    
    return new_data

def main():
    """Main function to generate circular arc hierarchical layout."""
    print("Loading course data...")
    data = load_data('data/data.json')
    
    courses_program = data.get('courses_program1', [])
    requisites_program = data.get('requisites_program1', [])
    
    print(f"Found {len(courses_program)} courses and {len(requisites_program)} prerequisites")
    
    all_courses = []
    for course_data in courses_program:
        all_courses.append(course_data['course_number'])
    
    for req_data in requisites_program:
        prereq = req_data['requisite_number']
        if prereq not in all_courses:
            all_courses.append(prereq)
    
    print(f"Total courses including prerequisites: {len(all_courses)}")
    
    prereq_graph = build_prerequisite_graph(requisites_program)
    print(f"Built prerequisite graph with {len(prereq_graph)} courses having prerequisites")
    
    print("Assigning levels using topological sorting...")
    topological_levels = assign_topological_levels(all_courses, prereq_graph)
    display_levels, num_levels = map_levels_to_display(topological_levels)
    
    courses_by_level = defaultdict(list)
    for course in all_courses:
        level = display_levels[course]
        courses_by_level[level].append(course)
    
    print(f"\nCourses by level:")
    for level in sorted(courses_by_level.keys()):
        dept_count = Counter(get_department(c) for c in courses_by_level[level])
        print(f"  Level {level}: {len(courses_by_level[level])} courses {dict(dept_count)}")
        print(f"    Courses: {sorted(courses_by_level[level])}")
    
    print(f"\nTotal levels: {num_levels}")
    
    # Verify no prerequisite level issues
    issues = []
    for course, prereqs in prereq_graph.items():
        course_level = display_levels.get(course, 0)
        for prereq in prereqs:
            prereq_level = display_levels.get(prereq, 0)
            if prereq_level >= course_level:
                issues.append(f"{prereq} -> {course}: prereq level {prereq_level} >= course level {course_level}")
    
    if issues:
        print(f"⚠️  Found {len(issues)} level issues:")
        for issue in issues[:5]:
            print(f"    {issue}")
    else:
        print("✅ No prerequisite level issues found!")
    
    print("\nApplying barycenter method for ordering within levels...")
    positions = barycenter_method(courses_by_level, prereq_graph)
    
    print("Generating circular arc coordinates...")
    coordinates = generate_circular_coordinates(courses_by_level, positions, num_levels)
    
    # Calculate some stats about the circular layout
    all_x = [x for x, y in coordinates.values()]
    all_y = [y for x, y in coordinates.values()]
    print(f"  X range: [{min(all_x):.2f}, {max(all_x):.2f}]")
    print(f"  Y range: [{min(all_y):.2f}, {max(all_y):.2f}]")
    
    print("\nUpdating program data...")
    new_data = update_program_data(data, coordinates)
    
    new_data['layout_metadata'] = {
        'algorithm': 'hierarchical_circular_arc',
        'levels': list(courses_by_level.keys()),
        'total_courses': len(all_courses),
        'courses_by_level': {str(k): len(v) for k, v in courses_by_level.items()},
        'num_levels': num_levels,
        'description': 'Hierarchical layout with courses arranged in circular arcs'
    }
    
    output_file = 'data/data_hierarchical_circular.json'
    print(f"\nSaving circular arc hierarchical layout to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(new_data, f, indent=2)
    
    print(f"✅ Circular arc hierarchical layout generated successfully!")
    print(f"   - {num_levels} levels: {', '.join(map(str, sorted(courses_by_level.keys())))}")
    print(f"   - {len(all_courses)} total courses")
    if issues:
        print(f"   - ⚠️  {len(issues)} remaining level issues")
    else:
        print(f"   - ✅ No prerequisite level conflicts")
    print(f"   - Saved to: {output_file}")

if __name__ == "__main__":
    main()
