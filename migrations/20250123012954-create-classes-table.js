'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Classes', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      class_code: {               
        type: Sequelize.STRING(100),
        allowNull: false
      },
      class_name: {               
        type: Sequelize.STRING(255),
        allowNull: false
      },
      course: { 
        type: Sequelize.STRING(100),
        allowNull: false
      },
      year: {        
        type: Sequelize.INTEGER,
        allowNull: false
      },
      section: {                  
        type: Sequelize.STRING(50),
        allowNull: false
      },
      room: {                  
        type: Sequelize.STRING(100),
        allowNull: false
      },
      start_time: {              
        type: Sequelize.TIME,
        allowNull: false
      },
      end_time: {                
        type: Sequelize.TIME,
        allowNull: false
      },
      schedule: {                  // e.g. "Sat" or "Mon,Wed,Fri"
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