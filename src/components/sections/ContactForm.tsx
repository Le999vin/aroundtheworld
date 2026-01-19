"use client";

import { useState } from "react";
import { Copy, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { profile } from "@/content/profile";
import { copyToClipboard } from "@/lib/copy";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialState: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

function validate(form: FormState) {
  const errors: FormErrors = {};
  if (!form.name.trim()) {
    errors.name = "Name is required.";
  }
  if (!form.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.message.trim()) {
    errors.message = "Message is required.";
  }
  return errors;
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    const subject = form.subject.trim() || "Project inquiry";
    const body = [
      `Hi ${profile.name},`,
      "",
      form.message,
      "",
      "From,",
      form.name,
      form.email,
    ].join("\n");
    const mailto = `mailto:${profile.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    toast.success("Thanks for reaching out. Opening your email client.");
    window.location.href = mailto;
    setForm(initialState);
  };

  const handleCopyEmail = async () => {
    const success = await copyToClipboard(profile.email);
    if (success) {
      toast.success("Email copied to clipboard.");
    } else {
      toast.error("Copy failed. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <Input
            id="name"
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            placeholder="Your name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={cn(errors.name && "border-destructive")}
          />
          {errors.name ? (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => handleChange("email", event.target.value)}
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={cn(errors.email && "border-destructive")}
          />
          {errors.email ? (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="subject">
          Subject
        </label>
        <Input
          id="subject"
          value={form.subject}
          onChange={(event) => handleChange("subject", event.target.value)}
          placeholder="Project or collaboration"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="message">
          Message
        </label>
        <Textarea
          id="message"
          value={form.message}
          onChange={(event) => handleChange("message", event.target.value)}
          placeholder="Tell me about your goals, timeline, and scope."
          rows={6}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          className={cn(errors.message && "border-destructive")}
        />
        {errors.message ? (
          <p id="message-error" className="text-xs text-destructive">
            {errors.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="gap-2">
          <Send className="h-4 w-4" />
          Send message
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="gap-2"
          onClick={handleCopyEmail}
        >
          <Copy className="h-4 w-4" />
          Copy email
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <a href={`mailto:${profile.email}`}>
            <Mail className="h-4 w-4" />
            Open mailto
          </a>
        </Button>
      </div>
    </form>
  );
}

