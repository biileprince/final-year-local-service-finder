"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Calendar,
  ArrowRight,
  Mic,
  Square,
  Trash2,
  Pencil,
  Check,
  X as XIcon,
  FileText,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";
import { messagesService, filesService } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useMessagesSocket } from "@/lib/messages-socket";
import { VoiceMessage } from "@/components/messages/voice-message";
import { AutoGrowTextarea } from "@/components/messages/auto-grow-textarea";
import { queryPermission } from "@/lib/permissions";
import type { Conversation, Message } from "@/types";
import { formatRelativeTime, formatDate, formatTime, cn } from "@/lib/utils";

// Mirrors backend `FilesService.maxFileSize` / `allowedMimeTypes` so we can fail
// fast in the UI instead of round-tripping to a 400.
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MESSAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const FILE_ACCEPT_ATTR =
  "image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx";

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string | null;
  caption: string;
  isImage: boolean;
}

const formatBytes = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const statusBadge: Record<string, string> = {
  PENDING: "bg-warning-50 text-warning-700",
  CONFIRMED: "bg-primary-50 text-primary-700",
  IN_PROGRESS: "bg-primary-50 text-primary-700",
  COMPLETED: "bg-success-50 text-success-700",
  CANCELLED: "bg-error-50 text-error-700",
};

export default function ConversationPage() {
  const params = useParams();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Files queued in the preview tray, not yet uploaded. Each entry holds an
  // object URL for image previews — revoked on remove / clear / unmount.
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [sendingAttachments, setSendingAttachments] = useState(false);
  const pendingRef = useRef<PendingAttachment[]>([]);
  useEffect(() => {
    pendingRef.current = pendingAttachments;
  }, [pendingAttachments]);
  useEffect(
    () => () => {
      pendingRef.current.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    },
    [],
  );

  // Drag & drop
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const rejected: string[] = [];
    const accepted: PendingAttachment[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        rejected.push(`${f.name} is over 10 MB`);
        continue;
      }
      // Some OSes leave .doc/.docx with an empty MIME type — accept by extension.
      const mt = f.type || "";
      const okByExt = /\.(docx?|pdf)$/i.test(f.name);
      if (mt && !ALLOWED_MESSAGE_MIME_TYPES.has(mt) && !okByExt) {
        rejected.push(`${f.name} (${mt || "unknown type"}) is not allowed`);
        continue;
      }
      const isImage = mt.startsWith("image/");
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: isImage ? URL.createObjectURL(f) : null,
        caption: "",
        isImage,
      });
    }
    if (rejected.length) {
      toast({
        variant: "error",
        title: "Some files were skipped",
        description: rejected.join("; "),
      });
    }
    if (accepted.length) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearPendingAttachments = () => {
    setPendingAttachments((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  };

  const updateCaption = (id: string, caption: string) => {
    setPendingAttachments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p)),
    );
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendPendingAttachments = async () => {
    if (
      !conversation ||
      pendingAttachments.length === 0 ||
      sendingAttachments
    ) {
      return;
    }
    setSendingAttachments(true);
    // Snapshot ids so we know which to drop from the queue after a successful
    // round; the user may have added more files while sending.
    const snapshot = pendingAttachments;
    const sentIds: string[] = [];
    try {
      for (const item of snapshot) {
        const uploaded = await filesService.upload(item.file, "MESSAGE");
        const newMessage = await messagesService.sendMessage(conversation.id, {
          content: item.caption.trim() || item.file.name,
          // Backend `MessageType` enum is lowercase ("image" | "file" | "voice").
          messageType: item.isImage ? "image" : "file",
          fileId: uploaded.id,
        });
        setMessages((prev) =>
          prev.some((m) => m.id === newMessage.id)
            ? prev
            : [...prev, newMessage],
        );
        sentIds.push(item.id);
      }
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't send attachment",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      // Drop just the ones that succeeded so the user can retry the rest.
      setPendingAttachments((prev) =>
        prev.filter((p) => {
          if (!sentIds.includes(p.id)) return true;
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
          return false;
        }),
      );
      setSendingAttachments(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingFiles(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFiles(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const {
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    markRead,
    startTyping,
    stopTyping,
    onNewMessage,
    onTyping,
    onMessagesRead,
  } = useMessagesSocket();

  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice note recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRecordingRef = useRef(false);
  const MAX_RECORD_SECONDS = 120;

  // Edit / delete
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Close the message-actions menu when clicking outside.
  useEffect(() => {
    if (!openMenuFor) return;
    const handler = () => setOpenMenuFor(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [openMenuFor]);

  const startEdit = (m: Message) => {
    setEditingId(m.id);
    setEditingText(m.content);
    setOpenMenuFor(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    try {
      const updated = await messagesService.editMessage(editingId, trimmed);
      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, ...updated } : m)),
      );
      cancelEdit();
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't edit",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const performDelete = async (messageId: string) => {
    setDeletingId(messageId);
    try {
      await messagesService.deleteMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deletedAt: new Date().toISOString(), content: "" }
            : m,
        ),
      );
      setConfirmDeleteId(null);
    } catch (err) {
      toast({
        variant: "error",
        title: "Couldn't delete",
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadConversation(params.id as string);
    }
  }, [params.id]);

  useEffect(() => {
    if (!conversation || !isConnected) return;
    joinConversation(conversation.id);
    // Joining the conversation already marks-as-read on the server (see gateway).
    return () => {
      leaveConversation(conversation.id);
    };
  }, [conversation, isConnected, joinConversation, leaveConversation]);

  // Live new messages
  useEffect(() => {
    return onNewMessage((message) => {
      if (message.conversationId !== conversation?.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // If the other party sent it and we're viewing the thread, mark read.
      if (message.senderId !== user?.id && conversation?.id) {
        markRead(conversation.id);
      }
      scrollToBottom();
    });
  }, [onNewMessage, conversation, user?.id, markRead]);

  // Typing indicator from the other side
  useEffect(() => {
    return onTyping((data) => {
      if (data.conversationId !== conversation?.id) return;
      if (data.userId === user?.id) return;
      setOtherIsTyping(data.isTyping);
    });
  }, [onTyping, conversation, user?.id]);

  // Read receipts from the other side
  useEffect(() => {
    return onMessagesRead((data) => {
      if (data.conversationId !== conversation?.id) return;
      if (data.readBy === user?.id) return;
      setOtherReadAt(data.readAt);
    });
  }, [onMessagesRead, conversation, user?.id]);

  const pickAudioMime = (): string => {
    // MediaRecorder support is fragmented: Chrome ships webm/opus, Safari/iOS
    // only mp4/aac. Empty string lets the browser pick its native default.
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    if (typeof MediaRecorder === "undefined") return "";
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  };

  const startRecording = async () => {
    if (!conversation || isRecording || sendingVoice) return;
    cancelRecordingRef.current = false;
    // Mic access requires HTTPS (or localhost). On a desktop without a mic,
    // or with Windows mic permission disabled, getUserMedia rejects with a
    // specific DOMException we surface to the user.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      toast({
        variant: "error",
        title: "Mic needs HTTPS",
        description:
          "Recording requires a secure connection. Open this site over HTTPS (or localhost) and retry.",
      });
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast({
        variant: "error",
        title: "Recording unsupported",
        description:
          "Your browser doesn't expose a microphone API. Try the latest Chrome, Edge, Safari, or Firefox.",
      });
      return;
    }
    // If the user previously denied this site, getUserMedia will reject
    // instantly without ever showing a prompt — give them the unblock
    // instructions immediately instead of the misleading "couldn't start"
    // error.
    const perm = await queryPermission("microphone");
    if (perm === "denied") {
      toast({
        variant: "error",
        title: "Microphone access blocked",
        description:
          "Your browser has microphone access disabled for this site. Click the lock icon in the address bar → Site settings → Microphone → Allow, then retry.",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        setIsRecording(false);
        if (cancelRecordingRef.current) return;
        if (chunks.length === 0) return;
        const blobType = mime || chunks[0]?.type || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        const ext = blobType.includes("mp4")
          ? "m4a"
          : blobType.includes("ogg")
            ? "ogg"
            : "webm";
        const file = new File(
          [blob],
          `voice-${Date.now()}.${ext}`,
          { type: blobType },
        );
        setSendingVoice(true);
        try {
          const uploaded = await filesService.upload(file, "MESSAGE");
          const newMessage = await messagesService.sendMessage(conversation.id, {
            content: "Voice message",
            messageType: "voice",
            fileId: uploaded.id,
          });
          setMessages((prev) =>
            prev.some((m) => m.id === newMessage.id)
              ? prev
              : [...prev, newMessage],
          );
        } catch (err) {
          toast({
            variant: "error",
            title: "Couldn't send voice note",
            description: err instanceof Error ? err.message : "Try again.",
          });
        } finally {
          setSendingVoice(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            // Auto-stop at the cap so we don't accidentally upload huge blobs.
            mediaRecorderRef.current?.stop();
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      // getUserMedia rejects with a DOMException whose `name` tells us the
      // specific failure mode — translate into something the user can act on.
      const name = (err as DOMException)?.name;
      let title = "Microphone unavailable";
      let description = "Couldn't start the microphone. Please try again.";
      if (name === "NotAllowedError" || name === "SecurityError") {
        title = "Microphone access blocked";
        description =
          "You denied microphone access. Click the lock icon in the address bar → Site settings → Microphone → Allow, then retry.";
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        title = "No microphone found";
        description =
          "No microphone is connected. On Windows, check Settings → Privacy → Microphone is on and a mic is available.";
      } else if (name === "NotReadableError") {
        title = "Microphone is busy";
        description =
          "Another app (video call, voice recorder) seems to be using the mic. Close it and retry.";
      } else if (err instanceof Error && err.message) {
        description = err.message;
      }
      toast({ variant: "error", title, description });
    }
  };

  const stopRecording = (cancel = false) => {
    cancelRecordingRef.current = cancel;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") r.stop();
    };
  }, []);

  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleTypingChange = (text: string) => {
    setMessageText(text);
    if (!conversation || !isConnected) return;
    startTyping(conversation.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversation.id);
    }, 1500);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async (id: string) => {
    setIsLoading(true);
    try {
      const [conversationData, messagesData] = await Promise.all([
        messagesService.getConversation(id),
        messagesService.getMessages(id),
      ]);
      setConversation(conversationData);
      setMessages(messagesData);
      // Seed the read-receipt indicator from the persisted last-read timestamp
      // for the *other* party so it shows up on first paint, before any live
      // `messages_read` event arrives.
      const otherLastRead =
        user?.role === "PROVIDER"
          ? conversationData.customerLastReadAt
          : conversationData.providerLastReadAt;
      setOtherReadAt(otherLastRead ?? null);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversation) return;

    setIsSending(true);
    try {
      // Always send via REST so we get the persisted message back even if the
      // socket round-trip drops; the gateway will broadcast and we de-dupe by id.
      const newMessage = await messagesService.sendMessage(
        conversation.id,
        { content: messageText.trim() },
      );
      setMessages((prev) =>
        prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage],
      );
      setMessageText("");
      if (conversation && isConnected) stopTyping(conversation.id);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-secondary-900">
          Conversation not found
        </h1>
        <Button asChild>
          <Link href="/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  const otherUser =
    user?.role === "PROVIDER"
      ? conversation.customer
      : conversation.provider?.user;

  return (
    // Height: full viewport minus the dashboard header (4 rem) and the page
    // padding (the layout adds p-4/sm:p-6/lg:p-8 + bottom-nav pb-24 on mobile).
    // `dvh` accounts for the mobile URL bar collapse so we don't get clipped.
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-[calc(100dvh-9rem)] flex-col rounded-xl bg-white shadow-soft sm:h-[calc(100dvh-10rem)] lg:h-[calc(100dvh-10rem)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="rounded-lg p-1 hover:bg-secondary-100 lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Avatar src={otherUser?.profileImage} name={otherUser?.name} />
          <div>
            <h2 className="font-semibold text-secondary-900">
              {otherUser?.name}
            </h2>
            <p className="text-xs text-secondary-500">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success-500" />
                  Online
                </span>
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Call">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Start video call">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="More options">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Pinned booking summary */}
      {conversation.booking && (
        <Link
          href={`/bookings/${conversation.booking.id}`}
          className="flex items-center justify-between gap-3 border-b bg-secondary-50 px-4 py-2.5 text-sm transition-colors hover:bg-secondary-100"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="overflow-hidden">
              <p className="truncate font-medium text-secondary-900">
                Booking #{conversation.booking.bookingNumber}
              </p>
              <p className="truncate text-xs text-secondary-500">
                {conversation.booking.scheduledDate &&
                  formatDate(conversation.booking.scheduledDate)}
                {conversation.booking.scheduledStartTime &&
                  ` · ${formatTime(conversation.booking.scheduledStartTime)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                statusBadge[conversation.booking.status] ??
                  "bg-secondary-100 text-secondary-700",
              )}
            >
              {conversation.booking.status}
            </span>
            <ArrowRight className="h-4 w-4 text-secondary-400" />
          </div>
        </Link>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-secondary-500">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.senderId === user?.id;
              const showAvatar =
                !isOwn &&
                (index === 0 ||
                  messages[index - 1]?.senderId !== message.senderId);
              const isDeleted = !!message.deletedAt;
              const isEditing = editingId === message.id;
              const canManage =
                isOwn && !isDeleted && message.messageType !== "voice" && !message.file;

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group flex gap-3",
                    isOwn && "flex-row-reverse",
                  )}
                >
                  {showAvatar ? (
                    <Avatar
                      size="sm"
                      src={isOwn ? user?.profileImage : otherUser?.profileImage}
                      name={isOwn ? user?.name : otherUser?.name}
                    />
                  ) : (
                    <div className="w-8" />
                  )}
                  <div
                    className={cn(
                      "relative max-w-[75%] rounded-2xl px-4 py-2",
                      isDeleted
                        ? "border border-dashed border-secondary-300 bg-transparent italic text-secondary-500"
                        : isOwn
                          ? "rounded-tr-sm bg-primary-600 text-white"
                          : "rounded-tl-sm bg-secondary-100 text-secondary-900",
                    )}
                  >
                    {isDeleted ? (
                      <p className="text-sm">This message was deleted</p>
                    ) : isEditing ? (
                      <div className="flex w-full min-w-[200px] flex-col gap-2">
                        <AutoGrowTextarea
                          value={editingText}
                          onValueChange={setEditingText}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              void saveEdit();
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          autoFocus
                          maxHeight={200}
                          className={cn(
                            "w-full rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2",
                            isOwn
                              ? "bg-white/20 text-white placeholder:text-white/60 focus:ring-white/40"
                              : "bg-white text-secondary-900 focus:ring-primary-500/40",
                          )}
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className={cn(
                              "rounded-md p-1.5 transition-colors",
                              isOwn
                                ? "hover:bg-white/20"
                                : "hover:bg-secondary-200",
                            )}
                            aria-label="Cancel edit"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveEdit()}
                            disabled={savingEdit || !editingText.trim()}
                            className={cn(
                              "rounded-md p-1.5 transition-colors disabled:opacity-50",
                              isOwn
                                ? "hover:bg-white/20"
                                : "hover:bg-secondary-200",
                            )}
                            aria-label="Save edit"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : message.file && message.messageType === "voice" ? (
                      <VoiceMessage url={message.file.url} isOwn={isOwn} />
                    ) : message.file ? (
                      message.file.thumbnailUrl ||
                      /\.(png|jpe?g|gif|webp)$/i.test(message.file.fileName) ? (
                        <a
                          href={message.file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <Image
                            src={message.file.thumbnailUrl || message.file.url}
                            alt={message.file.fileName}
                            width={320}
                            height={192}
                            sizes="(max-width: 768px) 70vw, 320px"
                            className="h-auto max-h-48 w-auto rounded-lg"
                          />
                        </a>
                      ) : (
                        <a
                          href={message.file.url}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "inline-flex items-center gap-2 underline",
                            isOwn ? "text-white" : "text-primary-700",
                          )}
                        >
                          <Paperclip className="h-4 w-4" />
                          {message.file.fileName}
                        </a>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {message.content}
                      </p>
                    )}
                    {!isEditing && !isDeleted && (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          isOwn ? "text-primary-200" : "text-secondary-400",
                        )}
                      >
                        {formatRelativeTime(message.createdAt)}
                        {message.editedAt && (
                          <span className="ml-1 italic">(edited)</span>
                        )}
                      </p>
                    )}

                    {canManage && !isEditing && (
                      <div
                        className={cn(
                          "absolute -top-2 z-10",
                          isOwn ? "-left-2" : "-right-2",
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuFor(
                              openMenuFor === message.id ? null : message.id,
                            );
                          }}
                          aria-label="Message actions"
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full border bg-white text-secondary-600 shadow-sm transition-opacity hover:bg-secondary-50 focus-visible:opacity-100 group-hover:opacity-100",
                            openMenuFor === message.id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {openMenuFor === message.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "absolute z-20 mt-1 w-32 overflow-hidden rounded-lg border border-secondary-200 bg-white shadow-lg",
                              isOwn ? "left-0" : "right-0",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => startEdit(message)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-secondary-700 hover:bg-secondary-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuFor(null);
                                setConfirmDeleteId(message.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error-600 hover:bg-error-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {otherIsTyping && (
            <div className="flex items-center gap-2 pl-11 text-xs text-secondary-500">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-secondary-400" />
              </span>
              <span>{otherUser?.name?.split(" ")[0] ?? "They"} is typing…</span>
            </div>
          )}
          {(() => {
            if (!otherReadAt || messages.length === 0) return null;
            const lastOwn = [...messages]
              .reverse()
              .find((m) => m.senderId === user?.id);
            if (!lastOwn) return null;
            if (new Date(otherReadAt) < new Date(lastOwn.createdAt)) return null;
            if (messages[messages.length - 1]?.senderId !== user?.id)
              return null;
            return (
              <p className="pr-2 text-right text-[11px] text-secondary-400">
                Read {formatRelativeTime(otherReadAt)}
              </p>
            );
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pending attachments tray */}
      {pendingAttachments.length > 0 && (
        <div className="border-t bg-secondary-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-secondary-700">
              {pendingAttachments.length}{" "}
              {pendingAttachments.length === 1 ? "file" : "files"} ready
            </p>
            <button
              type="button"
              onClick={clearPendingAttachments}
              disabled={sendingAttachments}
              className="text-xs text-secondary-500 hover:text-secondary-700 disabled:opacity-50"
            >
              Cancel all
            </button>
          </div>
          <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
            {pendingAttachments.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-secondary-200 bg-white p-2"
              >
                {item.isImage && item.previewUrl ? (
                  <Image
                    src={item.previewUrl}
                    alt={item.file.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-secondary-500">
                    <FileText className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-sm font-medium text-secondary-900">
                      {item.file.name}
                    </p>
                    <p className="shrink-0 text-xs text-secondary-500">
                      {formatBytes(item.file.size)}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={item.caption}
                    onChange={(e) => updateCaption(item.id, e.target.value)}
                    placeholder="Add a caption (optional)"
                    disabled={sendingAttachments}
                    maxLength={500}
                    className="mt-1 w-full rounded-md border border-secondary-200 bg-secondary-50 px-2 py-1 text-sm text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePendingAttachment(item.id)}
                  disabled={sendingAttachments}
                  aria-label={`Remove ${item.file.name}`}
                  className="shrink-0 rounded-md p-1 text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700 disabled:opacity-50"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendingAttachments}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Add more
            </Button>
            <Button
              type="button"
              onClick={() => void sendPendingAttachments()}
              isLoading={sendingAttachments}
              disabled={sendingAttachments}
            >
              <Send className="mr-2 h-4 w-4" />
              Send {pendingAttachments.length === 1 ? "file" : "all"}
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      {isRecording ? (
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => stopRecording(true)}
            aria-label="Cancel recording"
          >
            <Trash2 className="h-5 w-5 text-error-600" />
          </Button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-error-50 px-4 py-2 text-error-700">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error-500" />
            <span className="text-sm font-medium">Recording…</span>
            <span className="ml-auto font-mono text-sm tabular-nums">
              {formatRecordTime(recordSeconds)} /{" "}
              {formatRecordTime(MAX_RECORD_SECONDS)}
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={() => stopRecording(false)}
            aria-label="Stop and send"
            className="rounded-full"
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-3 border-t px-4 py-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={FILE_ACCEPT_ATTR}
            onChange={handleFileAttach}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendingAttachments || sendingVoice}
            aria-label="Attach file"
            className="shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <AutoGrowTextarea
            value={messageText}
            onValueChange={handleTypingChange}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline. Same on desktop +
              // mobile — mobile keyboards expose Shift via long-press on most
              // platforms, and many users prefer Enter-to-send.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage(
                  e as unknown as React.FormEvent<HTMLFormElement>,
                );
              }
            }}
            placeholder={
              sendingVoice
                ? "Sending voice note…"
                : "Type a message... (Shift+Enter for new line)"
            }
            disabled={sendingVoice}
            maxHeight={140}
            className="flex-1 rounded-2xl border border-secondary-300 bg-secondary-50 px-4 py-2 text-secondary-900 placeholder:text-secondary-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
          />
          {messageText.trim() ? (
            <Button
              type="submit"
              size="icon"
              disabled={isSending}
              aria-label="Send message"
              className="shrink-0 rounded-full"
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={startRecording}
              disabled={sendingVoice || sendingAttachments}
              aria-label="Record voice note"
              className="shrink-0 rounded-full"
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </form>
      )}

      {/* Drop overlay — pointer-events-none so the parent's drop handler still fires */}
      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-primary-500 bg-primary-500/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary-700">
            <UploadCloud className="h-10 w-10" />
            <p className="text-sm font-medium">Drop to attach</p>
            <p className="text-xs text-primary-600/80">
              Images, PDF, or Word · up to 10 MB each
            </p>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-secondary-900">
              Delete this message?
            </h3>
            <p className="mt-2 text-sm text-secondary-600">
              The other person will see &ldquo;This message was deleted.&rdquo;
              You can&apos;t undo this.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId === confirmDeleteId}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void performDelete(confirmDeleteId)}
                isLoading={deletingId === confirmDeleteId}
                className="bg-error-600 hover:bg-error-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
