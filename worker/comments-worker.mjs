const DEFAULT_COMMENTS_DIR = "comments";
const MAX_COMMENT_LENGTH = 800;
const DEFAULT_MAX_COMMENTS_PER_DIGEST = 200;

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const allowOrigin = allowed.includes("*") || !origin
    ? "*"
    : allowed.includes(origin)
      ? origin
      : allowed[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function requireEnv(env, key) {
  if (!env[key]) throw new Error(`Missing env ${key}`);
  return env[key];
}

function validDigestId(value) {
  return typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-[a-z0-9-]+)?$/.test(value);
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#b45f49";
}

function sanitizeEmoji(value) {
  const text = String(value || "").trim();
  return text.length > 0 && text.length <= 4 ? text : "✦";
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(text) {
  const binary = atob(text.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function githubPath(env, digestId) {
  const dir = env.COMMENTS_DIR || DEFAULT_COMMENTS_DIR;
  return `${dir.replace(/^\/|\/$/g, "")}/${digestId}.json`;
}

function githubContentApiUrl(env, repoPath) {
  const owner = requireEnv(env, "GITHUB_OWNER");
  const repo = requireEnv(env, "GITHUB_REPO");
  const safePath = repoPath.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}`;
}

function githubApiUrl(env, digestId) {
  return githubContentApiUrl(env, githubPath(env, digestId));
}

function digestContentPath(digestId) {
  return `content/digests/${digestId}.md`;
}

function maxCommentsPerDigest(env) {
  const value = Number.parseInt(env.MAX_COMMENTS_PER_DIGEST || "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_COMMENTS_PER_DIGEST;
}

async function githubFetch(url, env, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${requireEnv(env, "GITHUB_TOKEN")}`,
      "User-Agent": "paper-digest-comments-worker",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });

  return response;
}

async function readComments(env, digestId) {
  const branch = env.GITHUB_BRANCH || "main";
  const response = await githubFetch(`${githubApiUrl(env, digestId)}?ref=${encodeURIComponent(branch)}`, env);

  if (response.status === 404) {
    return { comments: [], sha: null };
  }

  if (!response.ok) {
    throw new Error(`GitHub read failed: ${response.status}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(decodeBase64(data.content || "W10="));
  return {
    comments: Array.isArray(parsed) ? parsed : [],
    sha: data.sha
  };
}

async function requireExistingDigest(env, digestId) {
  const branch = env.GITHUB_BRANCH || "main";
  const url = `${githubContentApiUrl(env, digestContentPath(digestId))}?ref=${encodeURIComponent(branch)}`;
  const response = await githubFetch(url, env);

  if (response.status === 404) {
    throw new Error("Unknown digestId");
  }

  if (!response.ok) {
    throw new Error(`GitHub digest check failed: ${response.status}`);
  }
}

function createComment(payload) {
  const digestId = payload.digestId;
  if (!validDigestId(digestId)) {
    throw new Error("Invalid digestId");
  }

  const text = sanitizeText(payload.text, MAX_COMMENT_LENGTH);
  if (!text) {
    throw new Error("Empty comment");
  }

  const nickname = sanitizeText(payload.nickname, 40) || "匿名同学";
  const avatar = payload.avatar || {};
  const createdAt = new Date().toISOString();
  const random = crypto.randomUUID().slice(0, 8);

  return {
    id: `${digestId}-${Date.now()}-${random}`,
    digestId,
    nickname,
    avatar: {
      emoji: sanitizeEmoji(avatar.emoji),
      color: sanitizeColor(avatar.color)
    },
    text,
    createdAt
  };
}

async function writeComments(env, digestId, comments, sha) {
  const branch = env.GITHUB_BRANCH || "main";
  const content = `${JSON.stringify(comments, null, 2)}\n`;
  const body = {
    message: `Add comment for ${digestId}`,
    content: encodeBase64(content),
    branch
  };

  if (sha) body.sha = sha;

  const response = await githubFetch(githubApiUrl(env, digestId), env, {
    method: "PUT",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`GitHub write failed: ${response.status}`);
  }
}

async function handleGet(request, env, cors) {
  const url = new URL(request.url);
  const digestId = url.searchParams.get("digestId") || "";
  if (!validDigestId(digestId)) {
    return jsonResponse({ error: "Invalid digestId" }, 400, cors);
  }

  await requireExistingDigest(env, digestId);
  const { comments } = await readComments(env, digestId);
  return jsonResponse({ comments }, 200, cors);
}

async function handlePost(request, env, cors) {
  const payload = await request.json();
  const comment = createComment(payload);
  await requireExistingDigest(env, comment.digestId);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { comments, sha } = await readComments(env, comment.digestId);
    if (comments.length >= maxCommentsPerDigest(env)) {
      return jsonResponse({ error: "Comment limit reached" }, 429, cors);
    }

    try {
      await writeComments(env, comment.digestId, [...comments, comment], sha);
      return jsonResponse({ comment }, 201, cors);
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }

  return jsonResponse({ error: "Could not save comment" }, 500, cors);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "GET") {
        return handleGet(request, env, cors);
      }

      if (request.method === "POST") {
        return handlePost(request, env, cors);
      }

      return jsonResponse({ error: "Method not allowed" }, 405, cors);
    } catch (error) {
      return jsonResponse({ error: error.message || "Unexpected error" }, 500, cors);
    }
  }
};
