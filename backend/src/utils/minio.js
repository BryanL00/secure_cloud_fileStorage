const fs = require('fs');
const path = require('path');
const https = require('https');
const Minio = require('minio');
require('dotenv').config();

const useSSL = process.env.MINIO_USE_SSL !== 'false';

// When MinIO is served with a self-signed cert, the Node client must trust it
// or the TLS handshake fails with a self-signed-cert error. Reuse the project's
// own cert as the CA by default; override with MINIO_CA_CERT. If no CA is found
// we leave the default agent in place (correct for a CA-issued cert).
let transportAgent;
if (useSSL) {
  const caPath = process.env.MINIO_CA_CERT
    || path.join(__dirname, '../../certs/server.cert');
  if (fs.existsSync(caPath)) {
    transportAgent = new https.Agent({ ca: fs.readFileSync(caPath) });
  }
}

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  // TLS for the server <-> object-store hop. Enabled by default; set
  // MINIO_USE_SSL=false only for a plain-HTTP MinIO in local development.
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  ...(transportAgent ? { transportAgent } : {}),
});

const BUCKET = process.env.MINIO_BUCKET;

// Upload encrypted file to MinIO
const uploadFile = (objectName, fileBuffer) => {
  return new Promise((resolve, reject) => {
    minioClient.putObject(
      BUCKET, 
      objectName, 
      fileBuffer, 
      fileBuffer.length,
      (err, etag) => {
        if (err) reject(err);
        else resolve(etag);
      }
    );
  });
};

// Download encrypted file from MinIO
const downloadFile = (objectName) => {
  return new Promise((resolve, reject) => {
    let chunks = [];
    minioClient.getObject(BUCKET, objectName, (err, stream) => {
      if (err) reject(err);
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
};

// Delete file from MinIO
const deleteFile = (objectName) => {
  return new Promise((resolve, reject) => {
    minioClient.removeObject(BUCKET, objectName, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = { uploadFile, downloadFile, deleteFile };