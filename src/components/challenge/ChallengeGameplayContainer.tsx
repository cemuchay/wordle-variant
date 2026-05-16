/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from 'react';
import { useChallengeContext } from '../../context/ChallengeContext';
import { RegularGameplay } from './RegularGameplay';
import { MarathonGameplay } from './MarathonGameplay';
import { useApp } from '../../context/AppContext';

export const ChallengeGameplayContainer = memo(() => {
    const { 
        selectedChallenge, myParticipation, setIsPlaying, submitChallengeResult 
    } = useChallengeContext();
    const { triggerToast } = useApp();

    if (!selectedChallenge || !myParticipation) return null;

    const isMarathon = selectedChallenge.word_length === 1;

    const onFinish = () => setIsPlaying(false);

    if (isMarathon) {
        return (
            <MarathonGameplay
                challenge={selectedChallenge}
                participation={myParticipation}
                triggerToast={triggerToast}
                submitChallengeResult={submitChallengeResult}
                onFinish={onFinish}
            />
        );
    }

    return (
        <RegularGameplay
            challenge={selectedChallenge}
            participation={myParticipation}
            triggerToast={triggerToast}
            submitChallengeResult={submitChallengeResult}
            onFinish={onFinish}
        />
    );
});
