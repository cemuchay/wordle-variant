import React from "react";
import formatFormulaHTML from "./formatFormulaHTML";

interface FormulaRendererProps {
    text: string;
    className?: string;
}

const FormulaRenderer: React.FC<FormulaRendererProps> = ({ text, className = "" }) => {
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
                            className="block my-3 p-3.5 text-center bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-xl shadow-md font-serif text-xl text-sky-200 select-none tracking-wide"
                            style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                    );
                } else {
                    // Check if plain text contains chemical formulas or subscripts (e.g. H2O, O2, CO2, Na+)
                    const hasChemFormula = /([A-Z][a-z]?[0-9]+)|([A-Z][a-z]?[\+\-\u2212\u2013])|(_[0-9a-zA-Z]+)/.test(part);
                    if (hasChemFormula) {
                        const htmlContent = formatFormulaHTML(part);
                        return (
                            <span
                                key={index}
                                className="whitespace-pre-line"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        );
                    }
                    // Normal text (preserve line breaks)
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

export default FormulaRenderer
