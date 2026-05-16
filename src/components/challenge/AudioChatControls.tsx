import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';

interface AudioChatControlsProps {
    challengeId: string;
    userId: string;
}

export const AudioChatControls = ({ challengeId, userId }: AudioChatControlsProps) => {
    const { triggerToast, activeCall, setActiveCall, audioChat, onlineUsers } = useApp();

    // SYNC: This control is "enabled" if the GLOBAL active call matches this challenge
    const isEnabled = activeCall?.challengeId === challengeId;

    // Count participants in this specific room
    const participantsInCall = onlineUsers.filter(u => u.activeVoiceRoomId === challengeId);
    const participantCount = participantsInCall.length;

    const toggleCall = () => {
        if (isEnabled) {
            setActiveCall(null);
        } else {
            // PREVENTION: Check if already in a DIFFERENT call
            if (activeCall) {
                triggerToast("You are already in a call. Leave it first to join this one.", 4000);
                return;
            }
            setActiveCall({ challengeId, userId, isInitiator: true });
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
        activeEngine,
        error,
        toggleMic,
        toggleSpeaker,
    } = audioChat;


    const [isOpponentSpeaking, setIsOpponentSpeaking] = useState(false);
    const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

    // Call duration timer
    useEffect(() => {
        let interval: number;
        if (isEnabled && isConnected) {
            const startTime = Date.now() - (callDuration * 1000);
            interval = window.setInterval(() => {
                setCallDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (!isEnabled) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCallDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEnabled, isConnected]);

    // Volume detection logic using a shared AudioContext to prevent "too many AudioContexts" errors
    useEffect(() => {
        if (!isEnabled || !isConnected) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsOpponentSpeaking(false);
            setIsLocalSpeaking(false);
            return;
        }

        let audioCtx: AudioContext | null = null;
        let remoteSource: MediaStreamAudioSourceNode | null = null;
        let localSource: MediaStreamAudioSourceNode | null = null;
        let remoteAnalyzer: AnalyserNode | null = null;
        let localAnalyzer: AnalyserNode | null = null;
        let animationFrame: number;

        const setupAnalyzers = async () => {
            try {
                // Use the standard constructor; multiple calls are usually fine if we close them,
                // but for stability we'll try to keep this one alive for the duration of the call.
                audioCtx = new AudioContext();
                if (audioCtx.state === 'suspended') await audioCtx.resume();

                if (remoteStream && remoteStream.getAudioTracks().length > 0) {
                    remoteSource = audioCtx.createMediaStreamSource(remoteStream);
                    remoteAnalyzer = audioCtx.createAnalyser();
                    remoteAnalyzer.fftSize = 256;
                    remoteSource.connect(remoteAnalyzer);
                }

                if (localStream && localStream.getAudioTracks().length > 0) {
                    localSource = audioCtx.createMediaStreamSource(localStream);
                    localAnalyzer = audioCtx.createAnalyser();
                    localAnalyzer.fftSize = 256;
                    localSource.connect(localAnalyzer);
                }

                const dataArray = new Uint8Array(128);
                const checkVolume = () => {
                    if (remoteAnalyzer) {
                        remoteAnalyzer.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                        setIsOpponentSpeaking(average > 8);
                    }
                    if (localAnalyzer && isMicOn) {
                        localAnalyzer.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                        setIsLocalSpeaking(average > 8);
                    } else {
                        setIsLocalSpeaking(false);
                    }
                    animationFrame = requestAnimationFrame(checkVolume);
                };

                checkVolume();
            } catch (err) {
                console.warn('AudioChat: Could not setup analyzers', err);
            }
        };

        setupAnalyzers();

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (remoteSource) remoteSource.disconnect();
            if (localSource) localSource.disconnect();
            if (audioCtx) audioCtx.close().catch(() => { });
        };
    }, [remoteStream, localStream, isConnected, isEnabled, isMicOn]);

    return (
        <div className="flex items-center gap-2">
            {!isEnabled ? (
                <button
                    onClick={toggleCall}
                    className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-3 py-1.5 rounded-xl border border-emerald-500/20 transition-all text-xs font-bold"
                >
                    <div className="relative">
                        <Phone size={14} />
                        {participantCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        )}
                    </div>
                    <span>Join Voice</span>
                    {participantCount > 0 && (
                        <span className="bg-emerald-500 text-black text-[9px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center ml-0.5">
                            {participantCount}
                        </span>
                    )}
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

                    <div className="h-4 w-px bg-zinc-800 mx-0.5" />

                    {/* Call Timer */}
                    <div className="px-2 min-w-12 text-center">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 tabular-nums">
                            {Math.floor(callDuration / 60)}:{String(callDuration % 60).padStart(2, '0')}
                        </span>
                    </div>

                    <div className="h-4 w-px bg-zinc-800 mx-0.5" />

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

                    {/* Active Engine Badge */}
                    {activeEngine && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-zinc-800/80 rounded-full border border-zinc-700/50 backdrop-blur-sm pointer-events-none">
                            <span className="text-[8px] font-black uppercase tracking-tighter text-zinc-500 whitespace-nowrap">
                                Engine: <span className={activeEngine === 'agora' ? 'text-emerald-500' : 'text-amber-500'}>{activeEngine}</span>
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
