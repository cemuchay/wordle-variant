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

function isInlineMath(str: string): boolean {
    const trimmed = str.trim();
    // Exclude simple prices or currency like $10, $50, $1,000
    if (/^\d+([.,]\d+)?\b/.test(trimmed)) return false;
    // Require math operators, LaTeX syntax, or symbols
    return /[\^_\=+\-\/\*\\<>≤≥±≠≈%]|\\[a-zA-Z]+/.test(trimmed);
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
        <span className={`inline ${className}`}>
            {parts.map((part, index) => {
                const isBlock = part.startsWith("$$") && part.endsWith("$$");
                const rawInline = part.startsWith("$") && part.endsWith("$") && part.length > 2;
                const isInline = rawInline && isInlineMath(part.slice(1, -1));

                if (isBlock || isInline) {
                    const formula = isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim();
                    const htmlContent = formatFormulaHTML(formula);

                    if (isBlock) {
                        return (
                            <span
                                key={index}
                                className="block my-2 p-2 text-center font-serif text-lg text-sky-200 select-none tracking-wide"
                                style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        );
                    }

                    return (
                        <span
                            key={index}
                            className="inline-flex items-center px-1 font-serif text-sky-200 select-none"
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
