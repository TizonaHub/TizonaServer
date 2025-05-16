
import os
import subprocess
import json
divideLicensesFiles=True
currentFileFolder=os.path.dirname(__file__)
def main():
    licensesNotFound={}
    json=getJson()
    licenseFiles=[]
    for entry in json:
        entryData=json[entry]
        license=None
        try:
            license=entryData['licenses']
            licenseFile=entryData['licenseFile']
            licenseFile=licenseFile.replace('\\', '\\\\')
            licenseFiles.append('{'+f'"dependency": "{entry}","license": "{license}","licenseFile": "{licenseFile}"'+"}")
        except:
            print(license)
            if license not in licensesNotFound:
                licensesNotFound[license] = []
            licensesNotFound[license].append(entry)
          #print(f'No license found for {entry:}+{dep}')
    
    writeLicenses(licenseFiles)

def getJson():
    try:
        result=subprocess.run(['license-checker','--json'],capture_output=True,check=True,shell=True)
        result=json.loads(result.stdout)
        return result
    except Exception as e:
      print(f'Exception at getJson(): {e}')

def writeLicenses(licenseFiles):
    for entry in licenseFiles:
        jsonData=json.loads(entry)
        dependency=jsonData['dependency']
        


def genSeparatedFolder(dir,content):
    path=f'./licenses/{dir}'
    try:
        os.mkdir(path)
    except:None
    writeLicenseFile(content,path+'/LICENSE.txt')


def getLicenseFile(directories):
    for dir in directories:
        if 'license' in dir.lower():return dir
    return False
def getFileContents(file):
    try:
        with open(file, 'r') as source:
            return source.read()  
    except Exception as e:
        print(f"\033[31mError at getFileContents, reading {file}:\033[0m")
        print (f'\033[33m{e}\033[0m')    

def writeLicenseFile(content,path=currentFileFolder):
        with open(path, 'w') as newFile:
            newFile.write(content)  



def genHtml(content):
        document="<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>License</title></head><body>"
        content=content.split("\n")
        index=0
        for paragraph in content:
            paragraph=paragraph.replace("<", "&lt;").replace(">", "&gt;")
            if "#" in paragraph: paragraph="<span style='font-weight:bold;font-size:20;background-color:yellow'>"+paragraph+"</span>"
            content[index]="<p>"+paragraph+"</p>"
            index=index+1
        content="".join(content)
        document+=content
        with open('./licenseGenerator/LICENSE.html', 'w') as newFile:
            newFile.write(content)  

def addMyLicense():
 text = """


=== Third party licenses ===

"""


main()
