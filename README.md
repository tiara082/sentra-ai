# Sentra AI

Sentra AI is a decision intelligence platform for regional education governance. It fuses official school metrics (e.g., Dapodik) with parent surveys and complaints to generate health scores, detect data anomalies, and simulate policy outcomes.

The project is structured into two main directories:
* `/backend`: Express.js API server handling data analytics, security/encryption, and local Hugging Face NLP pipelines.
* `/frontend`: React SPA (Vite + TypeScript + Tailwind CSS v4) with portals for parents (PWA) and Dinas analysts.

## Folder Structure

* `/backend`: Contains the Node/Express backend.
* `/frontend`: Contains the React/Vite frontend.

## Getting Started

### 1. Database Setup
The backend requires a PostgreSQL database. Ensure PostgreSQL is running, then run the database schema:
```bash
psql -d sentra_ai -f backend/src/schema.sql
```

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` root:
   ```env
   PORT=8000
   DATABASE_URL=postgresql://username:password@localhost:5432/sentra_ai
   JWT_SECRET=your_jwt_secret
   ENCRYPTION_KEY=your_aes_255_key_here
   ```
4. Reset and seed the database (seeds 24 schools across East Java and logs initial anomalies):
   ```bash
   npm run seed
   ```
5. Run the local AI retraining script to pre-compute sentence embeddings:
   ```bash
   npm run train
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser. The top navigation bar allows switching between the Parent Portal (PWA) and the Dinas Analyst Dashboard.

## Key Backend Tasks
Run these inside the `/backend` directory:
* `npm run seed`: Clears the DB and seeds mock schools, indicators, and complaints. Text data is encrypted at-rest using AES-256-GCM.
* `npm run train`: Pre-computes sentence embeddings using `Xenova/multilingual-e5-small` for all reviewed complaints in the DB.
* `npm run test`: Runs the automated integration test suite.
