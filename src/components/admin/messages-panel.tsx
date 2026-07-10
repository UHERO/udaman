"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { sendMessageAction, type SendMessagePayload } from "@/actions/messages";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CHANNELS = ["email", "slack", "sms"] as const;

const EMAIL_SENDERS = [
  {
    key: "default",
    label: "udaman.bot@gmail.com",
    from: "udaman.bot@gmail.com",
  },
  {
    key: "uherosrv",
    label: "uherosrv@hawaii.edu (not yet configured)",
    from: "uherosrv@hawaii.edu",
  },
] as const;

const formSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("email"),
    to: z.string().email("Must be a valid email address"),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Message body is required"),
    sender: z.string(),
  }),
  z.object({
    channel: z.literal("slack"),
    to: z.string().min(1, "Channel is required (e.g. #udaman-alerts)"),
    body: z.string().min(1, "Message body is required"),
  }),
  z.object({
    channel: z.literal("sms"),
    to: z.string().min(1, "Phone number is required (E.164 format)"),
    body: z.string().min(1, "Message body is required"),
  }),
]);

type FormValues = z.infer<typeof formSchema>;

type MessageRow = {
  id: number;
  channel: string;
  sender: string | null;
  from_addr: string | null;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  user_id: number | null;
  created_at: Date;
};

export function MessagesPanel({
  initialMessages,
}: {
  initialMessages: MessageRow[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("email");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      channel: "email",
      to: "",
      subject: "",
      body: "",
      sender: "default",
    },
  });

  function handleChannelChange(value: string) {
    const ch = value as (typeof CHANNELS)[number];
    setChannel(ch);
    if (ch === "email") {
      form.reset({
        channel: "email",
        to: "",
        subject: "",
        body: "",
        sender: "default",
      });
    } else if (ch === "slack") {
      form.reset({ channel: "slack", to: "", body: "" });
    } else {
      form.reset({ channel: "sms", to: "", body: "" });
    }
  }

  async function onSubmit(values: FormValues) {
    const senderConfig =
      values.channel === "email"
        ? EMAIL_SENDERS.find((s) => s.key === values.sender)
        : undefined;

    const payload: SendMessagePayload =
      values.channel === "email"
        ? {
            channel: "email",
            to: values.to,
            subject: values.subject,
            body: values.body,
            sender: values.sender === "default" ? undefined : values.sender,
            from: senderConfig?.from,
          }
        : values.channel === "slack"
          ? { channel: "slack", to: values.to, body: values.body }
          : { channel: "sms", to: values.to, body: values.body };

    try {
      const result = await sendMessageAction(payload);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    }
  }

  return (
    <div className="space-y-8">
      {/* Send form */}
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Send Message</h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldSet className="m-0 gap-1 p-0">
            <FieldGroup className="gap-3">
              <Field data-invalid={!!form.formState.errors.channel}>
                <FieldLabel htmlFor="channel">Channel</FieldLabel>
                <Select value={channel} onValueChange={handleChannelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch} className="capitalize">
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {channel === "email" && (
                <Field>
                  <FieldLabel htmlFor="sender">From</FieldLabel>
                  <Select
                    value={form.watch("sender") as string}
                    onValueChange={(value) => form.setValue("sender", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sender" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMAIL_SENDERS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field data-invalid={!!form.formState.errors.to}>
                <FieldLabel htmlFor="to">
                  {channel === "email"
                    ? "To"
                    : channel === "slack"
                      ? "Channel"
                      : "Phone Number"}
                </FieldLabel>
                <Input
                  id="to"
                  placeholder={
                    channel === "email"
                      ? "user@hawaii.edu"
                      : channel === "slack"
                        ? "#udaman-alerts"
                        : "+18081234567"
                  }
                  {...form.register("to")}
                />
                <FieldError errors={[form.formState.errors.to]} />
              </Field>

              {channel === "email" && (
                <Field
                  data-invalid={
                    !!(
                      form.formState.errors as Record<
                        string,
                        { message?: string }
                      >
                    ).subject
                  }
                >
                  <FieldLabel htmlFor="subject">Subject</FieldLabel>
                  <Input
                    id="subject"
                    placeholder="Test email subject"
                    {...form.register("subject")}
                  />
                  <FieldError
                    errors={[
                      (
                        form.formState.errors as Record<
                          string,
                          { message?: string }
                        >
                      ).subject,
                    ]}
                  />
                </Field>
              )}

              <Field data-invalid={!!form.formState.errors.body}>
                <FieldLabel htmlFor="body">
                  {channel === "email" ? "Body (plain text)" : "Message"}
                </FieldLabel>
                <Textarea
                  id="body"
                  rows={4}
                  placeholder={
                    channel === "email"
                      ? "Your email message here..."
                      : channel === "slack"
                        ? "Slack message text..."
                        : "SMS message text..."
                  }
                  {...form.register("body")}
                />
                <FieldError errors={[form.formState.errors.body]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Sending..." : "Send"}
          </Button>
        </form>
      </div>

      {/* Message history */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Message History</h2>
        {initialMessages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages sent yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium">ID</th>
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">From</th>
                  <th className="px-3 py-2 text-left font-medium">Recipient</th>
                  <th className="px-3 py-2 text-left font-medium">Subject</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Sent At</th>
                </tr>
              </thead>
              <tbody>
                {initialMessages.map((msg) => (
                  <tr key={msg.id} className="border-b last:border-0">
                    <td className="px-3 py-2 tabular-nums">{msg.id}</td>
                    <td className="px-3 py-2 capitalize">{msg.channel}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {msg.from_addr ?? msg.sender ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {msg.recipient}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2">
                      {msg.subject ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          msg.status === "sent" && "bg-green-50 text-green-700",
                          msg.status === "failed" && "bg-red-50 text-red-700",
                          msg.status === "pending" &&
                            "bg-yellow-50 text-yellow-700",
                        )}
                        title={msg.error ?? undefined}
                      >
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {new Date(msg.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
