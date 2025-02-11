'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password = await bcrypt.hash('student123', 10);
    return queryInterface.bulkInsert('Users', [
      {
        first_name: 'Student',
        last_name: 'One',
        email: 'student1@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',  // using the full course identifier for convenience
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Student',
        last_name: 'Two',
        email: 'student2@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Student',
        last_name: 'Three',
        email: 'student3@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Student',
        last_name: 'Four',
        email: 'student4@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Student',
        last_name: 'Five',
        email: 'student5@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Student',
        last_name: 'Six',
        email: 'student6@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        first_name: 'Student',
        last_name: 'Seven',
        email: 'student7@example.com',
        password_hash: password,
        role: 'student',
        school_id: 'BSIT3-06',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Users', { role: 'student', school_id: 'BSIT3-06' }, {});
  }
};
