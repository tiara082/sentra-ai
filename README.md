# Sentra AI - EduPolicy Lab Backend

Sentra AI is a backend API platform designed to automate educational complaint analysis and policy recommendations for regional education departments. The platform integrates local Deep Learning NLP pipelines for sentiment analysis, semantic duplicate detection, and category classification, alongside policy simulation tools.

## Key Features

1. **AI Processing Pipeline**
   * **Semantic Embeddings**: Uses `Xenova/multilingual-e5-small` to compute 384-dimensional dense vectors for Indonesian text.
   * **Complaint Categorization**: Employs an embedding-based KNN classifier (k=3) for context-aware classification.
   * **Duplicate Detection**: Uses Cosine Similarity on sentence embeddings with a threshold of 0.85.
   * **Sentiment Analysis**: Uses a pre-trained multilingual BERT sentiment classifier with support for dynamic human overrides.
   * **Asynchronous Queue**: Offloads CPU-intensive AI inference to a background worker queue, keeping HTTP request paths under 50ms.

2. **Security & Privacy (UU PDP Compliance)**
   * **At-Rest Encryption**: Encrypts sensitive fields (complaint details and survey feedback) using AES-256-GCM application-layer encryption.
   * **Privacy by Design**: Hashes parent phone numbers using SHA-256 to ensure complete anonymity where chosen.

3. **Decision Intelligence & Analytics**
   * **School Health Score**: Dynamically calculates composite metrics and dimensional scores based on official records and parent feedback.
   * **Ground Truth Anomaly Detection**: Uses standard deviation Z-scores to flag gaps between official figures and parent reports.
   * **Policy Simulation**: Projects composite score changes using a diminishing marginal returns model.
   * **Priority Recommendations**: Ranks intervention priority based on anomalies, health gaps, and active alerts.

---

## Tech Stack

* **Runtime**: Node.js & TypeScript
* **Framework**: Express.js
* **Database**: PostgreSQL
* **AI Model Engine**: Hugging Face Transformers.js (ONNX Runtime)

---

## Installation & Setup

1. Clone the repository and navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in a `.env` file:
   ```env
   PORT=8000
   DATABASE_URL=postgresql://username:password@localhost:5432/sentra_ai
   JWT_SECRET=your_jwt_secret_here
   ENCRYPTION_KEY=your_aes_256_key_here
   ```

4. Set up the database schema:
   ```bash
   psql -d sentra_ai -f src/schema.sql
   ```

---

## Commands

* **Database Seeding**: resets the database and seeds school indicator, parent, and government training datasets (fully encrypted).
  ```bash
  npm run seed
  ```

* **ML Model Retraining**: Pre-computes E5 sentence embeddings for DB-stored complaints and saves them as JSON models.
  ```bash
  npm run train
  ```

* **Start Development Server**:
  ```bash
  npm run dev
  ```

* **Run Integration Tests**:
  ```bash
  npm run test
  ```
