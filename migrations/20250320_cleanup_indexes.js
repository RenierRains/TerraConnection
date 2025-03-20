'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop duplicate indexes from Users table
    const userIndexes = Array.from({length: 63}, (_, i) => i + 2)
      .map(num => `email_${num}`);
    
    for (const index of userIndexes) {
      try {
        await queryInterface.removeIndex('Users', index);
      } catch (error) {
        console.log(`Index ${index} might not exist, continuing...`);
      }
    }

    // Drop duplicate indexes from RFID_Cards table
    const rfidIndexes = Array.from({length: 62}, (_, i) => i + 2)
      .map(num => `card_uid_${num}`);
    
    for (const index of rfidIndexes) {
      try {
        await queryInterface.removeIndex('RFID_Cards', index);
      } catch (error) {
        console.log(`Index ${index} might not exist, continuing...`);
      }
    }

    // Ensure we have the correct unique indexes with proper names
    await queryInterface.addIndex('Users', ['email'], {
      name: 'email_unique',
      unique: true,
      type: 'UNIQUE'
    });

    await queryInterface.addIndex('RFID_Cards', ['card_uid'], {
      name: 'card_uid_unique',
      unique: true,
      type: 'UNIQUE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // If needed to rollback, we just ensure the main unique indexes exist
    await queryInterface.addIndex('Users', ['email'], {
      name: 'email_unique',
      unique: true,
      type: 'UNIQUE'
    });

    await queryInterface.addIndex('RFID_Cards', ['card_uid'], {
      name: 'card_uid_unique',
      unique: true,
      type: 'UNIQUE'
    });
  }
}; 