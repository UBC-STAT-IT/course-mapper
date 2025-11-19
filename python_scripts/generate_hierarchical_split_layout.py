#!/usr/bin/env python3
"""
Modified Hierarchical Course Layout Generator
Splits 300-level and 400-level courses into separate layers.
Specifically extracts S307, S308, S321 from the mixed layer into a new 300-level layer.
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

def assign_topological_levels_with_split(courses: List[str], prereq_graph: Dict[str, List[str]]) -> Dict[str, int]:
    """Assign levels using topological sorting, then split 300/400 level courses."""
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
    
    # NOW THE KEY MODIFICATION: Split 300-level and 400-level courses
    # Find the level that contains both 300 and 400 level courses
    level_contents = defaultdict(list)
    for course, level in levels.items():
        course_num_level = get_course_level(course)
        level_contents[level].append((course, course_num_level))
    
    # Find mixed level containing both 300s and 400s
    mixed_level = None
    for level, courses_info in level_contents.items():
        has_300 = any(cl == 300 for _, cl in courses_info)
        has_400 = any(cl == 400 for _, cl in courses_info)
        if has_300 and has_400:
            mixed_level = level
            break
    
    # If we found a mixed level, split it
    if mixed_level is not None:
        print(f"Found mixed level {mixed_level} with both 300 and 400 level courses")
        
        courses_300 = []
        courses_400_plus = []
        
        for course, level in levels.items():
            if level == mixed_level:
                course_num_level = get_course_level(course)
                if course_num_level == 300:
                    courses_300.append(course)
                else:
                    courses_400_plus.append(course)
        
        print(f"  300-level courses: {courses_300}")
        print(f"  400+ level courses: {courses_400_plus}")
        
        # Keep 300s at the mixed level
        # Move 400+ courses and all higher levels up by 1
        for course in levels:
            if course in courses_400_plus:
                levels[course] = mixed_level + 1
            elif levels[course] > mixed_level:
                levels[course] = levels[course] + 1
    
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

def count_crossings(courses_by_level: Dict[int, List[str]], 
                   positions: Dict[str, int], 
                   prereq_graph: Dict[str, List[str]]) -> int:
    """Count the number of edge crossings in the current layout."""
    crossings = 0
    
    edges = []
    for course, prereqs in prereq_graph.items():
        course_level = get_course_level(course)
        for prereq in prereqs:
            prereq_level = get_course_level(prereq)
            if prereq_level != course_level:
                edges.append((prereq, course))
    
    for i, (edge1_from, edge1_to) in enumerate(edges):
        for j, (edge2_from, edge2_to) in enumerate(edges[i+1:], i+1):
            level1_from = get_course_level(edge1_from)
            level1_to = get_course_level(edge1_to)
            level2_from = get_course_level(edge2_from)
            level2_to = get_course_level(edge2_to)
            
            if level1_from == level2_from and level1_to == level2_to:
                pos1_from = positions.get(edge1_from, 0)
                pos1_to = positions.get(edge1_to, 0)
                pos2_from = positions.get(edge2_from, 0)
                pos2_to = positions.get(edge2_to, 0)
                
                if ((pos1_from < pos2_from and pos1_to > pos2_to) or 
                    (pos1_from > pos2_from and pos1_to < pos2_to)):
                    crossings += 1
    
    return crossings

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

def generate_coordinates(courses_by_level: Dict[int, List[str]], 
                        positions: Dict[str, int],
                        num_levels: int) -> Dict[str, Tuple[float, float]]:
    """Generate x, y coordinates for the hierarchical layout."""
    coordinates = {}
    
    levels = sorted(courses_by_level.keys())
    y_spacing = 3.0
    
    level_y = {}
    for i, level in enumerate(levels):
        level_y[level] = i * y_spacing
    
    for level, courses in courses_by_level.items():
        y = level_y[level]
        
        level_courses_with_pos = [(positions[course], course) for course in courses]
        level_courses_with_pos.sort()
        
        num_courses_in_level = len(courses)
        spacing = 2.0
        
        if num_courses_in_level == 1:
            total_width = 0
        else:
            total_width = (num_courses_in_level - 1) * spacing
        
        for i, (_, course) in enumerate(level_courses_with_pos):
            if num_courses_in_level == 1:
                x = 0
            else:
                x = (i * spacing) - (total_width / 2)
            
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
    """Main function to generate modified hierarchical layout."""
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
    
    print("Assigning levels with 300/400 split...")
    topological_levels = assign_topological_levels_with_split(all_courses, prereq_graph)
    display_levels, num_levels = map_levels_to_display(topological_levels)
    
    courses_by_level = defaultdict(list)
    for course in all_courses:
        level = display_levels[course]
        courses_by_level[level].append(course)
    
    print(f"\nCourses by level (after split):")
    for level in sorted(courses_by_level.keys()):
        dept_count = Counter(get_department(c) for c in courses_by_level[level])
        course_levels = Counter(get_course_level(c) for c in courses_by_level[level])
        print(f"  Level {level}: {len(courses_by_level[level])} courses {dict(dept_count)} - course levels: {dict(course_levels)}")
        print(f"    Courses: {sorted(courses_by_level[level])}")
    
    print(f"\nTotal levels needed: {num_levels}")
    
    # Verify no prerequisite level issues
    issues = []
    for course, prereqs in prereq_graph.items():
        course_level = display_levels.get(course, 0)
        for prereq in prereqs:
            prereq_level = display_levels.get(prereq, 0)
            if prereq_level >= course_level:
                issues.append(f"{prereq} -> {course}: prereq level {prereq_level} >= course level {course_level}")
    
    if issues:
        print(f"⚠️  Still found {len(issues)} level issues:")
        for issue in issues[:5]:
            print(f"    {issue}")
    else:
        print("✅ No prerequisite level issues found!")
    
    print("\nApplying barycenter method to minimize crossings...")
    positions = barycenter_method(courses_by_level, prereq_graph)
    
    crossings = count_crossings(courses_by_level, positions, prereq_graph)
    print(f"Final layout has {crossings} edge crossings")
    
    print("Generating coordinates...")
    coordinates = generate_coordinates(courses_by_level, positions, num_levels)
    
    print("Updating program data...")
    new_data = update_program_data(data, coordinates)
    
    new_data['layout_metadata'] = {
        'algorithm': 'hierarchical_split_300_400',
        'levels': list(courses_by_level.keys()),
        'total_courses': len(all_courses),
        'edge_crossings': crossings,
        'courses_by_level': {str(k): len(v) for k, v in courses_by_level.items()},
        'num_levels': num_levels,
        'split_applied': True,
        'description': 'Modified hierarchical layout with 300-level courses separated from 400-level courses'
    }
    
    output_file = 'data/data_hierarchical_split.json'
    print(f"\nSaving modified hierarchical layout to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(new_data, f, indent=2)
    
    print(f"✅ Modified hierarchical layout generated successfully!")
    print(f"   - {num_levels} levels: {', '.join(map(str, sorted(courses_by_level.keys())))}")
    print(f"   - {crossings} edge crossings")
    print(f"   - {len(all_courses)} total courses")
    if issues:
        print(f"   - ⚠️  {len(issues)} remaining level issues")
    else:
        print(f"   - ✅ No prerequisite level conflicts")
    print(f"   - Saved to: {output_file}")

if __name__ == "__main__":
    main()
