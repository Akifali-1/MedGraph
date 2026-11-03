# MedGraph AI — Clinical Decision Support System (CDSS)

MedGraph AI is a research and demonstration Clinical Decision Support System (CDSS) prototype. It combines a Neo4j knowledge graph with indexed guideline retrieval and returns source metadata with its result. Gemini is the default reasoning model when configured; SageMaker is optional and is used only when `SAGEMAKER_ENDPOINT_NAME` is set.

> **Note:** This is a demonstration prototype for research and portfolio purposes — not a certified medical device. See the [Disclaimer](#️-disclaimer) below.

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
                              (Gemini / optional SageMaker)
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
| **Graph DB** | Neo4j community, Cypher | Structured interaction and symptom lookups |
| **Vector DB** | Pinecone serverless | Grounding guideline vector index search |
| **Embeddings** | Google Gemini / OpenAI | Multi-stage chunk embeddings |
| **Reasoning** | Gemini by default; optional SageMaker | Response generation after retrieval |
| **Deployment** | Docker, Docker Compose | Local containerized execution |

---

## ⚙️ Configuration & Setup

### 1. Prerequisites
Ensure you have the following installed locally:
* **Python 3.10, 3.11, or 3.12** *(Note: Python 3.13+ is currently unsupported by `simsimd`/`langchain-pinecone` dependencies)*
* **Node.js 20+** (includes `npm`)
* Docker & Docker Compose (optional for containerized deployment)

### 2. Install Dependencies

#### Backend Setup
```powershell
# Clone the repository
git clone https://github.com/Akifali-1/MedGraph.git
cd MedGraph

# Create a virtual environment using Python 3.11 or 3.12
python -m venv .venv

# Activate the virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

# Upgrade pip and install backend packages into .venv
python -m pip install --upgrade pip
pip install -r requirements.txt
```

#### Frontend Setup
```powershell
cd frontend
npm install
cd ..
```
> 💡 **Windows Tip:** If `npm` is not recognized in your terminal, close and restart VS Code after installing Node.js so PowerShell reloads your system `PATH`.

### 3. Setup Environment Variables
Copy `.env.example` to `.env` and populate your credentials:
```bash
cp .env.example .env
```
Key configuration parameters in `.env`:
* `GOOGLE_API_KEY`: Gemini API key ([Get key from Google AI Studio](https://aistudio.google.com/app/api-keys))
* `PINECONE_API_KEY` & `PINECONE_INDEX_NAME`: Pinecone Vector DB credentials
* `NEO4J_URI`: `neo4j+s://<YOUR_INSTANCE_ID>.databases.neo4j.io`
* `NEO4J_USERNAME`: `neo4j`
* `NEO4J_PASSWORD`: Your Neo4j Aura database password

---

## 🚀 Running locally

### Option A: Bare-Metal Local Development Setup (Recommended)

1. **Launch Backend API server:**
   Make sure your `.venv` is activated, then start the server using `python` (not `py` on Windows):
   ```powershell
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   python run.py

   # Or run directly via the venv python executable:
   .\.venv\Scripts\python.exe run.py
   ```
   * **Backend API Gateway:** [http://localhost:8000](http://localhost:8000)
   * **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
   * **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

2. **Launch Frontend Vite dev server:**
   In a separate terminal window:
   ```powershell
   cd frontend
   npm run dev
   ```
   * **Frontend Web App:** [http://localhost:5173](http://localhost:5173)

3. **(Optional) Seed Neo4j Knowledge Graph:**
   ```powershell
    python backend/graph/seed.py
   ```
*(Note: Explicit `MOCK_NEO4J=true` and `MOCK_REDIS=true` enable local test/demo behavior. An unavailable live graph is reported as unavailable.)*

### Option B: Using Docker Compose
This spins up Redis, Neo4j, the FastAPI backend, and the React frontend in containerized environments:
```bash
docker-compose up --build
```
* **Frontend Web Console:** [http://localhost/](http://localhost/)
* **Backend API Gateway:** [http://localhost:8000/docs](http://localhost:8000/docs)

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

The optional fine-tuning and deployment scripts are not part of the default `/diagnose` path. The default path uses Gemini when configured; SageMaker is selected only when `SAGEMAKER_ENDPOINT_NAME` is set.

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
This is an optional deployment workflow and was not used for the Phase 2 evidence work.

---

## 📊 Evaluation & data sources

- [Latest evaluation summary](eval/results/2026-11-02/summary.md)
- [Evaluation set and metric definitions](eval/README.md)
- [Data sources, licenses, and access notes](docs/DATA_SOURCES.md)

The current interaction data source is `synthetic-demo`; DDInter 2.0 (CC BY-NC-SA 4.0) remains the selected source but its CSV was unavailable, so the graph was not replaced. Demo interaction alerts are labeled accordingly. The resumed live diagnosis run attempted all 20 provisional cases: 18 completed, 2 returned provider errors, top-1/top-3 were both 1/18, latency p50/p95 was 5425.10/23881.87 ms, and citation resolution was 32/32. Interaction metrics remain blocked. See `eval/results/2026-11-03-resumed/summary.md` for the measured results.

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
