import { NextRequest, NextResponse } from "next/server";

// ============ API CONFIG ============
// Primary: Groq (free, 30 RPM) — OpenAI-compatible
// Fallback: MiMo (if GROQ_API_KEY not set)
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MIMO_API_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const MIMO_API_KEY = process.env.MIMO_API_KEY || "";

const USE_GROQ = !!GROQ_API_KEY;
const USE_MIMO = !USE_GROQ && !!MIMO_API_KEY;
const DEMO_MODE = !USE_GROQ && !USE_MIMO;

// ============ MOCK RESPONSES ============

function mockCommitMessages(diff: string): string[] {
  const lowerDiff = diff.toLowerCase();

  if (lowerDiff.includes("import") && lowerDiff.includes("react")) {
    return [
      "feat: add React import and component rendering logic",
      "chore(deps): update React import statements",
      "feat(ui): integrate React component with import binding",
    ];
  }
  if (lowerDiff.includes("fix") || lowerDiff.includes("bug") || lowerDiff.includes("error")) {
    return [
      "fix: resolve null pointer exception in user authentication",
      "fix(auth): handle edge case in token validation",
      "fix: prevent crash when user session expires during API call",
    ];
  }
  if (lowerDiff.includes("test") || lowerDiff.includes("describe") || lowerDiff.includes("it(")) {
    return [
      "test: add unit tests for user registration flow",
      "test(auth): cover edge cases in login validation",
      "test: increase coverage for payment processing module",
    ];
  }
  if (lowerDiff.includes("style") || lowerDiff.includes("css") || lowerDiff.includes("className")) {
    return [
      "style: update responsive layout for mobile breakpoints",
      "style(ui): adjust color scheme and typography",
      "style: improve spacing and alignment in dashboard",
    ];
  }
  if (lowerDiff.includes("refactor") || lowerDiff.includes("rename")) {
    return [
      "refactor: extract utility functions into separate module",
      "refactor(core): simplify authentication middleware chain",
      "refactor: consolidate duplicate API response handlers",
    ];
  }
  if (lowerDiff.includes("remove") || lowerDiff.includes("delete")) {
    return [
      "chore: remove deprecated legacy configuration files",
      "refactor(cleanup): delete unused helper functions",
      "chore: strip out commented-out debug code",
    ];
  }

  return [
    "feat: implement core functionality and update module exports",
    "chore: update dependencies and improve build configuration",
    "feat: add new feature with comprehensive error handling",
  ];
}

function mockPRDescription(diff: string): string {
  const lowerDiff = diff.toLowerCase();
  const hasTest = lowerDiff.includes("test") || lowerDiff.includes("describe");
  const hasFix = lowerDiff.includes("fix") || lowerDiff.includes("bug");
  const hasStyle = lowerDiff.includes("style") || lowerDiff.includes("css");

  let summary = "Implement new feature with proper validation and error handling.";
  if (hasFix) summary = "Fix critical bug in authentication flow that caused crashes.";
  if (hasTest) summary = "Add comprehensive test coverage for core modules.";
  if (hasStyle) summary = "Update UI styling and improve responsive layout.";

  const changes = [
    "- Added input validation for user parameters",
    "- Improved error handling with descriptive messages",
    "- Updated related documentation",
  ];
  if (hasTest) {
    changes.unshift("- Added 15 new unit tests for authentication module");
    changes.push("- Increased test coverage from 72% to 89%");
  }
  if (hasFix) {
    changes.unshift("- Fixed null pointer exception in login endpoint");
    changes.push("- Added edge case handling for expired sessions");
  }

  return `## Summary\n${summary}\n\n## Changes\n${changes.join("\n")}\n\n## Testing\n- [x] All existing tests pass\n- [x] New tests added${hasTest ? " (15 tests)" : ""}\n- [ ] Manual QA needed\n\n## Notes\nThis change is backward compatible. No breaking changes.`;
}

// ============ LIVE API (Groq / MiMo) ============

async function callLLM(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  // Priority: Groq > MiMo
  const providers = [];
  if (USE_GROQ) {
    providers.push({ url: GROQ_API_URL, key: GROQ_API_KEY, model: "llama-3.3-70b-versatile" });
  }
  if (USE_MIMO) {
    providers.push({ url: MIMO_API_URL, key: MIMO_API_KEY, model: "mimo-v2.5" });
  }

  for (const p of providers) {
    try {
      const response = await fetch(p.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${p.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        console.error(`${p.model} API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      console.error(`${p.model} failed:`, err);
      continue;
    }
  }

  return "";
}

async function liveGenerate(diff: string, customRules?: Record<string, string>): Promise<string[]> {
  let systemPrompt = `You are an expert at writing git commit messages. Analyze code diffs and generate clear, concise Conventional Commits style messages.

Rules:
- Generate exactly 3 commit messages, one per line
- Max 72 characters per line
- Be specific about WHAT changed, not HOW
- Use format: type(scope): description
- Available types: feat, fix, chore, docs, style, refactor, test, perf, ci, build`;

  if (customRules?.prefixes) {
    systemPrompt += `\nCustom prefixes allowed: ${customRules.prefixes}`;
  }
  if (customRules?.format) {
    systemPrompt += `\nRequired format: ${customRules.format}`;
  }
  if (customRules?.language === "id") {
    systemPrompt += `\nGenerate messages in Bahasa Indonesia.`;
  }

  const content = await callLLM(systemPrompt, `Analyze this git diff:\n\n${diff}`, 256);

  const messages = content
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0 && line.length < 80 && !line.match(/^[0-9]+[.)\\s]/))
    .slice(0, 3);

  return messages.length > 0 ? messages : mockCommitMessages(diff);
}

async function livePRDescription(diff: string, customRules?: Record<string, string>): Promise<string> {
  let systemPrompt = `You are a senior developer writing pull request descriptions. Analyze the code diff and generate a professional PR description.

Format:
## Summary
[1-2 sentences describing what this PR does]

## Changes
[bullet list of key changes]

## Testing
[checkbox list of testing steps]

## Notes
[Any important notes, breaking changes, or dependencies]`;

  if (customRules?.language === "id") {
    systemPrompt += `\nGenerate the PR description in Bahasa Indonesia.`;
  }

  const content = await callLLM(systemPrompt, `Write a PR description for this diff:\n\n${diff}`, 512);
  return content || mockPRDescription(diff);
}

// ============ API ROUTE ============

export async function POST(request: NextRequest) {
  try {
    const { diff, mode = "commit", customRules } = await request.json();

    if (!diff || diff.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a git diff to analyze" },
        { status: 400 }
      );
    }

    let result: string | string[];
    let apiMode = DEMO_MODE ? "demo" : "live";
    const provider = USE_GROQ ? "groq" : USE_MIMO ? "mimo" : "mock";

    if (mode === "pr") {
      if (DEMO_MODE) {
        result = mockPRDescription(diff);
      } else {
        try {
          result = await livePRDescription(diff, customRules);
        } catch {
          result = mockPRDescription(diff);
          apiMode = "fallback";
        }
      }
    } else {
      if (DEMO_MODE) {
        result = mockCommitMessages(diff);
      } else {
        try {
          result = await liveGenerate(diff, customRules);
        } catch {
          result = mockCommitMessages(diff);
          apiMode = "fallback";
        }
      }
    }

    return NextResponse.json({
      result,
      mode: apiMode,
      model: provider === "groq" ? "llama-3.3-70b" : provider === "mimo" ? "mimo-v2.5" : "mock",
      provider,
      type: mode,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate" },
      { status: 500 }
    );
  }
}
