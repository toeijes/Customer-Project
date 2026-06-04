const bcrypt = require('bcryptjs');
const hash = '$2b$10$wH1a5Xz/49Z5N.Pqj45H.ePq5hJ1K.jM.O9.9k3Z5.459q.5/5x9O';
console.log(bcrypt.compareSync('admin123', hash));
