import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export const GlobalAudioPlayer = () => {
    const { audioChat, activeCall } = useApp();
    const { remoteStream, isSpeakerOn, addLog } = audioChat;
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio && remoteStream && activeCall) {
            // Only update srcObject if it has actually changed to avoid flickering
            if (audio.srcObject !== remoteStream) {
                console.log('GlobalAudio: Attaching remote stream', remoteStream.id);
                addLog(`Global playback: Attaching remote stream (${remoteStream.getAudioTracks().length} tracks)`, 'info');
                audio.srcObject = remoteStream;
            }
            
            audio.muted = false; 
            audio.volume = isSpeakerOn ? 1.0 : 0.0;

            const playAudio = () => {
                if (audio.paused) {
                    audio.play().catch(err => {
                        console.warn('GlobalAudio: Playback blocked', err);
                    });
                }
            };

            playAudio();

            const handleInteraction = () => {
                playAudio();
                window.removeEventListener('click', handleInteraction);
                window.removeEventListener('touchstart', handleInteraction);
            };
            window.addEventListener('click', handleInteraction);
            window.addEventListener('touchstart', handleInteraction);

            return () => {
                window.removeEventListener('click', handleInteraction);
                window.removeEventListener('touchstart', handleInteraction);
                // We DON'T clear srcObject here to prevent flickering when the effect re-runs 
                // due to a reference change of the same logical stream.
                // It will be cleared when activeCall or remoteStream becomes null.
            };
        } else if (audio && !remoteStream) {
            audio.srcObject = null;
        }
    }, [remoteStream, isSpeakerOn, activeCall, addLog]);

    return (
        <audio 
            ref={audioRef} 
            autoPlay 
            playsInline 
            style={{ display: 'none' }} 
        />
    );
};
