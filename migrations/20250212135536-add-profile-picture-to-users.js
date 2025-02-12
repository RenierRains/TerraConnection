'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'profile_picture', {
      type: Sequelize.STRING,
      allowNull: true  // allow
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'profile_picture');
  }
};
