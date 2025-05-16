"use client";
import { useState } from "react";

export default function Page() {
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<{ sender: string; text: string }[]>([]);
  // POINT THIS AT YOUR RENDER URL:
  const apiUrl = process.env.NEXT_PUBLIC_API_URL!;

  const sendMessage = async () => {
    if (!message.trim()) return;
    const userMsg = { sender: "You", text: message };
    setChatLog((prev) => [...prev, userMsg]);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const botMsg = { sender: "Agent", text: data.reply };
      setChatLog((prev) => [...prev, botMsg]);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        { sender: "Agent", text: "⚠️ Error contacting API." },
      ]);
    }

    setMessage("");
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Chat with AI Agent</h1>
      <div className="space-y-4 mb-6">
        {chatLog.map((msg, i) => (
          <div
            key={i}
            className={msg.sender === "You" ? "text-right" : "text-left"}
          >
            <span className="inline-block px-4 py-2 rounded-lg bg-gray-200">
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-2"
          type="text"
          placeholder="Type a message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
}