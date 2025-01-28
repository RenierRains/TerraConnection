'use strict';
module.exports = (sequelize, DataTypes) => {
  const Entry_Exit_Log = sequelize.define('Entry_Exit_Log', {
    card_uid: DataTypes.STRING(100),
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    type: {
      type: DataTypes.ENUM('entry','exit'),
      allowNull: false
    },
    location: DataTypes.STRING(100)
  }, {
    tableName: 'Entry_Exit_Logs',
    underscored: true
  });

  Entry_Exit_Log.associate = function(models) {
    // many logs -> 1 User
    Entry_Exit_Log.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
  };

  return Entry_Exit_Log;
};
