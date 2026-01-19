import os
import shutil
import json
import pickle
import sys
import platform
current_directory = os.getcwd()
total, used, free = shutil.disk_usage(current_directory)

def get_directory_size(directory):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(directory):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            if os.path.exists(file_path):
                total_size += os.path.getsize(file_path)
    return total_size


def make_json_serializable(obj):
    if isinstance(obj, set):
        return next(iter(obj)) if len(obj) == 1 else list(obj)
    elif isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [make_json_serializable(v) for v in obj]
    else:
        return obj
def readData(index=False):
    info = None 
    program_data = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
    if platform.system() == 'Linux': program_data = '/etc'
    app_data_dir = os.path.join(program_data, "TizonaHub")
    data_file = os.path.join(app_data_dir, "data.dat")
    try:
        with open(data_file, "rb") as f:
            info = pickle.load(f)
            return info if not index else info[index]
    except Exception as e:
        print('Error at readData', e, file=sys.stderr)
        return False
    
result={ 
    "total":round(total),
    "used":round(used),
    "free":round(free),
    "serverSize":round(get_directory_size(current_directory)),
    "serverVersion":readData('serverVersion'),
    "clientVersion":readData('clientVersion')
}
if platform.system()=='Windows': result['managerVersion']=readData('managerVersion')
result = make_json_serializable(result)
print(json.dumps(result)) 
