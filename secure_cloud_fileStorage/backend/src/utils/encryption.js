const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-cbc';

// Load RSA keys
const publicKey = fs.readFileSync(
  path.join(__dirname, '../../keys/public.pem'), 
  'utf8'
);
const privateKey = fs.readFileSync(
  path.join(__dirname, '../../keys/private.pem'), 
  'utf8'
);

// Generate random AES-256 key
const generateAESKey = () => {
  return crypto.randomBytes(32);
};

// Generate random IV
const generateIV = () => {
  return crypto.randomBytes(16);
};

// Encrypt file buffer with AES-256
const encryptFile = (fileBuffer, aesKey, iv) => {
  const cipher = crypto.createCipheriv(ALGORITHM, aesKey, iv);
  return Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
};

// Decrypt file buffer with AES-256
const decryptFile = (encryptedBuffer, aesKey, iv) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, aesKey, iv);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};

// Encrypt AES key with RSA public key
const encryptAESKey = (aesKey) => {
  return crypto.publicEncrypt(publicKey, aesKey).toString('base64');
};

// Decrypt AES key with RSA private key
const decryptAESKey = (encryptedAESKey) => {
  return crypto.privateDecrypt(
    privateKey,
    Buffer.from(encryptedAESKey, 'base64')
  );
};

module.exports = {
  generateAESKey,
  generateIV,
  encryptFile,
  decryptFile,
  encryptAESKey,
  decryptAESKey
};