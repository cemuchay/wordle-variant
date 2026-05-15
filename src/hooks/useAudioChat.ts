/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UseAudioChatProps {
    challengeId: string;
    userId: string;
    enabled: boolean;
}

export const useAudioChat = ({ challengeId, userId, enabled }: UseAudioChatProps) => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [opponentStatus, setOpponentStatus] = useState({ mic: false, speaker: true });
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);

    const ICE_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    const cleanup = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);
        setIsConnected(false);
        setError(null);
    }, [localStream]);

    const sendSignal = useCallback((data: any) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'signal',
                payload: { ...data, from: userId }
            });
        }
    }, [userId]);

    const localStreamRef = useRef<MediaStream | null>(null);

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({ type: 'candidate', candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            console.log('WebRTC: Received remote track', event.track.kind);
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else {
                setRemoteStream(new MediaStream([event.track]));
            }
            setIsConnected(true);
        };

        pc.onconnectionstatechange = () => {
            console.log('WebRTC: Connection state', pc.connectionState);
            if (pc.connectionState === 'connected') setIsConnected(true);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setIsConnected(false);
            }
        };

        // Important: Add local tracks if they exist
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
        return pc;
    }, [sendSignal]);

    const startAudio = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const msg = 'Microphone access is not available (secure connection required)';
            setError(msg);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            localStreamRef.current = stream;
            setIsMicOn(true);
            setError(null);

            // If a peer connection already exists, add tracks to it
            if (pcRef.current) {
                stream.getTracks().forEach(track => {
                    pcRef.current!.addTrack(track, stream);
                });
            }

            // Signaling handles the actual connection initiation
            sendSignal({ type: 'ready' });
        } catch (err: any) {
            let msg = 'Error accessing microphone';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = 'Microphone permission denied. Please allow access in browser settings.';
            } else if (err.name === 'NotFoundError') {
                msg = 'No microphone found on this device.';
            }
            setError(msg);
            console.error('Error accessing microphone:', err);
        }
    }, [sendSignal]);

    useEffect(() => {
        if (enabled && !localStream && !error) {
            startAudio();
        }
    }, [enabled, localStream, error, startAudio]);

    useEffect(() => {
        if (!enabled) {
            cleanup();
            return;
        }

        const channelId = `audio_chat_${challengeId}`;
        const channel = supabase.channel(channelId);

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.from === userId) return;

                const { type, offer, answer, candidate } = payload;

                if (type === 'ready') {
                    // Logic to decide who initiates (e.g., lower ID)
                    if (userId < payload.from) {
                        const pc = pcRef.current || createPeerConnection();
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        sendSignal({ type: 'offer', offer });
                    }
                } else if (type === 'offer') {
                    const pc = pcRef.current || createPeerConnection();
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendSignal({ type: 'answer', answer });
                } else if (type === 'answer') {
                    if (pcRef.current) {
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                    }
                } else if (type === 'candidate') {
                    if (pcRef.current) {
                        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                } else if (type === 'status') {
                    setOpponentStatus({ mic: payload.mic, speaker: payload.speaker });
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            cleanup();
        };
    }, [challengeId, userId, enabled, createPeerConnection, sendSignal, cleanup]);

    // Update opponent about our status
    useEffect(() => {
        if (enabled && isConnected) {
            sendSignal({ type: 'status', mic: isMicOn, speaker: isSpeakerOn });
        }
    }, [isMicOn, isSpeakerOn, isConnected, enabled, sendSignal]);

    const toggleMic = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicOn(audioTrack.enabled);
            }
        } else if (enabled) {
            startAudio();
        }
    }, [localStream, enabled, startAudio]);

    const toggleSpeaker = useCallback(() => {
        setIsSpeakerOn(prev => !prev);
    }, []);

    return {
        localStream,
        remoteStream,
        isMicOn,
        isSpeakerOn,
        opponentStatus,
        isConnected,
        error,
        toggleMic,
        toggleSpeaker
    };
};
