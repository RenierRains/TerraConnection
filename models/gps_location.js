'use strict';
module.exports = (sequelize, DataTypes) => {
  const GPS_Location = sequelize.define('GPS_Location', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    latitude: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    longitude: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    general_area: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Privacy-preserving general location area name'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Classes',
        key: 'id'
      }
    }
  }, {
    tableName: 'GPS_Locations',
    underscored: true,
    timestamps: false
  });

  GPS_Location.associate = function(models) {
    // many GPS_Location -> 1 User
    GPS_Location.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
    GPS_Location.belongsTo(models.Class, {
      foreignKey: 'class_id'
    });
  };

  return GPS_Location;
};
