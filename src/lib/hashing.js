import crypto from 'crypto';

const sha512 = (valueToHash, salt) => {
  const hash = crypto.createHmac('sha512', salt);
  hash.update(valueToHash);
  const value = hash.digest('hex');
  return value;
};

export const generateOnewayHash = (valueToHash, salt) => {
  return sha512(valueToHash, salt);
};
