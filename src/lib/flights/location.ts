export type DeviceLocation = {
  lat: number;
  lon: number;
  accuracy?: number;
};

export type LocationErrorCode =
  | "permission_denied"
  | "timeout"
  | "unavailable"
  | "unknown";

export class LocationError extends Error {
  code: LocationErrorCode;

  constructor(code: LocationErrorCode, message: string) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

export function requestDeviceLocation(
  timeoutMs = 8000
): Promise<DeviceLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new LocationError("unavailable", "Geolocation unavailable")
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case 1:
            reject(
              new LocationError(
                "permission_denied",
                "Location permission denied"
              )
            );
            break;
          case 2:
            reject(
              new LocationError(
                "unavailable",
                "Location position unavailable"
              )
            );
            break;
          case 3:
            reject(new LocationError("timeout", "Location request timed out"));
            break;
          default:
            reject(new LocationError("unknown", "Location error"));
            break;
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}
