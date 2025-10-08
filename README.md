# TizonaServer

## 🤔 What is TizonaServer?

TizonaServer is the backend engine behind [TizonaHub](https://github.com/TizonaHub), but it can also be used independently as a standalone server or API.  
It handles file storage, user management, and all server-side operations, acting as the core of your private cloud.  
Installed on a local machine or server, **TizonaServer ensures that all your data stays under your full control**, without relying on external services.

TizonaServer follows the same installation and setup process as TizonaHub.  
For a step-by-step guide, please refer to the [Getting Started](../../tizonahub/getting-started) section of the TizonaHub documentation.



## ⚠️ Legal Notice

TizonaHub is distributed for free and provided "as is" without any warranties.  
Although it has been designed to be clear, functional, and secure, the use of the software is the **sole responsibility of the user**.  
The developers assume **no responsibility for damages, data loss, or security issues** resulting from the use or misuse of the program.


## 🛠️ Getting Started (Development)

**Prerequisites**  
Make sure you have the following installed on your system:

- [Node.js](https://nodejs.org/)
- [Python](https://www.python.org/)
- [MySQL](https://www.mysql.com/)


## Start Developing
### 1. Clone project
Clone the project

```bash
  git clone  https://github.com/TizonaHub/TizonaServer.git
```

Go to the project directory

```bash
  cd TizonaServer
```

Install dependencies

```bash
  npm install
```
### 2. Prepare the Database
Before running the server, you need to initialize the database.  
Open your MySQL client and execute the following commands:
```sql
CREATE DATABASE tizonaserver;
USE tizonaserver;
SOURCE /your/installation/path/TizonaServer/SQL/setup.sql;
```
### 3. Prepare .env file
Create a `.env` file in the root folder or modify `.env.example` and rename it to `.env` in the root folder and add the following configuration (adapt as needed):
```ini
PASSPHRASE=your_PASSPHRASE
CRT=./SSL/your_crt.crt
SSL_KEY=./SSL/your_key.key
JWT_KEY='78-character-long-key'
ORIGINS=["http://ORIGIN","http://ANOTHERORIGIN"]

DB_HOST='localhost'
DB_USER='your user'
DB_USER_PASSWORD='your password'
DB='your_database'
STATIC='storage'
NODE_ENV=production
```

### 4. Start the server

```bash
  node --watch start.js
```

## 🧪 Testing

To run all tests, execute:
```bash
npx jest
```
To run a specific test:
```bash
npx jest tests/system/apiSystem.test.js
```
