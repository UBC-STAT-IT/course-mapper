import json
import sys
import os
from collections import defaultdict

def load_data(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

def save_data(data, filepath):
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def build_prereq_graph(course_requisites, courses):
    course_set = {c['course_number'] for c in courses}
    prereqs = defaultdict(set)
    for req in course_requisites:
        course = req['course_number']
        prereq = req['requisite_number']
        if course in course_set and prereq in course_set:
            prereqs[course].add(prereq)
    return prereqs

def build_dependent_graph(prereqs):
    """Build reverse graph: for each course, who depends on it."""
    dependents = defaultdict(set)
    for course, prereq_set in prereqs.items():
        for prereq in prereq_set:
            dependents[prereq].add(course)
    return dependents

def compute_levels(courses, prereqs):
    """
    Compute hierarchical level for each course.
    Level 0 = no prerequisites, higher levels depend on lower ones.
    """
    course_numbers = [c['course_number'] for c in courses]
    levels = {}
    
    def get_level(course, visited=None):
        if visited is None:
            visited = set()
        if course in levels:
            return levels[course]
        if course in visited:
            return 0
        visited.add(course)
        
        if course not in prereqs or len(prereqs[course]) == 0:
            levels[course] = 0
            return 0
        
        max_prereq_level = max(get_level(p, visited) for p in prereqs[course])
        levels[course] = max_prereq_level + 1
        return levels[course]
    
    for course in course_numbers:
        get_level(course)
    
    return levels

def count_crossings(level_groups, positions, prereqs):
    """Count edge crossings between adjacent levels."""
    crossings = 0
    levels_sorted = sorted(level_groups.keys())
    
    for i in range(len(levels_sorted) - 1):
        lower_level = levels_sorted[i]
        upper_level = levels_sorted[i + 1]
        
        edges = []
        for course in level_groups[upper_level]:
            if course in prereqs:
                for prereq in prereqs[course]:
                    if prereq in positions and course in positions:
                        prereq_pos = positions[prereq]
                        course_pos = positions[course]
                        edges.append((prereq_pos, course_pos))
        
        for j in range(len(edges)):
            for k in range(j + 1, len(edges)):
                p1, c1 = edges[j]
                p2, c2 = edges[k]
                if (p1 < p2 and c1 > c2) or (p1 > p2 and c1 < c2):
                    crossings += 1
    
    return crossings

def barycenter_ordering(level_groups, prereqs, dependents, iterations=20):
    """
    Use barycenter heuristic to minimize edge crossings.
    Position each node at the average position of its neighbors.
    """
    positions = {}
    levels_sorted = sorted(level_groups.keys())
    
    for level in levels_sorted:
        courses = sorted(level_groups[level])
        for i, course in enumerate(courses):
            positions[course] = i
    
    for _ in range(iterations):
        for level in levels_sorted:
            courses = level_groups[level]
            barycenters = []
            
            for course in courses:
                neighbors = []
                if course in prereqs:
                    for prereq in prereqs[course]:
                        if prereq in positions:
                            neighbors.append(positions[prereq])
                if course in dependents:
                    for dep in dependents[course]:
                        if dep in positions:
                            neighbors.append(positions[dep])
                
                if neighbors:
                    bc = sum(neighbors) / len(neighbors)
                else:
                    bc = positions[course]
                barycenters.append((bc, course))
            
            barycenters.sort(key=lambda x: x[0])
            for i, (_, course) in enumerate(barycenters):
                positions[course] = i
        
        for level in reversed(levels_sorted):
            courses = level_groups[level]
            barycenters = []
            
            for course in courses:
                neighbors = []
                if course in prereqs:
                    for prereq in prereqs[course]:
                        if prereq in positions:
                            neighbors.append(positions[prereq])
                if course in dependents:
                    for dep in dependents[course]:
                        if dep in positions:
                            neighbors.append(positions[dep])
                
                if neighbors:
                    bc = sum(neighbors) / len(neighbors)
                else:
                    bc = positions[course]
                barycenters.append((bc, course))
            
            barycenters.sort(key=lambda x: x[0])
            for i, (_, course) in enumerate(barycenters):
                positions[course] = i
    
    return positions

def arrange_courses(courses, levels, prereqs):
    """
    Arrange courses: y based on level, x minimizes edge crossings.
    """
    level_groups = defaultdict(list)
    for course in courses:
        cn = course['course_number']
        level = levels.get(cn, 0)
        level_groups[level].append(cn)
    
    dependents = build_dependent_graph(prereqs)
    positions = barycenter_ordering(level_groups, prereqs, dependents)
    
    initial_crossings = count_crossings(level_groups, positions, prereqs)
    
    y_spacing = 3
    x_spacing = 2
    
    course_map = {c['course_number']: c for c in courses}
    arranged = []
    
    for level in sorted(level_groups.keys()):
        group = level_groups[level]
        group_with_pos = [(positions[cn], cn) for cn in group]
        group_with_pos.sort(key=lambda x: x[0])
        
        n = len(group)
        start_x = -(n - 1) * x_spacing / 2
        
        for i, (_, cn) in enumerate(group_with_pos):
            new_course = course_map[cn].copy()
            new_course['x'] = start_x + i * x_spacing
            new_course['y'] = level * y_spacing
            arranged.append(new_course)
    
    return arranged, initial_crossings

def update_requisites_coords(requisites, course_coords):
    """
    Update requisites with new course coordinates.
    """
    updated = []
    for req in requisites:
        new_req = req.copy()
        course = req['course_number']
        prereq = req['requisite_number']
        
        if course in course_coords:
            new_req['course_x'] = course_coords[course]['x']
            new_req['course_y'] = course_coords[course]['y']
        if prereq in course_coords:
            new_req['requisite_x'] = course_coords[prereq]['x']
            new_req['requisite_y'] = course_coords[prereq]['y']
        
        updated.append(new_req)
    return updated

def main():
    if len(sys.argv) < 2:
        print("Usage: python arrange_hierarchical.py <input.json> [output.json]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        base = os.path.splitext(input_file)[0]
        output_file = base + "_hierarchical.json"
    
    data = load_data(input_file)
    
    courses = data.get('courses', [])
    course_requisites = data.get('course_requisites', [])
    
    prereqs = build_prereq_graph(course_requisites, courses)
    levels = compute_levels(courses, prereqs)
    
    total_crossings = 0
    
    for key in list(data.keys()):
        if key.startswith('courses_program'):
            program_courses = data[key]
            arranged, crossings = arrange_courses(program_courses, levels, prereqs)
            total_crossings += crossings
            data[key] = arranged
            
            course_coords = {c['course_number']: {'x': c['x'], 'y': c['y']} for c in arranged}
            
            req_key = key.replace('courses_', 'requisites_')
            if req_key in data:
                data[req_key] = update_requisites_coords(data[req_key], course_coords)
    
    save_data(data, output_file)
    
    max_level = max(levels.values()) if levels else 0
    print(f"Arranged {len(courses)} courses into {max_level + 1} levels")
    print(f"Edge crossings after optimization: {total_crossings}")
    print(f"Output saved to: {output_file}")

if __name__ == "__main__":
    main()
