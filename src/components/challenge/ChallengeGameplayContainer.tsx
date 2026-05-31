/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useCallback } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';
import { RegularGameplay } from './RegularGameplay';
import { MarathonGameplay } from './MarathonGameplay';
import { useApp } from '../../context/AppContext';

export const ChallengeGameplayContainer = memo(function ChallengeGameplayContainer() {
    const {
        selectedChallenge, myParticipation, setIsPlaying, submitResult
    } = useChallengeContext();
    const { triggerToast } = useApp();

    const onFinish = useCallback(() => setIsPlaying(false), [setIsPlaying]);
    if (!selectedChallenge || !myParticipation) return null;

    const isMarathon = selectedChallenge.word_length === 1;

    if (isMarathon) {
        return (
            <MarathonGameplay
                challenge={selectedChallenge}
                participation={myParticipation}
                triggerToast={triggerToast}
                submitChallengeResult={submitResult}
                onFinish={onFinish}
            />
        );
    }

    return (
        <RegularGameplay
            challenge={selectedChallenge}
            participation={myParticipation}
            triggerToast={triggerToast}
            submitChallengeResult={submitResult}
            onFinish={onFinish}
        />
    );
});
