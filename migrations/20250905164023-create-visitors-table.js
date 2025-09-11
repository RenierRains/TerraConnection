'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('visitors', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      face_image_path: {
        type: Sequelize.STRING,
        allowNull: true
      },
      entry_time: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      exit_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'exited', 'expired'),
        allowNull: false,
        defaultValue: 'active'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for efficient querying
    await queryInterface.addIndex('visitors', ['name'], {
      name: 'idx_visitors_name'
    });
    
    await queryInterface.addIndex('visitors', ['status'], {
      name: 'idx_visitors_status'
    });
    
    await queryInterface.addIndex('visitors', ['entry_time'], {
      name: 'idx_visitors_entry_time'
    });
    
    await queryInterface.addIndex('visitors', ['exit_time'], {
      name: 'idx_visitors_exit_time'
    });
    
    await queryInterface.addIndex('visitors', ['created_at'], {
      name: 'idx_visitors_created_at'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('visitors');
  }
};
