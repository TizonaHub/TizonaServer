
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');
process.loadEnvFile()
const jwtKey = process.env.JWT_KEY
async function readDirectory(dir, recursive) {
  try {
    const result = [];
    const resources = fs.readdirSync(dir);
    for (const resource of resources) {
      const resourcePath = dir + '/' + resource
      const stats = fs.statSync(resourcePath);
      const prepraredResourcePath = resourcePath.replace(process.env.STATIC, '')
      if (stats.isDirectory()) {
        let data = {
          type: 'directory',
          name: resource,
          children: null,
          uri: prepraredResourcePath,
          size: stats.blksize
        }
        if (recursive) data.children = await readDirectory(resourcePath, true);
        result.push(data);
      } else {
        let mimeType = await getMimeType(resource)
        if (resource != '.gitkeep')
          result.push({
            type: 'file',
            name: resource,
            uri: prepraredResourcePath,
            mimeType: mimeType,
            size: stats.blksize
          });
      }
    };
    return result;
  } catch (error) {
    console.error('error at cF.readDirectory: ', error.message);
    return null
  }
}
function checkPathLength(path) {
  const limit = 260
  if (path.length > limit) {
    console.err('Path is too long');
    return false
  }
  return true
}
/**
 * Deletes directories and subdirectories
 * @param {*} dir 
 */
function deleteDirectory(dir) {
  if (fs.existsSync(dir)) {
    if (fs.statSync(dir)) {
      fs.rmSync(dir, { recursive: true })
      return true
    }
    else fs.unlinkSync(dir)
    return false
  }
  else return false
}
async function changeResourceLocation(newLocation, source) {
  try {
    await fs.move(source, newLocation);
    return true;
  } catch (err) {
    console.error('Error at cF.changeResourceLocation: ', err.message);
    return false;
  }
}
//seems deprecated
function isPrivateDir(path) {
  if (path.split('/')[3] != 'appDirectories') return true
  return false
}
function getDecodedToken(req) {
  if (!req) return false
  try {
    const cookie = req.headers.cookie
    const token = getCookie('userToken', cookie)
    if (!token) return false
    const decoded = jwt.verify(token, jwtKey)
    return decoded
  } catch (error) {
    console.error('Error at function getDecodedToken: ', error);
  }

}
/**
 * checks if private path belongs to user
 * @param {*} user 
 * @param {*} path 
 * @returns 
 */
function verifyPathAccess(user, pathParam) {
  pathParam = path.normalize(__dirname + pathParam)
  pathParam = pathParam.split(__dirname)
  if (pathParam.length < 2) return false
  pathParam = pathParam[1].split('\\').slice(1)
  const condition1 = user && user.id == pathParam[1]
  const condition2 = pathParam[1] == 'publicDirectories'
  if (condition1) return true
  if (condition2) return true
  return false
}
/**
 * Removes root/ from directory and gets real directory source
 * @param {*} directory 
 * @returns 
 */
function getRealUrl(directory) {
  if (directory == '') directory = process.env.STATIC
  else directory = process.env.STATIC + directory

  return directory

}
function getOrigins() {
  const origins = JSON.parse(process.env.ORIGINS)
  let array = []
  if (origins[0] == "*") return origins
  origins.map((origin) => {
    array.push('http://' + origin)
    array.push('https://' + origin)
  })
  return array
}
async function getMimeType(filePath) {
  const mime = await import('mime');
  const mimeType = mime.default.getType(filePath);
  return mimeType
}
function getRandomString() {
  let chars = 'abcdefghijklmnopqrstuvwxyz1234567890'
  let string = ''
  for (let index = 0; index < 24; index++) {
    let random = Math.floor(Math.random() * (chars.length - 0) + 0);
    let uppercase = Math.round(Math.random() * (1 - 0) + 0);
    string = string + chars[random];
    if (uppercase) {
      let chars = string.split('');
      chars[index] = chars[index].toUpperCase();
      string = chars.join('');
    }
  }
  return string
}
function getCookie(cookieName, cookies) {
  if (!cookieName || !cookies) return false
  cookies = cookies.split(';')
  let foundCookie = false
  cookies.map((element) => {
    element = element.split('=')
    if (element[0] == cookieName) foundCookie = element
  });
  return foundCookie[1]
}
function validateJson(param) {
  try {
    if (JSON.parse(param)) return true
  } catch (error) {
    return false
  }

}
async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch (err) {
    return false;
  }
}
function validateUpdate(userToBeUpdated, userUpdating) {
  const condition1 = (userUpdating.role == 100 && userToBeUpdated.role == 100)
  const condition2=(userToBeUpdated.role<userUpdating.role)
  const condition3 = (userUpdating.id == userToBeUpdated.id)
  console.log('condition3: ', condition3);
  if (condition1 || condition2 || condition3) return true
  return false
}
module.exports = {
  readDirectory, deleteDirectory,
  getRealUrl, changeResourceLocation, getRandomString,
  getCookie, fileExists, validateJson, validateUpdate,
  checkPathLength, verifyPathAccess, isPrivateDir, getDecodedToken,
  getMimeType, getOrigins
};