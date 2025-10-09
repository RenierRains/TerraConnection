'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('allowed_ips', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: false,
        unique: true
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('allowed_ips', ['is_active'], {
      name: 'allowed_ips_is_active_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('allowed_ips', 'allowed_ips_is_active_idx');
    await queryInterface.dropTable('allowed_ips');
  }
};
