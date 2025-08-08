'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // List of tables that might have timestamp column issues
    const tablesToFix = [
      'Classes',
      'RFID_Cards', 
      'Entry_Exit_Logs',
      'Class_Professors',
      'Class_Enrollments',
      'GPS_Locations',
      'Audit_Logs',
      'Notifications'
    ];

    for (const tableName of tablesToFix) {
      try {
        // Check if the table exists
        const tableInfo = await queryInterface.describeTable(tableName);
        
        // If the table has createdAt, rename it to created_at
        if (tableInfo.createdAt) {
          console.log(`Fixing createdAt column in ${tableName}`);
          
          // First, update any invalid datetime values
          await queryInterface.sequelize.query(`
            UPDATE ${tableName} 
            SET createdAt = CURRENT_TIMESTAMP 
            WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL
          `);
          
          // Rename the column
          await queryInterface.renameColumn(tableName, 'createdAt', 'created_at');
        }
        
        // If the table has updatedAt, rename it to updated_at
        if (tableInfo.updatedAt) {
          console.log(`Fixing updatedAt column in ${tableName}`);
          
          await queryInterface.sequelize.query(`
            UPDATE ${tableName} 
            SET updatedAt = CURRENT_TIMESTAMP 
            WHERE updatedAt = '0000-00-00 00:00:00' OR updatedAt IS NULL
          `);
          
          await queryInterface.renameColumn(tableName, 'updatedAt', 'updated_at');
        }
      } catch (error) {
        console.log(`Table ${tableName} doesn't exist or doesn't need fixing: ${error.message}`);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    // Reverse the column renames
    const tablesToRevert = [
      'Classes',
      'RFID_Cards', 
      'Entry_Exit_Logs',
      'Class_Professors',
      'Class_Enrollments',
      'GPS_Locations',
      'Audit_Logs',
      'Notifications'
    ];

    for (const tableName of tablesToRevert) {
      try {
        const tableInfo = await queryInterface.describeTable(tableName);
        
        if (tableInfo.created_at) {
          await queryInterface.renameColumn(tableName, 'created_at', 'createdAt');
        }
        
        if (tableInfo.updated_at) {
          await queryInterface.renameColumn(tableName, 'updated_at', 'updatedAt');
        }
      } catch (error) {
        console.log(`Table ${tableName} doesn't exist or doesn't need reverting: ${error.message}`);
      }
    }
  }
};