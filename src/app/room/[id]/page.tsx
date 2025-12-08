"use client";
import { useRealtime } from "@/hooks/use-realtime";
import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
const formatTimeRemaining = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
function Page({ params }: PageProps<"/room/[id]">) {
  const router = useRouter();
  const { username } = useUsername();
  const { id } = use(params);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { data: ttl } = useQuery({
    queryKey: ["TTL", id],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId: id } });
      return res.data;
    },
  });

  useEffect(() => {
    if (ttl?.ttl !== undefined)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeRemaining(ttl.ttl);
  }, [ttl]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return;
    if (timeRemaining === 0) {
      router.replace("/?destroyed=true");
      return;
    }
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining, router]);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId: id } });
      return res.data;
    },
  });

  const { mutate: sendMessage, isPending: isSendingMessage } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post(
        { text, sender: username },
        { query: { roomId: id } }
      );
    },
  });
  const { mutate: destroyRoom, isPending: isDestroyingRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId: id } });
    },
  });

  const handleSendMessage = () => {
    sendMessage(
      { text: input },
      {
        onSuccess: () => {
          setInput("");
        },
      }
    );
  };
  useRealtime({
    channels: [id],
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetch();
      }
      if (event === "chat.destroy") {
        router.replace("/?destroyed=true");
      }
    },
  });
  const handleCopy = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/30">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500">ROOM ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{id}</span>
              <button
                onClick={handleCopy}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500">SELF DESTRUCT</span>
            <span
              className={`text-sm font-bold flex items-center gap-2 ${
                timeRemaining !== null && timeRemaining < 60
                  ? "text-red-500"
                  : "text-white"
              }`}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : "--:--"}
            </span>
          </div>
        </div>
        <button
          disabled={isDestroyingRoom}
          onClick={() => destroyRoom()}
          className="text-xs bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50"
        >
          {isDestroyingRoom ? (
            <Loader className="animate-spin size-4" />
          ) : (
            "DESTROY NOW"
          )}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages?.messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm font-mono uppercase">
              No messages yet, start the conversation.
            </p>
          </div>
        )}
        {messages?.messages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start">
            <div className="max-w-[80%] group">
              <div className="flex items-baseline gap-3 mb-1">
                <span
                  className={`text-xs font-bold ${
                    msg.sender === username ? "text-zinc-500" : "text-blue-500"
                  }`}
                >
                  {msg.sender === username ? "YOU" : msg.sender}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {format(msg.timestamp, "HH:mm")}
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed break-all">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 animate-pulse">
              {">"}
            </span>
            <input
              value={input}
              ref={inputRef}
              placeholder="shhhhhh..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  handleSendMessage();
                  inputRef.current?.focus();
                }
              }}
              autoFocus
              type="text"
              className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-colors text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm"
            />
          </div>
          <button
            disabled={!input.trim() || isSendingMessage}
            onClick={handleSendMessage}
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSendingMessage ? <Loader className="animate-spin" /> : "SEND"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default Page;
