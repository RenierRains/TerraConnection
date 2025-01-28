'use strict';
module.exports = (sequelize, DataTypes) => {
  const RFID_Card = sequelize.define('RFID_Card', {
    card_uid: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    issued_at: DataTypes.DATE,
    deactivated_at: DataTypes.DATE
  }, {
    tableName: 'RFID_Cards',
    underscored: true
  });

  RFID_Card.associate = function(models) {
    // many cards -> 1 User
    RFID_Card.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
  };

  return RFID_Card;
};
