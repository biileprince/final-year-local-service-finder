/**
 * Renders a schema.org JSON-LD <script>. Works in both server and client
 * components — the markup ends up in the HTML, which is what crawlers read for
 * rich results (star ratings, breadcrumbs, sitelinks search box).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Content is app-generated (no user HTML), so this is safe.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
