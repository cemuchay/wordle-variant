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

    // Status refs to avoid stale closures in event handlers
    const micStatusRef = useRef(isMicOn);
    const speakerStatusRef = useRef(isSpeakerOn);

    useEffect(() => { micStatusRef.current = isMicOn; }, [isMicOn]);
    useEffect(() => { speakerStatusRef.current = isSpeakerOn; }, [isSpeakerOn]);

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
        iceCandidatePoolSize: 10,
    };

    const sendSignal = useCallback((data: any) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'signal',
                payload: { ...data, from: userId }
            });
        }
    }, [userId]);

    const cleanup = useCallback(async (sendLeave = true) => {
        addLog('Cleaning up connection...', 'info');
        if (sendLeave) {
            sendSignal({ type: 'leave' });
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        setRemoteStream(null);
        setIsConnected(false);
        setError(null);
        makingOffer.current = false;
        ignoreOffer.current = false;
        pendingCandidates.current = [];
        addLog('Connection closed', 'warning');
    }, [addLog, sendSignal]);

    const stopLocalStream = useCallback(() => {
        if (localStreamRef.current) {
            addLog('Stopping local microphone tracks', 'info');
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
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
            addLog(`Remote track received: ${event.track.kind}`, 'success');

            setRemoteStream(prev => {
                if (prev) {
                    const hasTrack = prev.getTracks().some(t => t.id === event.track.id);
                    if (!hasTrack) {
                        prev.addTrack(event.track);
                    }
                    return new MediaStream(prev.getTracks());
                }
                return event.streams[0] || new MediaStream([event.track]);
            });
        };

        pc.onconnectionstatechange = () => {
            addLog(`Connection state: ${pc.connectionState}`,
                pc.connectionState === 'connected' ? 'success' :
                    pc.connectionState === 'failed' ? 'error' : 'info');

            setIsConnected(pc.connectionState === 'connected');

            if (pc.connectionState === 'connected') {
                sendSignal({
                    type: 'status',
                    mic: micStatusRef.current,
                    speaker: speakerStatusRef.current
                });
            }

            if (pc.connectionState === 'failed') {
                setError('Connection failed. Please check your network.');
            }
        };

        pc.oniceconnectionstatechange = () => {
            addLog(`ICE state: ${pc.iceConnectionState}`,
                pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed' ? 'success' :
                    pc.iceConnectionState === 'failed' ? 'error' : 'info');

            if (pc.iceConnectionState === 'disconnected') {
                addLog('ICE disconnected - network may be unstable', 'warning');
            }
        };

        pc.onsignalingstatechange = () => {
            addLog(`Signaling state: ${pc.signalingState}`, 'info');
        };

        pc.onnegotiationneeded = async () => {
            try {
                if (pc.signalingState !== 'stable') {
                    addLog('Negotiation needed but state not stable, skipping...', 'warning');
                    return;
                }
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

        if (localStreamRef.current) {
            addLog('Adding existing local tracks to new PeerConnection', 'info');
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pcRef.current = pc;
        return pc;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sendSignal, addLog]);

    const processPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
        if (pc.remoteDescription) {
            addLog(`Processing ${pendingCandidates.current.length} pending candidates`, 'info');
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
    }, [addLog]);

    const startAudio = useCallback(async () => {
        if (localStreamRef.current && localStreamRef.current.getAudioTracks().every(t => t.readyState === 'live')) {
            addLog('Reusing existing microphone stream', 'info');
            const pc = createPeerConnection();
            const senders = pc.getSenders();
            localStreamRef.current.getTracks().forEach(track => {
                const alreadyAdded = senders.some(s => s.track === track);
                if (!alreadyAdded) {
                    pc.addTrack(track, localStreamRef.current!);
                }
            });
            sendSignal({ type: 'ready' });
            return;
        }

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
            if (channelRef.current) {
                cleanup();
                stopLocalStream();
            }
            return;
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect
        addLog(`Joining audio channel: ${challengeId.slice(0, 8)}...`, 'info');
        const channelIdStr = `audio_chat_${challengeId}`;
        const channel = supabase.channel(channelIdStr, { config: { broadcast: { ack: true } } });

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
                    } else if (type === 'leave') {
                        addLog('Opponent left the call', 'warning');
                        cleanup(false);
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
                    setTimeout(() => {
                        if (enabled) startAudio();
                    }, 300);
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
    }, [challengeId, userId, enabled, createPeerConnection, sendSignal, cleanup, stopLocalStream, startAudio, addLog, processPendingCandidates]);

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
