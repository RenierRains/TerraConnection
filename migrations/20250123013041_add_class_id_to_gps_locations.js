'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('GPS_Locations', 'class_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Classes',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Update existing records to use the class_id from the most recent location update
    await queryInterface.sequelize.query(`
      UPDATE GPS_Locations gl
      INNER JOIN Class_Enrollments ce ON gl.user_id = ce.student_id
      SET gl.class_id = ce.class_id
      WHERE gl.class_id IS NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('GPS_Locations', 'class_id');
  }
}; 