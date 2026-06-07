/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, ChevronLeft, ChevronRight, X, Trophy, Film, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useConfirmation } from '../hooks/useConfirmation';

const getWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

class TechHouseSynth {
    public ctx: AudioContext | null = null;
    private isPlaying = false;
    private nextNoteTime = 0.0;
    private beatCount = 0;
    private timerId: any = null;
    private bpm = 124;
    private recorderDest: MediaStreamAudioDestinationNode | null = null;
    private mainGain: GainNode | null = null;
    private trackIndex = 0;

    private resumeHandler: (() => void) | null = null;

    start(trackIndex = 0, recorderDestNode?: MediaStreamAudioDestinationNode) {
        if (this.isPlaying) return;
        this.trackIndex = trackIndex % 5;
        // @ts-expect-error undefined
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.isPlaying = true;
        this.recorderDest = recorderDestNode || null;

        // Suggest playback audio session to bypass iOS silent switch if supported
        // @ts-expect-error undefined
        if (navigator.audioSession && typeof navigator.audioSession.type === 'string') {
            try {
                // @ts-expect-error undefined
                navigator.audioSession.type = 'playback';
            } catch (e) {
                console.log("Failed to set audio session type:", e);
            }
        }

        // Main Gain setup
        this.mainGain = this.ctx.createGain();
        this.mainGain.gain.value = 0.4;
        this.mainGain.connect(this.ctx.destination);
        if (this.recorderDest) {
            this.mainGain.connect(this.recorderDest);
        }

        this.nextNoteTime = this.ctx.currentTime;
        this.beatCount = 0;
        this.scheduler();

        // Autoplay resume workaround on any click
        if (this.ctx.state === 'suspended') {
            this.resumeHandler = () => {
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
                if (this.resumeHandler) {
                    window.removeEventListener('click', this.resumeHandler);
                    window.removeEventListener('touchstart', this.resumeHandler);
                    this.resumeHandler = null;
                }
            };
            window.addEventListener('click', this.resumeHandler);
            window.addEventListener('touchstart', this.resumeHandler);
        }
    }

    stop() {
        this.isPlaying = false;
        if (this.timerId) clearTimeout(this.timerId);
        if (this.resumeHandler) {
            window.removeEventListener('click', this.resumeHandler);
            window.removeEventListener('touchstart', this.resumeHandler);
            this.resumeHandler = null;
        }
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this.recorderDest = null;
        this.mainGain = null;
    }

    resumeContext(trackIndex = 0) {
        if (!this.isPlaying) {
            this.start(trackIndex);
        } else if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.log("Failed to resume context:", e));
        }
    }

    connectRecorder(destNode: MediaStreamAudioDestinationNode) {
        this.recorderDest = destNode;
        if (this.mainGain && this.ctx) {
            this.mainGain.connect(destNode);
        }
    }

    disconnectRecorder() {
        if (this.mainGain && this.recorderDest) {
            try {
                this.mainGain.disconnect(this.recorderDest);
            } catch (e) {
                console.log("Error disconnecting recorder:", e);
            }
        }
        this.recorderDest = null;
    }

    private scheduler() {
        while (this.isPlaying && this.ctx && this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.schedulePlay(this.beatCount, this.nextNoteTime);
            const secondsPerBeat = 60.0 / this.bpm / 4; // 16th notes
            this.nextNoteTime += secondsPerBeat;
            this.beatCount = (this.beatCount + 1) % 16;
        }
        if (this.isPlaying) {
            this.timerId = setTimeout(() => this.scheduler(), 25);
        }
    }

    private schedulePlay(beat: number, time: number) {
        if (!this.ctx || !this.mainGain) return;

        // 1. Kick drum
        if (beat % 4 === 0) {
            this.playKick(time);
        }

        // 2. Offbeat Hi-hat
        if (beat % 4 === 2) {
            this.playHiHat(time);
        }

        // 3. Bassline & 4. Chord Pad
        const bassPatterns = [
            [36, 0, 36, 0, 39, 0, 39, 39, 41, 0, 41, 0, 43, 41, 39, 36],
            [36, 36, 0, 36, 34, 34, 0, 34, 32, 32, 0, 32, 31, 31, 34, 34],
            [36, 0, 0, 36, 0, 0, 36, 0, 36, 0, 0, 36, 0, 0, 39, 41],
            [36, 36, 36, 36, 39, 39, 39, 39, 41, 41, 41, 41, 43, 43, 43, 43],
            [36, 0, 36, 36, 36, 0, 36, 36, 34, 0, 34, 34, 34, 0, 34, 34]
        ];

        const padPatterns = [
            [48, 48 + 3, 48 + 7, 48 + 10], // Cm7
            [48, 48 + 4, 48 + 7, 48 + 11], // CMaj7
            [48, 48 + 3, 48 + 7, 48 + 8],  // Cm(addb6)
            [48, 48 + 5, 48 + 7, 48 + 12], // Csus4
            [48, 48 + 2, 48 + 7, 48 + 9]   // Cadd9
        ];

        const bassPattern = bassPatterns[this.trackIndex];
        const midiNote = bassPattern[beat];
        if (midiNote > 0) {
            const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
            this.playBass(freq, time);
        }

        if (beat === 0) {
            const notes = padPatterns[this.trackIndex];
            notes.forEach(n => {
                const freq = 440 * Math.pow(2, (n - 69) / 12);
                this.playPad(freq, time, 3.8);
            });
        }
    }

    private playKick(time: number) {
        if (!this.ctx || !this.mainGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.mainGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);

        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

        osc.start(time);
        osc.stop(time + 0.3);
    }

    private playHiHat(time: number) {
        if (!this.ctx || !this.mainGain) return;
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.mainGain);

        noise.start(time);
        noise.stop(time + 0.05);
    }

    private playBass(freq: number, time: number) {
        if (!this.ctx || !this.mainGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, time);
        filter.frequency.exponentialRampToValueAtTime(80, time + 0.15);

        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.mainGain);

        osc.start(time);
        osc.stop(time + 0.15);
    }

    private playPad(freq: number, time: number, duration: number) {
        if (!this.ctx || !this.mainGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        gain.gain.setValueAtTime(0.0, time);
        gain.gain.linearRampToValueAtTime(0.08, time + 0.5);
        gain.gain.setValueAtTime(0.08, time + duration - 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.mainGain);

        osc.start(time);
        osc.stop(time + duration);
    }
}

interface WeeklyWrappedModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    isEasterEgg?: boolean;
    gameDate: string;
}

const toLocalYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseYYYYMMDD = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
};

interface ScoreRecord {
    game_date: string;
    status: string;
    guesses: { letter: string; status: 'correct' | 'present' | 'absent' }[][];
    game_message: string;
    skill_score?: number;
}

interface LeaderboardEntry {
    username: string;
    avatar_url?: string;
    total_points: number;
    days_active: number;
}

export const WeeklyWrappedModal: React.FC<WeeklyWrappedModalProps> = ({
    isOpen,
    onClose,
    userId,
    isEasterEgg = false,
    gameDate
}) => {
    const { ask } = useConfirmation();
    const [loading, setLoading] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 375);

    useEffect(() => {
        const handleResize = () => setIsSmallScreen(window.innerWidth <= 375);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [isMusicPlaying, setIsMusicPlaying] = useState(true);
    const [weeklyScores, setWeeklyScores] = useState<ScoreRecord[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [userRank, setUserRank] = useState<{ rank: number; entry: LeaderboardEntry } | null>(null);
    const [username, setUsername] = useState('Player');

    const [isRecording, setIsRecording] = useState(false);
    const [recordingProgress, setRecordingProgress] = useState(0);
    const [generatedVideoFile, setGeneratedVideoFile] = useState<File | null>(null);
    const [showVideoOverlay, setShowVideoOverlay] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const weeklyTrackIndex = useMemo(() => getWeekNumber(new Date()) % 5, []);
    const [avatarLoaded, setAvatarLoaded] = useState(false);
    const avatarImageRef = useRef<HTMLImageElement | null>(null);

    const synthRef = useRef<TechHouseSynth | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isMusicPlayingRef = useRef(isMusicPlaying);

    useEffect(() => {
        isMusicPlayingRef.current = isMusicPlaying;
    }, [isMusicPlaying]);

    const recordingIntervalRef = useRef<any>(null);
    const preRecordIntervalRef = useRef<any>(null);
    const wrappedTextCache = useRef<Record<string, string[]>>({});

    // 1. Fetch Weekly Wrapped Data
    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            setLoading(true);
            setCurrentSlide(0);
            try {
                // Fetch profile username and avatar
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', userId)
                    .single();
                if (profile) {
                    setUsername(profile.username);
                    setAvatarUrl(profile.avatar_url || null);
                }

                // Fetch scores range: Previous week (Monday to Sunday) relative to context gameDate
                const now = parseYYYYMMDD(gameDate);
                const lastMonday = new Date(now);
                const day = lastMonday.getDay();
                const diff = lastMonday.getDate() - day + (day === 0 ? -6 : 1) - 7;
                lastMonday.setDate(diff);
                lastMonday.setHours(12, 0, 0, 0);

                const lastSunday = new Date(lastMonday);
                lastSunday.setDate(lastSunday.getDate() + 6);
                lastSunday.setHours(12, 0, 0, 0);

                const startDate = toLocalYYYYMMDD(lastMonday);
                const endDate = toLocalYYYYMMDD(lastSunday);

                // Query user scores for this range
                const { data: scores } = await supabase
                    .from('scores')
                    .select('game_date, status, guesses, game_message, skill_score')
                    .eq('user_id', userId)
                    .gte('game_date', startDate)
                    .lte('game_date', endDate)
                    .order('game_date', { ascending: true });

                if (scores) {
                    setWeeklyScores(scores as ScoreRecord[]);
                }

                // Query Weekly Leaderboard
                const { data: lbData } = await supabase.rpc('get_weekly_report_leaderboard');
                if (lbData) {
                    const typedLb = lbData as LeaderboardEntry[];
                    setLeaderboard(typedLb);

                    // Find current user's position
                    const userIdx = typedLb.findIndex(e => e.username === (profile?.username || ''));
                    if (userIdx !== -1) {
                        setUserRank({
                            rank: userIdx + 1,
                            entry: typedLb[userIdx]
                        });
                    }
                }
            } catch (err) {
                console.error("Error loading wrapped data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, userId, isEasterEgg]);

    // 2. Play/Pause Music Loop
    useEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setGeneratedVideoFile(null);
            wrappedTextCache.current = {};
            if (synthRef.current) {
                synthRef.current.stop();
                synthRef.current = null;
            }
            if (preRecordIntervalRef.current) {
                clearInterval(preRecordIntervalRef.current);
                preRecordIntervalRef.current = null;
            }
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
            return;
        }

        if (!synthRef.current) {
            synthRef.current = new TechHouseSynth();
        }

        if (isMusicPlaying) {
            synthRef.current.start(weeklyTrackIndex);
        } else {
            synthRef.current.stop();
        }

        return () => {
            if (synthRef.current) {
                synthRef.current.stop();
                synthRef.current = null;
            }
            if (preRecordIntervalRef.current) {
                clearInterval(preRecordIntervalRef.current);
                preRecordIntervalRef.current = null;
            }
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        };
    }, [isOpen, isMusicPlaying, weeklyTrackIndex]);

    // 3. Preload User Avatar Image for Canvas (preventing taint and CORS issues)
    useEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAvatarLoaded(false);
            avatarImageRef.current = null;
            return;
        }

        const url = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;
        if (!url) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => {
            avatarImageRef.current = img;
            setAvatarLoaded(true);
        };
        img.onerror = () => {
            console.log("CORS/Image loading error for avatar. Fallback text will be rendered.");
            avatarImageRef.current = null;
            setAvatarLoaded(false);
        };
    }, [isOpen, avatarUrl, username]);

    if (!isOpen) return null;

    // Helper: Days of the week mapping
    const getDayName = (dateStr: string) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const date = new Date(dateStr);
        return days[date.getDay()];
    };

    // Calculate total slides count
    // 0: Intro
    // 1 to N: Daily Slides (weeklyScores.length)
    // N+1: Weekly Summary Stats
    // N+2: Leaderboard Spotlight (Last slide)
    const totalSlides = 1 + weeklyScores.length + 2;

    const nextSlide = () => {
        if (currentSlide < totalSlides - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    // 3. Render slide background colors (Spotify Wrapped aesthetics)
    const getSlideBackground = (index: number) => {
        if (index === 0) return 'from-indigo-950 via-purple-950 to-gray-950'; // Intro
        if (index === totalSlides - 2) return 'from-teal-950 via-emerald-950 to-gray-950'; // Stats
        if (index === totalSlides - 1) return 'from-fuchsia-950 via-violet-950 to-gray-950'; // Leaderboard

        // Alternate colors for daily slides
        const dayIdx = index - 1;
        const gradients = [
            'from-rose-950 via-red-950 to-gray-950',
            'from-blue-950 via-indigo-950 to-gray-950',
            'from-cyan-950 via-teal-950 to-gray-950',
            'from-amber-950 via-orange-950 to-gray-950',
            'from-emerald-950 via-green-950 to-gray-950',
            'from-violet-950 via-fuchsia-950 to-gray-950',
            'from-sky-950 via-blue-950 to-gray-950'
        ];
        return gradients[dayIdx % gradients.length];
    };

    // 4. Draw a slide onto a 1080x1920 portrait Canvas for sharing (with optional slideElapsed for dynamic flip reveals)
    const drawSlideToCanvas = (ctx: CanvasRenderingContext2D, index: number, width: number, height: number, slideElapsed?: number) => {
        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Draw background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        if (index === 0) {
            grad.addColorStop(0, '#1e1b4b'); // indigo-950
            grad.addColorStop(0.5, '#3b0764'); // purple-950
            grad.addColorStop(1, '#030712'); // gray-950
        } else if (index === totalSlides - 2) {
            grad.addColorStop(0, '#115e59'); // teal-950
            grad.addColorStop(0.5, '#064e3b'); // emerald-950
            grad.addColorStop(1, '#030712');
        } else if (index === totalSlides - 1) {
            grad.addColorStop(0, '#701a75'); // fuchsia-950
            grad.addColorStop(0.5, '#4c1d95'); // violet-950
            grad.addColorStop(1, '#030712');
        } else {
            const dayGradients = [
                ['#881337', '#450a0a'], // rose to red
                ['#1e3a8a', '#1e1b4b'], // blue to indigo
                ['#164e63', '#115e59'], // cyan to teal
                ['#78350f', '#7c2d12'], // amber to orange
                ['#064e3b', '#14532d'], // emerald to green
                ['#581c87', '#4a044e']  // violet to fuchsia
            ];
            const colors = dayGradients[(index - 1) % dayGradients.length];
            grad.addColorStop(0, colors[0]);
            grad.addColorStop(1, colors[1]);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Drawing helper details
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.arc(width * 0.9, height * 0.15, 300, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.beginPath();
        ctx.arc(width * 0.1, height * 0.8, 450, 0, Math.PI * 2);
        ctx.fill();

        // Draw username on top with mini avatar for all slides except slide 0
        if (index > 0) {
            ctx.save();
            ctx.font = 'bold 24px sans-serif';
            const text = `@${username}`;
            const textWidth = ctx.measureText(text).width;
            const avatarRadius = 18;
            const gap = 12;
            const totalWidth = (avatarRadius * 2) + gap + textWidth;
            const startX = (width - totalWidth) / 2;

            const avatarCx = startX + avatarRadius;
            const avatarCy = 75;

            // Draw mini circular avatar
            if (avatarLoaded && avatarImageRef.current) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatarImageRef.current, avatarCx - avatarRadius, avatarCy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
                ctx.restore();
                // Draw thin border
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Text fallback
                ctx.fillStyle = '#6366f1';
                ctx.beginPath();
                ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(avatarRadius * 1.0)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(username.charAt(0).toUpperCase(), avatarCx, avatarCy + 1);
            }

            // Draw username next to it
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, startX + (avatarRadius * 2) + gap, avatarCy);
            ctx.restore();
        }

        // Footer Brand
        ctx.fillStyle = '#6366f1'; // indigo-500
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VARIANT WRAPPED', width / 2, height - 100);

        ctx.fillStyle = '#9ca3af'; // gray-400
        ctx.font = '22px sans-serif';
        ctx.fillText('www.wordle-variant.xyz', width / 2, height - 60);

        if (index === 0) {
            // Slide 0: Intro
            // Draw large circular avatar
            const avatarCx = width / 2;
            const avatarCy = height * 0.22;
            const avatarRadius = 80;

            if (avatarLoaded && avatarImageRef.current) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatarImageRef.current, avatarCx - avatarRadius, avatarCy - avatarRadius, avatarRadius * 2, avatarRadius * 2);
                ctx.restore();
                // Draw border
                ctx.strokeStyle = '#6366f1'; // indigo-500
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Fallback text avatar
                ctx.fillStyle = '#6366f1';
                ctx.beginPath();
                ctx.arc(avatarCx, avatarCy, avatarRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.round(avatarRadius * 1.0)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(username.charAt(0).toUpperCase(), avatarCx, avatarCy + 4);
            }
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 74px sans-serif';
            ctx.fillText('YOUR WEEKLY', width / 2, height * 0.38);

            // Large text
            const gradText = ctx.createLinearGradient(0, height * 0.42, 0, height * 0.58);
            gradText.addColorStop(0, '#fbbf24'); // amber-400
            gradText.addColorStop(1, '#ec4899'); // pink-500
            ctx.fillStyle = gradText;
            ctx.font = 'black 110px sans-serif';
            ctx.fillText('WRAPPED', width / 2, height * 0.48);

            ctx.fillStyle = '#9ca3af';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(`Player: @${username}`, width / 2, height * 0.58);

            ctx.fillStyle = '#6366f1';
            ctx.font = '30px sans-serif';
            ctx.fillText('Tap to review your word journey...', width / 2, height * 0.72);

        } else if (index === totalSlides - 2) {
            // Slide: Stats Summary
            ctx.fillStyle = '#38bdf8'; // sky-400
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('WEEKLY BREAKDOWN', width / 2, height * 0.22);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 64px sans-serif';
            ctx.fillText('YOUR STATS', width / 2, height * 0.28);

            // Compute statistics
            const played = weeklyScores.length;
            const won = weeklyScores.filter(s => s.status === 'won').length;
            const winPct = played > 0 ? Math.round((won / played) * 100) : 0;
            const totalScore = weeklyScores.reduce((sum, s) => sum + (s.skill_score || 0), 0);

            // Metrics drawing
            const drawMetric = (label: string, value: string, yPos: number, accentColor: string) => {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(100, yPos, width - 200, 140);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.strokeRect(100, yPos, width - 200, 140);

                ctx.textAlign = 'left';
                ctx.fillStyle = '#9ca3af';
                ctx.font = 'bold 28px sans-serif';
                ctx.fillText(label, 140, yPos + 80);

                ctx.textAlign = 'right';
                ctx.fillStyle = accentColor;
                ctx.font = 'bold 54px sans-serif';
                ctx.fillText(value, width - 140, yPos + 90);
            };

            drawMetric('GAMES PLAYED', played.toString(), height * 0.36, '#ffffff');
            drawMetric('WIN RATE', `${winPct}%`, height * 0.46, '#10b981');
            drawMetric('TOTAL POINTS', totalScore.toString(), height * 0.56, '#fbbf24');

        } else if (index === totalSlides - 1) {
            // Slide: Leaderboard Spotlight
            ctx.fillStyle = '#f472b6'; // pink-400
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('GLOBAL RANKINGS', width / 2, height * 0.22);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 64px sans-serif';
            ctx.fillText('LEADERBOARD', width / 2, height * 0.28);

            if (userRank) {
                // Large Rank display
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 120px sans-serif';
                ctx.fillText(`#${userRank.rank}`, width / 2, height * 0.44);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 36px sans-serif';
                ctx.fillText(`Ranked globally with ${userRank.entry.total_points} Points!`, width / 2, height * 0.52);

                // Draw standard leaderboard window (up to 3 players around)
                const myIdx = leaderboard.findIndex(e => e.username === username);
                let start: number
                if (myIdx === -1) {
                    start = 0;
                } else {
                    start = Math.max(0, myIdx - 1);
                    if (start + 3 > leaderboard.length) {
                        start = Math.max(0, leaderboard.length - 3);
                    }
                }
                const windowLb = leaderboard.slice(start, start + 3);
                const startY = height * 0.60;
                windowLb.forEach((entry, idx) => {
                    const originalIdx = leaderboard.findIndex(e => e.username === entry.username);
                    const rank = originalIdx + 1;
                    const isMe = entry.username === username;

                    ctx.fillStyle = isMe ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)';
                    ctx.fillRect(100, startY + (idx * 90), width - 200, 70);
                    ctx.strokeStyle = isMe ? '#6366f1' : 'rgba(255, 255, 255, 0.05)';
                    ctx.strokeRect(100, startY + (idx * 90), width - 200, 70);

                    ctx.textAlign = 'left';
                    ctx.fillStyle = rank === 1 ? '#fbbf24' : '#ffffff';
                    ctx.font = 'bold 28px sans-serif';
                    ctx.fillText(`#${rank}  ${entry.username}${isMe ? ' (You)' : ''}`, 130, startY + (idx * 90) + 44);

                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#6366f1';
                    ctx.font = 'bold 28px sans-serif';
                    ctx.fillText(`${entry.total_points} pts`, width - 130, startY + (idx * 90) + 44);
                });
            } else {
                ctx.fillStyle = '#9ca3af';
                ctx.font = 'bold 32px sans-serif';
                ctx.fillText('Play classic games to rank on the weekly list!', width / 2, height * 0.48);
            }

        } else {
            // Daily Slides (1 to N)
            const dayScore = weeklyScores[index - 1];
            const dayName = getDayName(dayScore.game_date).toUpperCase();

            ctx.fillStyle = '#ec4899'; // pink-500
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(dayScore.game_date, width / 2, height * 0.20);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 82px sans-serif';
            ctx.fillText(dayName, width / 2, height * 0.27);

            // Draw Wordle grid of guesses
            const guesses = dayScore.guesses;
            const rows = guesses.length;
            const cols = guesses[0]?.length || 5;

            // Scale tiles and gap to canvas resolution to guarantee visual quality
            // Scale down if word length > 8 to prevent horizontal overflow on 1080px canvas
            const scaleFactor = cols > 8 ? 0.8 : 1.0;
            const tileSize = Math.round(width * 0.10 * scaleFactor); // 108px (standard) or 86px (scaled)
            const tileGap = Math.round(width * 0.015 * scaleFactor); // 16px (standard) or 13px (scaled)
            const boardWidth = (cols * tileSize) + ((cols - 1) * tileGap);
            const startX = (width - boardWidth) / 2;
            const startY = height * 0.35;

            guesses.forEach((guessRow, r) => {
                guessRow.forEach((charObj, c) => {
                    const x = startX + (c * (tileSize + tileGap));
                    const y = startY + (r * (tileSize + tileGap));

                    // Calculate staggered reveal time for each tile (200ms per row, 60ms per column)
                    const tileDelay = r * 200 + c * 60;
                    const flipDuration = 600; // Matches CSS animation (0.6s)
                    const t = slideElapsed !== undefined ? slideElapsed - tileDelay : Infinity;

                    let bgColor: string;
                    let textColor: string;
                    let borderColor: string;
                    let isRevealed = false;

                    if (t >= flipDuration / 2 || t === Infinity || slideElapsed === undefined || slideElapsed >= 999999) {
                        isRevealed = true;
                    }

                    if (isRevealed) {
                        if (charObj.status === 'correct') {
                            bgColor = '#538d4e';
                            textColor = '#000000';
                            borderColor = '#538d4e';
                        } else if (charObj.status === 'present') {
                            bgColor = '#b59f3b';
                            textColor = '#000000';
                            borderColor = '#b59f3b';
                        } else {
                            bgColor = '#3a3a3c';
                            textColor = '#ffffff';
                            borderColor = '#3a3a3c';
                        }
                    } else {
                        // Unrevealed state style: transparent with dark gray border
                        bgColor = 'transparent';
                        textColor = '#ffffff';
                        borderColor = '#52525b';
                    }

                    // Calculate rotation scaling Sy
                    let Sy = 1;
                    if (t >= 0 && t <= flipDuration && slideElapsed !== undefined && slideElapsed < 999999) {
                        const progress = t / flipDuration;
                        const angle = progress * Math.PI;
                        Sy = Math.abs(Math.cos(angle));
                    }

                    ctx.save();
                    ctx.translate(x + tileSize / 2, y + tileSize / 2);
                    ctx.scale(1, Sy);

                    // Draw cell background / border
                    if (bgColor === 'transparent') {
                        ctx.strokeStyle = borderColor;
                        ctx.lineWidth = 3;
                        ctx.strokeRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);
                    } else {
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);
                    }

                    // Draw Letter
                    ctx.fillStyle = textColor;
                    ctx.font = `bold ${Math.round(tileSize * 0.5)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(charObj.letter, 0, 2);

                    ctx.restore();
                });
            });

            // Reset text Baseline for descriptions
            ctx.textBaseline = 'alphabetic';

            // Draw Roast/Message
            if (dayScore.game_message) {
                ctx.fillStyle = '#f59e0b'; // amber-500
                ctx.font = `italic bold ${Math.round(width * 0.03)}px sans-serif`;
                ctx.textAlign = 'center';

                // Draw Roast/Message
                if (dayScore.game_message) {
                    ctx.fillStyle = '#f59e0b'; // amber-500
                    const fontSize = Math.round(width * 0.03);
                    ctx.font = `italic bold ${fontSize}px sans-serif`;
                    ctx.textAlign = 'center';

                    const cacheKey = `${dayScore.game_date}_${width}`;
                    let lines = wrappedTextCache.current[cacheKey];

                    if (!lines) {
                        const words = dayScore.game_message.split(' ');
                        let line = '';
                        lines = [];
                        const maxWordsWidth = width - 160;

                        for (let n = 0; n < words.length; n++) {
                            const testLine = line + words[n] + ' ';
                            const metrics = ctx.measureText(testLine);
                            if (metrics.width > maxWordsWidth && n > 0) {
                                lines.push(line);
                                line = words[n] + ' ';
                            } else {
                                line = testLine;
                            }
                        }
                        lines.push(line);
                        wrappedTextCache.current[cacheKey] = lines;
                    }

                    const roastY = startY + (rows * (tileSize + tileGap)) + Math.round(width * 0.08);
                    const lineSpacing = Math.round(width * 0.04);

                    lines.forEach((l, idx) => {
                        ctx.fillText(l.trim(), width / 2, roastY + (idx * lineSpacing));
                    });
                }
            }
        }
    };

    // 5. Share a single slide as PNG (actual browser share with download fallback)
    const exportSlideImage = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        drawSlideToCanvas(ctx, currentSlide, 1080, 1920);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], `wordle_wrapped_slide_${currentSlide}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Variant Wrapped',
                        text: `Check out my Variant Wrapped slide!`,
                    });
                } catch (err) {
                    console.log('Share failed, falling back to download:', err);
                    triggerDownload(blob);
                }
            } else {
                triggerDownload(blob);
            }
        }, 'image/png');
    };

    const triggerDownload = (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wordle_wrapped_slide_${currentSlide}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 6. Record Canvas animation with Audio stream to share/download a video (WebM)
    const exportWrappedVideo = async () => {
        if (generatedVideoFile) {
            setShowVideoOverlay(true);
            return;
        }
        if (isRecording) return;

        // Prompt user if they are about to record a silent video
        if (!isMusicPlayingRef.current) {
            const confirmed = await ask({
                title: 'No Audio Detected',
                message: 'This video has no sound, do you still want to download it without sound?',
                confirmLabel: 'Download Anyway',
                cancelLabel: 'Cancel',
                type: 'info'
            });
            if (!confirmed) return;
        }

        setIsRecording(true);
        setShowVideoOverlay(true);
        setRecordingProgress(0);

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 1080; // High quality Full HD portrait
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsRecording(false);
            return;
        }

        // Draw the very first slide immediately BEFORE capturing and starting the recorder
        // This ensures the stream is initialized with image frames right away, preventing initial blank screens
        drawSlideToCanvas(ctx, 0, 1080, 1920, 0);

        // Setup MediaStream
        const stream = canvas.captureStream(30); // 30 FPS
        const chunks: Blob[] = [];

        // Try to capture audio from the synth by connecting to its active context
        let audioStream: MediaStream | null = null;
        try {
            if (synthRef.current && synthRef.current.ctx && isMusicPlayingRef.current) {
                const dest = synthRef.current.ctx.createMediaStreamDestination();
                synthRef.current.connectRecorder(dest);
                audioStream = dest.stream;
            }
        } catch (e) {
            console.log("Audio capture error:", e);
        }

        // Combine video and audio tracks
        const combinedStream = new MediaStream();
        stream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
        if (audioStream) {
            audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
        }

        // Probe supported formats, prioritizing MP4 (avc1/mp4a) for native iOS/Android sharing on WhatsApp
        const candidateTypes = [
            'video/mp4;codecs=avc1,mp4a.40.2',
            'video/mp4;codecs=h264,aac',
            'video/mp4',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];

        let selectedMimeType = '';
        let extension = 'webm';

        for (const type of candidateTypes) {
            try {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    if (type.includes('mp4')) {
                        extension = 'mp4';
                    }
                    break;
                }
            } catch (e) {
                // Ignore unsupported error
                console.log("Unsupported mime type", e);
            }
        }

        if (!selectedMimeType) {
            selectedMimeType = 'video/webm';
            extension = 'webm';
        }

        // Configure MediaRecorder with a target bitrate (8 Mbps) for pristine yet mobile-shareable file size
        const targetBitrate = 8000000;
        let mediaRecorder: MediaRecorder;
        try {
            mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: selectedMimeType,
                videoBitsPerSecond: targetBitrate
            });
        } catch (e) {
            console.log("Error with bitrate", e);
            try {
                // Fall back to just the mimeType if the bitrate parameter fails
                mediaRecorder = new MediaRecorder(combinedStream, {
                    mimeType: selectedMimeType
                });
            } catch (err) {
                // Hard fallback to default
                mediaRecorder = new MediaRecorder(combinedStream);
                console.log("Hard fallback to default", err);
            }
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const rawMime = selectedMimeType.split(';')[0]; // e.g. 'video/mp4' or 'video/webm'
            const blob = new Blob(chunks, { type: rawMime });

            // Disconnect recorder from the synth
            if (synthRef.current) {
                synthRef.current.disconnectRecorder();
            }

            const fileName = `wordle_weekly_wrapped.${extension}`;
            const file = new File([blob], fileName, { type: rawMime });

            // Store in state to present the compile-then-share flow
            setGeneratedVideoFile(file);
            setIsRecording(false);
        };

        // Pre-recording drawing loop: draw slide 0 at 20fps to feed the stream during startup
        preRecordIntervalRef.current = setInterval(() => {
            drawSlideToCanvas(ctx, 0, 1080, 1920, 0);
        }, 50);

        // Synchronize actual recording timeline with MediaRecorder onstart event
        mediaRecorder.onstart = () => {
            if (preRecordIntervalRef.current) {
                clearInterval(preRecordIntervalRef.current);
                preRecordIntervalRef.current = null;
            }

            // Play through all slides programmatically for the video recording (4.0 seconds per slide)
            const slideDuration = 4000; // ms
            const totalDuration = totalSlides * slideDuration;

            let elapsed = 0;
            const interval = 33; // draw frame every 33ms (approx 30fps) for smooth video rendering

            recordingIntervalRef.current = setInterval(() => {
                elapsed += interval;
                const progress = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
                setRecordingProgress(progress);

                // Determine which slide to draw based on elapsed time
                const slideToDraw = Math.min(Math.floor(elapsed / slideDuration), totalSlides - 1);

                // Calculate elapsed time within the current slide
                const slideElapsed = elapsed % slideDuration;

                // Redraw every interval step to keep the video encoder fed and active with dynamic reveals
                drawSlideToCanvas(ctx, slideToDraw, 1080, 1920, slideElapsed);

                if (elapsed >= totalDuration) {
                    if (recordingIntervalRef.current) {
                        clearInterval(recordingIntervalRef.current);
                        recordingIntervalRef.current = null;
                    }
                    mediaRecorder.stop();
                }
            }, interval);
        };

        mediaRecorder.start();
    };

    const shareGeneratedVideo = async () => {
        if (!generatedVideoFile) return;

        if (navigator.canShare && navigator.canShare({ files: [generatedVideoFile] })) {
            try {
                await navigator.share({
                    files: [generatedVideoFile],
                    title: 'Variant Wrapped',
                    text: 'Check out my Variant Weekly Performance Wrapped video!',
                });
            } catch (err) {
                console.log('Video share failed, falling back to download:', err);
                await downloadGeneratedVideo();
            }
        } else {
            await downloadGeneratedVideo();
        }
    };

    const downloadGeneratedVideo = async () => {
        if (!generatedVideoFile) return;

        const url = URL.createObjectURL(generatedVideoFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = generatedVideoFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div
            onClick={() => {
                if (synthRef.current && isMusicPlayingRef.current) {
                    synthRef.current.resumeContext(weeklyTrackIndex);
                }
            }}
            onTouchStart={() => {
                if (synthRef.current && isMusicPlayingRef.current) {
                    synthRef.current.resumeContext(weeklyTrackIndex);
                }
            }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 z-99999 text-white overflow-hidden select-none"
        >
            {/* hidden canvas for export drawing - positioned offscreen to bypass layout engine throttling and preserve quality */}
            <canvas
                ref={canvasRef}
                className="absolute left-[-9999px] top-[-9999px]"
                width={1080}
                height={1920}
                style={{ width: '1080px', height: '1920px' }}
            />

            {loading ? (
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-4 border-correct border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500">Retrieving wrapped moments...</p>
                </div>
            ) : weeklyScores.length === 0 ? (
                <div className="text-center space-y-6 max-w-sm">
                    <div className="w-16 h-16 bg-white/5 rounded-full border border-white/10 flex items-center justify-center mx-auto text-gray-500">
                        <Trophy size={28} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-black uppercase tracking-wider">No Wrapped Moments</h2>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {isEasterEgg
                                ? "You haven't played any classic puzzles yet this week. Play a few rounds to unlock your Wrapped presentation!"
                                : "You didn't submit any classic scores during the previous week. Start playing now to receive next week's Wrapped!"
                            }
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-correct hover:bg-correct-dark text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md h-[88vh] flex flex-col relative bg-linear-to-b from-gray-900 via-gray-950 to-black rounded-[36px] overflow-hidden border border-white/10 shadow-2xl">
                    {/* Video Recording & Share Overlay */}
                    {showVideoOverlay && (isRecording || generatedVideoFile) && (
                        <div className="absolute inset-0 bg-black/95 z-60 flex flex-col items-center justify-center space-y-6 p-6 text-center">
                            {isRecording ? (
                                <>
                                    <div className="w-12 h-12 border-4 border-correct border-t-transparent rounded-full animate-spin" />
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-correct">Generating Shareable Video</h3>
                                        <p className="text-xs text-gray-500">Compiling slides {isMusicPlaying ? "with" : "without"} music: {recordingProgress}%</p>
                                    </div>
                                    <div className="w-full max-w-[200px] h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-correct" style={{ width: `${recordingProgress}%` }} />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6 max-w-xs w-full animate-pop">
                                    <div className="w-16 h-16 bg-correct/10 border border-correct/20 text-correct rounded-full flex items-center justify-center mx-auto">
                                        <Film size={28} />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-black uppercase tracking-wider text-white">Video Ready!</h3>
                                        <p className="text-xs text-gray-400 leading-relaxed">
                                            Your weekly wrapped video has been generated successfully. Share it now on WhatsApp, Instagram, or download it!
                                        </p>
                                    </div>
                                    <div className="space-y-2.5 w-full">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                shareGeneratedVideo();
                                            }}
                                            className="w-full py-3 bg-correct hover:bg-correct-dark text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            <Share2 size={14} />
                                            Share Video 🎬
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadGeneratedVideo();
                                            }}
                                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                        >
                                            Download Locally
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowVideoOverlay(false);
                                            }}
                                            className="w-full py-3 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Progress indicators at the top */}
                    <div className="absolute top-4 inset-x-6 flex gap-1 z-50">
                        {Array.from({ length: totalSlides }).map((_, i) => (
                            <div key={i} className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-correct transition-all duration-300 ${i < currentSlide ? 'w-full' : i === currentSlide ? 'w-full animate-pulse' : 'w-0'}`}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Volume Mute Toggle, Video Export, and Close Buttons */}
                    <div className="absolute top-8 inset-x-6 flex items-center justify-between z-50">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="p-2 bg-black/40 border border-white/5 hover:bg-black/60 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    exportWrappedVideo();
                                }}
                                className={`p-2 bg-black/40 border border-white/5 hover:bg-black/60 rounded-full text-correct hover:scale-105 transition-all cursor-pointer ${isRecording ? 'opacity-50 pointer-events-none' : ''}`}
                                title="Download as Video"
                            >
                                <Film size={16} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMusicPlaying(!isMusicPlaying);
                                }}
                                className="p-2 bg-black/40 border border-white/5 hover:bg-black/60 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
                            >
                                {isMusicPlaying ? <Volume2 size={16} /> : <VolumeX size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Slides Deck (Main Area) */}
                    <div className="flex-1 relative flex items-center justify-center p-6 mt-12 mb-20 overflow-hidden">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentSlide}
                                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                                transition={{ duration: 0.4 }}
                                className={`absolute inset-0 bg-linear-to-b ${getSlideBackground(currentSlide)} flex flex-col justify-center p-8`}
                            >
                                {currentSlide > 0 && (
                                    <div className="absolute top-6 inset-x-8 flex items-center justify-center gap-2 z-10">
                                        <img
                                            src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
                                            className="w-6 h-6 rounded-full border border-white/20 object-cover"
                                            alt={username}
                                        />
                                        <span className="text-sm mb-2 font-bold text-gray-400/60 uppercase tracking-widest">
                                            @{username}
                                        </span>
                                    </div>
                                )}
                                {currentSlide === 0 ? (
                                    // Slide 0: Intro
                                    <div className="text-center space-y-5">
                                        <div className="flex justify-center">
                                            <img
                                                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
                                                className="w-24 h-24 rounded-full border-4 border-indigo-500 shadow-xl object-cover animate-pulse"
                                                alt={username}
                                            />
                                        </div>
                                        <div className="text-correct font-black text-xs uppercase tracking-widest animate-bounce">
                                            Weekly Wrapped
                                        </div>
                                        <div className="space-y-1">
                                            <h1 className="text-4xl sm:text-5xl font-black text-white leading-none">YOUR WEEKLY</h1>
                                            <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-linear-to-r from-amber-400 to-pink-500 leading-none">
                                                WRAPPED
                                            </h1>
                                        </div>
                                        <div className="flex items-center justify-center gap-2">
                                            <img
                                                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`}
                                                className="w-6 h-6 rounded-full border border-white/20 object-cover"
                                                alt={username}
                                            />
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                @{username}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                                            Let's take a ride through all your daily guesses, roasts, and global standing.
                                        </p>
                                    </div>
                                ) : currentSlide === totalSlides - 2 ? (
                                    // Slide: Weekly Stats Summary
                                    <div className="space-y-6 text-center">
                                        <h2 className="text-xs font-black uppercase text-correct tracking-widest">Your Performance</h2>
                                        <h1 className="text-3xl font-black text-white uppercase tracking-wider">Weekly Stats</h1>

                                        <div className="space-y-4 max-w-xs mx-auto">
                                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                                <span className="text-xs font-black text-gray-400 uppercase">Played</span>
                                                <span className="text-2xl font-black text-white">{weeklyScores.length}</span>
                                            </div>
                                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                                <span className="text-xs font-black text-gray-400 uppercase">Win Rate</span>
                                                <span className="text-2xl font-black text-emerald-400">
                                                    {Math.round((weeklyScores.filter(s => s.status === 'won').length / weeklyScores.length) * 100)}%
                                                </span>
                                            </div>
                                            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                                <span className="text-xs font-black text-gray-400 uppercase">Points</span>
                                                <span className="text-2xl font-black text-amber-400">
                                                    {weeklyScores.reduce((sum, s) => sum + (s.skill_score || 0), 0)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : currentSlide === totalSlides - 1 ? (
                                    // Slide: Leaderboard Spotlight
                                    <div className="text-center space-y-6">
                                        <h2 className="text-xs font-black uppercase text-pink-400 tracking-widest">Global Standings</h2>
                                        <h1 className="text-3xl font-black text-white uppercase tracking-wider">Your Window</h1>

                                        {userRank ? (
                                            <div className="space-y-4">
                                                <div className="inline-block px-5 py-3 bg-white/5 border border-white/10 rounded-[20px]">
                                                    <div className="text-4xl font-black text-amber-400">#{userRank.rank}</div>
                                                    <div className="text-[9px] font-black uppercase text-gray-400 mt-0.5 tracking-widest">Global Rank</div>
                                                </div>

                                                {/* Mini Leaderboard Window */}
                                                <div className="space-y-1.5 max-w-xs mx-auto text-left w-full">
                                                    {(() => {
                                                        const myIdx = leaderboard.findIndex(e => e.username === username);
                                                        let start: number
                                                        if (myIdx === -1) {
                                                            start = 0;
                                                        } else {
                                                            start = Math.max(0, myIdx - 1);
                                                            if (start + 3 > leaderboard.length) {
                                                                start = Math.max(0, leaderboard.length - 3);
                                                            }
                                                        }
                                                        const windowLb = leaderboard.slice(start, start + 3);
                                                        return windowLb.map((entry) => {
                                                            const originalIdx = leaderboard.findIndex(e => e.username === entry.username);
                                                            const rank = originalIdx + 1;
                                                            const isMe = entry.username === username;
                                                            return (
                                                                <div
                                                                    key={entry.username}
                                                                    className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[11px]
                                                                        ${isMe
                                                                            ? 'bg-indigo-500/20 border-indigo-500/40 text-white font-black'
                                                                            : 'bg-white/5 border-white/5 text-gray-300'
                                                                        }`}
                                                                >
                                                                    <span className="truncate">
                                                                        <span className={rank === 1 ? 'text-amber-400 font-bold mr-1.5' : 'text-gray-500 mr-1.5'}>
                                                                            #{rank}
                                                                        </span>
                                                                        {entry.username} {isMe && '(You)'}
                                                                    </span>
                                                                    <span className="font-mono text-indigo-400 font-bold">
                                                                        {entry.total_points} pts
                                                                    </span>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>

                                                <p className="text-[10px] text-gray-400 leading-relaxed max-w-xs mx-auto">
                                                    You locked in **{userRank.entry.total_points}** total points across **{userRank.entry.days_active}** active days!
                                                </p>

                                                <div className="pt-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            exportWrappedVideo();
                                                        }}
                                                        disabled={isRecording}
                                                        className="w-full flex items-center justify-center gap-2 py-3 bg-linear-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <Film size={14} />
                                                        Share Full Video 🎬
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500">Play classic daily puzzles to secure a rank on the leaderboard!</p>
                                        )}
                                    </div>
                                ) : (
                                    // Daily Slides (1 to N)
                                    (() => {
                                        const score = weeklyScores[currentSlide - 1];
                                        const dateLabel = score.game_date;
                                        const dayName = getDayName(score.game_date);
                                        const wordLength = score.guesses[0]?.length || 0;
                                        const shouldScale = isSmallScreen && wordLength > 5;
                                        const cellSize = shouldScale ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';

                                        return (
                                            <div className="flex flex-col justify-between h-full">
                                                {/* Header */}
                                                <div className="text-center space-y-1">
                                                    <span className="text-[10px] py-2 font-bold text-pink-400 uppercase tracking-widest">{dateLabel}</span>
                                                    <h2 className="text-3xl font-black text-white uppercase">{dayName}</h2>
                                                </div>

                                                {/* Guess Grid */}
                                                <div className="my-auto space-y-1.5 flex flex-col items-center">
                                                    {score.guesses.map((row, rIdx) => (
                                                        <div key={rIdx} className="flex gap-1.5 justify-center">
                                                            {row.map((charObj, cIdx) => (
                                                                <div
                                                                    key={cIdx}
                                                                    className={`${cellSize} flex items-center justify-center font-bold rounded-md border
                                                                        ${charObj.status === 'correct' ? 'animate-reveal-wrapped-correct' :
                                                                            charObj.status === 'present' ? 'animate-reveal-wrapped-present' :
                                                                                'animate-reveal-wrapped-absent'}`}
                                                                    style={{
                                                                        animationDelay: `${rIdx * 0.20 + cIdx * 0.06}s`,
                                                                        animationFillMode: 'both'
                                                                    }}
                                                                >
                                                                    {charObj.letter}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Roast Message */}
                                                {score.game_message && (
                                                    <div className="text-center px-4">
                                                        <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-1">The Verdict</p>
                                                        <p className="text-sm font-black italic text-amber-400 leading-relaxed">
                                                            "{score.game_message}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Navigation and Share Actions (Bottom Area) */}
                    <div className="absolute bottom-6 inset-x-6 flex items-center justify-between z-50">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                prevSlide();
                            }}
                            disabled={currentSlide === 0}
                            className="p-3 bg-black/40 hover:bg-black/60 border border-white/5 rounded-full text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                exportSlideImage();
                            }}
                            className="flex items-center gap-2 px-5 py-3 bg-correct hover:bg-correct-dark text-black text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:scale-105 cursor-pointer"
                        >
                            <Share2 size={14} />
                            Share Slide
                        </button>

                        {currentSlide < totalSlides - 1 ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    nextSlide();
                                }}
                                className="p-3 bg-black/40 hover:bg-black/60 border border-white/5 rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
                            >
                                <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                className="p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white transition-all cursor-pointer"
                                title="Finish Wrapped"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
