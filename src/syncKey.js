import jwt from 'jsonwebtoken';

export default function initSyncKey(secret) {
  return function verifySyncKey(token) {
    return jwt.verify(token, secret);
  };
}
