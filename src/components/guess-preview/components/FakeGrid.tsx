import { useMemo } from "react";
import { getTileSizeClass } from "../types";

const FakeGrid = ({ targetWordToUse }: { targetWordToUse: string }) => {
    const fakeGrid = useMemo(() => {
        const cols = 2;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const rows = 5;
        const grid = [];
        for (let r = 0; r < rows; r++) {
            const rowLetters = [];
            for (let c = 0; c < cols; c++) {
                // eslint-disable-next-line react-hooks/purity
                rowLetters.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
            }
            grid.push(rowLetters);
        }
        return grid;
    }, []);

    return (<div className="grid gap-3 mb-6 justify-center">
        {fakeGrid.map((row, i) => (
            <div
                key={i}
                className="flex gap-1 p-2 bg-white/5 rounded-xl border border-white/5 opacity-60"
            >
                {row.map((letter: string, j: number) => {
                    const status = (i + j) % 3 === 0 ? "correct" : (i + j) % 3 === 1 ? "present" : "absent";
                    return (
                        <div
                            key={j}
                            className={`flex items-center justify-center font-black uppercase shadow-inner ${getTileSizeClass(targetWordToUse.length)} ${status === "correct"
                                ? "bg-correct text-white"
                                : status === "present"
                                    ? "bg-present text-white"
                                    : "bg-gray-800 text-gray-500 border border-gray-700"
                                }`}
                        >
                            {letter}
                        </div>
                    );
                })}
            </div>
        ))}
    </div>)
}

export default FakeGrid