// src/app/(marketing)/page.tsx
// Einstiegspunkt für den Globus.
// Imports, Daten laden, Rendering der Landing Page


// Client-UI der Landing Page (z.B. Globus/Interaktionen)
import LandingClient from "@/components/landing/LandingClient";

// Server-Funktion: lädt die Länder-Daten (z.B. aus GeoJSON/JSON)
import { loadCountries } from "@/lib/countries/loadCountries";

// Next.js Page (Server Component): darf async sein, um Daten vor dem Rendern zu laden
export default async function LandingPage() {
  // Länder-Daten serverseitig laden
  const countries = await loadCountries();

  // Client-Komponente rendern und Länder als Props übergeben
  return <LandingClient countries={countries} />;
}
