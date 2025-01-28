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
    // no direct associations usually
  };

  return Class_Enrollment;
};
