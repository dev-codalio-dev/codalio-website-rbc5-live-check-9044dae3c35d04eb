import { BUSINESS_NAME, LOGO_URL, PRIMARY, SERVICE_AREA } from "../lib/site";

export default function Header() {
  return (
    <header className="py-4 border-b border-border bg-white/80 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 flex items-center gap-3">
        {LOGO_URL ? (
          <img src={LOGO_URL} alt={`${BUSINESS_NAME} logo`} className="h-10 w-auto object-contain" />
        ) : (
          <span className="font-bold text-xl" style={{ color: PRIMARY }}>
            {BUSINESS_NAME}
          </span>
        )}
        <span className="ml-auto text-sm text-muted-foreground hidden sm:inline">
          Serving {SERVICE_AREA}
        </span>
      </div>
    </header>
  );
}
