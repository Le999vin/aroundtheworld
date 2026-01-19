"use client";

import Link from "next/link";
import { Copy, ExternalLink, Github } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ProjectLink } from "@/content/projects";
import { copyToClipboard } from "@/lib/copy";

export function ProjectLinks({ links }: { links: ProjectLink }) {
  const primaryLink = links.live || links.github;

  const handleCopy = async () => {
    if (!primaryLink) return;
    const success = await copyToClipboard(primaryLink);
    if (success) {
      toast.success("Link copied to clipboard.");
    } else {
      toast.error("Copy failed. Try again.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {links.github ? (
        <Button asChild variant="outline" className="gap-2">
          <Link href={links.github} target="_blank" rel="noreferrer">
            <Github className="h-4 w-4" />
            GitHub
          </Link>
        </Button>
      ) : null}
      {links.live ? (
        <Button asChild className="gap-2">
          <Link href={links.live} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Live Demo
          </Link>
        </Button>
      ) : null}
      {primaryLink ? (
        <Button variant="secondary" className="gap-2" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
          Copy link
        </Button>
      ) : null}
    </div>
  );
}

