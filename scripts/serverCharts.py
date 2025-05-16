import os
import shutil
import json
import sys
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
    
result={ 
    "total":round(total),
    "used":round(used),
    "free":round(free),
    "serverSize":round(get_directory_size(current_directory))
}


print(json.dumps(result)) 
