import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/layout/Container";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export function TechStack() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="space-y-10">
          <Reveal variants={fadeInUp}>
            <SectionHeading
              eyebrow="Stack"
              title="Tools I trust in production"
              description="Modern frontend foundations, tuned for speed and scalability."
            />
          </Reveal>
          <Reveal variants={fadeInUp}>
            <div className="flex flex-wrap gap-3">
              {profile.techStack.map((tech) => (
                <Badge key={tech} variant="secondary" className="px-4 py-2 text-sm">
                  {tech}
                </Badge>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

