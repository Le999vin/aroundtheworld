import type { Metadata } from "next";
import Link from "next/link";
import { Dribbble, Github, Linkedin, Mail } from "lucide-react";

import { Container } from "@/components/layout/Container";
import { ContactForm } from "@/components/sections/ContactForm";
import { Reveal } from "@/components/sections/Reveal";
import { SectionHeading } from "@/components/sections/SectionHeading";
import { Card } from "@/components/ui/card";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

const socialIcons = {
  GitHub: Github,
  LinkedIn: Linkedin,
  Email: Mail,
  Dribbble: Dribbble,
};

export const metadata: Metadata = {
  title: "Contact",
  description: `Start a conversation with ${profile.name}.`,
};

export default function ContactPage() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Reveal variants={fadeInUp}>
              <SectionHeading
                eyebrow="Contact"
                title="Let's build something premium"
                description="Share a brief about your project and I will reply within 48 hours."
              />
            </Reveal>
            <Reveal variants={fadeInUp}>
              <Card className="glass-card p-6">
                <ContactForm />
              </Card>
            </Reveal>
          </div>
          <div className="space-y-6">
            <Reveal variants={fadeInUp}>
              <Card className="glass-card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Direct
                </h3>
                <p className="mt-3 text-base font-semibold text-foreground">
                  {profile.email}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Prefer email? Use the form or send a quick note.
                </p>
              </Card>
            </Reveal>
            <Reveal variants={fadeInUp}>
              <Card className="glass-card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Social
                </h3>
                <ul className="mt-4 space-y-3">
                  {profile.social.map((link) => {
                    const Icon = socialIcons[link.label];
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

