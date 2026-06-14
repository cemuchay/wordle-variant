import { useState, useRef } from 'react';
import { Play, Pause } from "lucide-react";

export const AudioPlayer = ({ url }: { url: string }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => console.error(err));
        }
        setIsPlaying(!isPlaying);
    };

    const handleSpeedChange = () => {
        if (!audioRef.current) return;
        let nextRate: number;
        if (playbackRate === 1) nextRate = 1.5;
        else if (playbackRate === 1.5) nextRate = 2;
        else nextRate = 1;

        audioRef.current.playbackRate = nextRate;
        setPlaybackRate(nextRate);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 bg-black/30 p-2.5 rounded-xl min-w-[220px] border border-white/5 my-1">
            <audio
                ref={audioRef}
                src={url}
                onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
            />
            <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-correct text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            >
                {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
            </button>
            <div className="flex-1 flex flex-col gap-1">
                {/* Seek Bar */}
                <div
                    className="h-1.5 w-full bg-white/20 rounded-full cursor-pointer relative"
                    onClick={(e) => {
                        if (!audioRef.current || duration === 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const newTime = (clickX / rect.width) * duration;
                        audioRef.current.currentTime = newTime;
                        setCurrentTime(newTime);
                    }}
                >
                    <div
                        className="h-full bg-correct rounded-full"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-white/80 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
            <button
                type="button"
                onClick={handleSpeedChange}
                className="text-[10px] font-black bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-md transition-colors border border-white/5 cursor-pointer"
            >
                {playbackRate}x
            </button>
        </div>
    );
};
