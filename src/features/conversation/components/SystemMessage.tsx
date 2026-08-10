type SystemMessageProps = {
  content: string;
};

export default function SystemMessage({
  content,
}: SystemMessageProps) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
      {content}
    </div>
  );
}
