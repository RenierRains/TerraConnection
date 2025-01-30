const app = require('./app');
const db = require('./models');

const PORT = process.env.PORT || 3000;

// production, migrations. dev,  sync.
//prod npx sequelize-cli db:migrate --env production
db.sequelize
  .authenticate()
  .then(() => {
    console.log('Database connected!');
    //dev only:
    return db.sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });