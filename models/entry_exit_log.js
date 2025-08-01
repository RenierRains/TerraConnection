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
    location: DataTypes.STRING(100),
    face_verification_status: {
      type: DataTypes.ENUM('pending', 'verified', 'failed', 'skipped'),
      allowNull: true,
      defaultValue: 'pending',
      comment: 'Status of face verification after RFID scan'
    }
  }, {
    tableName: 'Entry_Exit_Logs',
    underscored: true
  });

  Entry_Exit_Log.associate = function(models) {
    // many logs -> 1 User
    Entry_Exit_Log.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return Entry_Exit_Log;
};
