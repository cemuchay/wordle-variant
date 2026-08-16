/**
 * Formats mathematical formulas with premium LaTeX-style typography,
 * italicized variables, spaced operators, and custom subscripts/superscripts.
 */
const formatFormulaHTML = (formula: string): string => {
   let formatted = formula;

   // Render LaTeX fractions \frac{num}{den} into HTML vertical layouts
   formatted = formatted.replace(
      /\\frac\{([^}]+)\}\{([^}]+)\}/g,
      (_, num, den) => {
         // Format sub-components inside the fraction first
         const formattedNum = formatFormulaHTML(num);
         const formattedDen = formatFormulaHTML(den);
         return `<span class="inline-flex flex-col align-middle text-center mx-1.5 leading-none"><span class="border-b border-white/20 pb-0.5 px-1 text-[0.85em]">${formattedNum}</span><span class="pt-0.5 px-1 text-[0.85em]">${formattedDen}</span></span>`;
      },
   );

   // Clean LaTeX-style operators
   formatted = formatted.replace(/\\le/g, " &le; ");
   formatted = formatted.replace(/\\ge/g, " &ge; ");
   formatted = formatted.replace(/\\approx/g, " &approx; ");
   formatted = formatted.replace(/\\ne/g, " &ne; ");
   formatted = formatted.replace(/\\cdot/g, " &middot; ");

   // Spacing for basic operators
   formatted = formatted.replace(/\+/g, " + ");
   formatted = formatted.replace(
      /(?<![eE_^{])-(?![0-9a-zA-Z]*})/g,
      " &minus; ",
   ); // Pad minus but avoid negative exponents/subscripts
   formatted = formatted.replace(/=/g, " = ");
   formatted = formatted.replace(/\*/g, " &times; ");
   formatted = formatted.replace(/\//g, " &divide; ");

   // Handle chemical formula subscript notation with underscores: e.g. H_2O -> H<sub>2</sub>O, x_{12} -> x<sub>12</sub>
   formatted = formatted.replace(/_\{([^}]+)\}/g, "<sub>$1</sub>");
   formatted = formatted.replace(/_([0-9]+[\+\-]?|[\+\-])/g, "<sub>$1</sub>");

   // Handle inline chemical formula digits (e.g. H2O -> H<sub>2</sub>O, CO2 -> CO<sub>2</sub>, Ca2+ -> Ca<sup>2+</sup>)
   formatted = formatted.replace(/([A-Z][a-z]?)([0-9]+)/g, "$1<sub>$2</sub>");
   formatted = formatted.replace(/([A-Z][a-z]?|\))([0-9]*)([\+\-\u2212\u2013])/g, (_, elem, num, sign) => {
      const s = sign === "-" || sign === "\u2212" || sign === "\u2013" ? "&minus;" : sign;
      return `${elem}<sup>${num}${s}</sup>`;
   });

   // Handle superscript with braces: e.g. x^{12} -> x<sup>12</sup>
   formatted = formatted.replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
   // Handle superscript single char/digit: e.g. x^2 -> x<sup>2</sup>
   formatted = formatted.replace(/\^([0-9a-zA-Z+-]+)/g, "<sup>$1</sup>");

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

export default formatFormulaHTML;
