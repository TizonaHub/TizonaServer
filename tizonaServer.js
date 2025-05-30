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
let https = require('https')
let http = require('http')
let dbFuncs = require('./dbFunctions')
const os = require('os');
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
    handlePostFiles(req, cb)
  },
  filename: function (req, file, cb) {
    const path = req.route.path
    if (path == '/api/updateUser') {
      let extension = file.originalname.split('.')
      extension = extension[extension.length - 1]
      let name = Math.floor(Date.now() / 1000) + '.' + extension;
      cb(null, name)
    }
    else cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })
function handlePostFiles(req, cb) {
  let directory = cF.getAbsPath(req.body.directory)
  const path = req.route.path
  if (path && path == '/api/users') { //single upload
    directory = './' + process.env.STATIC + '/userProfileImages'
    cb(null, directory);
  }
  else if (directory) {
    const token = cF.getCookie('userToken', req.headers.cookie)
    if (token) {
      try {
        const decoded = jwt.verify(token, jwtKey)
        const access = cF.verifyPathAccess(decoded, directory)
        if (!access) throw new Error('forbidden');
      } catch (error) {
        error.code = 403
        error.stack = null
        return cb(error);
      }
    }
    cb(null, directory);
  }
  else return null
}


function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Too many files uploaded' });
    }
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  err.code == 403 ? res.sendStatus(403) : null
  next(err);
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
      //console.log('url: ', cF.getAbsPath(url));
      console.error('error at ' + cF.getAbsPath(url) + ' :' + error.message);
      return res.sendStatus(404)
    }
  }
  next();
});

app.use(express.static(path.join(__dirname, process.env.STATIC)));// Serve static files from the React app 
app.use(express.static(path.join(__dirname, 'dist')));// Serves static files from the React app 
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


/**
 * SERVER CREATION
 */
try {
  const params = {
    cert: fs.readFileSync(process.env.CRT),
    key: fs.readFileSync(process.env.SSL_KEY),
    passphrase: process.env.PASSPHRASE
  }
  const testHTTPS = process.env.TEST_HTTPS
  const mode = process.env.NODE_ENV
  const condition1 = mode == 'development' && testHTTPS != 'true'
  const condition2 = mode != 'production'
  if (condition1 && condition2) throw new Error('Development mode, creating http server...')
  https.createServer(params, app).listen(443, () => {
    console.log(`HTTPS Server is running`);
  });
} catch (error) { //IF HTTPS FAILED, THEN HTTP SERVER IS CREATED
  console.log('Unable to create HTTPS server, creating HTTP server...');
  http.createServer(app).listen(80, () => {
    console.log('HTTP server is running');
  });
}
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

/**
 * API
 */

/**
 * RESOURCES
 */

app.patch('/api/resources/rename', upload.none(), (req, res) => { //changeresourcename
  try {
    const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
    if (!params.source || !params.newName) {
      return res.status(400).json({ error: 'Missing required parameters: source and newName' });
    }
    let source = cF.getAbsPath(params.source)
    const token = cF.getDecodedToken(req)
    let newName = path.basename(params.newName);
    let newSource = source.split(path.sep)
    newSource[newSource.length - 1] = newName
    newSource = path.join(...newSource)
    console.log('newSource: ', cF.verifyPathAccess(token, source));
    if (!cF.verifyPathAccess(token, source)) return res.sendStatus(404) //403, 404 privacy
    if (!cF.verifyPathAccess(token, newSource)) return res.sendStatus(404) //403, 404 privacy
    fs.renameSync(source, newSource)
    res.send()
  } catch (error) {
    console.error('error at /api/changeSourceName: ', error.message)
    res.sendStatus(500)
  }
})
app.delete('/api/resources', upload.none(), (req, res) => { //deleteresource
  const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
  let resourceUrl = params.resourceUrl || params.resourceUrl;
  if (!resourceUrl) {
    return res.status(400).json({ error: 'Missing required parameter: resourceUrl' });
  }
  resourceUrl = cF.getAbsPath(resourceUrl)
  const cookies = req.headers.cookie
  let access = false
  const token = cF.getCookie('userToken', cookies)
  if (!token) {
    access = cF.verifyPathAccess(null, resourceUrl)
  }
  else {
    try {
      const decoded = jwt.verify(token, jwtKey)
      access = cF.verifyPathAccess(decoded, resourceUrl)
    } catch (error) {
      console.error('error at /api/deleteResource: ', error.message);
      return res.sendStatus(500)
    }
  }
  try {
    if (access) {
      deleted = cF.deleteDirectory(resourceUrl)
      if (!deleted) throw new Error('Unable to delete resource')
      return res.send()
    }
    res.sendStatus(404) //403, 404 privacy
  } catch (error) {
    console.error('error at /api/deleteResource: ', error.message);
    return res.sendStatus(500)
  }
})
app.post('/api/resources/upload', upload.array('files[]'), (req, res) => { //postFiles
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
  } catch (err) {
    console.error('Error en /api/resources/info:', err.message);
    res.sendStatus(500);
  }
})
app.get('/api/resources/directories', async (req, res) => { //getDirectories
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
      const decoded = jwt.verify(token, jwtKey)
      const userExists = await dbFuncs.getUserById(decoded.id)
      const path = cF.getAbsPath(`/directories/${decoded.id}`)//process.env.STATIC + `/directories/${decoded.id}/`0
      privateDir = await cF.readDirectory(path, true, decoded)

      if (!userExists) return res.send(directories)
      directories.push({
        type: 'directory',
        name: decoded.id,
        children: privateDir,
        uri: path,
        personal: true,
      })
    } catch (error) {
      console.error('error at /api/getDirectories: ', error.message);
      return res.sendStatus(500)
    }
  }
  res.send(directories)
})
app.post('/api/resources/directories', upload.none(), (req, res) => { //createdirectory
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
    fs.mkdir(uri)
    res.send()
  } catch (error) {
    console.error('/api/createDirectory: ', error.message);
    return res.status(500).send(error.message)
  }
})
app.patch('/api/resources/move', upload.none(), async (req, res) => {
  const params = cF.JSONisNotEmpty(req.query) || cF.JSONisNotEmpty(req.body);
  if (!params || !params['newLocation'] || !params['source']) {
    return res.sendStatus(400);
  }
  const token = cF.getDecodedToken(req);
  const newLocation = cF.getAbsPath(params['newLocation']);
  const source = cF.getAbsPath(params['source']);
  const hasAccess = cF.verifyPathAccess(token, newLocation) && cF.verifyPathAccess(token, source);
  if (!hasAccess) return res.sendStatus(404)
  try {
    const success = await cF.changeResourceLocation(newLocation, source);
    if (!success) {
      return res.status(500).send({ message: 'Failed to move the resource.' });
    }
    return res.send();
  } catch (err) {
    console.error('Error en /api/resources/move:', err.message);
    return res.sendStatus(500);
  }
});

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
  async (req, res) => {
    if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
    let errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).send(errors)
    let decodedToken = null
    try {
      decodedToken = jwt.verify(cF.getCookie('userToken', req.headers.cookie), jwtKey)
    } catch (error) {
      return res.status(401).send({ errors: [{ type: 'token', msg: 'unable to decode token' }] })
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
      console.error('error at /api/updateUser: ', err.message);
    }
    return res.sendStatus(500)
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
  , async (req, res) => {
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
        fs.mkdir(uri)
        return res.cookie('userToken', token, {
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 31536000000 //1 year 
          //consider using secure:isHTTPS
        }).send({ user: user, userToken: token })
      } catch (error) {
        res.status(500).send({ msg: 'Unable to create folder' })
      }
    } catch (error) {
      console.error(error, ' at /api/createUser');
      return res.status(500).send({ code: error.code })
    }
  })
/**
 * SYSTEM
 */
app.get('/api/system/info', (req, res) => { //getServerInfo
  return res.send({ version: packageJson.version })

})
app.get('/api/system/ping', (req, res) => { //testConnection
  res.send();
});
app.get('/api/system/charts', (req, res) => { //getCharts
  const platform = os.platform()
  let platformCommand = 'python'
  if (platform != 'win32') platformCommand = 'python3'
  const pythonScriptPath = path.resolve(__dirname, './scripts/serverCharts.py');
  let script = execFile(platformCommand, [pythonScriptPath, __dirname])

  script.on('error', (error) => {
    console.error(error.message, ' at /api/getCharts');
    return res.sendStatus(500)
  });
  script.stdout.on('data', (data) => {
    data = JSON.parse(data)
    return res.send(data)
  })
})
/**
 *  AUTH
 */
app.get('/api/auth/me', async (req, res) => { //verifyToken
  if (!dbFuncs.getConnectionStatus()) return res.sendStatus(500)
  if (!req.headers.cookie) return res.sendStatus(400);
  try {
    let cookie = cF.getCookie('userToken', req.headers.cookie)
    let decodedToken = jwt.verify(cookie, jwtKey)
    let user = await dbFuncs.getUserById(decodedToken.id)
    if (user == undefined) return res.sendStatus(400)
    res.send({
      id: user.id, name: user.name, username: user.username,
      role: user.role, avatar: user.avatar
    })
  } catch (error) {
    console.error(error.message, ' on /api/verifyToken');
    res.sendStatus(400)
  }
})
app.get('/api/auth/logout', async (req, res) => { //removeToken
  try {
    let cookie = cF.getCookie('userToken', req.headers.cookie)
    if (cookie) {
      res.clearCookie('userToken').send();
    }
  } catch (error) {
    console.error(error.message, ' on /api/removeToken');
    res.status(400).send({ code: null })
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
app.use(multerErrorHandler);
