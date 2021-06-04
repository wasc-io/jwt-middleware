import cookie from 'cookie';
import errs from 'errs';
import getPino from 'pino';

import syncKey from './syncKey';
import asyncKey from './asyncKey';

const pino = getPino();

/**
 * The middleware function. If both secret and jwk are defined jwk will take precedent
 * @param {Object} options
 * @param {String} secret The JWT verification secret
 * @param {String|Object} jwk For JWK based authentication an endpoint or a direct object
 * @param {String} extractName The name of the header or cookie to extract the token from (default: authorization)
 * @param {Boolean} ignoreAdvancedAuthSchemes Will ignore any header which specifies the token type (eg: Bearer, Basic, ...)
 * @param {Object}
 * @param {Function} error The error logging function
 * @returns {Promise[Function]} The actual middleware function
 */
export default async function (options = {}) {
  let logger = pino.error;
  if (!options.secret && !options.jwk) {
    throw errs.create({
      name: 'NoVerfifaction',
      message:
        'No secret or jwk provided, the JWT token cannot be verified properly',
    });
  }

  if (options.error) {
    logger = options.error;
  }

  let verify;

  if (options.secret) verify = syncKey(options.secret);

  if (options.jwk) verify = await asyncKey(options.jwk);

  /**
   * The authentication middleware
   * @param {Request} request The express Request Object
   * @param {Response} response The express Response Object
   * @param {Function} next The express next function
   * @return
   */
  return async function (request, response, next) {
    const extractName = options.extractName || 'authorization';
    let token = request.get(extractName);
    if (!token) {
      const cookies = request.headers.cookie;

      if (cookies) {
        token = cookie.parse(cookies)[extractName];
      }
    }
    if (options.ignoreAdvancedAuthSchemes) {
      if (token && token.includes(' ')) return next();
    }

    try {
      if (!token) return next();

      const decoded = await verify(token);

      request.scope = decoded.scope;
      request.user = decoded.user;
      request.decodedToken = decoded;

      request.auth = {
        isAuthenticated: true,
        scope: decoded.scope,
      };

      return next();
    } catch (error) {
      if (error.message === 'no key found') {
        return response.status(401).json({
          name: 'BadCredentials',
          message: 'The provided token could not be verified.',
        });
      }
      if (error.name === 'TokenExpiredError') {
        return response.status(401).json({
          name: 'TokenExpired',
          message: 'The token cannot be used past its expiration',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return response.status(401).json({
          name: 'BadCredentials',
          message: 'The provided token could not be verified.',
        });
      }

      logger(error);

      return response.status(400).json({
        name: 'BadRequest',
        message: 'BadRequest',
      });
    }
  };
}
