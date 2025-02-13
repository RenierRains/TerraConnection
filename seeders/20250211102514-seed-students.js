'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password = await bcrypt.hash('student123', 10);
    const students = [];
    const base = 40186;
    const totalStudents = 7;
    for (let i = 0; i < totalStudents; i++) {
      const uniquePart = (base + i).toString().padStart(6, '0');
      const schoolId = `03-2223-${uniquePart}`;
      students.push({
        first_name: `Student`,
        last_name: `Number ${i + 1}`,
        email: `student${i + 1}@example.com`,
        password_hash: password,
        role: 'student',
        school_id: schoolId,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    return queryInterface.bulkInsert('Users', students, {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Users', {
      role: 'student'
    }, {});
  }
};
