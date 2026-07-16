import { ProtectedAvatar } from "@/components/chat/ProtectedAvatar"
import formatUsername from "@/utils/formatUsername"
import { Flame } from "lucide-react"

const ProfileSummaryCard = ({ userStats, currentUser, getRankColor }) => {
    return (
        <>
            {userStats && (
                <div className="relative overflow-hidden bg-linear-to-r from-[#E85151]/15 to-[#E85151]/5 border border-[#E85151]/20 rounded-2xl p-4 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full border-2 border-[#E85151] overflow-hidden flex items-center justify-center bg-black/40">
                            <ProtectedAvatar
                                userId={currentUser?.id}
                                src={currentUser?.user_metadata?.avatar_url}
                                username={formatUsername(currentUser?.user_metadata?.full_name)}
                                className="w-full h-full"
                            />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white leading-none mb-1">
                                {formatUsername(currentUser?.user_metadata?.full_name) || "Player"}
                            </h3>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${getRankColor(userStats.rank_name)}`}>
                                {userStats.rank_name}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-white/80 font-black uppercase">ELO rating</p>
                        <p className="text-lg font-black text-white flex items-center gap-1 justify-end">
                            <Flame size={16} fill="#E85151" className="text-[#E85151]" />
                            {userStats.rating}
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}

export default ProfileSummaryCard;