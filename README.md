# MedGraph AI — Clinical Decision Support System (CDSS)

MedGraph AI is a production-grade Clinical Decision Support System (CDSS) that unifies structured biomedical knowledge graphs with dense vector guideline indexes to enable explainable clinical reasoning. The system is designed to act as an auditable co-pilot for healthcare practitioners by querying standard drug-drug interactions (Neo4j) and clinical practice guidelines (Pinecone RAG) to generate grounded diagnostic assessments using fine-tuned generative LLMs (AWS SageMaker).

---

## 🏗️ System Architecture

MedGraph AI operates on a Dual-System architecture that prioritizes safety, citation accuracy, and low latency:

```
                            +----------------------------------------+
                            |      Practitioner Console (UI)         |
                            +----------------------------------------+
                                                 |
                                                 v
                                    FastAPI Orchestration API
                                                 |
                       +-------------------------+-------------------------+
                       |                                                   |
                       v                                                   v
         +---------------------------+                       +---------------------------+
         |     Biomedical Graph      |                       |     Guideline Vector      |
         |    Database (Neo4j)       |                       |    Database (Pinecone)    |
         +---------------------------+                       +---------------------------+
                       |                                                   |
                       v                                                   v
               Drug Interactions &                                 Official Guideline
             Disease-Symptom Mappings                           Citations & Context Chunks
                       |                                                   |
                       +-------------------------+-------------------------+
                                                 |
                                                 v
                                    LLM Reasoning Engine
                             (SageMaker Gemma-2 / Gemini Flash)
                                                 |
                                                 v
                                     Citation Veracity Check
                                                 |
                                                 v
                                     Ingested Patient Report
```

---

## 🛠️ Technology Stack

| Component | Technology | Role |
|---|---|---|
| **Frontend** | React, Vite, Tailwind CSS, Lucide | Telemetry-driven workspace dashboard |
| **Backend** | FastAPI, Uvicorn, Pydantic | Asynchronous, rate-limited clinical gateway API |
| **Caching** | Redis | MD5-hashed patient profiles cache fallback |
| **Graph DB** | Neo4j community, Cypher | Seeding NIH RxNav & Columbia Symptom linkages |
| **Vector DB** | Pinecone serverless | Grounding guideline vector index search |
| **Embeddings** | Google Gemini / OpenAI | Multi-stage chunk embeddings |
| **ML Models** | Hugging Face PEFT, Gemma 2 | Fine-tuned USMLE diagnostic parameters |
| **Deployment** | Docker, Docker Compose, AWS SageMaker | Portability and cloud-scalable inference |

---

## ⚙️ Configuration & Setup

### 1. Prerequisites
Ensure you have the following installed locally:
* Python 3.12+
* Node.js 20+
* Docker & Docker Compose
* Running Redis and Neo4j instances (or spin them up using Docker)

### 2. Install Dependencies
Clone the repository, create a virtual environment, and install dependencies:
```bash
# Clone
git clone https://github.com/Akifali-1/MedGraph.git
cd MedGraph

# Backend Setup
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend Setup
cd frontend
npm install
cd ..
```

### 3. Setup Environment
Copy the environment template and populate it with your API keys:
```bash
cp .env.example .env
```
Ensure you provide correct keys for:
* `GOOGLE_API_KEY` (Gemini API access)
* `PINECONE_API_KEY` (Pinecone credentials)
* `NEO4J_PASSWORD` (Neo4j instance access)

---

## 🚀 Running locally

### Option A: Using Docker Compose (Recommended)
This spins up Redis, Neo4j, the FastAPI backend, and the React frontend in containerized environments:
```bash
docker-compose up --build
```
* **Frontend Web Console:** [http://localhost/](http://localhost/)
* **Backend API Gateway:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Neo4j Browser:** [http://localhost:7474/](http://localhost:7474/)

### Option B: Bare-Metal Development Setup
1. **Start Redis and Neo4j services** locally.
2. **Seed Neo4j standard datasets:**
   ```bash
   python backend/graph/seed_csv.py
   python backend/graph/seed_rxnav.py
   python backend/graph/seed_columbia.py
   ```
3. **Launch Backend API server:**
   ```bash
   python -u run.py
   ```
4. **Launch Frontend Vite dev server:**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 🧪 CI/CD Pipeline & Testing

The repository includes a GitHub Actions configuration under `.github/workflows/ci.yml`. On every push or pull request to `main` and `dev`, the workflow:
1. Installs Python dependencies and runs the offline CDSS integration tests:
   ```bash
   python backend/tests/test_flow.py
   ```
2. Installs Node.js dependencies and verifies the frontend production build:
   ```bash
   cd frontend && npm run build
   ```

---

## 🧠 ML Fine-Tuning & SageMaker Deployment

### 1. Kaggle USMLE Fine-Tuning
The script `fine_tuning/fine_tune_medqa.py` is configured to run QLoRA parameter-efficient fine-tuning on **Gemma 2 2B / 9B** models using the USMLE US Medical licensing dataset (MedQA):
1. Create a Kaggle notebook and attach a GPU (NVIDIA T4 or A100).
2. Set your Hugging Face API token in secrets.
3. Execute the script to train adapter layers and push model parameters to Hugging Face.

### 2. AWS SageMaker Endpoint Deployment
Deploy the merged weights using the SageMaker Hugging Face TGI (Text Generation Inference) container:
```bash
python fine_tuning/deploy_sagemaker.py
```
This deploys the model on an `ml.g5.xlarge` instance (Ampere A10G GPU required for Gemma 2 sliding window attention support).

---

## 🔌 API Reference

### Rate Limiting Rules
* `POST /diagnose` — 10 requests/minute per IP
* `POST /knowledge/upload/guidelines` — 5 requests/minute per IP
* `POST /knowledge/upload/structured` — 5 requests/minute per IP
* `GET /knowledge/documents` — 30 requests/minute per IP

### Core Endpoints

* **`POST /diagnose`**
  * Demographics and clinical symptoms intake. Resolves synonyms, checks drug-drug interactions, retrieves guidelines context, and synthesizes diagnoses.
* **`POST /knowledge/upload/guidelines`**
  * Ingest custom clinical guideline files (PDF or TXT) into the Vector RAG DB.
* **`POST /knowledge/upload/structured`**
  * Ingest drug-drug interaction CSV datasets to Neo4j.
* **`GET /health`**
  * Real-time connectivity and latency health reports of all dependencies (Redis, Neo4j, Pinecone, SageMaker).

---

## ⚠️ Disclaimer
**MedGraph AI is a demonstration prototype for research and portfolio auditing purposes only.** It is not a certified medical device, does not provide official medical advice, and should never be used to diagnose or treat patients in clinical settings.
