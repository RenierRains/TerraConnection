'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'fcm_token', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'fcm_token');
  }
};