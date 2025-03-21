'use strict';
module.exports = (sequelize, DataTypes) => {
  const GPS_Location = sequelize.define('GPS_Location', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('class', 'guardian', 'student'),
      defaultValue: 'class'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'GPS_Locations',
    underscored: true,
    timestamps: false
  });

  GPS_Location.associate = function(models) {
    // many GPS_Location -> 1 User
    GPS_Location.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    GPS_Location.belongsTo(models.Class, {
      foreignKey: 'class_id',
      as: 'class'
    });
    GPS_Location.belongsTo(models.User, {
      foreignKey: 'student_id',
      as: 'student'
    });
  };

  return GPS_Location;
};
