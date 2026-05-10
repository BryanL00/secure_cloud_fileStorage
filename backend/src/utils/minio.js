const Minio = require('minio');
require('dotenv').config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
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