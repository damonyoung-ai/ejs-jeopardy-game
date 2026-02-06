export function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece}
          className="absolute top-0 h-3 w-2 animate-[fall_3.5s_linear_infinite] opacity-80"
          style={{
            left: `${(piece * 4) % 100}%`,
            backgroundColor: piece % 3 === 0 ? "#f5d76e" : piece % 3 === 1 ? "#7dd3fc" : "#f472b6",
            animationDelay: `${piece * 0.15}s`
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
