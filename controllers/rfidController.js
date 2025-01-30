const db = require('../models');

// This could be called by a local desktop script reading USB RFID data
// or a microcontroller-based scanner that sends POST requests
exports.processScan = async (req, res) => {
  try {
    const { card_uid, scan_type, location } = req.body; 
    // scan_type: 'entry' or 'exit'

    // Find the user by card UID
    const rfidCard = await db.RFID_Card.findOne({ where: { card_uid } });
    if (!rfidCard || !rfidCard.is_active) {
      return res.status(400).json({ error: 'Invalid or inactive card' });
    }

    // Create log entry
    const log = await db.Entry_Exit_Log.create({
      user_id: rfidCard.user_id,
      card_uid,
      type: scan_type,
      location
    });

    res.json({ message: 'Scan processed', log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process RFID scan' });
  }
};