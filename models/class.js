'use strict';
module.exports = (sequelize, DataTypes) => {
  const Class = sequelize.define('Class', {
    class_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    }
  }, {
    tableName: 'Classes',
    underscored: true
  });

  Class.associate = function(models) {
    // Class <-> many professors
    Class.belongsToMany(models.User, {
      through: models.Class_Professor,
      as: 'professors',
      foreignKey: 'class_id'
    });

    // Class <-> many students
    Class.belongsToMany(models.User, {
      through: models.Class_Enrollment,
      as: 'students',
      foreignKey: 'class_id'
    });
  };

  return Class;
};
