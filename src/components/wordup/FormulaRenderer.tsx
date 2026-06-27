import React from "react";

interface FormulaRendererProps {
  text: string;
  className?: string;
}

/**
 * Parses simple formulas with exponents (e.g. x^2, x^{12}), subscripts (e.g. H_2O, H_{2}),
 * variables (italicized), and common mathematical operators.
 */
export const formatFormulaHTML = (formula: string): string => {
  let formatted = formula;

  // Replace multiplication '*' with standard times symbol '×'
  formatted = formatted.replace(/\*/g, " &times; ");

  // Handle superscript with braces: e.g. x^{12} -> x<sup>12</sup>
  formatted = formatted.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
  // Handle superscript single char/digit: e.g. x^2 -> x<sup>2</sup>
  formatted = formatted.replace(/\^([0-9a-zA-Z+-]+)/g, "<sup>$1</sup>");

  // Handle subscript with braces: e.g. H_{2} -> H<sub>2</sub>
  formatted = formatted.replace(/_\{([^}]+)\}/g, "<sub>$1</sub>");
  // Handle subscript single char/digit: e.g. H_2 -> H<sub>2</sub>
  formatted = formatted.replace(/_([0-9a-zA-Z+-]+)/g, "<sub>$1</sub>");

  // Wrap variables (single alphabetical characters that are not part of HTML tags) in styled spans
  // Match single letters surrounded by non-word boundaries or math operators
   formatted = formatted.replace(/\b([a-zA-Z])\b/g, (_, letter) => {
    // Avoid wrapping letters inside HTML tags (like s, u, b, p, d, i, v)
    const lower = letter.toLowerCase();
    if (lower === "a" || lower === "x" || lower === "y" || lower === "z" || lower === "n" || lower === "c" || lower === "m" || lower === "e" || lower === "b" || lower === "f") {
      return `<span class="font-serif italic font-semibold text-sky-300">${letter}</span>`;
    }
    return letter;
  });

  return formatted;
};

export const FormulaRenderer: React.FC<FormulaRendererProps> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split text by $$ (block math) and $ (inline math)
  // We can use a regex to capture both: /|(\$\$.*?\$\$|\$.*?\$)/
  const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/g);

  return (
    <span className={`inline-block w-full ${className}`}>
      {parts.map((part, index) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          // Block formula
          const formula = part.slice(2, -2).trim();
          const htmlContent = formatFormulaHTML(formula);
          return (
            <span
              key={index}
              className="block my-4 p-4 text-center bg-slate-900/60 backdrop-blur-md border border-sky-500/30 rounded-xl shadow-lg shadow-sky-500/5 text-xl sm:text-2xl font-mono text-sky-200 tracking-wide select-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          );
        } else if (part.startsWith("$") && part.endsWith("$")) {
          // Inline formula
          const formula = part.slice(1, -1).trim();
          const htmlContent = formatFormulaHTML(formula);
          return (
            <span
              key={index}
              className="inline-block px-1.5 py-0.5 mx-0.5 bg-slate-800/80 rounded font-mono text-sky-300 border border-sky-500/10 text-[0.95em] align-middle select-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          );
        } else {
          // Normal text
          return <React.Fragment key={index}>{part}</React.Fragment>;
        }
      })}
    </span>
  );
};
