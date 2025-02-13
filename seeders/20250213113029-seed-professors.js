'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password = await bcrypt.hash('professor123', 10);
    return queryInterface.bulkInsert('Users', [
      {
        first_name: 'Professor',
        last_name: 'A',
        email: 'professorA@example.com',
        password_hash: password,
        role: 'professor',
        school_id: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Professor',
        last_name: 'B',
        email: 'professorB@example.com',
        password_hash: password,
        role: 'professor',
        school_id: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Professor',
        last_name: 'C',
        email: 'professorC@example.com',
        password_hash: password,
        role: 'professor',
        school_id: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Professor',
        last_name: 'D',
        email: 'professorD@example.com',
        password_hash: password,
        role: 'professor',
        school_id: null,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Professor',
        last_name: 'E',
        email: 'professorE@example.com',
        password_hash: password,
        role: 'professor',
        school_id: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },
  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Users', { role: 'professor' }, {});
  }
};
