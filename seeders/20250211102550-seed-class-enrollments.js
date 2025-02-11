'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const [classes] = await queryInterface.sequelize.query(
      `SELECT id FROM Classes WHERE class_code = 'ITE309' LIMIT 1;`
    );
    if (classes.length === 0) {
      throw new Error("Class ITE309 not found");
    }
    const classId = classes[0].id;

    const [students] = await queryInterface.sequelize.query(
      `SELECT id FROM Users WHERE school_id = 'BSIT3-06' AND role = 'student';`
    );

    // create enrollment record
    const enrollments = students.map(student => ({
      class_id: classId,
      student_id: student.id,
      enrolled_at: new Date()
    }));

    return queryInterface.bulkInsert('Class_Enrollments', enrollments, {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Class_Enrollments', null, {});
  }
};
