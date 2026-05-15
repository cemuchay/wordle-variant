import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export const GlobalAudioPlayer = () => {
    const { audioChat, activeCall } = useApp();
    const { remoteStream, isSpeakerOn, addLog } = audioChat;
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio && remoteStream && activeCall) {
            console.log('GlobalAudio: Attaching remote stream', remoteStream.id);
            addLog(`Global playback: Attaching remote stream (${remoteStream.getAudioTracks().length} tracks)`, 'info');
            
            audio.srcObject = remoteStream;
            audio.muted = false; 
            audio.volume = isSpeakerOn ? 1.0 : 0.0;

            const playAudio = () => {
                audio.play().catch(err => {
                    console.warn('GlobalAudio: Playback blocked', err);
                });
            };

            playAudio();

            const handleInteraction = () => {
                if (audio.paused) playAudio();
                window.removeEventListener('click', handleInteraction);
                window.removeEventListener('touchstart', handleInteraction);
            };
            window.addEventListener('click', handleInteraction);
            window.addEventListener('touchstart', handleInteraction);

            return () => {
                window.removeEventListener('click', handleInteraction);
                window.removeEventListener('touchstart', handleInteraction);
                audio.srcObject = null;
            };
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
