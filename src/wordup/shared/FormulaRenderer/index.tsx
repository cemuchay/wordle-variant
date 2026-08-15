import React from "react";
import formatFormulaHTML from "./formatFormulaHTML";

const SCIENTIFIC_CATEGORIES = new Set([
    "chemistry",
    "maths",
    "physics",
    "computers",
    "element_arena",
    "mental_math_blitz",
    "sequence_solver",
    "math",
]);

export function isScientificCategory(category?: string): boolean {
    if (!category) return false;
    const cat = category.toLowerCase().trim();
    return (
        SCIENTIFIC_CATEGORIES.has(cat) ||
        cat.includes("chem") ||
        cat.includes("math") ||
        cat.includes("physic")
    );
}

interface FormulaRendererProps {
    text: string;
    category?: string;
    isScientific?: boolean;
    className?: string;
}

const FormulaRenderer: React.FC<FormulaRendererProps> = ({
    text,
    category,
    isScientific,
    className = "",
}) => {
    if (!text) return null;

    const shouldFormatScientific = isScientific ?? isScientificCategory(category);

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
                    // Only apply un-delimited chemical/scientific formula formatting for scientific topics
                    if (shouldFormatScientific) {
                        const hasChemFormula = /([A-Z][a-z]?[0-9]+)|([A-Z][a-z]?[\+\-\u2212\u2013])|(_\{[0-9a-zA-Z]+\})/.test(part);
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

export default FormulaRenderer;
