const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gestionnaire-taches-secret';

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '8h',
  });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Autorisation manquante' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token invalide' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    req.user = decoded;
    next();
  });
}

module.exports = {
  signToken,
  verifyToken,
};
