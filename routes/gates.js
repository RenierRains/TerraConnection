const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('gates/rfid-scan', { title: 'RFID Scan point', layout: false });
});

module.exports = router;