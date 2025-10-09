'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const entries = [
      '127.0.0.1',
      '::1',
      '175.176.0.31',
      '192.168.10.128'
    ].map(ip => ({
      ip_address: ip,
      label: null,
      notes: null,
      is_active: true,
      created_at: now,
      updated_at: now
    }));

    if (entries.length === 0) {
      return;
    }

    await queryInterface.bulkInsert('allowed_ips', entries, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('allowed_ips', {
      ip_address: [
        '127.0.0.1',
        '::1',
        '175.176.0.31',
        '192.168.10.128'
      ]
    });
  }
};
