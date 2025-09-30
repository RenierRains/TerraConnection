'use strict';
module.exports = (sequelize, DataTypes) => {
  const Guardian_Student = sequelize.define('Guardian_Student', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    guardian_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    relationship_type: {
      type: DataTypes.ENUM('parent', 'guardian', 'grandparent', 'sibling', 'other'),
      allowNull: true,
      comment: 'Type of relationship between guardian and student'
    },
    priority_level: {
      type: DataTypes.ENUM('primary', 'secondary', 'emergency'),
      allowNull: true,
      defaultValue: 'primary',
      comment: 'Priority level of this guardian relationship'
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether to send email notifications to this guardian'
    },
    emergency_contact: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this guardian is an emergency contact'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about this guardian-student relationship'
    },
    effective_from: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date from which this relationship is effective'
    },
    effective_to: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date until which this relationship is effective'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
      comment: 'Status of the guardian-student relationship'
    }
  }, {
    tableName: 'Guardian_Students',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['guardian_id', 'student_id']
      },
      {
        fields: ['guardian_id']
      },
      {
        fields: ['student_id']
      },
      {
        fields: ['relationship_type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  Guardian_Student.associate = function(models) {
    Guardian_Student.belongsTo(models.User, { 
      foreignKey: 'guardian_id', 
      as: 'guardian',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    Guardian_Student.belongsTo(models.User, { 
      foreignKey: 'student_id', 
      as: 'student',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  };

  return Guardian_Student;
};
