'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if the Guardian_Students table exists and has the old column names
    const tableInfo = await queryInterface.describeTable('Guardian_Students');
    
    // If the table has createdAt, rename it to created_at
    if (tableInfo.createdAt) {
      // First, update any invalid datetime values
      await queryInterface.sequelize.query(`
        UPDATE Guardian_Students 
        SET createdAt = CURRENT_TIMESTAMP 
        WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL
      `);
      
      // Rename the column
      await queryInterface.renameColumn('Guardian_Students', 'createdAt', 'created_at');
    }
    
    // If the table has updatedAt, rename it to updated_at
    if (tableInfo.updatedAt) {
      await queryInterface.sequelize.query(`
        UPDATE Guardian_Students 
        SET updatedAt = CURRENT_TIMESTAMP 
        WHERE updatedAt = '0000-00-00 00:00:00' OR updatedAt IS NULL
      `);
      
      await queryInterface.renameColumn('Guardian_Students', 'updatedAt', 'updated_at');
    }
  },

  async down (queryInterface, Sequelize) {
    // Reverse the column rename
    const tableInfo = await queryInterface.describeTable('Guardian_Students');
    
    if (tableInfo.created_at) {
      await queryInterface.renameColumn('Guardian_Students', 'created_at', 'createdAt');
    }
    
    if (tableInfo.updated_at) {
      await queryInterface.renameColumn('Guardian_Students', 'updated_at', 'updatedAt');
    }
  }
};
