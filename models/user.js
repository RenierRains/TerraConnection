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
      unique: true,
      allowNull: false
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
    }
  }, {
    tableName: 'Users',
    underscored: true
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
  };

  return User;
};
