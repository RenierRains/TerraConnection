'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Retrieve professor IDs.
    const [professors] = await queryInterface.sequelize.query(
      `SELECT id, email FROM Users WHERE role = 'professor';`
    );
    // Retrieve class IDs by class_code.
    const [classes] = await queryInterface.sequelize.query(
      `SELECT id, class_code FROM Classes;`
    );

    function findProfessorId(email) {
      const prof = professors.find(p => p.email === email);
      return prof ? prof.id : null;
    }
    function findClassId(class_code) {
      const cls = classes.find(c => c.class_code === class_code);
      return cls ? cls.id : null;
    }

    const assignments = [
      // Professor A (professorA@example.com) handles ITE293 and ITE384.
      { professor_email: 'professorA@example.com', class_codes: ['ITE293', 'ITE384'] },
      // Professor B for ITE309.
      { professor_email: 'professorB@example.com', class_codes: ['ITE309'] },
      // Professor C for ITE370.
      { professor_email: 'professorC@example.com', class_codes: ['ITE370'] },
      // Professor D for ITE385 and ITE401.
      { professor_email: 'professorD@example.com', class_codes: ['ITE385', 'ITE401'] },
      // Professor E for SSP008.
      { professor_email: 'professorE@example.com', class_codes: ['SSP008'] }
    ];

    const bulkData = [];
    assignments.forEach(assignment => {
      const professorId = findProfessorId(assignment.professor_email);
      if (professorId) {
        assignment.class_codes.forEach(class_code => {
          const classId = findClassId(class_code);
          if (classId) {
            bulkData.push({
              professor_id: professorId,
              class_id: classId,
              assigned_at: new Date()
            });
          }
        });
      }
    });

    return queryInterface.bulkInsert('Class_Professors', bulkData, {});
  },
  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Class_Professors', null, {});
  }
};
