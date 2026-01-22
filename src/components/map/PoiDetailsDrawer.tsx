"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { createStopFromPoi } from "@/lib/itinerary/utils";
import { useItinerary } from "@/lib/itinerary/store";
import { buildGoogleMapsUrl } from "@/lib/maps/googleMaps";
import type { POI } from "@/lib/types";

const normalizeWebsite = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

type EnrichedPoiDetails = Pick<
  POI,
  "address" | "city" | "openingHours" | "website" | "osm" | "images"
>;

type PoiDetailsDrawerProps = {
  poi: POI | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCenter: (poi: POI) => void;
};

const hasText = (value?: string) =>
  typeof value === "string" && value.trim().length > 0;

export const PoiDetailsDrawer = ({
  poi,
  open,
  onOpenChange,
  onCenter,
}: PoiDetailsDrawerProps) => {
  const isOpen = open && Boolean(poi);
  const detailsCacheRef = useRef(new Map<string, EnrichedPoiDetails>());
  const attemptedRef = useRef(new Set<string>());
  const [enrichedDetails, setEnrichedDetails] =
    useState<EnrichedPoiDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const { selectedStops, toggleStop, isPlanFull, maxStops } = useItinerary();

  const poiId = poi?.id ?? null;
  const poiLat = poi?.lat;
  const poiLon = poi?.lon;
  const poiName = poi?.name;
  const poiCategory = poi?.category;
  const poiAddress = poi?.address;
  const poiCity = poi?.city;
  const poiOpeningHours = poi?.openingHours;
  const poiWebsite = poi?.website;
  const poiImages = poi?.images;
  const poiImageUrl = poi?.imageUrl;

  const isInPlan = poi
    ? selectedStops.some((stop) => stop.id === poi.id)
    : false;
  const isAddDisabled = Boolean(poi) && !isInPlan && isPlanFull;

  useEffect(() => {
    if (!poiId) {
      setEnrichedDetails(null);
      return;
    }
    const cached = detailsCacheRef.current.get(poiId) ?? null;
    setEnrichedDetails(cached);
  }, [poiId]);

  useEffect(() => {
    if (!poi || !isOpen) return;
    if (!Number.isFinite(poiLat) || !Number.isFinite(poiLon)) return;

    const cached = detailsCacheRef.current.get(poiId ?? "") ?? null;
    const missingAddress = !hasText(poiAddress) && !hasText(cached?.address);
    const missingCity = !hasText(poiCity) && !hasText(cached?.city);
    const missingOpening =
      !hasText(poiOpeningHours) && !hasText(cached?.openingHours);
    const missingWebsite = !hasText(poiWebsite) && !hasText(cached?.website);
    const hasLocalImages =
      Boolean(poiImageUrl) || (poiImages?.length ?? 0) > 0;
    const hasCachedImages = (cached?.images?.length ?? 0) > 0;
    const missingImages = !hasLocalImages && !hasCachedImages;
    const needsFetch =
      missingAddress ||
      missingCity ||
      missingOpening ||
      missingWebsite ||
      missingImages;

    if (!needsFetch) return;
    if (poiId && attemptedRef.current.has(poiId)) return;

    let aborted = false;
    if (poiId) attemptedRef.current.add(poiId);
    setIsLoadingDetails(true);

    const params = new URLSearchParams({
      lat: String(poiLat),
      lon: String(poiLon),
    });
    if (poiName) params.set("name", poiName);
    if (poiCategory) params.set("category", poiCategory);

    fetch(`/api/poi-details?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as EnrichedPoiDetails;
      })
      .then((data) => {
        if (aborted || !data || !poiId) return;
        const merged: EnrichedPoiDetails = {
          ...detailsCacheRef.current.get(poiId),
        };

        if (!hasText(poiAddress) && hasText(data.address)) {
          merged.address = data.address;
        }
        if (!hasText(poiCity) && hasText(data.city)) {
          merged.city = data.city;
        }
        if (!hasText(poiOpeningHours) && hasText(data.openingHours)) {
          merged.openingHours = data.openingHours;
        }
        if (!hasText(poiWebsite) && hasText(data.website)) {
          merged.website = data.website;
        }
        if (data.osm) {
          merged.osm = data.osm;
        }
        if (data.images && data.images.length > 0) {
          const existing = merged.images ?? [];
          const seen = new Set(existing.map((image) => image.url));
          const next = [...existing];
          for (const image of data.images) {
            if (!image?.url) continue;
            if (seen.has(image.url)) continue;
            next.push(image);
            seen.add(image.url);
          }
          merged.images = next;
        }

        detailsCacheRef.current.set(poiId, merged);
        setEnrichedDetails(merged);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!aborted) setIsLoadingDetails(false);
      });

    return () => {
      aborted = true;
    };
  }, [
    isOpen,
    poi,
    poiAddress,
    poiCategory,
    poiCity,
    poiId,
    poiLat,
    poiLon,
    poiName,
    poiOpeningHours,
    poiWebsite,
    poiImageUrl,
    poiImages,
  ]);

  const gallery = poi
    ? (() => {
        const items = new Map<string, { url: string; attribution?: string }>();
        const addImage = (url?: string, attribution?: string) => {
          if (!url) return;
          const trimmed = url.trim();
          if (!trimmed) return;
          if (!items.has(trimmed)) {
            items.set(trimmed, { url: trimmed, attribution });
          }
        };
        const addImages = (images?: POI["images"]) => {
          if (!images) return;
          for (const image of images) {
            if (!image?.url) continue;
            addImage(image.url, image.attribution);
          }
        };
        addImages(poi.images);
        addImages(enrichedDetails?.images ?? undefined);
        addImage(poi.imageUrl ?? undefined);
        return Array.from(items.values());
      })()
    : [];

  const description =
    poi?.description && poi.description.trim().length > 0
      ? poi.description
      : "Keine Beschreibung vorhanden.";

  const resolvedAddress = hasText(poiAddress)
    ? poiAddress
    : enrichedDetails?.address;
  const resolvedCity = hasText(poiCity) ? poiCity : enrichedDetails?.city;
  const resolvedOpeningHours = hasText(poiOpeningHours)
    ? poiOpeningHours
    : enrichedDetails?.openingHours;
  const resolvedWebsite = hasText(poiWebsite)
    ? poiWebsite
    : enrichedDetails?.website;

  const addressText = poi
    ? [resolvedAddress, resolvedCity].filter(Boolean).join(", ")
    : "";

  const missingAddress = !hasText(resolvedAddress);
  const missingCity = !hasText(resolvedCity);
  const showAddressLoading =
    isLoadingDetails && (missingAddress || missingCity);
  const showOpeningLoading =
    isLoadingDetails && !hasText(resolvedOpeningHours);
  const showWebsiteLoading =
    isLoadingDetails && !normalizeWebsite(resolvedWebsite ?? undefined);
  const showImageLoading = isLoadingDetails && gallery.length === 0;

  const mapsCandidate = poi
    ? {
        ...poi,
        address: resolvedAddress ?? poi.address,
        city: resolvedCity ?? poi.city,
      }
    : null;
  const googleMapsUrl = mapsCandidate
    ? buildGoogleMapsUrl(mapsCandidate)
    : null;
  const websiteUrl = normalizeWebsite(resolvedWebsite);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {poi ? (
        <SheetContent
          side="right"
          className="w-[420px] max-w-[92vw] rounded-l-[32px] border-l border-white/10 bg-slate-950/90 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 px-6 pb-4 pt-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                POI Details
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 pr-8">
                <h2 className="font-display text-2xl text-white">{poi.name}</h2>
                <Badge className="bg-white/10 text-white">
                  {poi.category}
                </Badge>
                {poi.rating ? (
                  <Badge className="bg-white/10 text-white">
                    {poi.rating.toFixed(1)}
                  </Badge>
                ) : null}
              </div>
              {addressText ? (
                <p className="mt-2 text-sm text-slate-300">{addressText}</p>
              ) : null}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Bilder
                </p>
                {showImageLoading ? (
                  <Skeleton className="mt-3 h-32 w-full rounded-2xl bg-white/10" />
                ) : gallery.length ? (
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                    {gallery.map((image, index) => (
                      <div
                        key={`${poi.id}-img-${index}`}
                        className="relative h-32 w-48 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                      >
                        <Image
                          src={image.url}
                          alt={poi.name}
                          fill
                          sizes="192px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex h-32 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-xs text-slate-400">
                    Keine Bilder vorhanden.
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Beschreibung
                </p>
                <p className="mt-2 text-sm text-slate-200">{description}</p>
              </div>

              <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Oeffnungszeiten
                  </p>
                  {showOpeningLoading ? (
                    <Skeleton className="mt-2 h-4 w-28 bg-white/10" />
                  ) : (
                    <p className="mt-1">{resolvedOpeningHours || "Keine Angaben"}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Adresse
                  </p>
                  {showAddressLoading ? (
                    <Skeleton className="mt-2 h-4 w-40 bg-white/10" />
                  ) : (
                    <p className="mt-1">{addressText || "Keine Angaben"}</p>
                  )}
                </div>
              </div>

              {poi.tags && poi.tags.length ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Tags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {poi.tags.map((tag) => (
                      <Badge
                        key={`${poi.id}-tag-${tag}`}
                        className="bg-white/10 text-white"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Button
                  type="button"
                  variant={isInPlan ? "secondary" : "outline"}
                  onClick={() => toggleStop(createStopFromPoi(poi))}
                  disabled={isAddDisabled}
                  title={
                    isAddDisabled
                      ? `Maximal ${maxStops} Orte im Plan.`
                      : undefined
                  }
                  className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  {isInPlan ? "Entfernen" : "+ Zu Plan"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onCenter(poi)}
                  className="w-full"
                >
                  Auf Karte zentrieren
                </Button>
                {googleMapsUrl ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open(
                        googleMapsUrl,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    Google Maps öffnen
                  </Button>
                ) : null}
                {showWebsiteLoading ? (
                  <Skeleton className="h-9 w-full rounded-md bg-white/10" />
                ) : websiteUrl ? (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
                  >
                    <a href={websiteUrl} target="_blank" rel="noreferrer">
                      Website
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
};

export default PoiDetailsDrawer;
