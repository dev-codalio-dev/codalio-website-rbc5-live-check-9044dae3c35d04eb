import { BUSINESS_NAME, SERVICE_AREA } from "../lib/site";

export default function Footer() {
  return (
    <footer className="py-6 border-t border-border">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-2 justify-between text-sm text-muted-foreground">
        <span>{BUSINESS_NAME}</span>
        <span>Serving {SERVICE_AREA}</span>
        <span>
          Estimates are preliminary and not a formal quotation. Final pricing
          is confirmed on-site.
        </span>
      </div>
    </footer>
  );
}
