import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/Container";
import { projects } from "@/content/projects";
import { fadeInUp } from "@/lib/motion";

import { ProjectCard } from "../projects/ProjectCard";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export function ProjectsPreview() {
  const featured = projects.filter((project) => project.featured).slice(0, 3);

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Reveal variants={fadeInUp}>
              <SectionHeading
                eyebrow="Case Studies"
                title="Selected projects"
                description="A snapshot of product work focused on measurable outcomes and premium UX."
              />
            </Reveal>
            <Reveal variants={fadeInUp}>
              <Button asChild variant="outline">
                <Link href="/projects">View all</Link>
              </Button>
            </Reveal>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((project, index) => (
              <Reveal key={project.slug} variants={fadeInUp} delay={index * 0.1}>
                <ProjectCard project={project} />
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

