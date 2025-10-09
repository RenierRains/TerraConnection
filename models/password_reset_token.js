'use strict';

module.exports = (sequelize, DataTypes) => {
  const Password_Reset_Token = sequelize.define('Password_Reset_Token', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    otp_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    reset_token_hash: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    request_ip: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    attempt_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    invalidated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    invalidated_reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: 'Password_Reset_Tokens',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Password_Reset_Token.associate = models => {
    Password_Reset_Token.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return Password_Reset_Token;
};
