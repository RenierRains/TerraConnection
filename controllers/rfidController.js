const db = require('../models');
const { logRFIDAudit } = require('./auditLogger');

exports.processScan = async (req, res) => {
  try {
    const { card_uid, location, device_id } = req.body;
    const rfidCard = await db.RFID_Card.findOne({ where: { card_uid } });
    
    if (!rfidCard || !rfidCard.is_active) {
      await logRFIDAudit(null, 'ACCESS_DENIED', {
        card_uid,
        reason: !rfidCard ? 'Invalid card' : 'Inactive card',
        deviceId: device_id,
        location,
        timestamp: new Date()
      }, req);
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

    await logRFIDAudit(rfidCard.user_id, 'ACCESS_GRANTED', {
      card_uid,
      deviceId: device_id,
      location,
      type: newType,
      cardDetails: {
        id: rfidCard.id,
        issuedAt: rfidCard.issued_at
      },
      userDetails: {
        id: user.id,
        school_id: user.school_id,
        name: `${user.first_name} ${user.last_name}`
      },
      timestamp: log.timestamp
    }, req);

    res.json({
      message: 'Scan processed',
      event: newType,
      user: {
        id: user.id,
        school_id: user.school_id,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_picture: user.profile_picture
      },
      log
    });
  } catch (err) {
    console.error(err);
    await logRFIDAudit(null, 'CARD_SCAN', {
      error: err.message,
      card_uid: req.body?.card_uid,
      deviceId: req.body?.device_id,
      location: req.body?.location,
      status: 'failed'
    }, req);
    res.status(500).json({ error: 'Failed to process scan' });
  }
};