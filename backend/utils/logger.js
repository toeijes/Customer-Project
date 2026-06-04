const db = require('../db');

/**
 * Logs a system action into the database.
 * 
 * @param {Object} req - The Express request object (used to extract IP)
 * @param {Object} user - The user performing the action (should have id and username/fullName)
 * @param {String} action - The action type (e.g., LOGIN, LOGOUT, UPDATE_ROLE, UPDATE_STATUS)
 * @param {String} target - The target entity (e.g., USERS, PROJECTS, SYSTEM)
 * @param {String} target_id - The ID of the targeted entity (optional)
 * @param {Object} details - Additional details about the action (optional)
 */
async function logSystemAction(req, user, action, target, target_id = null, details = null) {
  try {
    const ip_address = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
    const user_id = user?.id || null;
    const username = user?.fullName || user?.pwa_username || user?.local_username || user?.username || 'System';
    const jsonDetails = details ? JSON.stringify(details) : null;

    const sql = `
      INSERT INTO system_logs (user_id, username, action, target, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await db.query(sql, [
      user_id,
      username,
      action,
      target,
      target_id,
      jsonDetails,
      ip_address
    ]);
  } catch (error) {
    console.error('Failed to log system action:', error);
  }
}

module.exports = {
  logSystemAction
};
