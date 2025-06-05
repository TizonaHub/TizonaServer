const fs = require('fs').promises;
async function readEnv() {
    try {
        let json = {}
        const content = await fs.readFile('.env', 'utf8');
        content.split('\n').forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            const index = line.indexOf('=');
            if (index === -1) return;
            const key = line.slice(0, index).trim();
            let value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
            json[key] = value;
        });
        return json;
    } catch (error) {
        console.error('Could not read .env file:', error.message);
        return null
    }
}
async function setProcessEnv() {
    let envContentDefault = {
        STATIC: 'storage',
        DB_HOST: 'localhost',
        DB_USER: 'root',
        DB_USER_PASSWORD: '0000',
        JWT_KEY: 'pBcx]53L+1y8oeN7it5v:^tN8]WZaviaLK9Q}A+5P5fH.@!VdXad}fU,s%2#K==dbQ-m,h@B~0)6B=',
        ORIGINS: '["*"]',
        DB: 'tizonaserver',
    }
    const envContent = await readEnv() || envContentDefault;
    process.env.STATIC = envContent.STATIC
    process.env.DB_HOST = envContent.DB_HOST
    process.env.DB_USER = envContent.DB_USER
    process.env.DB_USER_PASSWORD = envContent.DB_USER_PASSWORD
    process.env.JWT_KEY = envContent.JWT_KEY
    process.env.ORIGINS = envContent.ORIGINS
    process.env.DB = envContent.DB
}
module.exports = { readEnv, setProcessEnv }