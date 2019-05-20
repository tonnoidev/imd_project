const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    port: process.env.PORT,
    config: {
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        server: process.env.DB_SERVER,
        database: process.DB_NAME
    }
};
