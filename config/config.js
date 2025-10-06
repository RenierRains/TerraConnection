require('dotenv').config();

module.exports = {
  development: {
    username: 'attendance_user',
    password: '12345678',
    database: 'attendance_db_prod',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: process.env.DB_USER || 'attendance_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql'
  }
};
