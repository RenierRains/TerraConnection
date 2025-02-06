'use strict';
module.exports = (sequelize, DataTypes) => {
  const Guardian_Student = sequelize.define('Guardian_Student', {
    //NOTE: no specific fields needed kung match ung migration columns (id, guardian_id, student_id, created_at)
  }, {
    tableName: 'Guardian_Students',  
    underscored: true,
    timestamps: false  
  });

  Guardian_Student.associate = function(models) {
    // no need
  };

  return Guardian_Student;
};