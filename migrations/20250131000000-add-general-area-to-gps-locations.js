'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('GPS_Locations', 'general_area', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Privacy-preserving general location area name (e.g. "Downtown", "Campus Area")'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('GPS_Locations', 'general_area');
  }
};
