# SEOmation — ml-service v1.2 (Groq + Cohere + Qdrant/PGVector, Google News + optional Serper)

**What’s included**
- Google News RSS used for fresh/trending context (locale via `.env` GN_HL/GN_GL/GN_CEID)
- Optional **Serper** web search if `SERPER_API_KEY` is set; otherwise skipped
- Baseline RSS kept as fallback (Neil Patel, Backlinko, Moz)
- RAG: quick seed + async web build; Qdrant batched upserts to reduce timeouts
- Windows/VS Code friendly; avoids lxml

## Run (local)
```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # set your keys (GROQ, COHERE; optional SERPER, QDRANT)
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
