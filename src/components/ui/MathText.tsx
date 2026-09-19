import { BlockMath, InlineMath } from "react-katex";
import { cn } from "@/design/utils";

export interface MathTextProps {
  /** Prose containing $...$ inline and $$...$$ block math. */
  text: string;
  className?: string;
}

type Segment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "block"; value: string };

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  const inlineRegex = /\$([^$]+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "inline", value: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

function tokenize(text: string): Segment[] {
  const segments: Segment[] = [];
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...parseInline(text.slice(lastIndex, match.index)));
    }
    segments.push({ type: "block", value: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(...parseInline(text.slice(lastIndex)));
  }
  return segments;
}

export function MathText({ text, className }: MathTextProps) {
  const segments = tokenize(text);
  return (
    <div className={cn("whitespace-pre-line", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.value}</span>;
        }
        const delimiter = segment.type === "inline" ? "$" : "$$";
        const display = `${delimiter}${segment.value}${delimiter}`;
        const rendered = (
          <>
            <span className="sr-only">{display}</span>
            <span aria-hidden="true">
              {segment.type === "inline" ? (
                <InlineMath
                  math={segment.value}
                  renderError={() => <span>{display}</span>}
                />
              ) : (
                <BlockMath
                  math={segment.value}
                  renderError={() => <span>{display}</span>}
                />
              )}
            </span>
          </>
        );
        return segment.type === "block" ? (
          <div key={index}>{rendered}</div>
        ) : (
          <span key={index}>{rendered}</span>
        );
      })}
    </div>
  );
}
