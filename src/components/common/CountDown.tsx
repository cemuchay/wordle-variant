import { getServerDate } from "@/lib/time";
import { useState, useEffect } from "react";

const CountDown = ({ isOpen }: { isOpen: boolean }) => {
    const [countdown, setCountdown] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        // This works in both browser (returns a number) and Node (returns a Timeout object)
        let timer: ReturnType<typeof setInterval> | undefined;

        const initCountdown = async () => {
            try {
                const { raw } = await getServerDate();
                const serverOffset = raw.getTime() - Date.now();

                timer = setInterval(() => {
                    const now = new Date(Date.now() + serverOffset);
                    const nigeriaTimeStr = now.toLocaleString("en-US", {
                        timeZone: "Africa/Lagos",
                    });
                    const tomorrow = new Date(nigeriaTimeStr);
                    tomorrow.setHours(24, 0, 0, 0);

                    const diff = tomorrow.getTime() - new Date(nigeriaTimeStr).getTime();

                    if (diff <= 0) {
                        setCountdown("0:00:00");
                        return;
                    }

                    const h = Math.floor(diff / (1000 * 60 * 60));
                    const m = Math.floor((diff / (1000 * 60)) % 60);
                    const s = Math.floor((diff / 1000) % 60);

                    setCountdown(
                        `${h}h:${m.toString().padStart(2, "0")}m:${s.toString().padStart(2, "0")}s`,
                    );
                }, 1000);
            } catch (e) {
                console.error("Countdown init failed", e);
            }
        };

        initCountdown();
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isOpen]);
    return (
        <div className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-widest text-white">
                Next Game
            </p>
            <p className="text-2xl font-mono font-medium text-white tracking-tighter">
                {countdown || "--:--:--"}
            </p>
        </div>
    )
}

export default CountDown