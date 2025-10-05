'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fix profile picture paths that start with /uploads/profile_pics/
    // Remove the leading slash to prevent path duplication
    await queryInterface.sequelize.query(`
      UPDATE Users 
      SET profile_picture = REPLACE(profile_picture, '/uploads/profile_pics/', 'uploads/profile_pics/') 
      WHERE profile_picture LIKE '/uploads/profile_pics/%'
    `);
    
    console.log('Fixed profile picture paths by removing leading slashes');
  },

  async down(queryInterface, Sequelize) {
    // Revert by adding back the leading slash
    await queryInterface.sequelize.query(`
      UPDATE Users 
      SET profile_picture = CONCAT('/', profile_picture)
      WHERE profile_picture LIKE 'uploads/profile_pics/%' 
      AND profile_picture NOT LIKE '/%'
    `);
    
    console.log('Reverted profile picture paths by adding back leading slashes');
  }
};
