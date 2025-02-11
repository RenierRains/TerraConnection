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
    timestamps: false 
  });

  Class_Professor.associate = function(models) {
    Class_Professor.belongsTo(models.Class, {
      foreignKey: 'class_id',
      as: 'classData'
    });
  };

  return Class_Professor;
};
