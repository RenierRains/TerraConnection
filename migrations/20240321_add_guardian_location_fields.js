'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('GPS_Locations', 'student_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    });

    await queryInterface.addColumn('GPS_Locations', 'type', {
      type: Sequelize.ENUM('class', 'guardian', 'student'),
      defaultValue: 'class'
    });

    // Update existing records to have type='class'
    await queryInterface.sequelize.query(`
      UPDATE GPS_Locations 
      SET type = 'class' 
      WHERE type IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('GPS_Locations', 'student_id');
    await queryInterface.removeColumn('GPS_Locations', 'type');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_GPS_Locations_type;
    `);
  }
}; 