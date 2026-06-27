import React from "react";

interface FormulaRendererProps {
  text: string;
  className?: string;
}

/**
 * Formats mathematical formulas with premium LaTeX-style typography,
 * italicized variables, spaced operators, and custom subscripts/superscripts.
 */
export const formatFormulaHTML = (formula: string): string => {
  let formatted = formula;

  // Render LaTeX fractions \frac{num}{den} into HTML vertical layouts
  formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, num, den) => {
     // Format sub-components inside the fraction first
     const formattedNum = formatFormulaHTML(num);
     const formattedDen = formatFormulaHTML(den);
     return `<span class="inline-flex flex-col align-middle text-center mx-1.5 leading-none"><span class="border-b border-white/20 pb-0.5 px-1 text-[0.85em]">${formattedNum}</span><span class="pt-0.5 px-1 text-[0.85em]">${formattedDen}</span></span>`;
  });

  // Clean LaTeX-style operators
  formatted = formatted.replace(/\\le/g, " &le; ");
  formatted = formatted.replace(/\\ge/g, " &ge; ");
  formatted = formatted.replace(/\\approx/g, " &approx; ");
  formatted = formatted.replace(/\\ne/g, " &ne; ");
  formatted = formatted.replace(/\\cdot/g, " &middot; ");

  // Spacing for basic operators
  formatted = formatted.replace(/\+/g, " + ");
  formatted = formatted.replace(/(?<![eE_^{])-(?![0-9a-zA-Z]*})/g, " &minus; "); // Pad minus but avoid negative exponents/subscripts
  formatted = formatted.replace(/=/g, " = ");
  formatted = formatted.replace(/\*/g, " &times; ");
  formatted = formatted.replace(/\//g, " &divide; ");

  // Handle superscript with braces: e.g. x^{12} -> x<sup>12</sup>
  formatted = formatted.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
  // Handle superscript single char/digit: e.g. x^2 -> x<sup>2</sup>
  formatted = formatted.replace(/\^([0-9a-zA-Z+-]+)/g, "<sup>$1</sup>");

  // Handle subscript with braces: e.g. H_{2} -> H<sub>2</sub>
  formatted = formatted.replace(/_\{([^}]+)\}/g, "<sub>$1</sub>");
  // Handle subscript single char/digit: e.g. H_2 -> H<sub>2</sub>
  formatted = formatted.replace(/_([0-9a-zA-Z+-]+)/g, "<sub>$1</sub>");

  // Wrap mathematical variables (individual letters) in italicized serif spans
  // Avoid modifying HTML entities (like &times;) or tag names
  formatted = formatted.replace(/\b([a-zA-Z])\b/g, (_, letter) => {
    const lower = letter.toLowerCase();
    // Exclude single-letter variables that match HTML tags or common units
    if (lower === "s" || lower === "g" || lower === "v" || lower === "d") {
       return letter;
    }
    return `<span class="font-serif italic text-sky-300 font-semibold select-none">${letter}</span>`;
  });

  return formatted;
};

export const FormulaRenderer: React.FC<FormulaRendererProps> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split text by $$ (block math) and $ (inline math)
  const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/g);

  return (
    <span className={`inline-block w-full ${className}`}>
      {parts.map((part, index) => {
        const isBlock = part.startsWith("$$") && part.endsWith("$$");
        const isInline = part.startsWith("$") && part.endsWith("$");

        if (isBlock || isInline) {
          const formula = isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim();
          const htmlContent = formatFormulaHTML(formula);
          return (
            <span
              key={index}
              className="block my-3 p-3.5 text-center bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-xl shadow-md font-serif text-lg sm:text-xl text-sky-200 select-none tracking-wide"
              style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          );
        } else {
          // Normal text (preserve line breaks if any)
          return (
            <span key={index} className="whitespace-pre-line">
              {part}
            </span>
          );
        }
      })}
    </span>
  );
};

