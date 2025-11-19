#!/usr/bin/env python3
"""
Horizontal Arc Layout Algorithm for Course Prerequisites
This creates a left-to-right flowing layout where courses are arranged in vertical arcs
based on their prerequisite depth. Foundation courses on the left, advanced on the right.
Each level forms a gentle vertical arc for visual appeal.
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
    
    # Calculate depth for each node (longest path from any root)
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

def reduce_crossings(layers, G):
    """
    Reduce edge crossings using barycenter heuristic.
    This minimizes the visual clutter of crossing prerequisite lines.
    """
    for iteration in range(15):  # More iterations for better optimization
        # Forward pass (left to right)
        for i in range(1, len(layers)):
            node_positions = {}
            for node in layers[i]:
                predecessors = list(G.predecessors(node))
                if predecessors:
                    pred_positions = []
                    for pred in predecessors:
                        if pred in layers[i-1]:
                            pred_positions.append(layers[i-1].index(pred))
                    if pred_positions:
                        node_positions[node] = sum(pred_positions) / len(pred_positions)
                    else:
                        node_positions[node] = layers[i].index(node)
                else:
                    node_positions[node] = layers[i].index(node)
            
            layers[i].sort(key=lambda x: node_positions.get(x, 0))
        
        # Backward pass (right to left)
        for i in range(len(layers) - 2, -1, -1):
            node_positions = {}
            for node in layers[i]:
                successors = list(G.successors(node))
                if successors:
                    succ_positions = []
                    for succ in successors:
                        if succ in layers[i+1]:
                            succ_positions.append(layers[i+1].index(succ))
                    if succ_positions:
                        node_positions[node] = sum(succ_positions) / len(succ_positions)
                    else:
                        node_positions[node] = layers[i].index(node)
                else:
                    node_positions[node] = layers[i].index(node)
            
            layers[i].sort(key=lambda x: node_positions.get(x, 0))

def assign_horizontal_arc_coordinates(layers, G):
    """
    Assign coordinates with horizontal flow and vertical arcs.
    - X-axis: Prerequisite depth (left = foundation, right = advanced)
    - Y-axis: Position within layer, arranged in gentle arc
    """
    coordinates = {}
    
    # Configuration
    x_spacing = 4.5  # Horizontal spacing between layers
    base_y_spacing = 2.0  # Base vertical spacing between nodes
    arc_curvature = 0.3  # How much the vertical arrangement curves (0 = straight line)
    
    for layer_idx, layer in enumerate(layers):
        # X position for this layer
        x = layer_idx * x_spacing
        
        if len(layer) == 1:
            # Single node: place at y=0 (center)
            y = 0
            coordinates[layer[0]] = {'x': x, 'y': y}
        else:
            # Multiple nodes: arrange in a vertical arc
            # Calculate vertical spacing based on number of nodes
            y_spacing = base_y_spacing
            total_height = (len(layer) - 1) * y_spacing
            
            # Center the arc vertically
            start_y = -total_height / 2
            
            for node_idx, node in enumerate(layer):
                # Base y position
                y = start_y + node_idx * y_spacing
                
                # Add arc curvature (parabolic shape)
                # Maximum curve at the edges, flat in the middle
                center_offset = node_idx - (len(layer) - 1) / 2
                normalized_offset = center_offset / ((len(layer) - 1) / 2) if len(layer) > 1 else 0
                
                # Parabolic curve: pushes outward at edges
                arc_offset = arc_curvature * (normalized_offset ** 2) * total_height
                y += arc_offset
                
                coordinates[node] = {'x': x, 'y': y}
    
    return coordinates

def assign_horizontal_arc_coordinates_compact(layers, G):
    """
    Alternative: More compact horizontal arc layout with dynamic spacing.
    Adjusts spacing based on connectivity to reduce edge length.
    """
    coordinates = {}
    
    # Configuration
    x_spacing = 5.0  # Horizontal spacing between layers
    min_y_spacing = 1.5  # Minimum vertical spacing
    max_y_spacing = 3.0  # Maximum vertical spacing
    arc_strength = 0.25  # Arc curvature strength
    
    for layer_idx, layer in enumerate(layers):
        x = layer_idx * x_spacing
        
        if len(layer) == 1:
            coordinates[layer[0]] = {'x': x, 'y': 0}
        else:
            # Adaptive spacing based on connectivity
            node_connectivity = []
            for node in layer:
                total_connections = G.in_degree(node) + G.out_degree(node)
                node_connectivity.append(total_connections)
            
            # Use average connectivity to determine spacing
            avg_connectivity = sum(node_connectivity) / len(node_connectivity) if node_connectivity else 1
            y_spacing = min_y_spacing + (max_y_spacing - min_y_spacing) * (1 / (1 + avg_connectivity))
            
            total_height = (len(layer) - 1) * y_spacing
            start_y = -total_height / 2
            
            for node_idx, node in enumerate(layer):
                y = start_y + node_idx * y_spacing
                
                # Add gentle arc curvature
                center_offset = node_idx - (len(layer) - 1) / 2
                normalized_offset = center_offset / ((len(layer) - 1) / 2) if len(layer) > 1 else 0
                arc_offset = arc_strength * (normalized_offset ** 2) * total_height
                
                y += arc_offset
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
    """Count the number of edge crossings between adjacent layers."""
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
        
        # Count crossings
        for e1_idx, (s1, t1) in enumerate(edges):
            for s2, t2 in edges[e1_idx + 1:]:
                if (s1 < s2 and t1 > t2) or (s1 > s2 and t1 < t2):
                    crossings += 1
    
    return crossings

def calculate_edge_length(coordinates, G):
    """Calculate total edge length."""
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
    """Main function to create horizontal arc layout."""
    print("=" * 60)
    print("HORIZONTAL ARC LAYOUT GENERATOR")
    print("=" * 60)
    print("\nLoading course data...")
    data = load_data('data/data.json')
    
    print("Creating graph from prerequisite relationships...")
    G = create_graph_from_data(data)
    print(f"  📊 Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    print("\nAssigning courses to layers by prerequisite depth...")
    layers, node_to_layer = assign_layers_by_depth(G)
    print(f"  🎯 Created {len(layers)} vertical layers:")
    for i, layer in enumerate(layers):
        print(f"     Layer {i} (x = {i * 4.5:.1f}): {len(layer)} courses")
    
    print("\nOptimizing to reduce edge crossings...")
    initial_crossings = count_crossings(layers, G)
    print(f"  Initial crossings: {initial_crossings}")
    
    reduce_crossings(layers, G)
    
    final_crossings = count_crossings(layers, G)
    reduction = initial_crossings - final_crossings
    reduction_pct = (reduction / max(initial_crossings, 1)) * 100
    print(f"  Final crossings: {final_crossings}")
    print(f"  ✨ Reduced by {reduction} crossings ({reduction_pct:.1f}%)")
    
    print("\nAssigning horizontal arc coordinates...")
    coordinates = assign_horizontal_arc_coordinates_compact(layers, G)
    
    # Calculate statistics
    avg_edge_length = calculate_edge_length(coordinates, G) / max(G.number_of_edges(), 1)
    print(f"  📏 Average edge length: {avg_edge_length:.2f}")
    
    print("\nUpdating data with new coordinates...")
    updated_data = update_data_with_coordinates(data, coordinates)
    
    print("Saving horizontal arc layout...")
    output_file = 'data/data_horizontal_arc.json'
    with open(output_file, 'w') as f:
        json.dump(updated_data, f, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ HORIZONTAL ARC LAYOUT COMPLETE!")
    print("=" * 60)
    print(f"\n📁 Output file: {output_file}")
    print("\nLayout characteristics:")
    print("  • Foundation courses on the left")
    print("  • Advanced courses flow to the right")
    print("  • Courses arranged in vertical arcs")
    print("  • Minimized edge crossings")
    print("  • Prerequisites flow left → right")
    print("\nTo use this layout:")
    print("  1. Copy data_horizontal_arc.json to data.json")
    print("  2. Refresh your web application")
    print("  3. Enjoy the flowing prerequisite structure!\n")

if __name__ == "__main__":
    main()
