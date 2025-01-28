'use strict';
module.exports = (sequelize, DataTypes) => {
  const Class_Professor = sequelize.define('Class_Professor', {
    assigned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'Class_Professors',
    underscored: true,
    timestamps: false // no created_at/updated_at needed unless need..?
  });

  Class_Professor.associate = function(models) {
    // no direct associations typical
  };

  return Class_Professor;
};
