"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/Container";
import { WebGLGuard } from "@/components/three/WebGLGuard";
import { profile } from "@/content/profile";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const HeroScene = dynamic(() => import("@/components/three/HeroScene"), {
  ssr: false,
});

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[62vh] items-center overflow-hidden pb-16 pt-20 sm:min-h-[68vh] sm:pb-24 sm:pt-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background" />
        <div className="absolute inset-0 bg-hero-glow" />
        <WebGLGuard>
          <HeroScene />
        </WebGLGuard>
        <div className="absolute inset-0 bg-grid opacity-30 mix-blend-soft-light" />
      </div>
      <Container className="relative z-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-w-2xl space-y-6"
        >
          <motion.p
            variants={fadeInUp}
            className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground"
          >
            {profile.location.toUpperCase()} | Available for select projects
          </motion.p>
          <div className="space-y-3">
            <motion.h1
              variants={fadeInUp}
              className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
            >
              {profile.name}
            </motion.h1>
            <motion.h2
              variants={fadeInUp}
              className="text-3xl font-semibold leading-tight text-cyan-400 sm:text-5xl"
            >
              {profile.title}
            </motion.h2>
          </div>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-muted-foreground sm:text-xl"
          >
            {profile.shortBio}
          </motion.p>
          <motion.div
            variants={fadeInUp}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button asChild size="lg" className="group">
              <Link href="/projects">
                View projects
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Contact</Link>
            </Button>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}

