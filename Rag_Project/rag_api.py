import warnings
warnings.filterwarnings("ignore")

# Disable LangSmith tracing to avoid version-conflict errors
import os
os.environ["LANGCHAIN_TRACING_V2"] = "false"

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

load_dotenv()

EMBED_MODEL = "gemini-embedding-001"   # confirmed available via google.genai SDK
CHAT_MODEL  = "gemini-3.8-flash"       # Gemini LLM (2.0-flash deprecated)
PERSIST_DIR = "db/chroma_db_gemini"
DOCS_PATH   = "docs"


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
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set in .env")
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


def build_qa_chain(vectorstore: Chroma):
    llm = ChatGoogleGenerativeAI(
        model=CHAT_MODEL,
        temperature=0.3,
        google_api_key=os.environ["GOOGLE_API_KEY"],
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global qa_chain
    print("[RAG] Initialising RAG pipeline (Gemini)...")
    vectorstore = build_vector_store()
    qa_chain    = build_qa_chain(vectorstore)
    print("[RAG] Ready to serve requests ✓")
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
    return {"status": "ok", "model": CHAT_MODEL, "embed_model": EMBED_MODEL}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if qa_chain is None:
        raise HTTPException(status_code=503, detail="RAG chain not initialised yet.")

    answer = qa_chain.invoke(req.question.strip())
    return ChatResponse(answer=answer)
