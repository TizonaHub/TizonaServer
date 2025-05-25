const mysql = require('mysql2');
const bcrypt =require('bcrypt')
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_USER_PASSWORD,
  database: process.env.DB
});

connection.connect((err) => {
  if (err) {
    console.error('Unable to connect:', err.message);
    return;
  }
  console.log('Connected to database');
});
function getConnectionStatus(){
    if(connection._closing) return false
    return true
}
async function checkAdminUser() {
    if (connection._closing) return false
    return new Promise((resolve, reject) => {
        connection.execute('select count(*) from users where users.role=100',
            (err, result) => {
                if (err) {
                    console.error('Error:', err);
                    reject(err);
                } else {
                    const count = result[0]['count(*)'];
                    resolve(count != 0);
                }
            });
    });

}
async function getUserById( id) {
    if (connection._closing) return false
    return new Promise((resolve, reject) => {
        connection.execute('select id,name,username,role,tokenMinDate,createdAt,avatar from users where id = ?', [id],
            (err, result) => {
                if (err) {
                    console.error('Error: ', err);
                    reject(err);
                } else {
                    resolve(result[0]);
                }
            });
    });

}async function deleteUserById( id) {
    if (connection._closing) return false
    return new Promise((resolve, reject) => {
        connection.execute('delete from users where id = ?', [id],
            (err, result) => {
                if (err) {
                    console.error('Error: ', err);
                    reject(false);
                } else {
                    resolve(true);
                }
            });
    });

}
async function getUsers() {
    if (connection._closing) return false
    return new Promise((resolve, reject) => {
        connection.execute(`select id,name,username,role,tokenMinDate
            ,createdAt,avatar from users order by role desc, username`,
            (err, result) => {
                if (err) {
                    console.error('Error: ', err);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
    });

}
async function checkCredentials( username, password) {
    if (connection._closing) return false
    try {
        let user= await new Promise((resolve, reject) => {
            connection.execute(
              'select * from users where username = ?', [username],
              (err, rows, fields) => {
                if (err instanceof Error) {
                  console.log(err);
                  reject(err);  
                  return;
                }
                resolve(rows[0]);  
              }
            );
          });
          if(user){
            if (await bcrypt.compare(password,user.password)) return user
            return false
          }

    } catch (err) {
        console.error('Error: ', err);
        throw err; 
    }
}
async function executeQuery(query, params) {
    console.log('query: ', query);
    if (connection._closing) return false
    return new Promise((resolve, reject) => {
        connection.execute(query, params, (err, results) => {
            if (err) {
                reject(new Error(`Error at executeQuery (${query}): ${err.message}`));
            } else {
                resolve(results);
            }
        });
    });
}


module.exports = {
    checkAdminUser, getUserById, checkCredentials,getUsers,deleteUserById,executeQuery,getConnectionStatus
}