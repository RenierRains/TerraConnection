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

    // Add type column
    await queryInterface.addColumn('GPS_Locations', 'type', {
      type: Sequelize.ENUM('class', 'guardian', 'student'),
      allowNull: false,
      defaultValue: 'class'
    });

    // Update existing records to have type='class'
    await queryInterface.sequelize.query(
      `UPDATE GPS_Locations SET type = 'class' WHERE type IS NULL`
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Remove student_id column
    await queryInterface.removeColumn('GPS_Locations', 'student_id');

    // Remove type column and its ENUM type
    await queryInterface.removeColumn('GPS_Locations', 'type');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_GPS_Locations_type');
  }
}; 