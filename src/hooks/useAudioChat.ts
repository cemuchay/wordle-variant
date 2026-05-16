/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { IAgoraRTCClient, ILocalAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;

// Helper to convert UUID to 32-bit numeric UID for Agora (preferred over strings)
const getNumericUid = (uuid: string): number => {
    if (!uuid) return 0;
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
        hash = ((hash << 5) - hash) + uuid.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

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
    activeEngine: 'agora' | 'p2p' | null;
    error: string | null;
    toggleMic: () => void;
    toggleSpeaker: () => void;
    logs: AudioLog[];
    clearLogs: () => void;
    addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export const useAudioChat = ({ challengeId, userId, enabled }: UseAudioChatProps): AudioChatState => {
    // --- State ---
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [opponentStatus, setOpponentStatus] = useState({ mic: false, speaker: true });
    const [isConnected, setIsConnected] = useState(false);
    const [activeEngine, setActiveEngine] = useState<'agora' | 'p2p' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<AudioLog[]>([]);

    // --- Refs ---
    const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
    const agoraLocalTrackRef = useRef<ILocalAudioTrack | null>(null);
    const isJoiningRef = useRef(false);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const makingOffer = useRef(false);
    const ignoreOffer = useRef(false);

    // Refs for stable access in event handlers
    const activeEngineRef = useRef(activeEngine);
    useEffect(() => { activeEngineRef.current = activeEngine; }, [activeEngine]);

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // Status refs for event handlers
    const micStatusRef = useRef(isMicOn);
    const speakerStatusRef = useRef(isSpeakerOn);
    useEffect(() => { micStatusRef.current = isMicOn; }, [isMicOn]);
    useEffect(() => { speakerStatusRef.current = isSpeakerOn; }, [isSpeakerOn]);

    // --- Helpers ---
    const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        if (!isMounted.current) return;
        setLogs(prev => [...prev.slice(-19), { message, type, timestamp: Date.now() }]);
        console.log(`[AudioChat] [${type.toUpperCase()}] ${message}`);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    const sendSignal = useCallback((data: any) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'signal',
                payload: { ...data, from: userId }
            });
        }
    }, [userId]);

    // --- P2P Engine Specifics ---
    const ICE_SERVERS = useMemo(() => ({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    }), []);

    const cleanupP2P = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        pendingCandidates.current = [];
        makingOffer.current = false;
        ignoreOffer.current = false;
    }, []);

    const createPeerConnection = useCallback(() => {
        if (pcRef.current) return pcRef.current;
        addLog('Initializing P2P Fallback...', 'info');
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) sendSignal({ type: 'candidate', candidate });
        };

        pc.ontrack = (event) => {
            if (!isMounted.current) return;
            addLog('P2P Remote track received', 'success');
            setRemoteStream(event.streams[0] || new MediaStream([event.track]));
        };

        pc.onconnectionstatechange = () => {
            if (!isMounted.current) return;
            setIsConnected(pc.connectionState === 'connected');
            if (pc.connectionState === 'connected') {
                sendSignal({ type: 'status', mic: micStatusRef.current, speaker: speakerStatusRef.current });
            }
        };

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }

        pcRef.current = pc;
        return pc;
    }, [sendSignal, addLog, ICE_SERVERS]);

    // --- Agora Engine Specifics ---
    const setupAgora = useCallback(async () => {
        if (!AGORA_APP_ID) {
            addLog('Agora App ID missing, skipping Agora...', 'warning');
            return false;
        }

        if (isJoiningRef.current || agoraClientRef.current) {
            return true;
        }

        try {
            isJoiningRef.current = true;
            addLog('Connecting via Agora...', 'info');
            const numericUid = getNumericUid(userId);

            const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            agoraClientRef.current = client;

            client.on('user-published', async (user, mediaType) => {
                if (mediaType === 'audio' && isMounted.current) {
                    addLog('Agora opponent audio published', 'success');
                    await client.subscribe(user, mediaType);
                    const remoteTrack = user.audioTrack as IRemoteAudioTrack;
                    remoteTrack.play();

                    const ms = new MediaStream();
                    ms.addTrack(remoteTrack.getMediaStreamTrack());
                    setRemoteStream(ms);
                }
            });

            client.on('user-unpublished', () => {
                if (isMounted.current) {
                    addLog('Agora opponent audio unpublished', 'info');
                    setRemoteStream(null);
                }
            });

            client.on('connection-state-change', (cur, _prev, reason) => {
                if (isMounted.current) {
                    addLog(`Agora state: ${cur} (${reason || 'no reason'})`, 'info');
                    setIsConnected(cur === 'CONNECTED');
                    if (cur === 'CONNECTED') {
                        sendSignal({ type: 'status', mic: micStatusRef.current, speaker: speakerStatusRef.current });
                    }
                }
            });

            addLog(`Fetching access token for UID: ${numericUid}...`, 'info');
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-agora-token', {
                body: { channelName: challengeId, uid: numericUid }
            });

            if (tokenError || !tokenData?.token) {
                throw new Error(tokenError?.message || 'Failed to retrieve access token');
            }

            await client.join(AGORA_APP_ID, challengeId, tokenData.token, numericUid);

            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                encoderConfig: 'speech_standard',
                AEC: true, ANS: true, AGC: true
            });

            agoraLocalTrackRef.current = audioTrack;
            await client.publish(audioTrack);

            if (isMounted.current) {
                const ms = new MediaStream();
                ms.addTrack(audioTrack.getMediaStreamTrack());
                localStreamRef.current = ms;
                setLocalStream(ms);
                setIsMicOn(true);
                setActiveEngine('agora');
                addLog('Agora connected successfully', 'success');
            }
            return true;
        } catch (err: any) {
            addLog(`Agora error: ${err.message || err}`, 'error');
            return false;
        } finally {
            isJoiningRef.current = false;
        }
    }, [challengeId, userId, addLog, sendSignal]);

    // --- Orchestration ---
    const startAudio = useCallback(async () => {
        if (!isMounted.current) return;
        setError(null);

        const agoraSuccess = await setupAgora();
        if (agoraSuccess || !isMounted.current) return;

        addLog('Switching to P2P fallback...', 'warning');
        setActiveEngine('p2p');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            if (isMounted.current) {
                localStreamRef.current = stream;
                setLocalStream(stream);
                setIsMicOn(true);
                createPeerConnection();
                sendSignal({ type: 'ready' });
            }
        } catch (err: any) {
            setError('Mic permission denied');
            addLog(`P2P error: ${err.message}`, 'error');
        }
    }, [setupAgora, createPeerConnection, addLog, sendSignal]);

    const stopAudio = useCallback(async () => {
        addLog('Stopping audio...', 'info');

        if (agoraLocalTrackRef.current) {
            agoraLocalTrackRef.current.stop();
            agoraLocalTrackRef.current.close();
            agoraLocalTrackRef.current = null;
        }
        if (agoraClientRef.current) {
            try {
                await agoraClientRef.current.leave();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) { /* ignore leave errors during abort */ }
            agoraClientRef.current = null;
        }

        cleanupP2P();

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }

        if (isMounted.current) {
            setLocalStream(null);
            setRemoteStream(null);
            setIsConnected(false);
            setActiveEngine(null);
        }
    }, [addLog, cleanupP2P]);

    // --- Lifecycle ---
    useEffect(() => {
        if (!enabled) {
            stopAudio();
            return;
        }

        const channelIdStr = `audio_chat_${challengeId}`;
        const channel = supabase.channel(channelIdStr);

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.from === userId) return;
                const { type, description, candidate } = payload;
                const currentEngine = activeEngineRef.current;

                if (type === 'status') {
                    setOpponentStatus({ mic: payload.mic, speaker: payload.speaker });
                } else if (type === 'leave') {
                    addLog('Opponent left the call', 'warning');
                    setIsConnected(false);
                    setRemoteStream(null);
                } else if (type === 'ready' && currentEngine === 'p2p') {
                    createPeerConnection();
                }

                if (currentEngine === 'p2p') {
                    const polite = userId < payload.from;
                    try {
                        if (type === 'description') {
                            const pc = createPeerConnection();
                            const offerCollision = (description.type === 'offer') && (makingOffer.current || pc.signalingState !== 'stable');
                            ignoreOffer.current = !polite && offerCollision;
                            if (ignoreOffer.current) return;
                            if (offerCollision) await pc.setLocalDescription({ type: 'rollback' });
                            await pc.setRemoteDescription(description);
                            if (description.type === 'offer') {
                                await pc.setLocalDescription();
                                sendSignal({ type: 'description', description: pc.localDescription });
                            }
                        } else if (type === 'candidate') {
                            const pc = createPeerConnection();
                            if (pc.remoteDescription) await pc.addIceCandidate(candidate);
                            else pendingCandidates.current.push(candidate);
                        }
                    } catch (err) { console.error('P2P Signal Error', err); }
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    startAudio();
                }
            });

        channelRef.current = channel;
        return () => {
            channel.unsubscribe();
            stopAudio();
        };
        // We exclude startAudio/stopAudio/activeEngine to avoid the restart loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [challengeId, userId, enabled]);

    const toggleMic = useCallback(() => {
        if (activeEngine === 'agora' && agoraLocalTrackRef.current) {
            const newState = !isMicOn;
            agoraLocalTrackRef.current.setEnabled(newState);
            setIsMicOn(newState);
            addLog(newState ? 'Mic unmuted (Agora)' : 'Mic muted (Agora)', 'info');
        } else if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsMicOn(track.enabled);
                addLog(track.enabled ? 'Mic unmuted (P2P)' : 'Mic muted (P2P)', 'info');
            }
        }
    }, [activeEngine, isMicOn, addLog]);

    const toggleSpeaker = useCallback(() => {
        setIsSpeakerOn(prev => {
            const newState = !prev;
            if (remoteStream) {
                remoteStream.getAudioTracks().forEach(t => t.enabled = newState);
            }
            addLog(newState ? 'Speaker unmuted' : 'Speaker muted', 'info');
            return newState;
        });
    }, [remoteStream, addLog]);

    // Send status updates when local state changes
    useEffect(() => {
        if (enabled && isConnected) {
            sendSignal({ type: 'status', mic: isMicOn, speaker: isSpeakerOn });
        }
    }, [isMicOn, isSpeakerOn, isConnected, enabled, sendSignal]);

    return {
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
        logs,
        clearLogs,
        addLog
    };
};
