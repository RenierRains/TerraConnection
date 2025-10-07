require('dotenv').config();
const { app, server } = require('./app');
const db = require('./models');

const PORT = process.env.PORT || 3000;
console.log({
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME
});
// production, migrations. dev,  sync.
//prod npx sequelize-cli db:migrate --env production
db.sequelize
  .authenticate()
  .then(() => {
    console.log('Database connected!');
    //dev only:
    return db.sequelize.sync({ alter: false });
  })
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to the database:', err);
  });
