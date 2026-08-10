import ReactMarkdown from "react-markdown";

type TextMessageProps = {
  content: string;
};

function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const code = String(children).replace(/\n$/, "");

  async function copyCode() {
    await navigator.clipboard.writeText(code);
  }

  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-zinc-800 bg-black">
      <button
        type="button"
        onClick={copyCode}
        className="absolute right-2 top-2 rounded bg-zinc-800 px-2 py-1 text-xs transition hover:bg-zinc-700"
      >
        Copy
      </button>

      <pre className="overflow-x-auto p-3 pr-16 text-sm">
        <code className={className}>
          {code}
        </code>
      </pre>
    </div>
  );
}

export default function TextMessage({
  content,
}: TextMessageProps) {
  return (
    <ReactMarkdown
      components={{
        code({
          inline,
          className,
          children,
          ...props
        }) {
          return !inline ? (
            <CodeBlock className={className}>
              {children}
            </CodeBlock>
          ) : (
            <code
              className="rounded bg-zinc-800 px-1 text-sm"
              {...props}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
