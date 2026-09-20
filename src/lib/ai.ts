/**
 * The only file that talks to the AI gateway (OpenAI-compatible /chat/completions).
 * Server-only: reads env vars, never ships key to the client.
 */

export function aiConfigured(): boolean {
  return Boolean(
    process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL
  );
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** POST /chat/completions and parse choices[0].message.content as JSON. */
export async function chatJSON(
  messages: ChatMessage[],
  maxTokens = 700
): Promise<unknown> {
  const base = (process.env.AI_BASE_URL || "").replace(/\/+$/, "");
  const key = process.env.AI_API_KEY || "";
  const model = process.env.AI_MODEL || "";
  const url = `${base}/chat/completions`;

  const makeBody = (withFormat: boolean) => ({
    model,
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
    ...(withFormat ? { response_format: { type: "json_object" as const } } : {}),
  });

  const call = (withFormat: boolean) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(makeBody(withFormat)),
    });

  let res = await call(true);

  // Gateway may not support response_format — retry once without it.
  if (res.status === 400) {
    const errText = await res.text().catch(() => "");
    if (/response_format/i.test(errText)) {
      res = await call(false);
    } else {
      throw new Error(`AI gateway 400: ${errText.slice(0, 300)}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `AI gateway ${res.status}: ${errText.slice(0, 300) || res.statusText}`
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  let content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("AI gateway returned no message content");
  }

  // Strip ```json fences if present.
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) content = fence[1];

  return JSON.parse(content.trim());
}
