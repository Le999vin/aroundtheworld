import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/Container";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { projects } from "@/content/projects";

type ProjectPageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export function generateMetadata({ params }: ProjectPageProps): Metadata {
  const project = projects.find((item) => item.slug === params.slug);
  if (!project) {
    return {
      title: "Project",
    };
  }

  return {
    title: project.title,
    description: project.description,
    openGraph: {
      title: project.title,
      description: project.description,
      images: [{ url: project.coverImage }],
    },
  };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const project = projects.find((item) => item.slug === params.slug);

  if (!project) {
    notFound();
  }

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to projects
        </Link>
        <div className="mt-6">
          <ProjectHeader project={project} />
        </div>
        <div className="space-y-12">
          <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-10">
              {project.contentSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {section.body.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <Card className="glass-card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Tech Stack
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </Card>
              <Card className="glass-card p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Highlights
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {project.highlights.map((highlight) => (
                    <li key={highlight}>- {highlight}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
          {project.gallery && project.gallery.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold text-foreground">
                  Screenshots
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {project.gallery.map((image) => (
                    <div key={image} className="glass-card overflow-hidden">
                      <Image
                        src={image}
                        alt={`${project.title} screenshot`}
                        width={1200}
                        height={800}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
