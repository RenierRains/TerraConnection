'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Password_Reset_Tokens', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      otp_hash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      reset_token_hash: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      request_ip: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      invalidated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      invalidated_reason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('Password_Reset_Tokens', ['user_id', 'expires_at'], {
      name: 'password_reset_tokens_user_expires_idx'
    });
    await queryInterface.addIndex('Password_Reset_Tokens', ['created_at'], {
      name: 'password_reset_tokens_created_at_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Password_Reset_Tokens');
  }
};
