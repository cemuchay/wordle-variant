import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAudioChat } from '../../hooks/useAudioChat';
import { useApp } from '../../context/AppContext';

interface AudioChatControlsProps {
    challengeId: string;
    userId: string;
}

export const AudioChatControls = ({ challengeId, userId }: AudioChatControlsProps) => {
    const { triggerToast, activeCall, setActiveCall } = useApp();
    
    // SYNC: This control is "enabled" if the GLOBAL active call matches this challenge
    const isEnabled = activeCall?.challengeId === challengeId;

    const toggleCall = () => {
        if (isEnabled) {
            setActiveCall(null);
        } else {
            // PREVENTION: Check if already in a DIFFERENT call
            if (activeCall) {
                triggerToast("You are already in a call. Leave it first to join this one.", 4000);
                return;
            }
            setActiveCall({ challengeId, userId });
        }
    };

    const [callDuration, setCallDuration] = useState(0);
    const {
        localStream,
        remoteStream,
        isMicOn,
        isSpeakerOn,
        opponentStatus,
        isConnected,
        error,
        toggleMic,
        toggleSpeaker
    } = useAudioChat({ challengeId, userId, enabled: isEnabled });

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isOpponentSpeaking, setIsOpponentSpeaking] = useState(false);
    const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

    // Toast error messages
    useEffect(() => {
        if (error) {
            triggerToast(error, 5000);
        }
    }, [error, triggerToast]);

    // Call duration timer
    useEffect(() => {
        let interval: number;
        if (isEnabled && isConnected) {
            const startTime = Date.now() - (callDuration * 1000);
            interval = window.setInterval(() => {
                setCallDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (!isEnabled) {
            setCallDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isEnabled, isConnected]);

    // Attach remote stream to audio element
    useEffect(() => {
        if (audioRef.current && remoteStream && isSpeakerOn) {
            audioRef.current.srcObject = remoteStream;
            audioRef.current.play().catch(console.error);
        }
    }, [remoteStream, isSpeakerOn]);

    // Simple volume detection for "speaking" animation (Remote)
    useEffect(() => {
        if (!remoteStream || !isConnected) return;

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(remoteStream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 512;
        source.connect(analyzer);

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        let animationFrame: number;

        const checkVolume = () => {
            analyzer.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setIsOpponentSpeaking(average > 10); // Threshold for speaking
            animationFrame = requestAnimationFrame(checkVolume);
        };

        checkVolume();

        return () => {
            cancelAnimationFrame(animationFrame);
            audioContext.close();
        };
    }, [remoteStream, isConnected]);

    // Simple volume detection for "speaking" animation (Local)
    useEffect(() => {
        if (!localStream || !isMicOn) {
            setIsLocalSpeaking(false);
            return;
        }

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(localStream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 512;
        source.connect(analyzer);

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        let animationFrame: number;

        const checkVolume = () => {
            analyzer.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setIsLocalSpeaking(average > 10);
            animationFrame = requestAnimationFrame(checkVolume);
        };

        checkVolume();

        return () => {
            cancelAnimationFrame(animationFrame);
            audioContext.close();
        };
    }, [localStream, isMicOn]);

    return (
        <div className="flex items-center gap-2">
            {/* Audio element for remote stream (hidden) */}
            <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

            {!isEnabled ? (
                <button
                    onClick={toggleCall}
                    className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-3 py-1.5 rounded-xl border border-emerald-500/20 transition-all text-xs font-bold"
                >
                    <Phone size={14} />
                    <span>Join Voice</span>
                </button>
            ) : (
                <div className="flex items-center gap-1.5 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
                    {/* Connection Status & Opponent Speaking Indicator */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpponentSpeaking ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`}>
                        {isConnected ? (
                            <div className="relative">
                                <Volume2 size={14} className={isOpponentSpeaking ? 'text-white' : 'text-zinc-400'} />
                                {!opponentStatus.mic && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full border border-zinc-900" title="Opponent Muted" />
                                )}
                            </div>
                        ) : (
                            <div className="animate-pulse w-2 h-2 bg-zinc-600 rounded-full" />
                        )}
                    </div>

                    <div className="h-4 w-[1px] bg-zinc-800 mx-0.5" />

                    {/* Call Timer */}
                    <div className="px-2 min-w-[3rem] text-center">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 tabular-nums">
                            {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, '0')}
                        </span>
                    </div>

                    <div className="h-4 w-[1px] bg-zinc-800 mx-0.5" />

                    {/* Mic Toggle with Local Speaking Visualizer */}
                    <button
                        onClick={toggleMic}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative ${error ? 'bg-red-500/20 text-red-500' : isMicOn ? (isLocalSpeaking ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-800') : 'bg-zinc-800/50 text-zinc-600'}`}
                        title={error ? error : isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                    >
                        {error ? <AlertCircle size={14} /> : isMicOn ? <Mic size={14} className={isLocalSpeaking ? 'text-white' : 'text-zinc-400'} /> : <MicOff size={14} />}
                        {isMicOn && isLocalSpeaking && (
                            <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-20" />
                        )}
                        {/* Mic Ready Indicator (Green dot) */}
                        {isMicOn && !isLocalSpeaking && !error && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-zinc-900" title="Mic Ready" />
                        )}
                    </button>

                    {/* Speaker Toggle with Opponent Status & Visualizer */}
                    <button
                        onClick={toggleSpeaker}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all relative ${isSpeakerOn ? (isOpponentSpeaking ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-zinc-800') : 'bg-red-500/10 text-red-500'}`}
                        title={isSpeakerOn ? 'Mute Speaker' : 'Unmute Speaker'}
                    >
                        {isSpeakerOn ? <Volume2 size={14} className={isOpponentSpeaking ? 'text-white' : 'text-zinc-400'} /> : <VolumeX size={14} />}
                        
                        {/* Opponent Speaker Status Indicator (Green dot if they are listening) */}
                        {isSpeakerOn && opponentStatus.speaker && !isOpponentSpeaking && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-zinc-900" title="Opponent Listening" />
                        )}
                        {/* Opponent Speaker Status Indicator (Red dot if they have muted their audio) */}
                        {isSpeakerOn && !opponentStatus.speaker && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-zinc-900" title="Opponent Muted Audio" />
                        )}

                        {isSpeakerOn && isOpponentSpeaking && (
                            <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-20" />
                        )}
                    </button>

                    {/* Leave Voice */}
                    <button
                        onClick={toggleCall}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all ml-1"
                        title="Leave Voice"
                    >
                        <PhoneOff size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
