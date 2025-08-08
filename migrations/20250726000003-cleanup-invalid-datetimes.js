'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // First, set MySQL to allow zero dates temporarily
    await queryInterface.sequelize.query("SET sql_mode = 'ALLOW_INVALID_DATES'");
    
    try {
      // Clean up invalid datetime values in all tables
      const tablesToClean = ['Users', 'Classes', 'RFID_Cards', 'Entry_Exit_Logs', 'Class_Professors', 'Class_Enrollments', 'GPS_Locations', 'Audit_Logs', 'Guardian_Students', 'Notifications'];
      
      for (const tableName of tablesToClean) {
        try {
          // Check if table exists
          const tableInfo = await queryInterface.describeTable(tableName);
          
          // Clean createdAt column if it exists
          if (tableInfo.createdAt) {
            console.log(`Cleaning createdAt in ${tableName}`);
            await queryInterface.sequelize.query(`
              UPDATE \`${tableName}\` 
              SET createdAt = CURRENT_TIMESTAMP 
              WHERE createdAt = '0000-00-00 00:00:00' OR createdAt IS NULL OR createdAt = ''
            `);
          }
          
          // Clean created_at column if it exists
          if (tableInfo.created_at) {
            console.log(`Cleaning created_at in ${tableName}`);
            await queryInterface.sequelize.query(`
              UPDATE \`${tableName}\` 
              SET created_at = CURRENT_TIMESTAMP 
              WHERE created_at = '0000-00-00 00:00:00' OR created_at IS NULL OR created_at = ''
            `);
          }
          
          // Clean updatedAt column if it exists
          if (tableInfo.updatedAt) {
            console.log(`Cleaning updatedAt in ${tableName}`);
            await queryInterface.sequelize.query(`
              UPDATE \`${tableName}\` 
              SET updatedAt = CURRENT_TIMESTAMP 
              WHERE updatedAt = '0000-00-00 00:00:00' OR updatedAt IS NULL OR updatedAt = ''
            `);
          }
          
          // Clean updated_at column if it exists
          if (tableInfo.updated_at) {
            console.log(`Cleaning updated_at in ${tableName}`);
            await queryInterface.sequelize.query(`
              UPDATE \`${tableName}\` 
              SET updated_at = CURRENT_TIMESTAMP 
              WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR updated_at = ''
            `);
          }
          
        } catch (error) {
          console.log(`Table ${tableName} doesn't exist or error cleaning: ${error.message}`);
        }
      }
      
    } finally {
      // Restore strict SQL mode
      await queryInterface.sequelize.query("SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
    }
  },

  async down (queryInterface, Sequelize) {
    // This migration cannot be easily reversed since we're fixing corrupted data
    console.log('Cannot reverse datetime cleanup migration');
  }
};
