"use client";

import { useState, useCallback, useEffect } from "react";

// ============ TYPES ============

type TabType = "commit" | "pr";
type CommitStyle = "conventional" | "semantic" | "simple" | "emoji";

interface HistoryItem {
  id: string;
  tab: TabType;
  diff: string;
  result: string[];
  style: CommitStyle;
  timestamp: number;
}

interface CustomRules {
  prefixes: string;
  format: string;
  language: "en" | "id";
}

// ============ SAMPLE DATA ============

const SAMPLE_DIFF = `diff --git a/src/auth/login.ts b/src/auth/login.ts
index 8a3b2c1..f4d5e6a 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,8 +1,12 @@
 import { Request, Response } from 'express';
+import { validateEmail } from '../utils/validators';
+import { RateLimiter } from '../middleware/rateLimiter';
 
+const limiter = new RateLimiter({ max: 5, window: 60 });
+
-export async function login(req: Request, res: Response) {
-  const { email, password } = req.body;
-  // TODO: validate input
+export async function login(req: Request, res: Response) {
+  const { email, password } = req.body;
+  
+  if (!validateEmail(email)) {
+    return res.status(400).json({ error: 'Invalid email format' });
+  }
+
+  if (!limiter.check(req.ip)) {
+    return res.status(429).json({ error: 'Too many attempts' });
+  }
+
   const user = await authenticate(email, password);
   if (!user) {
-    return res.status(401).json({ error: 'Unauthorized' });
+    return res.status(401).json({ error: 'Invalid credentials' });
   }
   const token = generateToken(user);
   res.json({ token, user: { id: user.id, email: user.email } });
 }`;

const SAMPLE_PR_DIFF = `diff --git a/src/components/Dashboard.tsx b/src/components/Dashboard.tsx
--- a/src/components/Dashboard.tsx
+++ b/src/components/Dashboard.tsx
@@ -10,6 +10,8 @@ import { fetchAnalytics } from '../api/analytics';
+import { useTheme } from '../hooks/useTheme';
+import { StatsCard } from './StatsCard';
 
 export function Dashboard() {
   const [data, setData] = useState(null);
+  const { theme } = useTheme();
   
   useEffect(() => {
     fetchAnalytics().then(setData);
@@ -20,7 +22,12 @@ export function Dashboard() {
   return (
-    <div className="dashboard">
+    <div className={\`dashboard \${theme}\`}>
       <h1>Dashboard</h1>
-      {data && <pre>{JSON.stringify(data)}</pre>}
+      {data && (
+        <div className="grid grid-cols-3 gap-4">
+          <StatsCard title="Users" value={data.users} />
+          <StatsCard title="Revenue" value={data.revenue} />
+          <StatsCard title="Growth" value={data.growth} />
+        </div>
+      )}
     </div>
   );
 }`;

// ============ COMPONENTS ============

function HistoryPanel({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative px-3 py-1.5 rounded-lg text-sm bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-200 transition-colors"
      >
        📜 History
        {history.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-dark-900 text-[10px] font-bold rounded-full flex items-center justify-center">
            {history.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h2 className="text-lg font-bold text-white">📜 History</h2>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-dark-400 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {history.length === 0 ? (
            <div className="text-center text-dark-500 py-10">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">No history yet</p>
              <p className="text-xs text-dark-600 mt-1">Generate some messages first!</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => { onSelect(item); setOpen(false); }}
                className="w-full text-left p-3 rounded-lg bg-dark-700/50 border border-dark-600 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-accent">
                    {item.tab === "pr" ? "🔀 PR" : "📝 Commit"} · {item.style}
                  </span>
                  <span className="text-[10px] text-dark-500">
                    {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-dark-300 truncate">
                  {item.result[0]?.substring(0, 60)}...
                </p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  rules,
  onSave,
}: {
  rules: CustomRules;
  onSave: (rules: CustomRules) => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<CustomRules>(rules);

  useEffect(() => { setLocal(rules); }, [rules]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-sm bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-dark-200 transition-colors"
      >
        ⚙️ Rules
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">⚙️ Custom Rules</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-dark-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">
              Custom Prefixes
            </label>
            <input
              type="text"
              value={local.prefixes}
              onChange={(e) => setLocal({ ...local, prefixes: e.target.value })}
              placeholder="feat, fix, chore, hotfix, wip"
              className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-100 text-sm placeholder:text-dark-500 focus:outline-none focus:border-accent/50"
            />
            <p className="text-[10px] text-dark-500 mt-1">
              Comma-separated. Leave empty for defaults.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">
              Commit Format
            </label>
            <input
              type="text"
              value={local.format}
              onChange={(e) => setLocal({ ...local, format: e.target.value })}
              placeholder={"type(scope): message"}
              className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-dark-600 text-dark-100 text-sm placeholder:text-dark-500 focus:outline-none focus:border-accent/50"
            />
            <p className="text-[10px] text-dark-500 mt-1">
              Examples: type(scope): message or type: message
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1">
              Language
            </label>
            <div className="flex gap-2">
              {(["en", "id"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLocal({ ...local, language: lang })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    local.language === lang
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "bg-dark-700 text-dark-300 border border-dark-600 hover:bg-dark-600"
                  }`}
                >
                  {lang === "en" ? "🇬🇧 English" : "🇮🇩 Indonesia"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-dark-700 text-dark-300 hover:bg-dark-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(local); setOpen(false); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-accent text-dark-900 hover:bg-accent-light transition-colors"
          >
            Save Rules
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============

export default function Home() {
  const [tab, setTab] = useState<TabType>("commit");
  const [diff, setDiff] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [prDescription, setPrDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string>("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [style, setStyle] = useState<CommitStyle>("conventional");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [rules, setRules] = useState<CustomRules>({
    prefixes: "",
    format: "type(scope): message",
    language: "en",
  });

  // Load from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("commitgenius_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      const savedRules = localStorage.getItem("commitgenius_rules");
      if (savedRules) setRules(JSON.parse(savedRules));
    } catch {}
  }, []);

  // Save history to localStorage
  const saveHistory = (item: HistoryItem) => {
    const updated = [item, ...history].slice(0, 50); // max 50 items
    setHistory(updated);
    localStorage.setItem("commitgenius_history", JSON.stringify(updated));
  };

  // Save rules to localStorage
  const saveRules = (newRules: CustomRules) => {
    setRules(newRules);
    localStorage.setItem("commitgenius_rules", JSON.stringify(newRules));
  };

  const generate = useCallback(async () => {
    if (!diff.trim()) return;
    setLoading(true);
    setResults([]);
    setPrDescription("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diff,
          mode: tab,
          customRules: rules,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Show provider in mode badge
      const modeLabel = data.provider === "groq" ? "groq" : data.provider === "mimo" ? "mimo" : data.mode;
      setMode(modeLabel);

      if (tab === "pr") {
        const desc = typeof data.result === "string" ? data.result : data.result.join("\n");
        setPrDescription(desc);
        saveHistory({
          id: Date.now().toString(),
          tab: "pr",
          diff: diff.substring(0, 200),
          result: [desc],
          style,
          timestamp: Date.now(),
        });
      } else {
        setResults(data.result);
        saveHistory({
          id: Date.now().toString(),
          tab: "commit",
          diff: diff.substring(0, 200),
          result: data.result,
          style,
          timestamp: Date.now(),
        });
      }
      setMode(data.mode);
    } catch {
      if (tab === "pr") {
        setPrDescription("Error: Failed to generate. Check your diff and try again.");
      } else {
        setResults(["Error: Failed to generate. Check your diff and try again."]);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff, tab, style, rules]);

  const copyToClipboard = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setTab(item.tab);
    setDiff(item.diff);
    setStyle(item.style);
    if (item.tab === "pr") {
      setPrDescription(item.result[0] || "");
    } else {
      setResults(item.result);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("commitgenius_history");
  };

  const styles: { id: CommitStyle; label: string; icon: string }[] = [
    { id: "conventional", label: "Conventional", icon: "📐" },
    { id: "semantic", label: "Semantic", icon: "🧠" },
    { id: "simple", label: "Simple", icon: "✨" },
    { id: "emoji", label: "Emoji", icon: "🎉" },
  ];

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "commit", label: "Commit Messages", icon: "📝" },
    { id: "pr", label: "PR Description", icon: "🔀" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-2xl">⚡</div>
            <div>
              <h1 className="text-lg font-bold text-white">CommitGenius</h1>
              <p className="text-xs text-dark-300">AI Git Workflow Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HistoryPanel history={history} onSelect={loadFromHistory} onClear={clearHistory} />
            <SettingsPanel rules={rules} onSave={saveRules} />
            {mode && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                mode === "groq" ? "bg-blue-500/10 text-blue-400" :
                mode === "live" ? "bg-accent/10 text-accent" :
                mode === "fallback" ? "bg-yellow-500/10 text-yellow-400" :
                "bg-dark-600 text-dark-300"
              }`}>
                {mode === "groq" ? "🟢 Groq (Free)" :
                 mode === "live" ? "🟢 Live" :
                 mode === "fallback" ? "🟡 Fallback" : "⚪ Demo"}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {/* Tab Selector */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex bg-dark-800 border border-dark-700 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setResults([]); setPrDescription(""); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-accent/20 text-accent"
                    : "text-dark-400 hover:text-dark-200"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Commit Style Selector (only for commit tab) */}
        {tab === "commit" && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-dark-300 mr-2">Style:</span>
            {styles.map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  style === s.id
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-dark-700 text-dark-300 border border-transparent hover:bg-dark-600 hover:text-dark-200"
                }`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: "calc(100vh - 240px)" }}>
          {/* Input Panel */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-dark-200">
                {tab === "commit" ? "Git Diff" : "Commits / Diff"}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDiff(tab === "commit" ? SAMPLE_DIFF : SAMPLE_PR_DIFF)}
                  className="text-xs px-2 py-1 rounded bg-dark-700 text-dark-400 hover:text-dark-200 hover:bg-dark-600 transition-colors"
                >
                  Load Sample
                </button>
                <button
                  onClick={() => { setDiff(""); setResults([]); setPrDescription(""); }}
                  className="text-xs px-2 py-1 rounded bg-dark-700 text-dark-400 hover:text-dark-200 hover:bg-dark-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={diff}
              onChange={(e) => setDiff(e.target.value)}
              placeholder={
                tab === "commit"
                  ? "Paste your git diff here...\n\nExample:\ngit diff\ngit diff --staged\ngit diff HEAD~1"
                  : "Paste multiple commits or a full diff...\n\nExample:\ngit log --oneline -10\ngit diff main..feature-branch"
              }
              className="flex-1 w-full bg-dark-800 border border-dark-600 rounded-xl p-4 text-dark-100 placeholder:text-dark-500 resize-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all min-h-[300px]"
              spellCheck={false}
            />
            <button
              onClick={generate}
              disabled={loading || !diff.trim()}
              className="mt-3 w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-accent text-dark-900 hover:bg-accent-light active:scale-[0.98]"
            >
              {loading ? (
                <span className="animate-pulse-gentle">Generating...</span>
              ) : tab === "commit" ? (
                "⚡ Generate Commit Messages"
              ) : (
                "📝 Generate PR Description"
              )}
            </button>
          </div>

          {/* Output Panel */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-dark-200 mb-2">
              {tab === "commit"
                ? `Suggested Messages ${results.length > 0 ? `(${results.length})` : ""}`
                : "PR Description"
              }
            </label>
            <div className="flex-1 bg-dark-800 border border-dark-600 rounded-xl p-4 min-h-[300px]">
              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse-gentle">
                      <div className="h-10 bg-dark-700 rounded-lg w-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* Commit Messages Output */}
              {!loading && tab === "commit" && results.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-dark-500">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-sm">Your commit messages will appear here</p>
                  <p className="text-xs text-dark-600 mt-1">Paste a diff and click Generate</p>
                </div>
              )}
              {!loading && tab === "commit" && results.map((msg, idx) => (
                <div
                  key={idx}
                  className="animate-fade-in bg-dark-700/50 border border-dark-600 rounded-lg p-3 flex items-center justify-between gap-3 group hover:border-accent/30 transition-colors mb-2"
                >
                  <code className="text-sm text-dark-100 font-mono break-all flex-1 leading-relaxed">
                    {msg}
                  </code>
                  <button
                    onClick={() => copyToClipboard(msg, idx)}
                    className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-all bg-dark-600 text-dark-300 hover:bg-accent/20 hover:text-accent"
                  >
                    {copiedIdx === idx ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              ))}

              {/* PR Description Output */}
              {!loading && tab === "pr" && !prDescription && (
                <div className="h-full flex flex-col items-center justify-center text-dark-500">
                  <div className="text-4xl mb-3">🔀</div>
                  <p className="text-sm">Your PR description will appear here</p>
                  <p className="text-xs text-dark-600 mt-1">Paste commits/diff and click Generate</p>
                </div>
              )}
              {!loading && tab === "pr" && prDescription && (
                <div className="animate-fade-in">
                  <div className="bg-dark-700/50 border border-dark-600 rounded-lg p-4 mb-3">
                    <pre className="text-sm text-dark-100 font-mono whitespace-pre-wrap leading-relaxed">
                      {prDescription}
                    </pre>
                  </div>
                  <button
                    onClick={() => copyToClipboard(prDescription, 0)}
                    className="w-full py-2.5 rounded-lg text-sm font-medium transition-all bg-dark-600 text-dark-300 hover:bg-accent/20 hover:text-accent border border-dark-600 hover:border-accent/30"
                  >
                    {copiedIdx === 0 ? "✓ Copied to clipboard!" : "📋 Copy PR Description"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Rules Indicator */}
        {(rules.prefixes || rules.language === "id") && (
          <div className="mt-4 flex items-center gap-2 text-xs text-dark-500">
            <span>⚙️ Active rules:</span>
            {rules.prefixes && <span className="px-2 py-0.5 rounded bg-dark-700 text-dark-300">Prefixes: {rules.prefixes}</span>}
            {rules.language === "id" && <span className="px-2 py-0.5 rounded bg-dark-700 text-dark-300">🇮🇩 Bahasa Indonesia</span>}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 py-4 text-center text-xs text-dark-500">
        CommitGenius — Built with Next.js & MiMo AI •
        <a href="https://github.com/xiaomimimo" className="text-accent/60 hover:text-accent ml-1">
          GitHub
        </a>
      </footer>
    </div>
  );
}
