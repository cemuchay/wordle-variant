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

export default FormulaRenderer
