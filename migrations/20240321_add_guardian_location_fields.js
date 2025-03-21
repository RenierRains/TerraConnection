'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add student_id column
    await queryInterface.addColumn('GPS_Locations', 'student_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    });

    // Add type column with MySQL ENUM
    await queryInterface.addColumn('GPS_Locations', 'type', {
      type: Sequelize.ENUM,
      values: ['class', 'guardian', 'student'],
      allowNull: false,
      defaultValue: 'class'
    });

    // Update existing records to have type='class'
    await queryInterface.sequelize.query(
      `UPDATE GPS_Locations SET type = 'class' WHERE type IS NULL`
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns
    await queryInterface.removeColumn('GPS_Locations', 'student_id');
    await queryInterface.removeColumn('GPS_Locations', 'type');
  }
}; 