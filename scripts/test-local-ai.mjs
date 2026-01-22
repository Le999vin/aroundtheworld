const localUrl = process.env.LOCAL_AI_URL ?? "http://localhost:3000/api/ai";

const payload = {
  messages: [{ role: "user", content: "Give me 3 short travel tips." }],
  context: { mode: "explore" },
  threadKey: "debug",
};

console.log("Requesting:", localUrl);
const response = await fetch(localUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

console.log("Status:", response.status);
console.log("Content-Type:", response.headers.get("content-type"));

if (!response.body) {
  console.error("No response body.");
  process.exit(1);
}

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let linesPrinted = 0;
const maxLines = 30;

while (linesPrinted < maxLines) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith("event:") || line.startsWith("data:")) {
      console.log(line);
      linesPrinted += 1;
      if (linesPrinted >= maxLines) break;
    }
  }
}
