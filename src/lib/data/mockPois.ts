import type { PlaceCategory, POI } from "@/lib/types";

const CATEGORY_ROTATION: PlaceCategory[] = [
  "landmarks",
  "museums",
  "food",
  "nightlife",
  "nature",
];

export const buildMockPois = (center: { lat: number; lon: number }): POI[] => {
  const labels = [
    "Old Town Viewpoint",
    "City Art Museum",
    "Riverside Market",
    "Skyline Rooftop",
    "Botanical Gardens",
    "Historic Cathedral",
    "Food Hall District",
  ];

  return labels.map((name, index) => {
    const offset = (index + 1) * 0.08;
    return {
      id: `poi-${index}-${center.lat}-${center.lon}`,
      name,
      category: CATEGORY_ROTATION[index % CATEGORY_ROTATION.length],
      lat: center.lat + (index % 2 === 0 ? offset : -offset),
      lon: center.lon + (index % 3 === 0 ? -offset : offset),
      rating: 4.2 + (index % 3) * 0.2,
      address: "Central district",
      source: "static",
    };
  });
};
