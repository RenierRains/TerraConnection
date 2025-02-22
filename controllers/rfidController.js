const db = require('../models');

exports.processScan = async (req, res) => {
  try {
    const { card_uid, location } = req.body;
    const rfidCard = await db.RFID_Card.findOne({ where: { card_uid } });
    if (!rfidCard || !rfidCard.is_active) {
      return res.status(400).json({ error: 'Invalid or inactive card' });
    }

    const lastScan = await db.Entry_Exit_Log.findOne({
      where: { card_uid },
      order: [['timestamp', 'DESC']]
    });

    const newType = lastScan && lastScan.type === 'entry' ? 'exit' : 'entry';

    const log = await db.Entry_Exit_Log.create({
      user_id: rfidCard.user_id,
      card_uid,
      type: newType,
      location: location || null,
      timestamp: new Date()
    });

    const user = await db.User.findByPk(rfidCard.user_id);

    res.json({
      message: 'Scan processed',
      event: newType,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture
      },
      log
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process scan' });
  }
};