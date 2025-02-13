'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // get all class
    const [classes] = await queryInterface.sequelize.query(
      `SELECT id FROM Classes;`
    );
    
    // get all student
    const [students] = await queryInterface.sequelize.query(
      `SELECT id FROM Users WHERE role = 'student';`
    );
    
    // create enrollment record for each student in class
    const enrollments = [];
    classes.forEach(cls => {
      students.forEach(student => {
        enrollments.push({
          class_id: cls.id,
          student_id: student.id,
          enrolled_at: new Date()
        });
      });
    });
    
    return queryInterface.bulkInsert('Class_Enrollments', enrollments, {});
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Class_Enrollments', null, {});
  }
};
