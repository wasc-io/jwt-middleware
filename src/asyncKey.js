import jose from 'node-jose';
import fetch from 'node-fetch';

async function fetchJwks(uri) {
  return fetch(uri).then((response) => response.json());
}

async function verifyToken(token, keystore) {
  const { payload } = await jose.JWS.createVerify(keystore).verify(token);
  return JSON.parse(payload.toString());
}

export default async function initAsyncKey(jwk) {
  let jwkContent = jwk;
  if (typeof jwk === 'string') {
    jwkContent = await fetchJwks(jwk);
  }
  let keystore = await jose.JWK.asKeyStore(jwkContent);

  return async function (token) {
    try {
      return verifyToken(token, keystore);
    } catch (error) {
      jwkContent = fetchJwks(jwk);
      keystore = await jose.JWK.asKeyStore(jwkContent);

      return verifyToken(token, keystore);
    }
  };
}
