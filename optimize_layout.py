#!/usr/bin/env python3
"""
Optimize course layout using Sugiyama algorithm to minimize edge crossings.
This script reads the data.json file, applies the Sugiyama layered graph layout
algorithm, and outputs an optimized version with new coordinates.
"""

import json
import networkx as nx
from collections import defaultdict
import copy

def load_data(filename):
    """Load the course data from JSON file."""
    with open(filename, 'r') as f:
        return json.load(f)

def create_graph_from_data(data):
    """Create a directed graph from the course prerequisite data."""
    G = nx.DiGraph()
    
    # Add all courses as nodes
    for course in data['courses']:
        G.add_node(course['course_number'])
    
    # Add prerequisite edges (prerequisite -> course)
    for req in data['course_requisites']:
        if req['is_primary'] == 1:  # Only use primary prerequisites
            prerequisite = req['requisite_number']
            course = req['course_number']
            G.add_edge(prerequisite, course)
    
    return G

def assign_layers(G):
    """Assign courses to layers using topological sorting."""
    # Start with courses that have no prerequisites
    layers = []
    remaining_nodes = set(G.nodes())
    processed = set()
    
    while remaining_nodes:
        # Find nodes with no unprocessed predecessors
        current_layer = []
        for node in remaining_nodes:
            predecessors = set(G.predecessors(node))
            if predecessors.issubset(processed):
                current_layer.append(node)
        
        if not current_layer:
            # Handle cycles by picking the node with minimum in-degree
            min_in_degree = min(G.in_degree(node) for node in remaining_nodes)
            current_layer = [node for node in remaining_nodes 
                           if G.in_degree(node) == min_in_degree][:1]
        
        layers.append(current_layer)
        processed.update(current_layer)
        remaining_nodes.difference_update(current_layer)
    
    return layers

def reduce_crossings(layers, G):
    """Reduce edge crossings using barycenter heuristic."""
    # Multiple passes of the barycenter heuristic
    for iteration in range(10):
        # Forward pass (top to bottom)
        for i in range(1, len(layers)):
            # Calculate barycenters for current layer based on previous layer
            node_positions = {}
            for j, node in enumerate(layers[i]):
                predecessors = list(G.predecessors(node))
                if predecessors:
                    # Find positions of predecessors in previous layer
                    pred_positions = []
                    for pred in predecessors:
                        if pred in layers[i-1]:
                            pred_positions.append(layers[i-1].index(pred))
                    if pred_positions:
                        node_positions[node] = sum(pred_positions) / len(pred_positions)
                    else:
                        node_positions[node] = j
                else:
                    node_positions[node] = j
            
            # Sort nodes by their barycenter values
            layers[i].sort(key=lambda x: node_positions.get(x, 0))
        
        # Backward pass (bottom to top)
        for i in range(len(layers) - 2, -1, -1):
            # Calculate barycenters for current layer based on next layer
            node_positions = {}
            for j, node in enumerate(layers[i]):
                successors = list(G.successors(node))
                if successors:
                    # Find positions of successors in next layer
                    succ_positions = []
                    for succ in successors:
                        if succ in layers[i+1]:
                            succ_positions.append(layers[i+1].index(succ))
                    if succ_positions:
                        node_positions[node] = sum(succ_positions) / len(succ_positions)
                    else:
                        node_positions[node] = j
                else:
                    node_positions[node] = j
            
            # Sort nodes by their barycenter values
            layers[i].sort(key=lambda x: node_positions.get(x, 0))

def assign_coordinates(layers, original_data):
    """Assign x,y coordinates to nodes based on their layer positions with circular arc layout growing from bottom to top."""
    import math
    coordinates = {}
    
    # Calculate spacing - increased for better visibility
    max_layer_size = max(len(layer) for layer in layers)
    base_radius = 3.0  # Base radius for the circular layout (increased)
    layer_spacing = 2.5  # Radial spacing between layers (increased)
    
    for layer_idx, layer in enumerate(layers):
        # Calculate radius for this layer (increases upward)
        radius = base_radius + layer_idx * layer_spacing
        
        if len(layer) == 1:
            # Single node: place at top center (90 degrees)
            angle = math.pi / 2  # 90 degrees - pointing up
            x = radius * math.cos(angle)
            y = radius * math.sin(angle)
            coordinates[layer[0]] = {'x': x, 'y': y}
        else:
            # Multiple nodes: arrange in an arc
            # Arc span depends on number of nodes (more nodes = wider arc)
            max_arc_span = math.pi * 0.6  # Maximum arc span (about 108 degrees)
            arc_span = min(max_arc_span, len(layer) * 0.4)  # Adaptive arc span (increased)
            
            # Calculate angles for each node, centered around 90 degrees (upward)
            center_angle = math.pi / 2  # 90 degrees - pointing up
            if len(layer) > 1:
                angle_step = arc_span / (len(layer) - 1)
                start_angle = center_angle - arc_span / 2  # Center the arc around 90 degrees
            else:
                angle_step = 0
                start_angle = center_angle
            
            for node_idx, node in enumerate(layer):
                angle = start_angle + node_idx * angle_step
                x = radius * math.cos(angle)
                y = radius * math.sin(angle)
                coordinates[node] = {'x': x, 'y': y}
    
    return coordinates

def update_data_with_coordinates(data, coordinates):
    """Update the data structure with new coordinates."""
    updated_data = copy.deepcopy(data)
    
    # Update coordinates for each program
    for program_key in updated_data:
        if program_key.startswith('courses_program'):
            for course in updated_data[program_key]:
                course_number = course['course_number']
                if course_number in coordinates:
                    course['x'] = coordinates[course_number]['x']
                    course['y'] = coordinates[course_number]['y']
    
    # Update requisites coordinates
    for program_key in updated_data:
        if program_key.startswith('requisites_program'):
            for requisite in updated_data[program_key]:
                course_number = requisite['course_number']
                requisite_number = requisite['requisite_number']
                
                if course_number in coordinates:
                    requisite['course_x'] = coordinates[course_number]['x']
                    requisite['course_y'] = coordinates[course_number]['y']
                
                if requisite_number in coordinates:
                    requisite['requisite_x'] = coordinates[requisite_number]['x']
                    requisite['requisite_y'] = coordinates[requisite_number]['y']
    
    return updated_data

def count_crossings(layers, G):
    """Count the number of edge crossings in the current layout."""
    crossings = 0
    
    for i in range(len(layers) - 1):
        current_layer = layers[i]
        next_layer = layers[i + 1]
        
        # Get all edges between these layers
        edges = []
        for j, node1 in enumerate(current_layer):
            for k, node2 in enumerate(next_layer):
                if G.has_edge(node1, node2):
                    edges.append((j, k))
        
        # Count crossings between edges
        for e1_idx, (s1, t1) in enumerate(edges):
            for s2, t2 in edges[e1_idx + 1:]:
                if (s1 < s2 and t1 > t2) or (s1 > s2 and t1 < t2):
                    crossings += 1
    
    return crossings

def main():
    """Main function to optimize the course layout."""
    print("Loading course data...")
    data = load_data('data/data.json')
    
    print("Creating graph from prerequisite relationships...")
    G = create_graph_from_data(data)
    print(f"Graph has {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
    
    print("Assigning courses to layers...")
    layers = assign_layers(G)
    print(f"Created {len(layers)} layers")
    for i, layer in enumerate(layers):
        print(f"  Layer {i}: {len(layer)} courses")
    
    print("Reducing edge crossings...")
    initial_crossings = count_crossings(layers, G)
    print(f"Initial crossings: {initial_crossings}")
    
    reduce_crossings(layers, G)
    final_crossings = count_crossings(layers, G)
    print(f"Final crossings: {final_crossings}")
    print(f"Reduction: {initial_crossings - final_crossings} crossings ({(initial_crossings - final_crossings) / max(initial_crossings, 1) * 100:.1f}%)")
    
    print("Assigning optimized coordinates...")
    coordinates = assign_coordinates(layers, data)
    
    print("Updating data with new coordinates...")
    updated_data = update_data_with_coordinates(data, coordinates)
    
    print("Saving optimized data...")
    with open('data/data_optimized.json', 'w') as f:
        json.dump(updated_data, f, indent=2)
    
    print("✅ Optimization complete! New file saved as 'data/data_optimized.json'")
    print("\nTo use the optimized layout:")
    print("1. Backup your original data.json file")
    print("2. Replace data.json with data_optimized.json")
    print("3. Refresh your web application")

if __name__ == "__main__":
    main()
