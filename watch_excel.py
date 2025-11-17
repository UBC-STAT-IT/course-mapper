#!/usr/bin/env python3
"""
File watcher script that automatically runs excel_to_json.py
whenever data.xlsx is modified.

Usage:
    python3 watch_excel.py

To stop: Press Ctrl+C
"""

import sys
import time
import subprocess
import os
from pathlib import Path

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("Error: watchdog library not found.")
    print("Please install it by running: pip3 install watchdog")
    sys.exit(1)


class ExcelFileHandler(FileSystemEventHandler):
    def __init__(self, excel_file_path, script_path):
        self.excel_file_path = Path(excel_file_path).resolve()
        self.script_path = Path(script_path).resolve()
        self.last_modified = 0
        self.cooldown = 1  # seconds to wait before processing another change
        
    def on_modified(self, event):
        # Ignore directory events
        if event.is_directory:
            return
        
        # Check if the modified file is our Excel file
        if Path(event.src_path).resolve() == self.excel_file_path:
            self.handle_change("modified")
    
    def on_created(self, event):
        # Ignore directory events
        if event.is_directory:
            return
        
        # Excel often creates a new file when saving
        if Path(event.src_path).resolve() == self.excel_file_path:
            self.handle_change("created")
    
    def on_moved(self, event):
        # Ignore directory events
        if event.is_directory:
            return
        
        # Excel sometimes moves files when saving (atomic write)
        if hasattr(event, 'dest_path') and Path(event.dest_path).resolve() == self.excel_file_path:
            self.handle_change("moved")
    
    def handle_change(self, event_type):
        # Debounce: ignore if modified too recently
        current_time = time.time()
        if current_time - self.last_modified < self.cooldown:
            return
        
        self.last_modified = current_time
        print(f"\n[{time.strftime('%H:%M:%S')}] Detected change in {self.excel_file_path.name} ({event_type})")
        self.run_conversion_script()
    
    def run_conversion_script(self):
        try:
            print(f"Running {self.script_path.name}...")
            result = subprocess.run(
                [sys.executable, str(self.script_path)],
                cwd=str(self.script_path.parent),
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                print("✓ Conversion completed successfully!")
                if result.stdout:
                    print(result.stdout)
            else:
                print("✗ Conversion failed!")
                if result.stderr:
                    print(f"Error: {result.stderr}")
        except subprocess.TimeoutExpired:
            print("✗ Conversion timed out (>30 seconds)")
        except Exception as e:
            print(f"✗ Error running script: {e}")


def main():
    # Set up paths
    base_dir = Path(__file__).parent
    data_dir = base_dir / "data"
    excel_file = data_dir / "data.xlsx"
    script_file = data_dir / "excel_to_json.py"
    
    # Check if files exist
    if not excel_file.exists():
        print(f"Error: {excel_file} not found!")
        sys.exit(1)
    
    if not script_file.exists():
        print(f"Error: {script_file} not found!")
        sys.exit(1)
    
    # Set up the observer
    event_handler = ExcelFileHandler(excel_file, script_file)
    observer = Observer()
    observer.schedule(event_handler, str(data_dir), recursive=False)
    
    # Start watching
    observer.start()
    print("=" * 60)
    print("📊 Excel File Watcher Started")
    print("=" * 60)
    print(f"Watching: {excel_file}")
    print(f"Will run: {script_file}")
    print("\nPress Ctrl+C to stop...")
    print("=" * 60)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping file watcher...")
        observer.stop()
    
    observer.join()
    print("File watcher stopped.")


if __name__ == "__main__":
    main()
