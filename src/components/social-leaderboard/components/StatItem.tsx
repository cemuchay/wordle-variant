const StatItem: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
    <div>
        <div className="text-2xl font-black text-white font-mono">{value}</div>
        <div className="text-[9px] uppercase text-gray-400 tracking-widest font-bold">{label}</div>
    </div>
);

export default StatItem