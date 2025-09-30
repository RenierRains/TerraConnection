'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const columns = await queryInterface.describeTable(tableName);
        return columns[columnName] !== undefined;
      } catch (error) {
        return false;
      }
    };

    // Helper function to check if index exists
    const indexExists = async (tableName, indexName) => {
      try {
        const indexes = await queryInterface.showIndex(tableName);
        return indexes.some(index => index.name === indexName);
      } catch (error) {
        return false;
      }
    };

    // Add created_at column if it doesn't exist
    if (!(await columnExists('Guardian_Students', 'created_at'))) {
      await queryInterface.addColumn('Guardian_Students', 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      });
    }

    // Add new columns to Guardian_Students table
    if (!(await columnExists('Guardian_Students', 'relationship_type'))) {
      await queryInterface.addColumn('Guardian_Students', 'relationship_type', {
        type: Sequelize.ENUM('parent', 'guardian', 'grandparent', 'sibling', 'other'),
        allowNull: true,
        comment: 'Type of relationship between guardian and student'
      });
    }

    if (!(await columnExists('Guardian_Students', 'priority_level'))) {
      await queryInterface.addColumn('Guardian_Students', 'priority_level', {
        type: Sequelize.ENUM('primary', 'secondary', 'emergency'),
        allowNull: true,
        defaultValue: 'primary',
        comment: 'Priority level of this guardian relationship'
      });
    }

    if (!(await columnExists('Guardian_Students', 'email_notifications'))) {
      await queryInterface.addColumn('Guardian_Students', 'email_notifications', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether to send email notifications to this guardian'
      });
    }

    if (!(await columnExists('Guardian_Students', 'emergency_contact'))) {
      await queryInterface.addColumn('Guardian_Students', 'emergency_contact', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this guardian is an emergency contact'
      });
    }

    if (!(await columnExists('Guardian_Students', 'notes'))) {
      await queryInterface.addColumn('Guardian_Students', 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about this guardian-student relationship'
      });
    }

    if (!(await columnExists('Guardian_Students', 'effective_from'))) {
      await queryInterface.addColumn('Guardian_Students', 'effective_from', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date from which this relationship is effective'
      });
    }

    if (!(await columnExists('Guardian_Students', 'effective_to'))) {
      await queryInterface.addColumn('Guardian_Students', 'effective_to', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Date until which this relationship is effective'
      });
    }

    if (!(await columnExists('Guardian_Students', 'updated_at'))) {
      await queryInterface.addColumn('Guardian_Students', 'updated_at', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'Last updated timestamp'
      });
    }

    if (!(await columnExists('Guardian_Students', 'status'))) {
      await queryInterface.addColumn('Guardian_Students', 'status', {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Status of the guardian-student relationship'
      });
    }

    // Add indexes for better performance (only if they don't exist)
    if (!(await indexExists('Guardian_Students', 'idx_guardian_students_guardian_id'))) {
      await queryInterface.addIndex('Guardian_Students', ['guardian_id'], {
        name: 'idx_guardian_students_guardian_id'
      });
    }

    if (!(await indexExists('Guardian_Students', 'idx_guardian_students_student_id'))) {
      await queryInterface.addIndex('Guardian_Students', ['student_id'], {
        name: 'idx_guardian_students_student_id'
      });
    }

    if (!(await indexExists('Guardian_Students', 'idx_guardian_students_relationship_type'))) {
      await queryInterface.addIndex('Guardian_Students', ['relationship_type'], {
        name: 'idx_guardian_students_relationship_type'
      });
    }

    if (!(await indexExists('Guardian_Students', 'idx_guardian_students_status'))) {
      await queryInterface.addIndex('Guardian_Students', ['status'], {
        name: 'idx_guardian_students_status'
      });
    }

    if (!(await indexExists('Guardian_Students', 'idx_guardian_students_created_at'))) {
      await queryInterface.addIndex('Guardian_Students', ['created_at'], {
        name: 'idx_guardian_students_created_at'
      });
    }

    // Add composite index for efficient queries (only if it doesn't exist)
    if (!(await indexExists('Guardian_Students', 'idx_guardian_students_guardian_student'))) {
      await queryInterface.addIndex('Guardian_Students', ['guardian_id', 'student_id'], {
        name: 'idx_guardian_students_guardian_student',
        unique: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Helper function to check if index exists
    const indexExists = async (tableName, indexName) => {
      try {
        const indexes = await queryInterface.showIndex(tableName);
        return indexes.some(index => index.name === indexName);
      } catch (error) {
        return false;
      }
    };

    // Helper function to check if column exists
    const columnExists = async (tableName, columnName) => {
      try {
        const columns = await queryInterface.describeTable(tableName);
        return columns[columnName] !== undefined;
      } catch (error) {
        return false;
      }
    };

    // Remove indexes first (only if they exist)
    if (await indexExists('Guardian_Students', 'idx_guardian_students_guardian_student')) {
      await queryInterface.removeIndex('Guardian_Students', 'idx_guardian_students_guardian_student');
    }
    if (await indexExists('Guardian_Students', 'idx_guardian_students_created_at')) {
      await queryInterface.removeIndex('Guardian_Students', 'idx_guardian_students_created_at');
    }
    if (await indexExists('Guardian_Students', 'idx_guardian_students_status')) {
      await queryInterface.removeIndex('Guardian_Students', 'idx_guardian_students_status');
    }
    if (await indexExists('Guardian_Students', 'idx_guardian_students_relationship_type')) {
      await queryInterface.removeIndex('Guardian_Students', 'idx_guardian_students_relationship_type');
    }
    if (await indexExists('Guardian_Students', 'idx_guardian_students_student_id')) {
      await queryInterface.removeIndex('Guardian_Students', 'idx_guardian_students_student_id');
    }
    if (await indexExists('Guardian_Students', 'idx_guardian_students_guardian_id')) {
      await queryInterface.removeIndex('Guardian_Students', 'idx_guardian_students_guardian_id');
    }

    // Remove columns (only if they exist)
    if (await columnExists('Guardian_Students', 'status')) {
      await queryInterface.removeColumn('Guardian_Students', 'status');
    }
    if (await columnExists('Guardian_Students', 'updated_at')) {
      await queryInterface.removeColumn('Guardian_Students', 'updated_at');
    }
    if (await columnExists('Guardian_Students', 'effective_to')) {
      await queryInterface.removeColumn('Guardian_Students', 'effective_to');
    }
    if (await columnExists('Guardian_Students', 'effective_from')) {
      await queryInterface.removeColumn('Guardian_Students', 'effective_from');
    }
    if (await columnExists('Guardian_Students', 'notes')) {
      await queryInterface.removeColumn('Guardian_Students', 'notes');
    }
    if (await columnExists('Guardian_Students', 'emergency_contact')) {
      await queryInterface.removeColumn('Guardian_Students', 'emergency_contact');
    }
    if (await columnExists('Guardian_Students', 'email_notifications')) {
      await queryInterface.removeColumn('Guardian_Students', 'email_notifications');
    }
    if (await columnExists('Guardian_Students', 'priority_level')) {
      await queryInterface.removeColumn('Guardian_Students', 'priority_level');
    }
    if (await columnExists('Guardian_Students', 'relationship_type')) {
      await queryInterface.removeColumn('Guardian_Students', 'relationship_type');
    }
  }
};
