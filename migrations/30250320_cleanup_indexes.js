'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop all existing indexes from Users table except PRIMARY
    try {
      await queryInterface.sequelize.query(`
        SELECT DISTINCT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'Users' 
        AND INDEX_NAME != 'PRIMARY'
      `).then(async ([results]) => {
        for (const row of results) {
          try {
            await queryInterface.sequelize.query(`DROP INDEX \`${row.INDEX_NAME}\` ON Users`);
            console.log(`Dropped index ${row.INDEX_NAME} from Users`);
          } catch (error) {
            console.log(`Error dropping index ${row.INDEX_NAME}: ${error.message}`);
          }
        }
      });
    } catch (error) {
      console.log('Error getting Users indexes:', error.message);
    }

    // Drop all existing indexes from RFID_Cards table except PRIMARY
    try {
      await queryInterface.sequelize.query(`
        SELECT DISTINCT INDEX_NAME 
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'RFID_Cards' 
        AND INDEX_NAME != 'PRIMARY'
      `).then(async ([results]) => {
        for (const row of results) {
          try {
            await queryInterface.sequelize.query(`DROP INDEX \`${row.INDEX_NAME}\` ON RFID_Cards`);
            console.log(`Dropped index ${row.INDEX_NAME} from RFID_Cards`);
          } catch (error) {
            console.log(`Error dropping index ${row.INDEX_NAME}: ${error.message}`);
          }
        }
      });
    } catch (error) {
      console.log('Error getting RFID_Cards indexes:', error.message);
    }

    // Create new unique indexes with proper names
    try {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX \`email_unique\` ON Users (\`email\`)
      `);
      console.log('Created email_unique index on Users');
    } catch (error) {
      console.log('Error creating email_unique index:', error.message);
    }

    try {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX \`card_uid_unique\` ON RFID_Cards (\`card_uid\`)
      `);
      console.log('Created card_uid_unique index on RFID_Cards');
    } catch (error) {
      console.log('Error creating card_uid_unique index:', error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // If needed to rollback, we just ensure the main unique indexes exist
    try {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX \`email_unique\` ON Users (\`email\`)
      `);
    } catch (error) {
      console.log('Error creating email_unique index:', error.message);
    }

    try {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX \`card_uid_unique\` ON RFID_Cards (\`card_uid\`)
      `);
    } catch (error) {
      console.log('Error creating card_uid_unique index:', error.message);
    }
  }
}; 