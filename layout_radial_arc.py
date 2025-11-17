#!/usr/bin/env python3
"""
Radial Arc Layout Algorithm for Course Prerequisites
This creates a circular/radial layout where courses are arranged in concentric arcs
based on their prerequisite depth. Foundation courses are in the center, and advanced
courses radiate outward.
"""

import json
import networkx as nx
import copy
import math

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

def assign_layers_by_depth(G):
    """Assign courses to layers based on longest path from root nodes."""
    layers = []
    node_to_layer = {}
    
    # Find all root nodes (no prerequisites)
    root_nodes = [node for node in G.nodes() if G.in_degree(node) == 0]
    
    # Calculate depth for each node
    def calculate_depth(node, visited=None):
        if visited is None:
            visited = set()
        
        if node in visited:
            return 0
        
        visited.add(node)
        
        predecessors = list(G.predecessors(node))
        if not predecessors:
            return 0
        
        max_depth = 0
        for pred in predecessors:
            depth = calculate_depth(pred, visited.copy())
            max_depth = max(max_depth, depth + 1)
        
        return max_depth
    
    # Assign each node to a layer based on its depth
    for node in G.nodes():
        depth = calculate_depth(node)
        node_to_layer[node] = depth
    
    # Group nodes by layer
    max_layer = max(node_to_layer.values()) if node_to_layer else 0
    layers = [[] for _ in range(max_layer + 1)]
    
    for node, layer_idx in node_to_layer.items():
        layers[layer_idx].append(node)
    
    return layers, node_to_layer

def cluster_within_layers(layers, G):
    """
    Organize nodes within each layer to minimize crossings and group related courses.
    Uses barycenter heuristic similar to Sugiyama algorithm.
    """
    # Multiple passes to optimize positioning
    for iteration in range(10):
        # Forward pass
        for i in range(1, len(layers)):
            node_positions = {}
            for node in layers[i]:
                predecessors = list(G.predecessors(node))
                if predecessors:
                    pred_positions = []
                    for pred in predecessors:
                        for prev_layer_idx in range(i):
                            if pred in layers[prev_layer_idx]:
                                pred_positions.append(layers[prev_layer_idx].index(pred))
                                break
                    if pred_positions:
                        node_positions[node] = sum(pred_positions) / len(pred_positions)
                    else:
                        node_positions[node] = layers[i].index(node)
                else:
                    node_positions[node] = layers[i].index(node)
            
            layers[i].sort(key=lambda x: node_positions.get(x, 0))
        
        # Backward pass
        for i in range(len(layers) - 2, -1, -1):
            node_positions = {}
            for node in layers[i]:
                successors = list(G.successors(node))
                if successors:
                    succ_positions = []
                    for succ in successors:
                        for next_layer_idx in range(i + 1, len(layers)):
                            if succ in layers[next_layer_idx]:
                                succ_positions.append(layers[next_layer_idx].index(succ))
                                break
                    if succ_positions:
                        node_positions[node] = sum(succ_positions) / len(succ_positions)
                    else:
                        node_positions[node] = layers[i].index(node)
                else:
                    node_positions[node] = layers[i].index(node)
            
            layers[i].sort(key=lambda x: node_positions.get(x, 0))

def assign_radial_coordinates(layers, G):
    """
    Assign radial coordinates to nodes.
    - Inner circles: Foundation courses
    - Outer circles: Advanced courses
    - Angular position: Based on clustering/grouping
    """
    coordinates = {}
    
    # Configuration
    min_radius = 2.0  # Radius for innermost layer (foundation courses)
    radius_increment = 2.5  # Space between concentric circles
    
    for layer_idx, layer in enumerate(layers):
        # Calculate radius for this layer
        radius = min_radius + layer_idx * radius_increment
        
        if len(layer) == 1:
            # Single node: place at angle 0 (pointing right)
            angle = 0
            x = radius * math.cos(angle)
            y = radius * math.sin(angle)
            coordinates[layer[0]] = {'x': x, 'y': y, 'radius': radius, 'angle': angle}
        else:
            # Multiple nodes: distribute around the circle
            # Full circle distribution (0 to 2π)
            angle_step = (2 * math.pi) / len(layer)
            
            for node_idx, node in enumerate(layer):
                # Start from 90 degrees (top) and go clockwise
                angle = (math.pi / 2) - (node_idx * angle_step)
                x = radius * math.cos(angle)
                y = radius * math.sin(angle)
                coordinates[node] = {
                    'x': x, 
                    'y': y, 
                    'radius': radius, 
                    'angle': angle
                }
    
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
                    course['r'] = coordinates[course_number]['radius']
                    course['theta'] = math.degrees(coordinates[course_number]['angle'])
    
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

def count_edge_length(coordinates, G):
    """Calculate total edge length (shorter is better)."""
    total_length = 0
    for edge in G.edges():
        source, target = edge
        if source in coordinates and target in coordinates:
            x1, y1 = coordinates[source]['x'], coordinates[source]['y']
            x2, y2 = coordinates[target]['x'], coordinates[target]['y']
            length = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            total_length += length
    return total_length

def main():
    """Main function to create radial arc layout."""
    print("=" * 60)
    print("RADIAL ARC LAYOUT GENERATOR")
    print("=" * 60)
    print("\nLoading course data...")
    data = load_data('data/data.json')
    
    print("Creating graph from prerequisite relationships...")
    G = create_graph_from_data(data)
    print(f"  📊 Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    print("\nAssigning courses to layers by prerequisite depth...")
    layers, node_to_layer = assign_layers_by_depth(G)
    print(f"  🎯 Created {len(layers)} concentric layers:")
    for i, layer in enumerate(layers):
        print(f"     Layer {i} (radius {2.0 + i * 2.5:.1f}): {len(layer)} courses")
    
    print("\nOptimizing node positions within layers...")
    cluster_within_layers(layers, G)
    print("  ✨ Clustering complete")
    
    print("\nAssigning radial coordinates...")
    coordinates = assign_radial_coordinates(layers, G)
    
    # Calculate statistics
    avg_edge_length = count_edge_length(coordinates, G) / max(G.number_of_edges(), 1)
    print(f"  📏 Average edge length: {avg_edge_length:.2f}")
    
    print("\nUpdating data with new coordinates...")
    updated_data = update_data_with_coordinates(data, coordinates)
    
    print("Saving radial arc layout...")
    output_file = 'data/data_radial_arc.json'
    with open(output_file, 'w') as f:
        json.dump(updated_data, f, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ RADIAL ARC LAYOUT COMPLETE!")
    print("=" * 60)
    print(f"\n📁 Output file: {output_file}")
    print("\nLayout characteristics:")
    print("  • Foundation courses in the center")
    print("  • Advanced courses radiate outward")
    print("  • Courses distributed in concentric circles")
    print("  • Prerequisites flow from inner to outer rings")
    print("\nTo use this layout:")
    print("  1. Copy data_radial_arc.json to data.json")
    print("  2. Refresh your web application")
    print("  3. View the circular prerequisite flow!\n")

if __name__ == "__main__":
    main()
