'use strict';
module.exports = (sequelize, DataTypes) => {
  const Class_Enrollment = sequelize.define('Class_Enrollment', {
    enrolled_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'Class_Enrollments',
    underscored: true,
    timestamps: false
  });

  Class_Enrollment.associate = function(models) {
    Class_Enrollment.belongsTo(models.User, {
      foreignKey: 'student_id',
      as: 'studentData'
    });
    Class_Enrollment.belongsTo(models.Class, {
      foreignKey: 'class_id',
      as: 'classData'
    });
  };

  return Class_Enrollment;
};
