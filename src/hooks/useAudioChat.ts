/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UseAudioChatProps {
    challengeId: string;
    userId: string;
    enabled: boolean;
}

export interface AudioLog {
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    timestamp: number;
}

export interface AudioChatState {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMicOn: boolean;
    isSpeakerOn: boolean;
    opponentStatus: { mic: boolean; speaker: boolean };
    isConnected: boolean;
    error: string | null;
    toggleMic: () => void;
    toggleSpeaker: () => void;
    logs: AudioLog[];
    clearLogs: () => void;
    addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export const useAudioChat = ({ challengeId, userId, enabled }: UseAudioChatProps): AudioChatState => {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [opponentStatus, setOpponentStatus] = useState({ mic: false, speaker: true });
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<AudioLog[]>([]);

    const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        setLogs(prev => [...prev.slice(-19), { message, type, timestamp: Date.now() }]);
        console.log(`[AudioChatLog] ${type.toUpperCase()}: ${message}`);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

    // Perfect Negotiation State
    const makingOffer = useRef(false);
    const ignoreOffer = useRef(false);

    const ICE_SERVERS: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
        ],
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
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
        addLog('Cleaning up connection...', 'info');
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
        pendingCandidates.current = [];
        addLog('Connection closed', 'warning');
    }, [addLog]);

    const createPeerConnection = useCallback(() => {
        if (pcRef.current) return pcRef.current;

        addLog('Initializing PeerConnection...', 'info');
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                sendSignal({ type: 'candidate', candidate });
            }
        };

        pc.ontrack = (event) => {
            const track = event.track;
            const streams = event.streams;
            addLog(`Remote track received: ${track.kind} (Streams: ${streams.length})`, 'success');

            // Use existing stream if available, otherwise create new one
            const remoteStream = streams[0] || new MediaStream([track]);
            setRemoteStream(remoteStream);

            track.onunmute = () => {
                addLog(`Remote track unmuted: ${track.kind}`, 'info');
                setRemoteStream(new MediaStream([track])); // Refresh stream reference
            };
        };

        pc.onconnectionstatechange = () => {
            addLog(`Connection state: ${pc.connectionState}`, pc.connectionState === 'connected' ? 'success' : 'info');
            setIsConnected(pc.connectionState === 'connected');
            if (pc.connectionState === 'failed') {
                setError('Connection failed. Please check your network.');
                addLog('WebRTC connection failed', 'error');
            }
        };

        pc.onsignalingstatechange = () => {
            addLog(`Signaling state: ${pc.signalingState}`, 'info');
        };

        pc.onnegotiationneeded = async () => {
            try {
                addLog('Negotiation needed, sending offer...', 'info');
                makingOffer.current = true;
                await pc.setLocalDescription();
                sendSignal({ type: 'description', description: pc.localDescription });
            } catch (err) {
                addLog(`Negotiation error: ${err}`, 'error');
            } finally {
                makingOffer.current = false;
            }
        };

        // Add tracks if we already have a local stream
        if (localStreamRef.current) {
            addLog('Adding existing local tracks to new PeerConnection', 'info');
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
        return pc;
    }, [sendSignal, addLog]);

    const processPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
        if (pc.remoteDescription) {
            const candidates = [...pendingCandidates.current];
            pendingCandidates.current = [];
            for (const candidate of candidates) {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (err) {
                    console.warn('Error adding pending candidate:', err);
                }
            }
        }
    }, []);

    const startAudio = useCallback(async () => {
        addLog('Requesting microphone access...', 'info');
        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Microphone access not available');
            addLog('Microphone API not found', 'error');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: { ideal: true },
                    noiseSuppression: { ideal: true },
                    autoGainControl: { ideal: true }
                }
            });

            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            setError(null);
            addLog('Microphone access granted', 'success');

            const pc = createPeerConnection();

            // Explicitly add tracks to PeerConnection
            const senders = pc.getSenders();
            stream.getTracks().forEach(track => {
                const alreadyAdded = senders.some(s => s.track === track);
                if (!alreadyAdded) {
                    addLog(`Adding track to PC: ${track.kind}`, 'info');
                    pc.addTrack(track, stream);
                }
            });

            addLog('Sending ready signal to opponent', 'info');
            sendSignal({ type: 'ready' });
        } catch (err: any) {
            setError('Mic permission denied');
            addLog(`Microphone error: ${err.message || err}`, 'error');
        }
    }, [sendSignal, createPeerConnection, addLog]);

    useEffect(() => {
        if (!enabled) {
            if (channelRef.current) cleanup();
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        addLog(`Joining audio channel: ${challengeId.slice(0, 8)}...`, 'info');
        const channelId = `audio_chat_${challengeId}`;
        const channel = supabase.channel(channelId, { config: { broadcast: { ack: true } } });

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.from === userId) return;
                const { type, description, candidate } = payload;
                const polite = userId < payload.from;

                try {
                    if (type === 'description') {
                        const pc = createPeerConnection();
                        const offerCollision = (description.type === 'offer') &&
                            (makingOffer.current || pc.signalingState !== 'stable');

                        ignoreOffer.current = !polite && offerCollision;
                        if (ignoreOffer.current) {
                            addLog('Ignoring offer (polite collision)', 'warning');
                            return;
                        }

                        if (offerCollision) {
                            addLog('Offer collision, rolling back...', 'warning');
                            await pc.setLocalDescription({ type: 'rollback' });
                        }

                        addLog(`Setting remote ${description.type}...`, 'info');
                        await pc.setRemoteDescription(description);

                        if (description.type === 'offer') {
                            addLog('Creating answer...', 'info');
                            await pc.setLocalDescription();
                            sendSignal({ type: 'description', description: pc.localDescription });
                        }

                        await processPendingCandidates(pc);

                    } else if (type === 'candidate') {
                        const pc = createPeerConnection();
                        if (pc.remoteDescription) {
                            try {
                                await pc.addIceCandidate(candidate);
                            } catch (err) {
                                if (!ignoreOffer.current) throw err;
                            }
                        } else {
                            pendingCandidates.current.push(candidate);
                        }
                    } else if (type === 'ready') {
                        addLog('Opponent is ready', 'success');
                        createPeerConnection();
                    } else if (type === 'status') {
                        setOpponentStatus({ mic: payload.mic, speaker: payload.speaker });
                    } else if (type === 'call_rejected') {
                        addLog('Opponent declined the call', 'error');
                        setError('Call was declined');
                    }
                } catch (err) {
                    addLog(`Handshake error: ${err}`, 'error');
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    addLog('Subscribed to signaling channel', 'success');
                    startAudio();
                }
                if (status === 'CHANNEL_ERROR') {
                    addLog('Signaling channel error', 'error');
                }
            });

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            cleanup();
        };
    }, [challengeId, userId, enabled, createPeerConnection, sendSignal, cleanup, startAudio, addLog, processPendingCandidates]);

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
                addLog(track.enabled ? 'Microphone unmuted' : 'Microphone muted', 'info');
            }
        }
    }, [addLog]);

    const toggleSpeaker = useCallback(() => {
        setIsSpeakerOn(prev => {
            addLog(!prev ? 'Speaker unmuted' : 'Speaker muted', 'info');
            return !prev;
        });
    }, [addLog]);

    return {
        localStream,
        remoteStream,
        isMicOn,
        isSpeakerOn,
        opponentStatus,
        isConnected,
        error,
        toggleMic,
        toggleSpeaker,
        logs,
        clearLogs,
        addLog
    };
};
