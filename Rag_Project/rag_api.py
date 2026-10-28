import warnings
warnings.filterwarnings("ignore")

# Disable LangSmith tracing to avoid version-conflict errors
import os
os.environ["LANGCHAIN_TRACING_V2"] = "false"

import re
from pathlib import Path
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# ── Google AI SDK (new v1 SDK — bypasses the v1beta issue in langchain-google-genai) ──
import google.genai as genai

# ── LangChain ────────────────────────────────────────────────────────────────
from langchain_core.embeddings import Embeddings
from langchain_community.document_loaders import TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

# ── Config ────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"

def load_env_config():
    if ENV_PATH.exists():
        load_dotenv(dotenv_path=ENV_PATH, override=True)
    load_dotenv()

load_env_config()

EMBED_MODEL = "gemini-embedding-001"   # confirmed available via google.genai SDK
CHAT_MODEL  = "gemini-3.5-flash"       # Fast, reliable Gemini LLM
FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]
PERSIST_DIR = str(BASE_DIR / "db" / "chroma_db_gemini")
DOCS_PATH   = str(BASE_DIR / "docs")


def _get_api_key() -> str:
    load_env_config()
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key.strip() in ("", "your_gemini_api_key_here"):
        raise RuntimeError(
            "Gemini API key is not configured. Please set GOOGLE_API_KEY in Rag_Project/.env"
        )
    api_key = api_key.strip()
    os.environ["GOOGLE_API_KEY"] = api_key
    os.environ["GEMINI_API_KEY"] = api_key
    return api_key


# ── Custom Embedding Class ────────────────────────────────────────────────────
# Uses google.genai SDK directly (v1 API) — bypasses langchain-google-genai's
# v1beta limitation where gemini-embedding-001 is not found.

class GeminiEmbeddings(Embeddings):

    def __init__(self, api_key: str, model: str = EMBED_MODEL):
        self._client = genai.Client(api_key=api_key)
        self._model  = model

    def _embed_one(self, text: str) -> List[float]:
        response = self._client.models.embed_content(
            model=self._model,
            contents=text,
        )
        return list(response.embeddings[0].values)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_one(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed_one(text)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_embeddings() -> GeminiEmbeddings:
    api_key = _get_api_key()
    return GeminiEmbeddings(api_key=api_key)


def load_documents():
    loader = DirectoryLoader(
        path=DOCS_PATH,
        glob="*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
    )
    docs = loader.load()
    if not docs:
        raise FileNotFoundError(f"No .txt files found in '{DOCS_PATH}'.")
    print(f"[RAG] Loaded {len(docs)} document(s).")
    return docs


def build_vector_store() -> Chroma:
    embeddings = _get_embeddings()

    if os.path.exists(PERSIST_DIR) and os.listdir(PERSIST_DIR):
        print(f"[RAG] Loading existing vector store from '{PERSIST_DIR}'...")
        return Chroma(
            persist_directory=PERSIST_DIR,
            embedding_function=embeddings,
        )

    print(f"[RAG] Building fresh vector store from '{DOCS_PATH}'...")
    docs   = load_documents()
    chunks = RecursiveCharacterTextSplitter(
                 chunk_size=800, chunk_overlap=100
             ).split_documents(docs)
    print(f"[RAG] {len(chunks)} chunks — embedding with Gemini...")

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=PERSIST_DIR,
    )
    print("[RAG] Vector store ready.")
    return vectorstore


def build_qa_chain(vectorstore: Chroma, model_name: str = CHAT_MODEL):
    api_key = _get_api_key()
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=0.3,
        google_api_key=api_key,
    )

    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    system_prompt = (
        "You are a helpful assistant for UNIV-Resolve, a university complaint management platform. "
        "Answer the user's question using ONLY the context retrieved from the knowledge base below. "
        "If the answer is not in the context, say you don't have that information and suggest "
        "the user contact the university administration directly.\n\n"
        "Context:\n{context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human",  "{question}"),
    ])

    def format_docs(docs):
        return "\n\n".join(d.page_content for d in docs)

    # Pure LCEL chain — no langchain_classic dependency needed
    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain


# ── App lifecycle ─────────────────────────────────────────────────────────────

qa_chain = None


def init_rag():
    global qa_chain
    vectorstore = build_vector_store()
    qa_chain = build_qa_chain(vectorstore)
    return qa_chain


@asynccontextmanager
async def lifespan(app: FastAPI):
    global qa_chain
    print("[RAG] Initialising RAG pipeline (Gemini)...")
    try:
        init_rag()
        print("[RAG] Ready to serve requests ✓")
    except Exception as e:
        print(f"[RAG] ⚠️ Initialization warning: {e}")
        print("[RAG] The server will run, and the pipeline will initialize once GOOGLE_API_KEY is saved in Rag_Project/.env")
    yield
    print("[RAG] Shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="UNIV-Resolve RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": CHAT_MODEL,
        "embed_model": EMBED_MODEL,
        "initialized": qa_chain is not None,
    }


def fallback_search(query: str) -> str:
    """Local document excerpt search when Gemini API key is not configured."""
    try:
        docs = load_documents()
        words = set(re.findall(r"\w+", query.lower()))
        stop_words = {
            "what", "is", "the", "a", "an", "in", "on", "of", "to", "for",
            "and", "or", "how", "why", "who", "when", "where", "can", "you",
            "tell", "me", "about", "this", "that", "it", "are", "was", "were",
            "do", "does", "did", "please", "help"
        }
        query_words = words - stop_words or words

        best_score = 0
        best_snippet = ""
        for doc in docs:
            paragraphs = doc.page_content.split("\n\n")
            for p in paragraphs:
                p_clean = p.strip()
                if len(p_clean) < 40:
                    continue
                p_lower = p_clean.lower()
                score = sum(1 for w in query_words if w in p_lower)
                if score > best_score:
                    best_score = score
                    best_snippet = p_clean

        if best_snippet and best_score > 0:
            snippet_display = best_snippet[:650] + ("..." if len(best_snippet) > 650 else "")
            return (
                f"{snippet_display}\n\n"
                f"---\n"
                f"💡 *Retrieved from knowledge base docs. To enable AI conversational reasoning, "
                f"configure `GOOGLE_API_KEY` in `Rag_Project/.env`.*"
            )
    except Exception as e:
        print(f"[RAG] Fallback document search error: {e}")

    return (
        "👋 The UNIV-Resolve assistant is active!\n\n"
        "To enable AI-generated answers, please set your Gemini API key in `Rag_Project/.env`:\n"
        "```\nGOOGLE_API_KEY=AIzaSy...your_key_here\n```\n"
        "Get a free key from Google AI Studio: https://aistudio.google.com/app/apikey"
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    global qa_chain
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # 1. Ensure vectorstore is available
    vectorstore = None
    try:
        vectorstore = build_vector_store()
    except Exception as e:
        print(f"[RAG] Vectorstore init error ({e}). Using document fallback.")
        return ChatResponse(answer=fallback_search(question))

    # 2. Invoke RAG chain across available Gemini models
    for model_cand in FALLBACK_MODELS:
        try:
            chain = build_qa_chain(vectorstore, model_name=model_cand)
            answer = chain.invoke(question)
            if answer and answer.strip():
                return ChatResponse(answer=answer.strip())
        except Exception as e:
            print(f"[RAG] Model '{model_cand}' error ({e}), trying next candidate...")

    print("[RAG] All Gemini models failed or unavailable. Falling back to document search.")
    return ChatResponse(answer=fallback_search(question))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_api:app", host="127.0.0.1", port=8001, reload=True)

