import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { BUSINESS_NAME, PRIMARY, SERVICE_AREA } from "../lib/site";

type Message = { role: "user" | "assistant"; content: string };
type Size = "small" | "medium" | "large";
type Finish = "standard" | "mid-range" | "premium";
type Details = {
  project?: string;
  rate?: number;
  typicalSqft?: [number, number, number];
  size?: Size;
  sqft?: number;
  finish?: Finish;
  timeline?: string;
};
// "declined" keeps listening: the homeowner can still book, or change a detail.
type Step = "project" | "size" | "finish" | "timeline" | "booking" | "declined" | "booked";

// Keyword, label, typical installed cost per sq ft at a standard finish, and
// typical small / medium / large areas in sq ft. Whole words only, so
// "waterproof" is not a roof and "outdoor" is not a door. A bare leak names
// no room, so it is checked last: "my shower is leaking" is a bathroom.
type Project = { match: RegExp; label: string; rate: number; sqft: [number, number, number] };
const PROJECTS: Project[] = [
  { match: /\b(roof(s|ing)?|shingles?|flat[- ]roof)\b/i, label: "roofing", rate: 9, sqft: [1000, 1800, 2800] },
  { match: /\bkitchens?\b/i, label: "kitchen renovation", rate: 250, sqft: [100, 180, 300] },
  { match: /\b(bath(room)?s?|showers?|washrooms?|ensuites?)\b/i, label: "bathroom renovation", rate: 300, sqft: [40, 70, 120] },
  { match: /\bbasements?\b/i, label: "basement finishing", rate: 70, sqft: [400, 800, 1200] },
  { match: /\b(decks?|decking|patios?|porch(es)?)\b/i, label: "deck or patio", rate: 60, sqft: [150, 300, 500] },
  { match: /\b(floor(s|ing)?|til(e|es|ing)|hardwood|laminate|carpet(s|ing)?)\b/i, label: "flooring", rate: 12, sqft: [200, 600, 1200] },
  { match: /\bpaint(s|ing)?\b/i, label: "painting", rate: 4, sqft: [300, 1000, 2500] },
  { match: /\b(windows?|doors?)\b/i, label: "windows and doors", rate: 90, sqft: [30, 80, 160] },
  { match: /\b(siding|exterior|eavestroughs?|gutters?|soffits?|fascia)\b/i, label: "exterior work", rate: 15, sqft: [800, 1500, 2500] },
  { match: /\b(home addition|addition to|extension)\b/i, label: "home addition", rate: 300, sqft: [200, 400, 700] },
  { match: /\b(leak(s|ing|y)?|membrane)\b/i, label: "roofing", rate: 9, sqft: [1000, 1800, 2800] }
];
const DEFAULT_PROJECT = { rate: 100, sqft: [100, 250, 500] as [number, number, number] };
const SIZE_INDEX: Record<Size, number> = { small: 0, medium: 1, large: 2 };
const FINISH_FACTOR: Record<Finish, number> = { standard: 1, "mid-range": 1.3, premium: 1.75 };

const QUESTIONS: Record<Exclude<Step, "booking" | "declined" | "booked">, string> = {
  project: "What kind of project are you planning — for example a kitchen, bathroom, basement or roof?",
  size: "Roughly how big is the area? A square footage is ideal, or just say small, medium or large.",
  finish: "What level of finish are you after — standard, mid-range or premium materials?",
  timeline: "When would you like the work done — as soon as possible, within a few months, or flexible?"
};

function readProject(text: string) {
  return PROJECTS.find((project) => project.match.test(text));
}

function readSize(text: string): Pick<Details, "size" | "sqft"> {
  const area = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*f(?:ee)?t|square\s*f(?:ee|oo)t|sqft|sf|ft2)/i);
  if (area) {
    const sqft = Math.round(Number(area[1].replace(/,/g, "")));
    if (sqft > 0) {
      return { sqft, size: sqft < 120 ? "small" : sqft < 350 ? "medium" : "large" };
    }
  }
  if (/\b(small|tiny|compact)\b/i.test(text)) return { size: "small" };
  if (/\b(medium|mid[- ]?size[d]?|average|moderate)\b/i.test(text)) return { size: "medium" };
  if (/\b(large|big|huge|entire|whole)\b/i.test(text)) return { size: "large" };
  return {};
}

function readFinish(text: string): Finish | undefined {
  if (/\b(premium|luxury|high[- ]end|custom|top[- ]of[- ]the[- ]line)\b/i.test(text)) return "premium";
  if (/\b(mid[- ]?range|mid[- ]grade|good quality|better)\b/i.test(text)) return "mid-range";
  if (/\b(standard|basic|budget|economy|simple|builder[- ]grade)\b/i.test(text)) return "standard";
  return undefined;
}

function readTimeline(text: string): string | undefined {
  if (/\b(asap|urgent|emergency|right away|immediately|this week|soon as possible)\b/i.test(text)) {
    return "as soon as possible";
  }
  const span = text.match(/\b(?:in|within|next)?\s*(\d+|a few|a couple of?)\s*(day|week|month)s?\b/i);
  if (span) return `within ${span[1]} ${span[2]}s`;
  const season = text.match(/\b(this month|next month|this spring|this summer|this fall|this winter|spring|summer|fall|autumn|winter|next year|flexible|no rush)\b/i);
  return season ? season[1].toLowerCase() : undefined;
}

// Phrases that carry "no" without declining anything.
const NOT_A_DECLINE = /\b(no rush|no hurry|no problem|no worries|not sure|not in a rush)\b/gi;

// Undefined when the answer is unclear, or says both: better to ask again
// than to book, or turn down, a visit the homeowner did not mean to.
function readYesNo(text: string): "yes" | "no" | undefined {
  const cleaned = text.replace(NOT_A_DECLINE, " ");
  const no = /\b(no|nope|nah|not now|not yet|maybe later|no thanks|don'?t)\b/i.test(cleaned);
  const yes = /\b(yes|yeah|yep|sure|ok|okay|please|book|schedule|sounds good|let'?s do it)\b/i.test(cleaned);
  if (yes === no) return undefined;
  return yes ? "yes" : "no";
}

function nextStep(details: Details): Exclude<Step, "declined" | "booked"> {
  if (!details.project) return "project";
  if (!details.size) return "size";
  if (!details.finish) return "finish";
  if (!details.timeline) return "timeline";
  return "booking";
}

function roundTo(value: number, step: number) {
  return Math.max(step, Math.round(value / step) * step);
}

function estimate(details: Details) {
  const typical = details.typicalSqft ?? DEFAULT_PROJECT.sqft;
  const sqft = details.sqft ?? typical[SIZE_INDEX[details.size ?? "medium"]];
  const base = sqft * (details.rate ?? DEFAULT_PROJECT.rate) * FINISH_FACTOR[details.finish ?? "standard"];
  const low = roundTo(base * 0.85, 500);
  const high = roundTo(base * 1.2, 500);
  return `$${low.toLocaleString()} – $${high.toLocaleString()}`;
}

function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// Says back whatever this message added or corrected.
function acknowledge(before: Details, after: Details) {
  const heard: string[] = [];
  if (after.project && before.project !== after.project) heard.push(`${article(after.project)} ${after.project} project`);
  if (after.size && (before.size !== after.size || before.sqft !== after.sqft)) {
    heard.push(after.sqft ? `about ${after.sqft} sq ft` : `a ${after.size} space`);
  }
  if (after.finish && before.finish !== after.finish) heard.push(`${after.finish} finishes`);
  if (after.timeline && before.timeline !== after.timeline) heard.push(`timing ${after.timeline}`);
  return heard.length ? `Got it — ${heard.join(", ")}.` : "";
}

const NOT_AN_ANSWER = /^(?:(?:hi|hello|hey|yo|thanks|thank you|ok|okay|huh|what)\b|\?)/i;

// Everything this message says, layered over what is already known. A
// detail stated again replaces the old one, so a correction is taken.
function readDetails(details: Details, step: Step, text: string): Details {
  const updated: Details = { ...details };
  const project = readProject(text);
  if (project) {
    updated.project = project.label;
    updated.rate = project.rate;
    updated.typicalSqft = project.sqft;
  } else if (!updated.project && step === "project" && text.length >= 4 && text.length <= 60 && !NOT_AN_ANSWER.test(text)) {
    updated.project = text.toLowerCase();
  }
  const size = readSize(text);
  if (size.size) {
    updated.size = size.size;
    updated.sqft = size.sqft ?? (updated.size === details.size ? details.sqft : undefined);
  }
  updated.finish = readFinish(text) ?? updated.finish;
  updated.timeline = readTimeline(text) ?? updated.timeline;
  if (!updated.timeline && step === "timeline" && text.length <= 60 && !NOT_AN_ANSWER.test(text)) {
    updated.timeline = text.toLowerCase();
  }
  return updated;
}

function estimateLine(details: Details) {
  return [
    `Based on that, a preliminary range for your ${details.project} is ${estimate(details)}.`,
    "This is an estimate, not a formal quotation — final pricing is confirmed on-site."
  ].join(" ");
}

function reply(step: Step, before: Details, after: Details, text: string): { content: string; step: Step } {
  const ack = acknowledge(before, after);
  const upcoming = nextStep(after);
  const settled = step === "booking" || step === "declined" || step === "booked";

  if (settled) {
    // A change to the project comes first: "please make it premium" or "no
    // rush" is a correction, not an answer to the visit.
    if (ack && upcoming === "booking") {
      if (step === "booked") {
        return { content: `${ack} ${estimateLine(after)} I'll pass that on to the specialist before the visit.`, step };
      }
      return { content: `${ack} ${estimateLine(after)} Would you like to book a free on-site visit?`, step: "booking" };
    }
    if (step === "booked") {
      return { content: "You're all set — the visit is requested. If anything about the project changes, just tell me here.", step };
    }

    const answer = readYesNo(text);
    if (answer === "yes") {
      return {
        content: `Great — a ${BUSINESS_NAME} specialist will reach out to confirm an on-site visit in ${SERVICE_AREA}. Your final quote is confirmed after that visit.`,
        step: "booked"
      };
    }
    if (answer === "no" || step === "declined") {
      return {
        content: "No problem. Whenever you're ready, just say \"book a visit\" and I'll set it up — or tell me if anything about the project changes.",
        step: "declined"
      };
    }
    return { content: "Would you like to book a free on-site visit to confirm the price? (yes / no)", step };
  }

  if (upcoming === "booking") {
    return {
      content: [ack, estimateLine(after), "Would you like to book a free on-site visit?"].filter(Boolean).join(" "),
      step: upcoming
    };
  }

  // Nothing new was understood: re-ask, but say why, so it never reads as a loop.
  const asked = upcoming === step && !ack;
  const question = QUESTIONS[upcoming];
  return {
    content: asked ? `Sorry, I didn't quite catch that. ${question}` : [ack, question].filter(Boolean).join(" "),
    step: upcoming
  };
}

export default function EstimateChat({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi — I'm the project consultant for ${BUSINESS_NAME}. What are you looking to renovate?`
    }
  ]);
  const [details, setDetails] = useState<Details>({});
  const [step, setStep] = useState<Step>("project");
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (!open) return null;

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft("");

    const updated = readDetails(details, step, content);
    const answer = reply(step, details, updated, content);
    setDetails(updated);
    setStep(answer.step);
    setMessages((prev) => [
      ...prev,
      { role: "user", content },
      { role: "assistant", content: answer.content }
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-4 py-3 text-primary-foreground font-semibold" style={{ background: PRIMARY }}>
          <div className="flex items-center justify-between">
            <span>{BUSINESS_NAME}</span>
            <button type="button" onClick={onClose} className="text-white/90 text-sm">
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-8 rounded-xl px-3 py-2 text-sm text-primary-foreground"
                  : "mr-8 rounded-xl px-3 py-2 text-sm bg-muted"
              }
              style={message.role === "user" ? { background: PRIMARY } : undefined}
            >
              {message.content}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="p-3 border-t border-border flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            className="flex-1 rounded-xl border border-input px-3 py-2 text-sm bg-background"
            placeholder="Describe your project…"
          />
          <Button type="button" onClick={send}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
