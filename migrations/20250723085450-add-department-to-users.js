'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'department', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Department or college the user belongs to (e.g., CMA, MBA, SHS)'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'department');
  }
};
