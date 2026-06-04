import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const markdownComponents = {
  a: ({ children, href }) => (
    <a
      className="text-blue-300 underline decoration-blue-300/40 underline-offset-2 hover:text-blue-200"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-slate-600 pl-4 text-slate-300">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className;

    if (isBlock) {
      return (
        <code className="block overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100">
          {children}
        </code>
      );
    }

    return (
      <code className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[0.92em] text-slate-100">
        {children}
      </code>
    );
  },
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-2xl font-semibold leading-tight text-white">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold leading-tight text-white">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold leading-tight text-white">
      {children}
    </h3>
  ),
  hr: () => <hr className="my-5 border-slate-700" />,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  ol: ({ children }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1 text-slate-200">{children}</ol>
  ),
  p: ({ children }) => <p className="mb-4 leading-relaxed text-slate-200">{children}</p>,
  pre: ({ children }) => <pre className="my-4 overflow-x-auto">{children}</pre>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700 text-left text-sm">{children}</table>
    </div>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-slate-800">{children}</tbody>,
  td: ({ children }) => <td className="px-3 py-2 text-slate-200">{children}</td>,
  th: ({ children }) => (
    <th className="bg-slate-900 px-3 py-2 font-semibold text-slate-100">{children}</th>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 ml-6 list-disc space-y-1 text-slate-200">{children}</ul>
  ),
};

export default function ForumMarkdown({ children, emptyText = "No message content." }) {
  const markdown = typeof children === "string" ? children.trim() : "";

  // if (!markdown) {
  //   return <div className="text-sm italic text-slate-400">{emptyText}</div>;
  // }
  if (!markdown) {
    return null;
  }
  return (
    <div className="forum-markdown max-w-none overflow-hidden text-sm">
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm, remarkBreaks]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
