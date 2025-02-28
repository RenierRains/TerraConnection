'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Audit_Logs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,  // system events might have no user
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      details: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('Audit_Logs', ['timestamp'], {
      name: 'audit_logs_timestamp_idx'
    });
    await queryInterface.addIndex('Audit_Logs', ['action_type'], {
      name: 'audit_logs_action_type_idx'
    });
    await queryInterface.addIndex('Audit_Logs', ['user_id'], {
      name: 'audit_logs_user_id_idx'
    });
    await queryInterface.addIndex('Audit_Logs', ['action_type', 'timestamp'], {
      name: 'audit_logs_action_timestamp_idx'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Audit_Logs', 'audit_logs_timestamp_idx');
    await queryInterface.removeIndex('Audit_Logs', 'audit_logs_action_type_idx');
    await queryInterface.removeIndex('Audit_Logs', 'audit_logs_user_id_idx');
    await queryInterface.removeIndex('Audit_Logs', 'audit_logs_action_timestamp_idx');
    await queryInterface.dropTable('Audit_Logs');
  }
};
