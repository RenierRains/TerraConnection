'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if the Users table exists and has the old column names
    const tableInfo = await queryInterface.describeTable('Users');
    
    // If the table has createdAt/updatedAt, rename them to created_at/updated_at
    if (tableInfo.createdAt) {
      // First, update any invalid datetime values
      await queryInterface.sequelize.query(`
        UPDATE Users 
        SET createdAt = CURRENT_TIMESTAMP 
        WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL
      `);
      
      await queryInterface.sequelize.query(`
        UPDATE Users 
        SET updatedAt = CURRENT_TIMESTAMP 
        WHERE updatedAt = '0000-00-00 00:00:00' OR updatedAt IS NULL
      `);
      
      // Rename the columns
      await queryInterface.renameColumn('Users', 'createdAt', 'created_at');
      await queryInterface.renameColumn('Users', 'updatedAt', 'updated_at');
    }
  },

  async down (queryInterface, Sequelize) {
    // Reverse the column rename
    const tableInfo = await queryInterface.describeTable('Users');
    
    if (tableInfo.created_at) {
      await queryInterface.renameColumn('Users', 'created_at', 'createdAt');
      await queryInterface.renameColumn('Users', 'updated_at', 'updatedAt');
    }
  }
};
