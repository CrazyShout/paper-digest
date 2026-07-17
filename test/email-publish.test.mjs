import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTransportOptions,
  explainSmtpError,
  isRetryableSmtpError,
  validateDelivery,
  withSmtpRetry
} from "../scripts/email-publish.mjs";

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
});
