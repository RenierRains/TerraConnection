'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('visitors');

    if (!tableDefinition.rfid_card_uid) {
      await queryInterface.addColumn('visitors', 'rfid_card_uid', {
        type: Sequelize.STRING(128),
        allowNull: true
      });
    }

    const indexes = await queryInterface.showIndex('visitors');
    const hasRfidIndex = indexes.some((index) => index.name === 'idx_visitors_rfid_card_uid');

    if (!hasRfidIndex) {
      await queryInterface.addIndex('visitors', ['rfid_card_uid'], {
        name: 'idx_visitors_rfid_card_uid'
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('visitors');
    const hasRfidIndex = indexes.some((index) => index.name === 'idx_visitors_rfid_card_uid');

    if (hasRfidIndex) {
      await queryInterface.removeIndex('visitors', 'idx_visitors_rfid_card_uid');
    }

    const tableDefinition = await queryInterface.describeTable('visitors');

    if (tableDefinition.rfid_card_uid) {
      await queryInterface.removeColumn('visitors', 'rfid_card_uid');
    }
  }
};

