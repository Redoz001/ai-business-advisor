import TextMessage from "./TextMessage";

type CodeMessageProps = {
  content: string;
};

export default function CodeMessage({
  content,
}: CodeMessageProps) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
        Code response
      </div>

      <TextMessage content={content} />
    </div>
  );
}
