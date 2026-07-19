export type PublicAuthConfig = { oidcEnabled: boolean; localAuthEnabled: boolean; providerName: string };

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

export const oidcEnabled = () => Boolean(process.env.OIDC_ISSUER?.trim() && process.env.OIDC_CLIENT_ID?.trim() && process.env.OIDC_CLIENT_SECRET?.trim());
export const localAuthEnabled = () => booleanEnv("LOCAL_AUTH_ENABLED", true);
export const oidcSignupEnabled = () => booleanEnv("OIDC_ALLOW_SIGNUP", true);

export function publicAuthConfig(): PublicAuthConfig {
  return { oidcEnabled: oidcEnabled(), localAuthEnabled: localAuthEnabled(), providerName: process.env.OIDC_PROVIDER_NAME?.trim() || "Authentik" };
}
