'use strict';
module.exports = (sequelize, DataTypes) => {
  const GPS_Location = sequelize.define('GPS_Location', {
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
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
      foreignKey: 'user_id'
    });
  };

  return GPS_Location;
};
