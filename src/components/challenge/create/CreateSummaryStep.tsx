import { memo } from 'react';
import { Clock, Users, Globe, Puzzle, Swords, Eye, Shuffle, Gamepad2 } from 'lucide-react';

export interface ChallengeFormSettings {
    mode: 'LIVE' | 'ANYTIME';
    length: number;
    maxAttempts: number;
    maxTime: number | null;
    isMarathon: boolean;
    marathonGames: number[];
    marathonForceOrder: boolean;
    marathonTimerType: 'same' | 'custom';
    marathonTimers: number[];
    invitedCount: number;
    isPublic: boolean;
    maxParticipants: number;
    lifespanHours: number;
    isCustomWord: boolean;
    customWordCount: number;
    isHandicap: boolean;
    handicapMode: 'random' | 'custom';
    handicapEnforced: boolean;
    isShapeshifter: boolean;
    disableHints: boolean;
    isBotMarathon: boolean;
    isEditing: boolean;
    errorCount: number;
}

interface CreateSummaryStepProps {
    settings: ChallengeFormSettings;
    onBack: () => void;
    onConfirm: () => void;
    loading: boolean;
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-2.5 px-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
                <span className="text-white/40 shrink-0">{icon}</span>
                <span className="text-xs font-black uppercase tracking-wider text-white/70">{label}</span>
            </div>
            <span className="text-xs font-black text-white text-right">{value}</span>
        </div>
    );
}

export const CreateSummaryStep = memo(({ settings, onBack, onConfirm, loading }: CreateSummaryStepProps) => {
    const s = settings;

    return (
        <div className="space-y-4">
            <div className="text-center pb-1">
                <p className="text-sm font-black uppercase tracking-wider text-white">Challenge Summary</p>
                <p className="text-[10px] text-white/50 font-medium">Review your settings before creating</p>
            </div>

            <div className="space-y-1.5">
                {/* Core settings */}
                <SummaryRow
                    icon={<Gamepad2 size={14} />}
                    label="Mode"
                    value={s.mode}
                />
                <SummaryRow
                    icon={<Puzzle size={14} />}
                    label={s.isMarathon ? 'Format' : 'Word Length'}
                    value={s.isMarathon ? `${s.marathonGames.length}-Game Marathon (${s.marathonGames.join('→')}L)` : `${s.length} Letters`}
                />
                <SummaryRow
                    icon={<span className="text-[10px] font-black">#</span>}
                    label="Max Attempts"
                    value={String(s.maxAttempts)}
                />
                <SummaryRow
                    icon={<Clock size={14} />}
                    label="Time Limit"
                    value={s.maxTime ? `${s.maxTime} min` : s.isMarathon && s.marathonTimerType === 'custom' ? 'Per-word timers' : 'None'}
                />

                {/* Marathon specifics */}
                {s.isMarathon && s.marathonForceOrder && (
                    <SummaryRow
                        icon={<Shuffle size={14} />}
                        label="Game Order"
                        value="Forced (sequential)"
                    />
                )}

                {/* Players & visibility */}
                <SummaryRow
                    icon={<Users size={14} />}
                    label="Players"
                    value={
                        s.invitedCount > 0
                            ? `${s.invitedCount} invited` + (s.isPublic ? ' + public' : '')
                            : s.isPublic
                                ? 'Public (up to ' + s.maxParticipants + ')'
                                : 'Just yourself'
                    }
                />
                <SummaryRow
                    icon={<Globe size={14} />}
                    label="Visibility"
                    value={s.isPublic ? 'Public' : 'Private'}
                />
                <SummaryRow
                    icon={<Clock size={14} />}
                    label="Lifespan"
                    value={s.lifespanHours >= 24 ? `${s.lifespanHours / 24}d` : `${s.lifespanHours}h`}
                />

                {/* Custom words */}
                {s.isCustomWord && (
                    <SummaryRow
                        icon={<Puzzle size={14} />}
                        label="Custom Words"
                        value={s.isMarathon ? `${s.customWordCount} words set` : 'Yes'}
                    />
                )}

                {/* Game modifiers */}
                {s.isHandicap && (
                    <SummaryRow
                        icon={<Swords size={14} />}
                        label="Handicap"
                        value={s.handicapMode === 'random' ? 'Random starter' : 'Custom starter'}
                    />
                )}
                {s.isShapeshifter && (
                    <SummaryRow icon={<Shuffle size={14} />} label="Shape Shifter" value="Enabled" />
                )}
                {s.disableHints && (
                    <SummaryRow icon={<Eye size={14} />} label="Hints" value="Disabled" />
                )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-4 rounded-2xl border border-white/15 bg-white/5 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                    ← Back
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading || s.errorCount > 0}
                    className="flex-1 bg-correct text-black py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:brightness-50 cursor-pointer"
                >
                    {loading ? (s.isEditing ? 'Saving...' : 'Creating...') : (s.isEditing ? 'Save Changes' : 'Confirm & Create')}
                </button>
            </div>
        </div>
    );
});
