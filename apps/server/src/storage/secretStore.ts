import fs from "fs";
import path from "path";

export type Secrets = {
  meshy?: string;
  openai?: string;
  anthropic?: string; // Anthropic Claude API key
  llmApiKey?: string; // API key for local/compatible LLM providers
};

const dir = path.resolve(process.cwd(), "data");
const file = path.join(dir, "secrets.json");

fs.mkdirSync(dir, { recursive: true });

export function readSecrets(): Secrets {
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as Secrets;
  } catch (error) {
    return {};
  }
}

export function writeSecrets(next: Secrets) {
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
}

export function upsertSecret(name: keyof Secrets, value: string) {
  const current = readSecrets();
  current[name] = value;
  writeSecrets(current);
}

export function deleteSecret(name: keyof Secrets) {
  const current = readSecrets();
  if (name in current) {
    delete current[name];
    writeSecrets(current);
  }
}
