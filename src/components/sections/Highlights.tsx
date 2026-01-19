import { Shield, Sparkles, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Container } from "@/components/layout/Container";
import { profile } from "@/content/profile";
import { fadeInUp } from "@/lib/motion";

import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const icons = {
  Zap,
  Sparkles,
  Shield,
};

export function Highlights() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="space-y-10">
          <Reveal variants={fadeInUp}>
            <SectionHeading
              eyebrow="Highlights"
              title="Premium delivery, predictable outcomes"
              description="From UX clarity to clean architecture, I focus on the details that move the needle."
            />
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {profile.highlights.map((item, index) => {
              const Icon = icons[item.icon];
              return (
                <Reveal
                  key={item.title}
                  variants={fadeInUp}
                  delay={index * 0.1}
                >
                  <Card className="glass-card p-6">
                    <div className="space-y-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

