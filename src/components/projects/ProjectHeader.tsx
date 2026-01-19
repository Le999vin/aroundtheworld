import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Project } from "@/content/projects";
import { formatDate } from "@/lib/format";

import { ProjectLinks } from "./ProjectLinks";

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {project.title}
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          {project.description}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>{formatDate(project.date)}</span>
        <Separator orientation="vertical" className="h-4" />
        <span>{project.role}</span>
      </div>
      <ProjectLinks links={project.links} />
      <Separator className="my-8" />
    </section>
  );
}

