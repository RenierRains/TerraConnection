'use strict';
module.exports = (sequelize, DataTypes) => {
  const Guardian_Student = sequelize.define('Guardian_Student', {
    // If  'id' and 'created_at' in the table, omit fields
    // Sequelize map auto if  column match
  }, {
    tableName: 'Guardian_Student',
    underscored: true,
    timestamps: false 
  });

  Guardian_Student.associate = function(models) {
    // Typically bridging tables don’t need direct associations themselves,
    // but you could define belongsTo if you want direct references.
  };

  return Guardian_Student;
};