================================================================================
CloudFortify - Secure Cloud File Storage with RBAC
Final Year Project (FYP) - Source Code & Execution Instructions
================================================================================

--------------------------------------------------------------------------------
1. SOURCE CODE ACCESS (valid for at least 1 year after submission)
--------------------------------------------------------------------------------

The complete, latest source code is hosted on GitHub:

    https://github.com/BryanL00/secure_cloud_fileStorage


To clone the repository:

    git clone https://github.com/BryanL00/secure_cloud_fileStorage.git

NOTE: No dataset is required. This project does NOT use any images or a
self-collected/public dataset. All data (user accounts, files) is created by
the user at run time. Therefore no Kaggle upload is needed.


--------------------------------------------------------------------------------
2. OVERVIEW
--------------------------------------------------------------------------------

CloudFortify is a browser-based secure file storage system featuring:
  - AES-256-CBC file encryption + RSA key wrapping
  - Role-Based Access Control (RBAC) with 5 roles
  - JWT authentication via HTTP-only cookies
  - End-to-end TLS/HTTPS (client, server, object storage)
  - Department-aware file sharing
  - Audit logging and a recycle bin

Architecture: React (frontend)  <->  Node.js/Express (backend)
              Backend  <->  PostgreSQL (metadata)  +  MinIO (encrypted files)


--------------------------------------------------------------------------------
3. REQUIRED TOOLS / SOFTWARE (with versions and download links)
--------------------------------------------------------------------------------

The project was developed and tested with the following versions:

  Tool          Tested Version   Download Link
  ------------  ---------------  ---------------------------------------------
  Node.js       v20.20.2 (18+)   https://nodejs.org/en/download
  npm           v10.8.2          (bundled with Node.js)
  PostgreSQL    14 or newer      https://www.postgresql.org/download/
  MinIO         latest server    https://min.io/download
  OpenSSL       3.x              https://www.openssl.org/  (or bundled w/ OS)
  Git           any recent       https://git-scm.com/downloads

macOS users can install MinIO via Homebrew (https://brew.sh):
    brew install minio/stable/minio


--------------------------------------------------------------------------------
4. LIBRARIES / DEPENDENCIES
--------------------------------------------------------------------------------

All libraries are installed automatically with "npm install" (see Section 6).
Key dependencies:

  BACKEND (Node.js / Express):
    express ^4.18.2         - web server framework
    pg ^8.11.0              - PostgreSQL client
    minio ^7.1.3            - MinIO (S3-compatible) object storage client
    jsonwebtoken ^9.0.0     - JWT authentication
    bcryptjs ^2.4.3         - password hashing
    multer ^1.4.5-lts.1     - multipart file upload handling
    file-type ^16.5.4       - MIME type / file signature validation
    express-rate-limit ^8.5.2 - login/upload rate limiting
    cookie-parser ^1.4.7    - HTTP-only cookie parsing
    cors ^2.8.5             - cross-origin resource sharing
    dotenv ^16.0.3          - environment variable loading
    uuid ^9.0.0             - unique identifiers
    (encryption uses Node.js built-in "crypto" - no extra library)

  FRONTEND (React / Vite):
    react ^19.2.4
    react-dom ^19.2.4
    react-router-dom ^7.14.1
    axios ^1.15.0
    vite ^8.0.4 (build tool)


--------------------------------------------------------------------------------
5. FIRST-TIME SETUP
--------------------------------------------------------------------------------

STEP 5.1 - Create the PostgreSQL database and load the schema:

    psql -U postgres -c "CREATE DATABASE secure_cloud_storage;"
    psql -U postgres -d secure_cloud_storage -f backend/schema.sql

STEP 5.2 - Generate the RSA key pair (used to wrap the AES file keys):

    mkdir -p backend/keys
    openssl genrsa -out backend/keys/private.pem 2048
    openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem

STEP 5.3 - Generate a self-signed TLS certificate (enables HTTPS):

    mkdir -p backend/certs
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout backend/certs/server.key -out backend/certs/server.cert -days 825 \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

STEP 5.4 - Create the backend environment file "backend/.env" with:

    DATABASE_URL=postgresql://postgres:<password>@localhost:5432/secure_cloud_storage
    MINIO_ENDPOINT=localhost
    MINIO_PORT=9000
    MINIO_ACCESS_KEY=<your_minio_access_key>
    MINIO_SECRET_KEY=<your_minio_secret_key>
    MINIO_BUCKET=encrypted-files
    MINIO_USE_SSL=true
    MINIO_CA_CERT=./certs/server.cert
    JWT_SECRET=<any_long_random_string>
    RSA_PRIVATE_KEY_PATH=./keys/private.pem
    RSA_PUBLIC_KEY_PATH=./keys/public.pem
    PORT=3001
    FRONTEND_URL=https://localhost:5173
    SSL_KEY_PATH=./certs/server.key
    SSL_CERT_PATH=./certs/server.cert

STEP 5.5 - Install dependencies:

    cd backend  && npm install
    cd ../frontend && npm install


--------------------------------------------------------------------------------
6. RUNNING THE APPLICATION (three processes required)
--------------------------------------------------------------------------------

PROCESS 1 - MinIO object storage (over TLS):

    mkdir -p ~/.minio/certs
    cp backend/certs/server.cert ~/.minio/certs/public.crt
    cp backend/certs/server.key  ~/.minio/certs/private.key
    minio server ~/minio-data --console-address :9001

    Then open  https://localhost:9001  and create a bucket named:
        encrypted-files
    (For plain HTTP instead: skip the certs and set MINIO_USE_SSL=false in .env)

PROCESS 2 - Backend API:

    cd backend
    npm run dev        (development, auto-reload)
      or
    npm start          (production)
    -> runs on  https://localhost:3001

PROCESS 3 - Frontend:

    cd frontend
    npm run dev
    -> runs on  https://localhost:5173

Open https://localhost:5173 in a browser. Because the certificate is
self-signed, the browser shows a one-time security warning - click through it
to proceed.

TIP: From the backend folder you can start backend + frontend together with:
    npm run fullstack


--------------------------------------------------------------------------------
7. DEFAULT / TEST LOGIN
--------------------------------------------------------------------------------

Loading backend/schema.sql (Step 5.1) seeds an initial administrator account:

    Email:    admin@test.com
    Password: Admin@1234

Log in with this account, then create additional users (Department Manager,
Project Manager, User, Guest) from the Admin Panel to explore all roles.
Change or remove the default admin account after first login.


--------------------------------------------------------------------------------
8. TROUBLESHOOTING
--------------------------------------------------------------------------------

  - "connection refused" to database: ensure PostgreSQL is running and the
    DATABASE_URL credentials in backend/.env are correct.
  - MinIO upload errors: confirm the "encrypted-files" bucket exists and that
    MINIO_USE_SSL matches how MinIO was started (TLS vs plain HTTP).
  - Browser blocks the site: accept the self-signed certificate warning.
  - Port already in use: change PORT (backend) or the Vite port (frontend).

================================================================================
End of Readme.txt
================================================================================
