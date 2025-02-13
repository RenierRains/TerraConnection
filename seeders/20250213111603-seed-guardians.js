'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const password = await bcrypt.hash('guardian123', 10);
    //7 only seed
    const guardians = [];
    for (let i = 0; i < 7; i++) {
      guardians.push({
        first_name: 'Guardian',
        last_name: `Number ${i + 1}`,
        email: `guardian${i + 1}@example.com`,
        password_hash: password,
        role: 'guardian',
        school_id: null, // Guardians don't have a school_id.
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    await queryInterface.bulkInsert('Users', guardians, {});

    // Now create linking records in Guardian_Students.
    // Retrieve all student IDs (assumes the student seeder has already run)
    const [students] = await queryInterface.sequelize.query(
      `SELECT id FROM Users WHERE role = 'student' ORDER BY id ASC;`
    );
    // Retrieve all guardian IDs (the ones we just inserted)
    const [guardianRecords] = await queryInterface.sequelize.query(
      `SELECT id FROM Users WHERE role = 'guardian' ORDER BY id ASC;`
    );

    const links = [];
    // For each guardian (up to 7) link to the corresponding student (by order).
    for (let i = 0; i < Math.min(students.length, guardianRecords.length); i++) {
      links.push({
        guardian_id: guardianRecords[i].id,
        student_id: students[i].id,
        created_at: new Date()
      });
    }

    return queryInterface.bulkInsert('Guardian_Students', links, {});
  },

  async down(queryInterface, Sequelize) {
    // Remove all guardian–student links
    await queryInterface.bulkDelete('Guardian_Students', null, {});
    // Remove all guardians (role 'guardian')
    await queryInterface.bulkDelete('Users', { role: 'guardian' }, {});
  }
};
