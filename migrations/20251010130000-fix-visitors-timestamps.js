'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('visitors');

    // Rename legacy camelCase timestamp columns if they exist
    if (!tableDefinition.created_at && tableDefinition.createdAt) {
      await queryInterface.renameColumn('visitors', 'createdAt', 'created_at');
    }

    if (!tableDefinition.updated_at && tableDefinition.updatedAt) {
      await queryInterface.renameColumn('visitors', 'updatedAt', 'updated_at');
    }

    // Ensure timestamp columns exist after potential renames
    const updatedDefinition = await queryInterface.describeTable('visitors');

    if (!updatedDefinition.created_at) {
      await queryInterface.addColumn('visitors', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }

    if (!updatedDefinition.updated_at) {
      await queryInterface.addColumn('visitors', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      });
    }

    // Ensure the created_at index exists before sync tries to create it
    const visitorIndexes = await queryInterface.showIndex('visitors');
    const hasCreatedAtIndex = visitorIndexes.some(
      (index) => index.name === 'idx_visitors_created_at'
    );

    if (!hasCreatedAtIndex) {
      await queryInterface.addIndex('visitors', ['created_at'], {
        name: 'idx_visitors_created_at'
      });
    }
  },

  async down() {
    // Non-destructive corrective migration; nothing to do on rollback.
  }
};
