import os
import sys
import pandas
import json

script_path = os.path.abspath(__file__)
folder_path = os.path.dirname(script_path)

if len(sys.argv) > 1:
    input_file = sys.argv[1]
else:
    input_file = "data.xlsx"

if os.path.isabs(input_file):
    data_path = input_file
else:
    data_path = os.path.join(folder_path, input_file)

base_name = os.path.splitext(os.path.basename(data_path))[0]
output_file = base_name + ".json"
output_path = os.path.join(folder_path, output_file)

xls = pandas.ExcelFile(data_path)
data = {}
requisites_programs = None

for sheet_name in xls.sheet_names:
    datafile = pandas.read_excel(data_path, sheet_name=sheet_name)
    datafile.fillna('', inplace=True)
    
    if sheet_name.startswith('requisites_program'):
        if requisites_programs is None:
            requisites_programs = datafile.to_dict(orient="records")
    else:
        data[sheet_name] = datafile.to_dict(orient="records")

if requisites_programs is not None:
    data['requisites_programs'] = requisites_programs

with open(output_path, "w") as f:
    f.write(json.dumps(data))
