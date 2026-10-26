import warnings
warnings.filterwarnings("ignore")

import os
from langchain_community.document_loaders import TextLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_chroma import Chroma
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

EMBED_MODEL = "nomic-embed-text"
CHAT_MODEL = "llama3.2:1b"


# ── Step 1 : load ────────────────────────────────────────────────────────────

def load_documents(docs_path: str = "docs"):
    if not os.path.exists(docs_path):
        raise FileNotFoundError(f"'{docs_path}' folder not found.")

    loader = DirectoryLoader(
        path=docs_path,
        glob="*.txt",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"},
    )

    documents = loader.load()

    if len(documents) == 0:
        raise FileNotFoundError(f"No .txt files found in '{docs_path}'.")

    print(f"Loaded {len(documents)} document(s).")
    return documents


# ── Step 2 : split ───────────────────────────────────────────────────────────

def split_documents(documents, chunk_size: int = 800, chunk_overlap: int = 100):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Split into {len(chunks)} chunks.")
    return chunks


# ── Step 3 : embed + store (fully local, no rate limits) ───────────────────

def create_vector_store(chunks, persist_directory: str = "db/chroma_db"):
    print("Creating embeddings locally with Ollama and storing in ChromaDB...")

    embedding_model = OllamaEmbeddings(model=EMBED_MODEL)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embedding_model,
        persist_directory=persist_directory,
        collection_metadata={"hnsw:space": "cosine"},
    )
    print("Vector store ready.")
    return vectorstore


def load_existing_vector_store(persist_directory: str = "db/chroma_db"):
    embedding_model = OllamaEmbeddings(model=EMBED_MODEL)
    vectorstore = Chroma(
        persist_directory=persist_directory,
        embedding_function=embedding_model,
        collection_metadata={"hnsw:space": "cosine"},
    )
    return vectorstore


# ── Step 4 : retrieval + generation (fully local) ───────────────────────────

def build_qa_chain(vectorstore):
    llm = ChatOllama(
        model=CHAT_MODEL,
        temperature=0.3,
    )

    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    system_prompt = (
        "You are an assistant for question-answering tasks. "
        "Use the following retrieved context to answer the question. "
        "If you don't know the answer, say that you don't know.\n\n"
        "Context:\n{context}"
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    qa_chain = create_retrieval_chain(retriever, question_answer_chain)
    return qa_chain


def ask(qa_chain, question: str):
    result = qa_chain.invoke({"input": question})
    print(f"\nAnswer: {result['answer']}")
    return result


# ── Entry point ──────────────────────────────────────────────────────────────

def main():
    persist_directory = "db/chroma_db"

    if os.path.exists(persist_directory) and os.listdir(persist_directory):
        print("Existing vector store found. Loading instantly...")
        vectorstore = load_existing_vector_store(persist_directory)
    else:
        print("No existing vector store found. Building it now...")
        documents = load_documents(docs_path="docs")
        chunks = split_documents(documents)
        vectorstore = create_vector_store(chunks, persist_directory)

    qa_chain = build_qa_chain(vectorstore)

    print("\nReady! Ask questions below.")
    while True:
        try:
            question = input("\nYou: ").strip()
            if question.lower() == "exit":
                print("Goodbye!")
                break
            if question:
                ask(qa_chain, question)
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()