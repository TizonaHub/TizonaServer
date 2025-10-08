import os
import shutil
import json
import pickle
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


def readData(index):
    info=None 
    program_data = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
    app_data_dir = os.path.join(program_data, "TizonaHub")
    data_file = os.path.join(app_data_dir, "data.dat")
    try:
        with open(data_file, "rb") as f:
                info = pickle.load(f)
                return info if not index else list(info.values())[index]
    except Exception as e:
        print('Error at readData',e)
        return False
    
result={ 
    "total":round(total),
    "used":round(used),
    "free":round(free),
    "serverSize":round(get_directory_size(current_directory)),
    "serverVersion":readData(2),
    "clientVersion":readData(1),
    "managerVersion":readData(3)
}


print(json.dumps(result)) 
