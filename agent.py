# agent.py
# A simple bot that uses the Gemini API to respond to prompts.

import google.generativeai as genai
import os
import argparse
import json
import wikipedia

# --- Configuration ---
# IMPORTANT: Set your API key as an environment variable named 'GEMINI_API_KEY'
# You can get an API key from Google AI Studio: https://aistudio.google.com/app/apikey
#
# To set it in your terminal (for the current session):
# export GEMINI_API_KEY='YOUR_API_KEY_HERE'
#
# To set it permanently, add the above line to your shell's configuration file
# (e.g., ~/.zshrc for zsh, or ~/.bash_profile or ~/.bashrc for bash)
# and then run 'source ~/.zshrc' or 'source ~/.bash_profile'.

# --- Constants ---
HISTORY_FILE = "history.json"
MAX_HISTORY_MESSAGES = 50 # Maximum number of messages (user + assistant) to keep in history

# --- Global Variables ---
# history will store a list of dictionaries, e.g., [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]
history = []
current_model_name = "" # Will be set by args

# --- Utility Functions ---
def load_history():
    """Loads chat history from the JSON file and truncates if too long."""
    global history
    try:
        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)
            # Truncate history if it's longer than MAX_HISTORY_MESSAGES
            if len(history) > MAX_HISTORY_MESSAGES:
                print(f"[INFO] History file has {len(history)} messages. Truncating to last {MAX_HISTORY_MESSAGES}.")
                history = history[-MAX_HISTORY_MESSAGES:]
    except FileNotFoundError:
        history = []
    except json.JSONDecodeError:
        print(f"[WARNING] Could not decode {HISTORY_FILE}. Starting with an empty history.")
        history = []

def save_history():
    """Saves the current chat history to the JSON file."""
    global history
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4) # Added indent for readability
    except IOError as e:
        print(f"[ERROR] Could not save history to {HISTORY_FILE}: {e}")

def add_to_history(role, content):
    """Adds a message to the history and ensures it doesn't exceed MAX_HISTORY_MESSAGES."""
    global history
    history.append({"role": role, "content": content})
    if len(history) > MAX_HISTORY_MESSAGES:
        # Remove the oldest message (first element) to maintain the limit
        # We remove two items (one user, one assistant typically) to keep pairs,
        # but simpler to just remove the oldest one by one.
        # For more sophisticated pruning, one might remove pairs.
        history.pop(0)
    save_history()


# --- Argument Parsing ---
def parse_arguments():
    """Parses command-line arguments."""
    parser = argparse.ArgumentParser(description="Simple bot using the Gemini API.")
    parser.add_argument("prompt", type=str, nargs="?", help="The prompt to send to the Gemini API.")
    parser.add_argument("--model", type=str, default="gemini-1.5-flash-latest", help="The model to use (e.g., gemini-1.5-flash-latest, gemini-pro).")
    return parser.parse_args()

# --- Main Bot Logic ---
def run_bot(prompt_text, model_name_to_use):
    """
    Sends a prompt to the Gemini API and prints the response.
    Uses the global 'history'.

    Args:
        prompt_text (str): The text prompt to send to the model.
        model_name_to_use (str): The name of the model to use for this call.
    """
    global history
    try:
        # Configure the API key
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("Error: GEMINI_API_KEY environment variable not set.")
            print("Please set it before running the script.")
            print("You can get an API key from Google AI Studio: https://aistudio.google.com/app/apikey")
            return None # Return None to indicate failure

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name_to_use)

        print(f"\n🤖 Sending prompt to Gemini ({model_name_to_use})...")

        # Fallback: build composite prompt manually with history
        composite_prompt = ""
        for msg in history:
            role = msg["role"].capitalize()
            composite_prompt += f"{role}: {msg['content']}\n"
        composite_prompt += f"User: {prompt_text}\nAssistant:"
        response = model.generate_content(composite_prompt)

        # Print the response
        if response and response.text:
            print("\n✨ Gemini's Response:")
            print("-" * 20)
            print(response.text)
            print("-" * 20)
            return response.text
        elif response and response.prompt_feedback:
            print("\n⚠️ Prompt was blocked.")
            print(f"Reason: {response.prompt_feedback}")
            return None # Return None as the prompt was blocked
        else:
            print("\n🤔 No response text received.")
            return None # Return None if no text

    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        print("Ensure your API key is correct and you have internet connectivity.")
        return None # Return None on error

# --- Entry Point ---
if __name__ == "__main__":
    args = parse_arguments()
    current_model_name = args.model # Set the global current_model_name

    load_history() # Load history at the start

    if args.prompt:
        # For a single command-line prompt, we don't save its response to history by default
        # unless we explicitly decide to. For now, let's treat it as a one-off.
        # If we want to include it, we'd add_to_history("user", args.prompt)
        # and then add_to_history("assistant", reply)
        _ = run_bot(args.prompt, current_model_name) # We don't need the reply for one-off
    else:
        # Interactive mode
        print("🤖 Welcome to the Gemini API Bot!")
        print(f"Using model: {current_model_name}")
        print(f"Chat history will be loaded from/saved to '{HISTORY_FILE}'.")
        print(f"History is limited to the last {MAX_HISTORY_MESSAGES} messages.")
        print("Type '/exit', '/quit', '/wiki <topic>', or '/clear_history'.")
        print("-" * 30)

        while True:
            try:
                user_prompt = input("\n👤 Your Prompt: ").strip()

                if not user_prompt:
                    continue

                if user_prompt.lower() in ["/exit", "/quit"]:
                    print("\n👋 Goodbye!")
                    save_history() # Ensure history is saved on exit
                    break
                elif user_prompt.lower() == "/clear_history":
                    history = []
                    save_history()
                    print("\n🧹 Chat history cleared.")
                    continue
                elif user_prompt.startswith("/wiki "):
                    topic = user_prompt[len("/wiki "):].strip()
                    if not topic:
                        print("Please specify a topic for Wikipedia. Usage: /wiki <topic>")
                        continue
                    try:
                        print(f"\n🔍 Fetching Wikipedia summary for '{topic}'...")
                        summary = wikipedia.summary(topic, sentences=3) # Increased sentences slightly
                        print(f"\n📚 Wiki Summary for '{topic}':\n{summary}\n")
                        # Add both the query and the summary to history for context
                        add_to_history("user", f"Can you give me a Wikipedia summary for {topic}?")
                        add_to_history("assistant", f"Here's a Wikipedia summary for '{topic}': {summary}")
                    except wikipedia.exceptions.PageError:
                        print(f"\n❌ Could not find a Wikipedia page for '{topic}'.")
                        add_to_history("user", f"Can you give me a Wikipedia summary for {topic}?")
                        add_to_history("assistant", f"Sorry, I could not find a Wikipedia page for '{topic}'.")
                    except wikipedia.exceptions.DisambiguationError as e:
                        print(f"\n❌ '{topic}' refers to multiple pages. Please be more specific. Options might include: {e.options[:5]}")
                        add_to_history("user", f"Can you give me a Wikipedia summary for {topic}?")
                        add_to_history("assistant", f"The term '{topic}' is ambiguous. Please be more specific.")
                    except Exception as e:
                        print(f"\n❌ Error fetching wiki summary: {e}")
                        add_to_history("user", f"Can you give me a Wikipedia summary for {topic}?")
                        add_to_history("assistant", f"Sorry, an error occurred while fetching the Wikipedia summary for '{topic}'.")
                    continue # Go to next prompt input

                # Regular chat interaction
                add_to_history("user", user_prompt)
                reply = run_bot(user_prompt, current_model_name)
                if reply:
                    add_to_history("assistant", reply)
                # History is saved by add_to_history and run_bot (if successful)

            except KeyboardInterrupt:
                print("\n\n👋 Session ended by user. Goodbye!")
                save_history()
                break
            except EOFError: # Handles Ctrl+D
                print("\n\n👋 Session ended. Goodbye!")
                save_history()
                break
