import { branding } from "@/config/branding";

/**
 * Injects the branding palette as CSS custom properties on :root.
 * Because everything in globals.css references these variables,
 * editing config/branding.ts re-skins the whole app.
 */
export function BrandStyle() {
  const c = branding.colors;
  const css = `:root{
    --bg:${c.bg};
    --surface:${c.surface};
    --surface-alt:${c.surfaceAlt};
    --border:${c.border};
    --text:${c.text};
    --text-muted:${c.textMuted};
    --primary:${c.primary};
    --primary-text:${c.primaryText};
    --primary-glow:${(c as { primaryGlow?: string }).primaryGlow ?? c.primary};
    --secondary:${c.secondary};
    --success:${c.success};
    --warning:${c.warning};
    --danger:${c.danger};
  }`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
