import { Container } from "@/components/layout/Container";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export function TimelineSection() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="space-y-10">
          <Reveal variants={fadeInUp}>
            <SectionHeading
              eyebrow="Timeline"
              title="Experience and education"
              description="A focused journey through product, design, and engineering roles."
            />
          </Reveal>
          <Reveal variants={fadeInUp}>
            <div className="glass-card p-6">
              <ul className="space-y-6 border-l border-border/60 pl-6">
                {profile.timeline.map((item) => (
                  <li key={item.title} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base font-semibold text-foreground">
                        {item.title}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.company}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.period}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

