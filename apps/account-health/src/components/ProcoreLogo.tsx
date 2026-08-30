export function ProcoreLogo({ className = "h-5" }: { className?: string }) {
  return (
    <img
      src="/procore-wordmark.svg"
      alt="Procore"
      className={className}
    />
  );
}

export function ProcoreMark({ className = "h-4 w-5" }: { className?: string }) {
  return <img src="/procore-hex.svg" alt="" className={className} />;
}
