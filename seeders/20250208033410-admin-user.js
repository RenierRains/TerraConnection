'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password_hash = await bcrypt.hash('adminpassword', 10);

    return queryInterface.bulkInsert('Users', [{
      first_name: 'Super',
      last_name: 'Admin',
      email: 'admin@phinmaed.com',
      password_hash: password_hash,
      role: 'admin',
      school_id: null, 
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Users', { email: 'admin@phinmaed.com' }, {});
  }
};