'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'email_unique',
        msg: 'This email is already registered'
      }
    },
    school_id: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('student','professor','guardian','admin'),
      allowNull: false,
      defaultValue: 'student'
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Department or college the user belongs to (e.g., CMA, MBA, SHS)'
    },
    profile_picture: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    fcm_token: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'Users',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['email'],
        name: 'email_unique'
      }
    ]
  });

  User.associate = function(models) {
    // 1 User -> many RFID_Cards
    User.hasMany(models.RFID_Card, {
      foreignKey: 'user_id'
    });
    
    // 1 User -> many Entry_Exit_Logs
    User.hasMany(models.Entry_Exit_Log, {
      foreignKey: 'user_id'
    });

    // many Users (professors) <-> many Classes
    // Using Class_Professors
    User.belongsToMany(models.Class, {
      through: models.Class_Professor,
      as: 'professorClasses',
      foreignKey: 'professor_id'
    });

    // many Users (students) <-> many Classes
    // Using Class_Enrollments
    User.belongsToMany(models.Class, {
      through: models.Class_Enrollment,
      as: 'studentClasses',
      foreignKey: 'student_id'
    });

    // 1 User -> many GPS_Locations
    User.hasMany(models.GPS_Location, {
      foreignKey: 'user_id'
    });

    // 1 User -> many Audit_Logs
    User.hasMany(models.Audit_Log, {
      foreignKey: 'user_id'
    });

    // If the user is a guardian, they can be linked to many students:
    User.belongsToMany(models.User, {
      through: models.Guardian_Student,
      as: 'StudentsMonitored',
      foreignKey: 'guardian_id',
      otherKey: 'student_id'
    });

    // If the user is a student, they can be linked to many guardians:
    User.belongsToMany(models.User, {
      through: models.Guardian_Student,
      as: 'Guardians',
      foreignKey: 'student_id',
      otherKey: 'guardian_id'
    });

    // User belongs to a department
    User.belongsTo(models.Department, {
      foreignKey: 'department',
      targetKey: 'code',
      as: 'departmentInfo'
    });
  };

  return User;
};
