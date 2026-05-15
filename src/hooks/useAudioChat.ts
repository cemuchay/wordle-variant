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
    const localStreamRef = useRef<MediaStream | null>(null);

    // Perfect Negotiation State
    const makingOffer = useRef(false);
    const ignoreOffer = useRef(false);
    const isSettingRemoteAnswerPending = useRef(false);

    const ICE_SERVERS = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    const sendSignal = useCallback((data: any) => {
        if (channelRef.current && channelRef.current.state === 'joined') {
            channelRef.current.send({
                type: 'broadcast',
                event: 'signal',
                payload: { ...data, from: userId }
            });
        }
    }, [userId]);

    const cleanup = useCallback(async () => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
        setRemoteStream(null);
        setIsConnected(false);
        setError(null);
        makingOffer.current = false;
        ignoreOffer.current = false;
        isSettingRemoteAnswerPending.current = false;
    }, []);

    const createPeerConnection = useCallback(() => {
        if (pcRef.current) return pcRef.current;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) sendSignal({ type: 'candidate', candidate });
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            } else {
                setRemoteStream(new MediaStream([event.track]));
            }
        };

        pc.onconnectionstatechange = () => {
            setIsConnected(pc.connectionState === 'connected');
        };

        // Standard Negotiation Needed handler
        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current = true;
                await pc.setLocalDescription();
                sendSignal({ type: 'description', description: pc.localDescription });
            } catch (err) {
                console.error('Negotiation error:', err);
            } finally {
                makingOffer.current = false;
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
        return pc;
    }, [sendSignal]);

    const startAudio = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Microphone access not available');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            setError(null);

            const pc = createPeerConnection();
            // Tracks are added in createPeerConnection or here if pc already exists
            if (pc.getSenders().length === 0) {
                stream.getTracks().forEach(track => pc.addTrack(track, stream));
            }

            // Notify opponent we are ready
            sendSignal({ type: 'ready' });
        } catch (err: any) {
            setError('Mic permission denied');
        }
    }, [sendSignal, createPeerConnection]);

    useEffect(() => {
        if (!enabled) {
            cleanup();
            return;
        }

        const channelId = `audio_chat_${challengeId}`;
        const channel = supabase.channel(channelId, { config: { broadcast: { ack: true } } });

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.from === userId) return;
                const { type, description, candidate } = payload;
                const polite = userId < payload.from; // Lower ID is polite

                try {
                    if (type === 'description') {
                        const pc = createPeerConnection();
                        const offerCollision = (description.type === 'offer') &&
                            (makingOffer.current || pc.signalingState !== 'stable');

                        ignoreOffer.current = !polite && offerCollision;
                        if (ignoreOffer.current) return;

                        if (offerCollision) {
                            await pc.setLocalDescription({ type: 'rollback' });
                        }

                        await pc.setRemoteDescription(description);
                        if (description.type === 'offer') {
                            await pc.setLocalDescription();
                            sendSignal({ type: 'description', description: pc.localDescription });
                        }
                    } else if (type === 'candidate') {
                        const pc = createPeerConnection();
                        try {
                            await pc.addIceCandidate(candidate);
                        } catch (err) {
                            if (!ignoreOffer.current) throw err;
                        }
                    } else if (type === 'ready') {
                        // Just trigger PC creation if it hasn't happened
                        createPeerConnection();
                    } else if (type === 'status') {
                        setOpponentStatus({ mic: payload.mic, speaker: payload.speaker });
                    }
                } catch (err) {
                    console.error('Perfect Negotiation Error:', err);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') startAudio();
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            cleanup();
        };
    }, [challengeId, userId, enabled, createPeerConnection, sendSignal, cleanup, startAudio]);

    useEffect(() => {
        if (enabled && isConnected) {
            sendSignal({ type: 'status', mic: isMicOn, speaker: isSpeakerOn });
        }
    }, [isMicOn, isSpeakerOn, isConnected, enabled, sendSignal]);

    const toggleMic = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsMicOn(track.enabled);
            }
        }
    }, []);

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
