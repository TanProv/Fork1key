# ☕ Batch Verifier

Coffee Engine Version: 0.6.0

A web application for batch verification with API documentation.

## Features

- 🎨 Modern, responsive UI with gradient design
- 📚 API documentation using Redoc (OpenAPI 3.0)
- 🔒 CSRF protection for secure API calls
- 📡 Server-Sent Events (SSE) for real-time updates
- ⚡ Express.js backend with RESTful API

## Installation

```bash
cd d:\Fork_1key\batch-verifier
npm install
```

## Usage

### Start the server

```bash
npm start
```

The server will start on `http://localhost:3000`

### Access the application

- **Landing Page**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs

## API Endpoints

### GET /api/status
Get system status (no authentication required)

### POST /api/batch
Submit batch verification requests (requires CSRF token)
- Returns Server-Sent Events (SSE) stream

### POST /api/cancel
Cancel a pending verification (requires CSRF token)

### POST /api/check-status
Check verification status (no authentication required)

## CSRF Token

The CSRF token is displayed in the console when the server starts. Include it in the `X-CSRF-Token` header for protected endpoints.

## Technology Stack

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **API Docs**: Redoc
- **Security**: Helmet, CORS, CSRF protection

## Project Structure

```
batch-verifier/
├── package.json
├── server.js
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── js/
│   │   └── main.js
│   └── api/
│       └── docs/
│           ├── index.html
│           └── api.json
└── README.md
```

## License

MIT
