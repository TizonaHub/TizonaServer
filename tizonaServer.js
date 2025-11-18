const express = require('express');
const path = require('path');
const app = express();
const fs = require('fs-extra');
const jwt = require('jsonwebtoken');
const cF = require('./cF')
const cors = require('cors');
const multer = require('multer');
const { execFile, spawn } = require('child_process');
const bcrypt = require('bcrypt');
const { body, validationResult, param, cookie } = require('express-validator');
const packageJson = require('./package.json')
let dbFuncs = require('./dbFunctions')
const os = require('os');
const archiver = require('archiver');
const extract = require('extract-zip');
const { exec } = require('child_process')
process.loadEnvFile()

const corsOptions = {
  origin: (origin, callback) => {
    let origins = cF.getOrigins();
    if (origins.indexOf('*') >= 0 || origin == undefined) return callback(null, true);
    if (origins.includes(origin)) return callback(null, true);
    callback(new Error('Access forbidden').message);
  },
  credentials: true,
};

//VARS
let saltRounds = 14
const jwtKey = process.env.JWT_KEY
//
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    handlePostFiles(req, cb, file)
  },
  filename: function (req, file, cb) {
    const path = req.route.path
    if (path == '/api/updateUser') {
      let nameSplit = file.originalname.split('.')
      extension = nameSplit[nameSplit.length - 1]
      let name = Math.floor(Date.now() / 1000) + '.' + extension;
      cb(null, name)
    }
    else if (path == '/api/system/plugins') {
      let nameSplit = file.originalname.split('.')
      extension = nameSplit[nameSplit.length - 1]
      let name = nameSplit[0] + '_temp' + '.' + extension;
      cb(null, name)

    }
    else cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })
function handlePostFiles(req, cb, file) {
  let directory = cF.getAbsPath(req.body.directory)
  const path = req.route.path
  const isPlugin = path && path == '/api/system/plugins'
  if (isPlugin) {
    if (file && file.mimetype != 'application/zip') {
      const error = new Error("Plugin file is not a .zip file")
      error.status = 415
      cb(error)
    }
    return cb(null, './plugins');
  }
  if (path && path == '/api/users') { //single upload
    directory = './' + process.env.STATIC + '/userProfileImages'
    return cb(null, directory);
  }
  else if (directory && (isPlugin)) {
    const token = cF.getCookie('userToken', req.headers.cookie)
    if (token) {
      try {
        const decoded = jwt.verify(token, jwtKey)
        const access = cF.verifyPathAccess(decoded, directory)
        if (!access) throw new Error('forbidden');
      } catch (error) {
        error.status = 403
        error.stack = null
        return cb(error);
      }
    }
    cb(null, directory);
  }
  else return null
}

app.use(cors(corsOptions));
app.use((req, res, next) => {
  const url = req.originalUrl
  if (req.originalUrl.length > 1
    && url.startsWith('/directories')) {
    const token = cF.getCookie('userToken', req.headers.cookie)
    try {
      const decoded = token ? jwt.verify(token, jwtKey) : { id: 'null' }
      const access = cF.verifyPathAccess(decoded, cF.getAbsPath(url))
      if (!access) throw new Error('forbidden');
    } catch (error) {
      console.error('error at ' + cF.getAbsPath(url) + ' :' + error.message);
      error.status = 404
      return next(error)
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, process.env.STATIC)));// Serve static files from the React app 
app.use(express.static(path.join(__dirname, 'dist')));// Serves static files from the React app 
app.use(express.static(path.join(__dirname, 'plugins')));
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

(async () => {
  let pluginsDirData = []
  try {
    pluginsDirData = await fs.readdir('./plugins')
  } catch (error) {
    error.status = 500
    return console.log(error);
  }

  pluginsDirData.forEach(async (res) => {
    try {
      if (res == '.gitkeep') return
      const dirPath = './plugins/' + res
      const info = await fs.stat(dirPath);
      if (!info.isDirectory()) return;
      dirData = await fs.readdir(dirPath)
      const clientPath = path.join(dirPath, "/client");
      const backendPath = path.resolve(__dirname, dirPath, "backend.js");
      try {
        require(backendPath);
      } catch (error) {
        console.log('error: ', error.message);
      }
      app.get('/' + res, (req, res) => {
        res.sendFile(path.join(__dirname, clientPath, 'index.html'));
      });
    } catch (error) {
      error.status = 500
      return console.log(error.message);
    }
  });
})();
/**
 * API
 */

/**
 * RESOURCES
 */

app.patch('/api/resources/rename', upload.none(), (req, res, next) => { //changeresourcename
  try {
    const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
    if (!params.source || !params.newName) {
      return res.status(400).json({ error: 'Missing required parameters: source and newName' });
    }
    let source = cF.getAbsPath(params.source)
    const token = cF.getDecodedToken(req)
    let newName = path.basename(params.newName);
    let newSource = path.join(source.slice(0, source.lastIndexOf(path.sep)), newName)
    if (!cF.verifyPathAccess(token, source)) return res.sendStatus(404) //403, 404 privacy
    if (!cF.verifyPathAccess(token, newSource)) return res.sendStatus(404) //403, 404 privacy
    fs.renameSync(source, newSource)
    res.send()
  } catch (error) {
    console.error('error at /api/changeSourceName: ', error.message)
    error.status = 500
    return next(error)
  }
})
app.delete('/api/resources', upload.none(), (req, res, next) => { //deleteresource
  const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
  let resourceUrl = params.resourceUrl || params.resourceUrl;
  if (!resourceUrl) {
    return res.status(400).json({ error: 'Missing required parameter: resourceUrl' });
  }
  paramsArray = cF.paramsToArray(resourceUrl, true)
  const cookies = req.headers.cookie
  const token = cF.getCookie('userToken', cookies)
  paramsArray.forEach((resource) => {
    if (!fs.existsSync(resource)) throw new Error('resource: ' + resource + ' does not exist')
    let access = false
    if (!token) {
      access = cF.verifyPathAccess(null, resource)
    }
    else {
      const decoded = cF.verifyToken(token, jwtKey)
      access = cF.verifyPathAccess(decoded, resource)
    }
    if (access) {
      try {
        const deleted = cF.deleteDirectory(resource)
        if (!deleted) throw new Error('Unable to delete resource')
      } catch (error) {
        error.status = 500
        return next(error)
      }
    }
    return res.send()
  })
})
app.post('/api/resources/upload', upload.array('files[]'), (req, res, next) => { //postFiles
  res.send()
})
app.get('/api/resources/info', async (req, res) => { //getresourceinfo
  try {
    const resourcePath = cF.getAbsPath(req.query['resourcePath']);
    const token = cF.getDecodedToken(req);
    if (!cF.verifyPathAccess(token, resourcePath)) return res.sendStatus(404); // 403, 404 privacy

    const decodedPath = decodeURIComponent(resourcePath);
    const stats = fs.statSync(decodedPath);
    const mimeType = await cF.getMimeType(resourcePath);
    stats.mimeType = mimeType;
    res.status(200).send(stats);
  } catch (error) {
    console.error('Error en /api/resources/info:', error.message);
    error.status = 500
    return next(error)
  }
})
app.get('/api/resources/directories', async (req, res, next) => { //getDirectories
  const queryParams = req.query
  let directory = queryParams['directory'] ?? path.join('directories', 'publicDirectories');
  directory = cF.getAbsPath(directory)
  const recursive = queryParams['recursive'] == 'true'
  let privateDir = queryParams['privateDir'] == 'true' //if true, gets private dir
  let directories = await cF.readDirectory(directory, recursive)
  if (!directories) return res.sendStatus(404) //403, privacy
  if (privateDir && req.headers.cookie) {
    try {
      const token = cF.getCookie('userToken', req.headers.cookie)
      if (!token) return res.send(directories)
      const decoded = jwt.verify(token, jwtKey)
      const userExists = await dbFuncs.getUserById(decoded.id)
      const path = cF.getAbsPath(`/directories/${decoded.id}`)//process.env.STATIC + `/directories/${decoded.id}/`0
      privateDir = await cF.readDirectory(path, true, decoded)

      if (!userExists) return res.send(directories)
      directories.push({
        type: 'directory',
        name: decoded.id,
        children: privateDir,
        uri: `/directories/${decoded.id}`, //path,
        personal: true,
      })
    } catch (error) {
      console.error('error at /api/resources/directories: ', error.message);
      error.status = 500
      if (directories) return res.send(directories)
      return next(error)
    }
  }
  res.send(directories)
})
app.post('/api/resources/directories', upload.none(), async (req, res, next) => { //createdirectory
  const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
  let uri = params.path || params.path;
  if (!uri) {
    return res.status(400).json({ error: 'Missing required parameter: path' });
  }
  uri = cF.getAbsPath(uri)
  if (!cF.checkPathLength(uri)) return res.status(400).send({ msg: 'path too long' })
  if (fs.existsSync(process.env.STATIC + uri)) return res.status(500).send('directory already exists')
  let decoded = false
  if (req.headers.cookie) {
    try {
      const token = cF.getCookie('userToken', req.headers.cookie)
      decoded = jwt.verify(token, jwtKey)
    } catch (error) {
    }
  }
  try {
    const access = cF.verifyPathAccess(decoded, uri);
    if (!access) return res.sendStatus(404) //403
    await fs.mkdir(uri)
    res.send()
  } catch (error) {
    console.error('/api/createDirectory: ', error.message);
    error.status = 500
    return next(error)
  }
})
app.patch('/api/resources/move', upload.none(), async (req, res, next) => {
  const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
  let instructions = cF.paramsToArray(params['instructions'])
  const newLocationParams = cF.paramsToArray(params['newLocation'], true)
  const sourceParams = cF.paramsToArray(params['source'], true)
  const cookies = req.headers.cookie
  const token = cF.getCookie('userToken', cookies)
  if (sourceParams.length != newLocationParams.length && !instructions) {
    const error = new Error('source and newLocation have different numbers of parameters');
    error.status = 400;
    return next(error)
  }
  if (!instructions) instructions = [{ from: params['source'], to: params['newLocation'] }]
  for (const instruction of instructions) {
    try {
      const from = cF.getAbsPath(instruction.from);
      const to = cF.getAbsPath(instruction.to);
      let error = null;
      if (!fs.existsSync(from)) error = new Error(`resource ${from} does not exist`);
      if (error) {
        error.status = 400;
        throw error
      }
      let accessSource = false;
      let accessNewLocation = false;

      if (!token) {

        accessSource = cF.verifyPathAccess(null, from);
        accessNewLocation = cF.verifyPathAccess(null, to);
      } else {
        const decoded = cF.verifyToken(token, jwtKey);
        accessSource = cF.verifyPathAccess(decoded, from);
        accessNewLocation = cF.verifyPathAccess(decoded, to);
      }

      if (!accessSource || !accessNewLocation) {
        error = new Error(`Could not move resource because you do not have access to it`);
        error.status = 403;
        return next(error);
      }
      await cF.changeResourceLocation(to, from);

    } catch (error) {
      return next(error)
    }
  }
  return res.send()
});

app.post('/api/resources/zip', upload.none(), async (req, res, next) => {
  const cookies = req.headers.cookie;
  const token = cF.getCookie("userToken", cookies);
  const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
  let uris = cF.paramsToArray(params["resources"]);
  console.log("uris: ", uris);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="resources.zip"'
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    let error = new Error(err.message);
    error.status = 500;
    return next(error);
  });
  archive.pipe(res);

  let decoded = false;
  try {
    decoded = cF.verifyToken(token, jwtKey);
  } catch (error) {
    console.error("Invalid token", error);
  }
  for (let uri of uris) {
    const absPath = cF.getAbsPath(uri);
    const accessSource = cF.verifyPathAccess(decoded, absPath);
    if (!accessSource) continue;
    if (!fs.existsSync(absPath)) continue;

    const stat = fs.statSync(absPath);
    let nameInZip = path.relative(cF.getAbsPath('/'), absPath);
    nameInZip = nameInZip.split(path.sep).join("/"); // ZIP uses '/', not backslashes
    if (stat.isDirectory()) {
      if (decoded && nameInZip.includes(decoded.id)) {
        nameInZip = nameInZip.replace(decoded.id, 'Private')
      }
      archive.directory(absPath, nameInZip);
    }
    else {
      archive.file(absPath, { name: nameInZip });
    }
  }

  archive.finalize();
})
/**
 * USERS
 */
app.put('/api/users', upload.single('file'), //updateUser
  body('name').isLength({ max: 35 }).withMessage('length'),
  body('username').isLength({ max: 35 }).withMessage('length'),
  body('avatar').if((value, { req }) => req.body.avatar !== undefined)
    .custom(cF.validateJson).withMessage('invalid json'),
  body('password').if((value, { req }) => req.body.password !== undefined)
    .isLength({ min: 8, max: 25 }).withMessage('length'),
  async (req, res, next) => {
    if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
    let errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).send(errors)
    let decodedToken = null
    try {
      decodedToken = jwt.verify(cF.getCookie('userToken', req.headers.cookie), jwtKey)
    } catch (error) {
      error.message = 'unable to decode token'
      error.status = 401
      return next(error)
    }
    const propertiesArray = {
      username: req.body.username,
      name: req.body.name,
      password: req.body.password ? await bcrypt.hash(req.body.password, saltRounds) : null,
      avatar: req.body.avatar,
      role: req.body.role
    }
    const id = req.body.userId ? req.body.userId : decodedToken.id //updated user id
    if (req.body.userId) {
      const userUpdating = await dbFuncs.getUserById(decodedToken.id)
      const userToBeUpdated = await dbFuncs.getUserById(id)
      const validation = cF.validateUpdate(userToBeUpdated, userUpdating)
      if (!validation) return res.sendStatus(403)
      if (userUpdating.role == 100 && userToBeUpdated.role == 100) propertiesArray.role = 100

    }
    const propertiesToUpdate = []
    const params = []
    Object.entries(propertiesArray).forEach((property) => {
      if (property[1]) propertiesToUpdate.push({ [property[0]]: property[1] })
    })
    let query = `
UPDATE users
SET ${propertiesToUpdate.map((property) => {
      property = Object.entries(property)[0]
      if (property[0] == 'avatar') {
        const result = handleAvatarUpdate(property, req.file)
        result[1].forEach((prop) => {
          params.push(prop)
        })
        return avatarQuery = result[0]
      }
      params.push(property[1])
      return property[0] + ' = ?'
    })}
WHERE id = ?`;
    params.push(id)
    try {
      const result = await dbFuncs.executeQuery(query, params)
      if (result) return res.send()
    } catch (err) {
      err.status = 500
    }
    next(err)
    function handleAvatarUpdate(property, file) {
      let params = []
      let query = `avatar=JSON_SET(avatar`
      let json = JSON.parse(property[1])
      Object.entries(json).map((avatarProp) => {
        if (avatarProp[0] != 'profileImage') {
          params.push(avatarProp[1])
          query = query + `, '$.${avatarProp[0]}', ?`
        }
      })
      if (file) {
        const path = `./userProfileImages/${file.filename}`
        params.push(path)
        query = query + `, '$.profileImage', ?`
      }
      query = query + ")"
      return [query, params]
    }

  });
app.delete('/api/users/:id', upload.none(), async (req, res) => { //deleteUser
  const deleteUserId = req.params.id;
  if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
  if (!deleteUserId) {
    return res.status(400).json({ error: 'Missing required parameter: id' });
  }
  const token = cF.getDecodedToken(req)
  if (!token) return res.sendStatus(401)
  const userData = await dbFuncs.getUserById(token.id)
  const role1 = userData.role //user deleting
  if (role1 < 50) return res.sendStatus(403)
  const deleteUserData = await dbFuncs.getUserById(deleteUserId)
  if (!deleteUserData) return res.status(404).json({ error: 'User to delete not found' });
  const role2 = deleteUserData.role //user to delete
  if ((role1 <= role2) || (role1 >= 100 && role2 >= 100)) return res.sendStatus(403)
  const result = await dbFuncs.deleteUserById(deleteUserData.id)
  if (result) return res.send()
  return res.status(500).json({ error: 'Failed to delete user' });

})
app.get('/api/users', async (req, res) => { //getUsers
  if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
  const result = await dbFuncs.getUsers()
  res.send(result)
})
app.post('/api/users', upload.none(), //createUser
  body('name').notEmpty().withMessage('empty'),
  body('username').notEmpty().withMessage('empty'),
  body('password').notEmpty().withMessage('empty').isLength({ min: 8, max: 25 }).withMessage('length')
  , async (req, res, next) => {
    if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
    let errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).send()
    const id = cF.getRandomString()
    const name = req.body.name
    const username = req.body.username;
    const hash = await bcrypt.hash(req.body.password, saltRounds);
    const colors = ['#ff000', '#0080000', '#800080', '#FFA500', '#a52a2a']
    const color = colors[Math.floor(Math.random() * colors.length)]
    let json = JSON.stringify({ profileImage: null, bgColor: color, shadowFilter: 0 });
    let query = `insert into users values(?,?,?,?,?,?,default,default);`;
    const adminIsCreated = await dbFuncs.checkAdminUser()
    const role = adminIsCreated ? 0 : 100
    try {
      await dbFuncs.executeQuery(query, [id, name, username, hash, role, json])
      const user = { id: id, name: name, username: username, role: role }
      const token = jwt.sign(user, jwtKey, { expiresIn: '365d' });
      try {
        const uri = process.env.STATIC + '/directories/' + id
        await fs.mkdir(uri)
        return res.cookie('userToken', token, {
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 31536000000 //1 year 
          //consider using secure:isHTTPS
        }).send({ userData: user, userToken: token })
      } catch (error) {
        error.message = 'Unable to create folder'
        error.status = 500
        next(error)
      }
    } catch (error) {
      console.error(error, ' at /api/createUser');
      error.status = 500
      return next(error)
    }
  })
/**
 * SYSTEM
 */
app.get('/api/system/info', (req, res) => { //getServerInfo
  return res.send({ version: packageJson.version })

})
app.get('/api/system/errorTest', (req, res, next) => {
  try {
    throw new Error('error test');
  } catch (error) {
    error.status = 403
    next(error)
  }
})
app.get('/api/system/ping', (req, res) => { //testConnection
  res.send();
});
app.get('/api/system/charts', (req, res) => { //getCharts
  const platform = os.platform()
  let platformCommand = 'python'
  if (platform != 'win32') platformCommand = 'python3'
  const pythonScriptPath = path.resolve(__dirname, './scripts/serverCharts.py');
  const script = execFile(platformCommand, [pythonScriptPath, path.join(__dirname, '..')], { windowsHide: true })

  script.on('error', (error) => {
    console.error(error.message, ' at /api/getCharts');
    return res.sendStatus(500)
  });
  script.stdout.on('data', (data) => {
    data = JSON.parse(data)
    return res.send(data)
  })
})
app.get('/api/system/plugins', async (req, res, next) => {
  try {
    const pluginsDirData = await fs.readdir('./plugins');
    const pluginsArray = [];
    for (const dir of pluginsDirData) {
      try {
        const dirPath = `./plugins/${dir}`;
        const manifestPath = path.join(dirPath, "manifest.json");
        const manifestData = await fs.readFile(manifestPath, "utf8");
        const manifestJSON = JSON.parse(manifestData);

        pluginsArray.push({
          name: manifestJSON.name,
          icon: path.join(dir, manifestJSON.icon),
          frontEnd: path.join(dir, 'client'),
          devUrl: manifestJSON.devUrl,
          devMode: manifestJSON.devMode,
          dependency:manifestJSON.dependency,
          publisher:manifestJSON.publisher,
          repository:manifestJSON.repository,
          description:manifestJSON.description,
          url:manifestJSON.url,
          license:manifestJSON.license,
          version:manifestJSON.version
        });

      } catch (error) {
        if(!dir == '.gitkeep') console.warn(`⚠️ Error reading ${dir} info:`, error.message);
      }
    }
    return res.json({ pluginsArray });
  } catch (error) {
    error.status = 500;
    return next(error);
  }
});

app.post('/api/system/plugins', upload.single('plugin'), async (req, res, next) => {
  async function installPlugin(file) {
    console.log('file: ', file);
    const overwrite = req.query.overwrite === 'true'
    const relDest = path.join('plugins', file.originalname.slice(0, file.originalname.lastIndexOf('.zip')))
    const dest = path.join(relDest)
    if (overwrite === false && fs.existsSync(relDest)) {
      console.error('This plugin already exists')
      return res.status(409).send({ message: 'Plugin with same name already exists' })
    }
    if (fs.existsSync(file.path)) {
      try {
        await extract(file.path, { dir: path.join(__dirname, dest) });
        const installScriptExists = fs.readFileSync(path.join(dest, "/scripts/install.js"), "utf-8");
        if (installScriptExists) {
          exec("node " + path.join(dest, "scripts/install.js"), (error, stdout, stderr) => {
            if (error) {
              error.message = "Error at installation script: " + error.message;
              error.status = 500;
              return next(error);  
            }
          });
        }
            res.send()
      }
      catch (error) {
        error.status = 500
        return next(error)
      }
    } else {
      res.status(404).send({ message: 'Could not find plugin zip' })
    }

  }
  await installPlugin(req.file)
  //res.send()
})
/**
 *  AUTH
 */
app.get('/api/auth/me', async (req, res, next) => { //verifyToken
  if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
  if (!req.headers.cookie) return res.sendStatus(400);
  try {
    let cookie = cF.getCookie('userToken', req.headers.cookie)
    if (!cookie) return res.sendStatus(400)
    let decodedToken = jwt.verify(cookie, jwtKey)
    let user = await dbFuncs.getUserById(decodedToken.id)
    if (user == undefined) return res.sendStatus(400)
    res.send({
      id: user.id, name: user.name, username: user.username,
      role: user.role, avatar: user.avatar
    })
  } catch (error) {
    console.error(error.message, ' on /api/auth/me');
    error.status = 400
    return next(error)
  }
})
app.get('/api/auth/logout', async (req, res, next) => { //removeToken
  try {
    let cookie = cF.getCookie('userToken', req.headers.cookie)
    if (cookie) {
      res.clearCookie('userToken').send();
    }
  } catch (error) {
    console.error(error.message, ' on /api/removeToken');
    error.status = 400
    next(error)
  }
})
app.post('/api/auth/login', upload.none(), async (req, res) => { ///api/authenticateUser
  if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
  const password = req.body.password
  const username = req.body.username
  if (!username || !password) return res.sendStatus(400)
  let user = await dbFuncs.checkCredentials(username, password)
  if (user) {
    const token = jwt.sign({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    }, jwtKey, { expiresIn: '365d' });
    res.cookie('userToken', token, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 31536000000 //1 year 
    }).send({
      userToken: token, userData: {
        name: user.name,
        username: user.username,
        role: user.role,
        profileImage: user.profileImage,
        createdAt: user.createdAt,
      }
    })
  }
  else res.sendStatus(401)
})

//APP
app.use(errorHandler);
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Too many files uploaded' });
    }
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  //Global errors
  console.error(err.message, ' -- Code: ' + err.status);
  if (err.message == 'invalid signature') {
    return res.clearCookie('userToken').status(401).json({
      message: err.message || 'Server error',
    })
  }
  return res.status(err.status || 500).json({
    message: err.message || 'Server error',
  });
}

module.exports = app
