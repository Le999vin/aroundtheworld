import Link from "next/link";
import { Dribbble, Github, Linkedin, Mail } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { navigation } from "@/lib/navigation";
import { profile } from "@/content/profile";

import { Container } from "./Container";

const socialIcons = {
  GitHub: Github,
  LinkedIn: Linkedin,
  Email: Mail,
  Dribbble: Dribbble,
};

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/70 py-12 backdrop-blur">
      <Container>
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">
              {profile.name}
            </p>
            <p className="text-sm text-muted-foreground">{profile.shortBio}</p>
            <p className="text-xs text-muted-foreground">{profile.location}</p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Navigation
            </p>
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Connect
            </p>
            <ul className="space-y-2">
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
          </div>
        </div>
        <Separator className="my-10" />
        <div className="flex flex-col gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>(c) {new Date().getFullYear()} {profile.name}. All rights reserved.</span>
          <span>Built with Next.js, TypeScript, Tailwind CSS, and WebGL.</span>
        </div>
      </Container>
    </footer>
  );
}

