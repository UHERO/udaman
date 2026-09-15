import { describe, expect, test } from "bun:test";

import { buildMessageRecord } from "./message-log";

describe("buildMessageRecord", () => {
  test("joins array recipients and defaults nullable fields", () => {
    const rec = buildMessageRecord({
      channel: "email",
      to: ["a@hawaii.edu", "b@hawaii.edu"],
      subject: "Hi",
      body: "text",
      sender: "default",
      fromAddr: "udaman.bot@gmail.com",
    });
    expect(rec).toEqual({
      channel: "email",
      sender: "default",
      fromAddr: "udaman.bot@gmail.com",
      recipient: "a@hawaii.edu, b@hawaii.edu",
      subject: "Hi",
      body: "text",
      userId: null,
    });
  });

  test("slack/sms rows carry no sender or subject", () => {
    const rec = buildMessageRecord({
      channel: "slack",
      to: "#udaman",
      body: "hello",
      userId: 7,
    });
    expect(rec.sender).toBeNull();
    expect(rec.fromAddr).toBeNull();
    expect(rec.subject).toBeNull();
    expect(rec.recipient).toBe("#udaman");
    expect(rec.userId).toBe(7);
  });

  test("clips recipient and subject to their column widths", () => {
    const long = "x".repeat(600);
    const rec = buildMessageRecord({
      channel: "email",
      to: long,
      subject: long,
      body: long,
    });
    expect(rec.recipient.length).toBe(500);
    expect(rec.subject!.length).toBe(500);
    expect(rec.body.length).toBe(600); // TEXT column, not clipped
  });
});
