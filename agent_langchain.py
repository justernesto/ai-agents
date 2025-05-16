#!/usr/bin/env python3
# agent_langchain.py
# A LangChain-based agent using Gemini, with memory and a Wikipedia tool.

import os
import json
import wikipedia

from langchain.tools import Tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain.agents import initialize_agent, AgentType

# --- Configuration ---
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("Set GEMINI_API_KEY in your environment before running.")

# Initialize the LLM (Gemini via Google GenAI integration)
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash-latest",
    google_api_key=api_key,
    temperature=0.7,
)

# Memory for conversation
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

# --- Tool Definitions ---
def wiki_lookup(query: str) -> str:
    """Fetch a brief summary from Wikipedia."""
    try:
        return wikipedia.summary(query, sentences=2)
    except Exception as e:
        return f"Error fetching Wikipedia summary: {e}"

tools = [
    Tool(
        name="Wikipedia",
        func=wiki_lookup,
        description="Fetches a 2-sentence summary from Wikipedia for a given topic."
    )
]

# --- Initialize Agent ---
agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
    verbose=True,
    memory=memory,
)

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    reply = agent.run(req.message)
    return {"reply": reply}