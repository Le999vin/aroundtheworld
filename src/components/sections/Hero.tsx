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

function HeroFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400/15 via-cyan-400/10 to-emerald-400/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-28 sm:pt-32">
      <div className="absolute inset-0 -z-10">
        <WebGLGuard fallback={<HeroFallback />}>
          <HeroScene />
        </WebGLGuard>
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      </div>
      <Container>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-w-3xl space-y-6"
        >
          <motion.p
            variants={fadeInUp}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground"
          >
            {profile.location} | Available for select projects
          </motion.p>
          <motion.h1
            variants={fadeInUp}
            className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
          >
            {profile.name}
            <span className="block text-gradient">{profile.title}</span>
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-lg text-muted-foreground sm:text-xl"
          >
            {profile.shortBio}
          </motion.p>
          <motion.div
            variants={fadeInUp}
            className="flex flex-col gap-3 sm:flex-row"
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

