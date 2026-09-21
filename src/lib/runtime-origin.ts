export function configuredServerApiOrigin(
  environment: Record<string, string | undefined>,
): string {
  const value =
    environment.API_ORIGIN ??
    (environment.NODE_ENV === "development"
      ? "http://localhost:5000"
      : "https://api.example.com");
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password) {
    throw new Error("API_ORIGIN must be an exact origin without credentials or a path");
  }
  return value;
}

export function configuredStorefrontOrigin(
  environment: Record<string, string | undefined>,
): string {
  const value =
    environment.STOREFRONT_ORIGIN ??
    (environment.NODE_ENV === "development"
      ? "http://localhost:3030"
      : "https://example.com");
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password) {
    throw new Error(
      "STOREFRONT_ORIGIN must be an exact origin without credentials or a path",
    );
  }
  return value;
}
