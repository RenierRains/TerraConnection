'use strict';
module.exports = (sequelize, DataTypes) => {
  const Class = sequelize.define('Class', {
    class_code: {                
      type: DataTypes.STRING(100),
      allowNull: false
    },
    class_name: {                
      type: DataTypes.STRING(255),
      allowNull: false
    },
    course: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    section: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    room: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    schedule: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'Classes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Class.associate = function(models) {
    Class.belongsToMany(models.User, {
      through: models.Class_Professor,
      as: 'professors',
      foreignKey: 'class_id'
    });
    Class.belongsToMany(models.User, {
      through: models.Class_Enrollment,
      as: 'students',
      foreignKey: 'class_id'
    });
  };

  return Class;
};