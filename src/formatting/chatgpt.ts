import { logger } from "../logger.js";

const MAX_NOTE_LENGTH = 2000;

interface ChatCompletionsResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function extractContent(response: ChatCompletionsResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function truncate(value: string): string {
  if (value.length <= MAX_NOTE_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_NOTE_LENGTH - 3)}...`;
}

export async function formatNoteWithChatGPT(
  note: string,
  projectName: string,
  apiKey: string,
  model: string
): Promise<string> {
  const raw = note.trim();
  if (!raw) {
    return "";
  }

  const prompt = [
    `Project: ${projectName}`,
    "",
    "Reformat the following llm calls and git commits. Keep it very short and generic. Just keep the message.",
    "Rules:",
    "- Keep all factual details.",
    "- Improve readability and wording only.",
    "- Don't leave commit diffs, make it generic",
    "- No need to show lines changed, just a message",
    "- No markdown just plain text.",
    "- Message only about what has been done.",
    "- No bullet points just sentences.",
    "- No titles or project id's.",
    "- No small changes like linting or merging, just features and fixes.",
    "",
    raw,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "You format commits and llm prompts into generic work notes.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(
        `ChatGPT formatting failed (${response.status}): ${errorText}`
      );
      return truncate(raw);
    }

    const payload = (await response.json()) as ChatCompletionsResponse;
    const formatted = extractContent(payload);
    if (!formatted) {
      return truncate(raw);
    }

    return truncate(formatted);
  } catch (err) {
    logger.warn(`ChatGPT formatting error: ${err}`);
    return truncate(raw);
  }
}
