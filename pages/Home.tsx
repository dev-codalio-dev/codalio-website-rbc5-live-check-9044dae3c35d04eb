import { useState } from "react";
import { Button } from "../components/ui/button";
import EstimateChat from "../components/EstimateChat";
import {
  BUSINESS_DETAILS,
  BUSINESS_NAME,
  PRIMARY,
  SERVICE_AREA,
  TRADE_CATEGORY
} from "../lib/site";

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <section className="flex-1 flex items-center">
        <div className="max-w-5xl mx-auto px-6 py-16 w-full">
          <p className="uppercase text-sm font-semibold tracking-[0.08em] mb-2" style={{ color: PRIMARY }}>
            {TRADE_CATEGORY}
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 max-w-3xl">
            A clearer path to your next project with {BUSINESS_NAME}
          </h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
            Chat with our AI project consultant for a preliminary cost estimate,
            then book a site visit. Serving homeowners across {SERVICE_AREA}.
          </p>
          <Button
            type="button"
            size="lg"
            className="h-auto rounded-xl px-5 py-3 text-base font-semibold shadow-[0_12px_28px_color-mix(in_srgb,var(--primary)_20%,transparent)]"
            onClick={() => setChatOpen(true)}
          >
            Get a free estimate
          </Button>
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl">{BUSINESS_DETAILS}</p>
        </div>
      </section>

      <section className="py-8 bg-card border-t border-border">
        <div className="max-w-5xl mx-auto px-6 grid gap-4 md:grid-cols-3">
          {[
            { title: "Local expertise", body: `Trusted in ${SERVICE_AREA}` },
            { title: "Preliminary estimates", body: "Transparent ranges before you book" },
            { title: "Easy booking", body: "Schedule a consultation online" }
          ].map((item) => (
            <div key={item.title} className="p-4 h-full rounded-2xl bg-muted border border-border">
              <div className="font-semibold">{item.title}</div>
              <div className="text-sm text-muted-foreground">{item.body}</div>
            </div>
          ))}
        </div>
      </section>

      <EstimateChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
