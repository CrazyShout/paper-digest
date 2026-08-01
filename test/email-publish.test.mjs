import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIdeaCenterReady,
  assertReviewCenterReady,
  buildBulkMailOptions,
  buildHtmlBody,
  buildIdeaUpdateHtmlBody,
  buildIdeaUpdateSubject,
  buildIdeaUpdateTextBody,
  buildReviewUpdateHtmlBody,
  buildReviewUpdateSubject,
  buildReviewUpdateTextBody,
  buildTextBody,
  buildTransportOptions,
  explainSmtpError,
  getDigestNavUrl,
  getIdeaCenterUrl,
  getReviewCenterUrl,
  isRetryableSmtpError,
  parseRecipientState,
  parseRecipientsConfig,
  summarizeIdeaCenter,
  validateDelivery,
  verifyPublishedIdeaCenter,
  verifyPublishedReviewCenter,
  withSmtpRetry
} from "../scripts/email-publish.mjs";
import { ideaArtifactSnapshotFingerprint } from "../src/lib/idea-fingerprint.js";
import {
  reviewCenterFingerprint,
  reviewSnapshotFingerprint
} from "../src/lib/review-fingerprint.js";

test("digest navigation URL preserves the requested issue", () => {
  assert.equal(
    getDigestNavUrl("2026-07-17", "https://example.com/paper-digest"),
    "https://example.com/paper-digest/index.html#2026-07-17"
  );
});

test("recipient configuration fails closed", () => {
  assert.deepEqual(
    parseRecipientsConfig({ recipients: ["Reader@Example.com", "reader@example.com"] }),
    ["reader@example.com"]
  );
  assert.throws(() => parseRecipientsConfig({ recipients: [] }), /不能为空/);
  assert.throws(() => parseRecipientsConfig({ recipients: ["not-an-email"] }), /无效地址/);
});

test("recipient state selects only newcomers and rejects stale onboarding state", () => {
  assert.deepEqual(
    parseRecipientState({
      recipients: ["existing@example.com", "new@example.com"],
      onboardedRecipients: ["existing@example.com"]
    }).welcomeRecipients,
    ["new@example.com"]
  );
  assert.throws(
    () => parseRecipientState({
      recipients: ["reader@example.com"],
      onboardedRecipients: ["removed@example.com"]
    }),
    /不在推送名单/
  );
});

test("email HTML uses the already-rendered digest body without double escaping", () => {
  const html = buildHtmlBody({
    title: "Test digest",
    date: "2026-07-17",
    displayDate: "2026-07-17",
    keywords: [],
    summary: "Summary",
    body: "Shift & Drift",
    bodyHtml: "<p>Shift &amp; Drift</p>"
  }, "2026-07-17", "https://example.com/#2026-07-17", "", [], "https://example.com");

  assert.match(html, /Shift &amp; Drift/);
  assert.doesNotMatch(html, /&amp;amp;/);
});

test("welcome email introduces the system before the latest digest", () => {
  const digest = {
    title: "Latest digest",
    date: "2026-07-25",
    displayDate: "2026-07-25",
    keywords: ["V2X"],
    summary: "Summary",
    body: "Digest body",
    bodyHtml: "<p>Digest body</p>"
  };
  const args = [
    digest,
    "2026-07-25",
    "https://example.com/#2026-07-25",
    "https://example.com/wiki",
    [],
    "https://example.com",
    { welcome: true }
  ];
  const text = buildTextBody(...args);
  const html = buildHtmlBody(...args);

  assert.match(text, /欢迎加入 Paper Digest/);
  assert.match(text, /不提供 AI 问答/);
  assert.ok(text.indexOf("欢迎加入 Paper Digest") < text.indexOf("[Paper Digest] 2026-07-25"));
  assert.match(html, /欢迎加入 Paper Digest/);
  assert.ok(html.indexOf("欢迎加入 Paper Digest") < html.indexOf("2026-07-25 Latest digest"));
});

test("review update email links every direction and explains continuous maintenance", () => {
  const center = {
    updatedAt: "2026-07-28",
    directions: [
      {
        id: "cooperative-autonomous-driving",
        label: "协同自动驾驶",
        title: "协同自动驾驶综述",
        subtitle: "从消息价值到闭环证据"
      },
      {
        id: "world-models",
        label: "世界模型",
        title: "驾驶世界模型综述",
        subtitle: "从生成质量到仿真准入"
      }
    ]
  };
  const currentSiteUrl = "https://example.com/paper-digest";
  const text = buildReviewUpdateTextBody(center, currentSiteUrl);
  const html = buildReviewUpdateHtmlBody(center, currentSiteUrl);

  assert.equal(
    getReviewCenterUrl(currentSiteUrl),
    "https://example.com/paper-digest/reviews/index.html"
  );
  assert.match(buildReviewUpdateSubject(center), /2026-07-28.*动态综述中心/);
  assert.match(text, /持续更新的研究证据地图/);
  assert.match(text, /cooperative-autonomous-driving\/index\.html/);
  assert.match(text, /world-models\/index\.html/);
  assert.match(html, /持续更新的研究证据地图/);
  assert.match(html, /cooperative-autonomous-driving\/index\.html/);
  assert.match(html, /world-models\/index\.html/);
});

test("review update publishing requires completed independent review", () => {
  const rawDirection = {
    id: "world-models",
    sections: [{ body: "current snapshot" }],
    searchAudit: {
      independentReview: {
        status: "pending",
        reviewers: 0,
        rounds: 0
      }
    }
  };
  const snapshotFingerprint = reviewSnapshotFingerprint(rawDirection);
  const ready = {
    directions: [
      {
        ...rawDirection,
        currentSnapshotFingerprint: snapshotFingerprint,
        searchAudit: {
          independentReview: {
            status: "passed",
            reviewers: 1,
            rounds: 2,
            snapshotFingerprint
          }
        }
      }
    ]
  };
  assert.doesNotThrow(() => assertReviewCenterReady(ready));
  assert.throws(
    () => assertReviewCenterReady({
      directions: [
        {
          searchAudit: {
            independentReview: {
              status: "pending",
              reviewers: 0,
              rounds: 0
            }
          }
        }
      ]
    }),
    /未通过独立复核/
  );
  assert.throws(
    () => assertReviewCenterReady({
      directions: [
        {
          ...ready.directions[0],
          currentSnapshotFingerprint: "0".repeat(64)
        }
      ]
    }),
    /未通过独立复核/
  );
});

test("review update publishing verifies the deployed version markers", async () => {
  const center = {
    version: 2,
    updatedAt: "2026-07-28",
    directions: [{ id: "first" }, { id: "second" }]
  };
  const fingerprint = reviewCenterFingerprint(center);
  await assert.doesNotReject(
    verifyPublishedReviewCenter(center, "https://example.com", async () => ({
      ok: true,
      text: async () => `<main data-review-version="2" data-review-updated="2026-07-28" data-review-directions="2" data-review-fingerprint="${fingerprint}">`
    }))
  );
  await assert.rejects(
    verifyPublishedReviewCenter(center, "https://example.com", async () => ({
      ok: true,
      text: async () => '<main data-review-version="1" data-review-updated="2026-07-20" data-review-directions="2">'
    })),
    /不是当前本地版本/
  );
  await assert.rejects(
    verifyPublishedReviewCenter(center, "https://example.com", async () => ({
      ok: true,
      text: async () => '<main data-review-version="2" data-review-updated="2026-07-28" data-review-directions="2" data-review-fingerprint="stale-body">'
    })),
    /不是当前本地版本/
  );
});

test("review deployment fingerprint changes with direction content", () => {
  const center = {
    version: 2,
    updatedAt: "2026-07-28",
    directions: [{ id: "world-models", abstract: "current" }]
  };
  const changed = structuredClone(center);
  changed.directions[0].abstract = "revised";

  assert.notEqual(
    reviewCenterFingerprint(center),
    reviewCenterFingerprint(changed)
  );
});

function sampleIdeaCenter() {
  return {
    version: 2,
    updatedAt: "2026-08-01",
    explorationStatus: "reviewed",
    directions: [
      {
        id: "cooperative-autonomous-driving",
        label: "协同自动驾驶",
        status: "reviewed",
        candidatePool: {
          counts: {
            queries: 12,
            references: 40,
            assets: 8,
            candidates: 20
          }
        },
        ideas: [
          {
            id: "clock-age",
            reviewStatus: "rejected",
            blindReview: {
              reviewers: [{ lens: "novelty" }, { lens: "implementation" }]
            }
          }
        ]
      },
      {
        id: "world-models",
        label: "世界模型",
        status: "reviewed",
        candidatePool: {
          counts: {
            queries: 9,
            references: 37,
            assets: 7,
            candidates: 15
          }
        },
        ideas: [
          {
            id: "rank-survival",
            reviewStatus: "rejected",
            blindReview: {
              reviewers: [{ lens: "novelty" }, { lens: "implementation" }]
            }
          }
        ]
      }
    ],
    finalReview: {
      status: "rejected",
      report: {
        status: "rejected",
        overall: 6,
        summary: "Evidence is not yet executable."
      }
    }
  };
}

test("idea update email reports audit scale and honest gate outcome", () => {
  const center = sampleIdeaCenter();
  const stats = summarizeIdeaCenter(center);
  const currentSiteUrl = "https://example.com/paper-digest";
  const text = buildIdeaUpdateTextBody(center, currentSiteUrl);
  const html = buildIdeaUpdateHtmlBody(center, currentSiteUrl);

  assert.deepEqual(stats, {
    directions: 2,
    queryRuns: 21,
    references: 77,
    assets: 15,
    candidates: 35,
    reviewedIdeas: 2,
    passedIdeas: 0,
    globalStatus: "rejected",
    globalScore: 6
  });
  assert.equal(
    getIdeaCenterUrl(currentSiteUrl),
    "https://example.com/paper-digest/ideas/index.html"
  );
  assert.match(buildIdeaUpdateSubject(center), /2026-08-01.*Idea 中心/);
  assert.match(text, /逐维最低分/);
  assert.match(text, /0 个候选达到全维度满分/);
  assert.match(text, /未通过全局终审/);
  assert.match(html, /Notebook 文档结构/);
  assert.match(html, /0 个全维度满分通过/);
});

test("idea update publishing requires completed audits but permits rejection", () => {
  const center = sampleIdeaCenter();
  assert.doesNotThrow(() => assertIdeaCenterReady(center));

  const incomplete = structuredClone(center);
  incomplete.directions[0].ideas[0].blindReview.reviewers = [{ lens: "novelty" }];
  assert.throws(() => assertIdeaCenterReady(incomplete), /未完成候选检索与独立盲评/);

  const pending = structuredClone(center);
  pending.finalReview.report = null;
  assert.throws(() => assertIdeaCenterReady(pending), /尚未完成独立全局终审/);
});

test("idea update publishing verifies the deployed content fingerprint", async () => {
  const center = sampleIdeaCenter();
  const fingerprint = ideaArtifactSnapshotFingerprint(center);

  await assert.doesNotReject(
    verifyPublishedIdeaCenter(center, "https://example.com", async () => ({
      ok: true,
      text: async () => `<dl data-idea-version="2" data-idea-updated="2026-08-01" data-idea-directions="2" data-idea-fingerprint="${fingerprint}">`
    }))
  );
  await assert.rejects(
    verifyPublishedIdeaCenter(center, "https://example.com", async () => ({
      ok: true,
      text: async () => '<dl data-idea-version="2" data-idea-updated="2026-08-01" data-idea-directions="2" data-idea-fingerprint="stale">'
    })),
    /不是当前本地版本/
  );
});

test("bulk email uses BCC and does not expose subscribers in To", () => {
  const options = buildBulkMailOptions({
    from: "sender@example.com",
    envelopeTo: "sender@example.com",
    recipients: ["first@example.com", "second@example.com"],
    subject: "Update",
    text: "Text",
    html: "<p>Text</p>"
  });

  assert.equal(options.to, "sender@example.com");
  assert.equal(options.bcc, "first@example.com,second@example.com");
  assert.doesNotMatch(options.to, /first|second/);
});

test("buildTransportOptions validates credentials and keeps SMTP timeouts", () => {
  const options = buildTransportOptions({
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "sender@example.com",
    pass: "app-password",
    rejectUnauthorized: true,
    connectionTimeout: 12_000,
    greetingTimeout: 8_000,
    socketTimeout: 24_000
  });

  assert.equal(options.host, "smtp.example.com");
  assert.equal(options.port, 587);
  assert.equal(options.secure, false);
  assert.deepEqual(options.auth, {
    user: "sender@example.com",
    pass: "app-password"
  });
  assert.equal(options.connectionTimeout, 12_000);
  assert.equal(options.greetingTimeout, 8_000);
  assert.equal(options.socketTimeout, 24_000);
});

test("DNS failures are retryable and receive a useful explanation", () => {
  const error = Object.assign(new Error("getaddrinfo ENOTFOUND smtp.gmail.com"), {
    code: "EDNS",
    errno: "ENOTFOUND",
    hostname: "smtp.gmail.com"
  });

  assert.equal(isRetryableSmtpError(error), true);
  assert.match(
    explainSmtpError(error, { host: "smtp.gmail.com", port: 587 }),
    /DNS.*npm run email:check/
  );
});

test("authentication failures are not retried", async () => {
  let attempts = 0;
  const error = Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 });

  await assert.rejects(
    withSmtpRetry(async () => {
      attempts += 1;
      throw error;
    }, { retries: 2, retryDelayMs: 0, wait: async () => {} }),
    /Invalid login/
  );
  assert.equal(attempts, 1);
});

test("TLS certificate errors are reported separately from network failures", () => {
  const error = Object.assign(new Error("self-signed certificate"), { code: "ESOCKET" });

  assert.match(explainSmtpError(error), /TLS 校验失败/);
});

test("generic SMTP errors never expose recipient addresses or raw server replies", () => {
  const error = Object.assign(
    new Error("550 <private.reader@example.com> rejected"),
    {
      code: "EENVELOPE",
      responseCode: 550,
      response: "550 mailbox private.reader@example.com unavailable"
    }
  );
  const message = explainSmtpError(error);

  assert.match(message, /EENVELOPE.*SMTP 550/);
  assert.doesNotMatch(message, /private\.reader@example\.com|mailbox unavailable/i);
});

test("safe transient failures retry before succeeding", async () => {
  let attempts = 0;
  const result = await withSmtpRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      throw Object.assign(new Error("temporary DNS failure"), { code: "EAI_AGAIN" });
    }
    return "ok";
  }, { retries: 2, retryDelayMs: 0, wait: async () => {} });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("validateDelivery rejects unconfirmed recipients", () => {
  assert.throws(
    () => validateDelivery(
      { accepted: ["first@example.com"], rejected: [] },
      ["first@example.com", "second@example.com"]
    ),
    /未确认接受 1 位收件人/
  );
  assert.throws(
    () => validateDelivery({}, ["first@example.com"]),
    /未返回 accepted/
  );
});
