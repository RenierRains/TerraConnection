'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Classes', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      class_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      room: {                        // NOTE test
        type: Sequelize.STRING(100),
        allowNull: false
      },
      start_time: {                  // NOTE start test
        type: Sequelize.TIME,
        allowNull: false
      },
      end_time: {                    // NOTE start test
        type: Sequelize.TIME,
        allowNull: false
      },
      schedule: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Classes');
  }
};