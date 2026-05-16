/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { IAgoraRTCClient, ILocalAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;


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
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const makingOffer = useRef(false);
    const ignoreOffer = useRef(false);

    // Status refs for event handlers
    const micStatusRef = useRef(isMicOn);
    const speakerStatusRef = useRef(isSpeakerOn);
    useEffect(() => { micStatusRef.current = isMicOn; }, [isMicOn]);
    useEffect(() => { speakerStatusRef.current = isSpeakerOn; }, [isSpeakerOn]);

    // --- Helpers ---
    const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
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
    const ICE_SERVERS: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    };

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
            addLog('P2P Remote track received', 'success');
            setRemoteStream(event.streams[0] || new MediaStream([event.track]));
        };

        pc.onconnectionstatechange = () => {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sendSignal, addLog]);

    // --- Agora Engine Specifics ---
    const setupAgora = useCallback(async () => {
        if (!AGORA_APP_ID) {
            addLog('Agora App ID missing, skipping Agora...', 'warning');
            return false;
        }

        try {
            addLog('Connecting via Agora (Loading SDK)...', 'info');
            // Dynamically import Agora SDK
            const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
            
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            agoraClientRef.current = client;

            client.on('user-published', async (user, mediaType) => {
                if (mediaType === 'audio') {
                    addLog('Agora opponent audio published', 'success');
                    await client.subscribe(user, mediaType);
                    const remoteTrack = user.audioTrack as IRemoteAudioTrack;
                    remoteTrack.play();

                    // Create standard MediaStream for volume analysis
                    const ms = new MediaStream();
                    ms.addTrack(remoteTrack.getMediaStreamTrack());
                    setRemoteStream(ms);
                }
            });

            client.on('user-unpublished', () => {
                addLog('Agora opponent audio unpublished', 'info');
                setRemoteStream(null);
            });

            client.on('connection-state-change', (cur, _prev, reason) => {
                addLog(`Agora state: ${cur} (${reason || 'no reason'})`, 'info');
                setIsConnected(cur === 'CONNECTED');
                if (cur === 'CONNECTED') {
                    sendSignal({ type: 'status', mic: micStatusRef.current, speaker: speakerStatusRef.current });
                }
            });

            // 1. Get Secure Token from Supabase Edge Function
            addLog('Fetching secure access token...', 'info');
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('get-agora-token', {
                body: { channelName: challengeId, uid: userId }
            });

            if (tokenError || !tokenData?.token) {
                throw new Error(tokenError?.message || 'Failed to retrieve access token');
            }

            // 2. Join Channel with Token
            await client.join(AGORA_APP_ID, challengeId, tokenData.token, userId);

            // Create and publish local track
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                encoderConfig: 'speech_standard',
                AEC: true,
                ANS: true,
                AGC: true
            });

            agoraLocalTrackRef.current = audioTrack;
            await client.publish(audioTrack);

            // Sync with localStream for UI
            const ms = new MediaStream();
            ms.addTrack(audioTrack.getMediaStreamTrack());
            localStreamRef.current = ms;
            setLocalStream(ms);
            setIsMicOn(true);

            setActiveEngine('agora');
            addLog('Agora connected successfully', 'success');
            return true;
        } catch (err: any) {
            addLog(`Agora error: ${err.message || err}`, 'error');
            return false;
        }
    }, [challengeId, userId, addLog, sendSignal]);

    // --- Orchestration ---
    const startAudio = useCallback(async () => {
        setError(null);

        // Try Agora first
        const agoraSuccess = await setupAgora();
        if (agoraSuccess) return;

        // Fallback to P2P
        addLog('Switching to P2P fallback...', 'warning');
        setActiveEngine('p2p');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            createPeerConnection();
            sendSignal({ type: 'ready' });
        } catch (err: any) {
            setError('Mic permission denied');
            addLog(`P2P error: ${err.message}`, 'error');
        }
    }, [setupAgora, createPeerConnection, addLog, sendSignal]);

    const stopAudio = useCallback(async () => {
        addLog('Stopping audio...', 'info');

        // Cleanup Agora
        if (agoraLocalTrackRef.current) {
            agoraLocalTrackRef.current.stop();
            agoraLocalTrackRef.current.close();
            agoraLocalTrackRef.current = null;
        }
        if (agoraClientRef.current) {
            await agoraClientRef.current.leave();
            agoraClientRef.current = null;
        }

        // Cleanup P2P
        cleanupP2P();

        // Cleanup Tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }

        setLocalStream(null);
        setRemoteStream(null);
        setIsConnected(false);
        setActiveEngine(null);
    }, [addLog, cleanupP2P]);

    // --- Lifecycle ---
    useEffect(() => {
        if (!enabled) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            stopAudio();
            return;
        }

        const channelIdStr = `audio_chat_${challengeId}`;
        const channel = supabase.channel(channelIdStr);

        channel
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.from === userId) return;
                const { type, description, candidate } = payload;

                // Handle shared signals (status, leave, ready)
                if (type === 'status') {
                    setOpponentStatus({ mic: payload.mic, speaker: payload.speaker });
                } else if (type === 'leave') {
                    addLog('Opponent left the call', 'warning');
                    setIsConnected(false);
                    setRemoteStream(null);
                } else if (type === 'ready' && activeEngine === 'p2p') {
                    createPeerConnection();
                }

                // Handle P2P specific signals if in P2P mode
                if (activeEngine === 'p2p') {
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
    }, [challengeId, userId, enabled, activeEngine, startAudio, stopAudio, createPeerConnection, sendSignal, addLog]);

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
