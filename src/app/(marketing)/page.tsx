// src/app/(marketing)/page.tsx
import LandingClient from "@/components/landing/LandingClient";
import { loadCountries } from "@/lib/countries/loadCountries";

export default async function LandingPage() {
  const countries = await loadCountries();

  return <LandingClient countries={countries} />;
}
