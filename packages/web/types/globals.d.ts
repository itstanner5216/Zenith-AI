export {};

declare global {
  interface CustomJwtSessionClaims {
    publicMetadata: Record<string, unknown>;
  }
}
