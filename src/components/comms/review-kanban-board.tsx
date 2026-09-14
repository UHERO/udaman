"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import {
  REVIEW_BOARD_STATUSES,
  REVIEW_BOARD_STATUS_LABELS,
  type ReviewBoardStatus,
} from "@catalog/models/approval-review";
import type { ReviewMessageJSON } from "@catalog/models/review-message";
import {
  CheckCircle2,
  GripVertical,
  Maximize2,
  Minimize2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import {
  getReviewMessages,
  sendReviewMessage,
  setReviewBoardStatus,
} from "@/actions/approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Author-driven kanban board: one card per review, dragged between status
 * columns by the parent approval's author to signal reviewer progress.
 * Independent of the reviewer's own attested checkbox/notes (ReviewTable).
 *
 * Read-only for anyone who isn't allowed to move a given card — cards render
 * without drag handles in that case.
 */
export function ReviewKanbanBoard({
  reviews,
  approvals,
  canDrag,
  currentUserId,
  showComm = false,
}: {
  reviews: ApprovalReviewJSON[];
  /** Parent approval per review, keyed by approvalId — only needed when showComm. */
  approvals?: Record<number, ApprovalJSON>;
  canDrag: (review: ApprovalReviewJSON) => boolean;
  currentUserId: number;
  /** Show the parent comm's name/link on each card (cross-comm board). */
  showComm?: boolean;
}) {
  const router = useRouter();
  const dndId = useId();
  const [cards, setCards] = useState(reviews);
  useEffect(() => setCards(reviews), [reviews]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const reviewId = Number(active.id);
    const status = over.id as ReviewBoardStatus;
    const review = cards.find((r) => r.id === reviewId);
    if (!review || review.boardStatus === status || !canDrag(review)) return;

    const previous = cards;
    setCards((cs) =>
      cs.map((r) => (r.id === reviewId ? { ...r, boardStatus: status } : r)),
    );
    setReviewBoardStatus(reviewId, status)
      .then(() => router.refresh())
      .catch((err) => {
        setCards(previous);
        toast.error(err instanceof Error ? err.message : "Update failed");
      });
  }

  const activeCard = activeId ? cards.find((r) => r.id === activeId) : null;

  if (!cards.length) {
    return (
      <p className="text-muted-foreground py-2 text-sm">No reviews yet.</p>
    );
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REVIEW_BOARD_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            cards={cards.filter((r) => r.boardStatus === status)}
            approvals={approvals}
            canDrag={canDrag}
            currentUserId={currentUserId}
            showComm={showComm}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <ReviewCard
            review={activeCard}
            approval={approvals?.[activeCard.approvalId]}
            draggable={false}
            currentUserId={currentUserId}
            showComm={showComm}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  cards,
  approvals,
  canDrag,
  currentUserId,
  showComm,
}: {
  status: ReviewBoardStatus;
  cards: ApprovalReviewJSON[];
  approvals?: Record<number, ApprovalJSON>;
  canDrag: (review: ApprovalReviewJSON) => boolean;
  currentUserId: number;
  showComm: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex min-h-24 flex-col gap-2 rounded-md border border-dashed p-2 transition-colors",
        isOver && "border-primary bg-muted/70",
      )}
    >
      <div className="text-muted-foreground flex items-center justify-between px-1 text-xs font-medium tracking-wide uppercase">
        {REVIEW_BOARD_STATUS_LABELS[status]}
        <span className="tabular-nums">{cards.length}</span>
      </div>
      {cards.map((review) => (
        <DraggableCard
          key={review.id}
          review={review}
          approval={approvals?.[review.approvalId]}
          draggable={canDrag(review)}
          currentUserId={currentUserId}
          showComm={showComm}
        />
      ))}
    </div>
  );
}

function DraggableCard({
  review,
  approval,
  draggable,
  currentUserId,
  showComm,
}: {
  review: ApprovalReviewJSON;
  approval?: ApprovalJSON;
  draggable: boolean;
  currentUserId: number;
  showComm: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: review.id,
    disabled: !draggable,
  });

  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <ReviewCard
        review={review}
        approval={approval}
        draggable={draggable}
        currentUserId={currentUserId}
        showComm={showComm}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

function ReviewCard({
  review,
  approval,
  draggable,
  currentUserId,
  showComm,
  dragAttributes,
  dragListeners,
}: {
  review: ApprovalReviewJSON;
  approval?: ApprovalJSON;
  draggable: boolean;
  currentUserId: number;
  showComm: boolean;
  dragAttributes?: ReturnType<typeof useDraggable>["attributes"];
  dragListeners?: ReturnType<typeof useDraggable>["listeners"];
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const isOwn = review.reviewerUserId === currentUserId;
  const canMessage =
    isOwn || (!!approval && approval.authorUserId === currentUserId);

  return (
    <>
      <div
        className="bg-background hover:bg-muted/40 w-full max-w-full cursor-pointer space-y-1.5 overflow-hidden rounded-md border p-2 text-left text-sm shadow-sm"
        onClick={() => setDetailsOpen(true)}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-medium">
            {review.reviewer}
            {isOwn && (
              <span className="text-muted-foreground text-xs"> (you)</span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {review.attested && (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            {draggable && (
              <span
                role="button"
                aria-label="Drag to move"
                className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
                {...dragAttributes}
                {...dragListeners}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0" />
              </span>
            )}
          </div>
        </div>
        {showComm && approval && (
          <Link
            href={`/comms/pub-form/${approval.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground block truncate text-xs hover:underline"
          >
            {approval.name}
          </Link>
        )}
        {review.notes && (
          <p className="text-muted-foreground line-clamp-2 overflow-hidden text-xs wrap-break-word">
            {review.notes}
          </p>
        )}
        {approval?.targetReleaseDate && showComm && (
          <Badge variant="outline" className="text-[10px]">
            Target {approval.targetReleaseDate}
          </Badge>
        )}
      </div>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setMaximized(false);
        }}
      >
        <DialogContent
          className={cn(
            "flex flex-col",
            maximized
              ? "h-[calc(100%-2rem)] max-h-none w-[calc(100%-2rem)] max-w-none sm:max-w-none"
              : "max-h-[calc(100%-2rem)] sm:max-w-xl md:max-w-2xl",
          )}
        >
          <button
            type="button"
            onClick={() => setMaximized((v) => !v)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-4 right-11 cursor-pointer rounded-xs p-0.5 transition-colors"
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            <span className="sr-only">
              {maximized ? "Restore" : "Maximize"}
            </span>
          </button>
          <DialogHeader>
            <DialogTitle>
              {review.reviewer}
              {isOwn && (
                <span className="text-muted-foreground text-xs font-normal">
                  {" "}
                  (you)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto text-sm">
            {showComm && approval && (
              <Link
                href={`/comms/pub-form/${approval.id}`}
                className="text-muted-foreground block hover:underline"
              >
                {approval.name}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {REVIEW_BOARD_STATUS_LABELS[review.boardStatus]}
              </Badge>
              {review.attested && (
                <Badge
                  variant="outline"
                  className="gap-1 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Attested
                </Badge>
              )}
              {approval?.targetReleaseDate && showComm && (
                <Badge variant="outline">
                  Target {approval.targetReleaseDate}
                </Badge>
              )}
            </div>
            <div>
              <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                Notes
              </div>
              {review.notes ? (
                <p className="whitespace-pre-wrap">{review.notes}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  No notes yet.
                </p>
              )}
            </div>
            {canMessage && (
              <ReviewMessageThread
                reviewId={review.id}
                open={detailsOpen}
                currentUserId={currentUserId}
                maximized={maximized}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Clarification thread for one review. Loaded lazily when the modal opens
 * (not on every card render) since most cards' threads are never viewed.
 * Posting emails the other party (author <-> reviewer) via the server action.
 */
function ReviewMessageThread({
  reviewId,
  open,
  currentUserId,
  maximized,
}: {
  reviewId: number;
  open: boolean;
  currentUserId: number;
  maximized: boolean;
}) {
  const [messages, setMessages] = useState<ReviewMessageJSON[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMessages(null);
    getReviewMessages(reviewId)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load messages",
          );
          setMessages([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, reviewId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const result = await sendReviewMessage(reviewId, body);
      setMessages((prev) => [...(prev ?? []), result.data]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col border-t pt-3",
        maximized && "min-h-0 flex-1",
      )}
    >
      <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        Messages
      </div>
      <div
        className={cn(
          "scrollbar-thin bg-muted/20 flex flex-col gap-2.5 overflow-y-auto rounded-md p-3",
          maximized ? "min-h-0 flex-1" : "max-h-72",
        )}
      >
        {messages === null && (
          <p className="text-muted-foreground text-xs">Loading…</p>
        )}
        {messages?.length === 0 && (
          <p className="text-muted-foreground text-xs italic">
            No messages yet.
          </p>
        )}
        {messages?.map((m) => {
          const isMine = m.senderUserId === currentUserId;
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                isMine && "flex-row-reverse",
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                  isMine ? "bg-ublue" : "bg-upurple",
                )}
                title={m.sender}
              >
                {initials(m.sender)}
              </div>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-xs shadow-sm",
                  isMine
                    ? "bg-ublue rounded-br-sm text-white"
                    : "bg-upurple/15 rounded-bl-sm",
                )}
              >
                <p className="wrap-break-word whitespace-pre-wrap">
                  {m.body}
                </p>
                {m.createdAt && (
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      isMine ? "text-white/70" : "text-muted-foreground",
                    )}
                  >
                    {new Date(m.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask for clarification…"
          className="min-h-16 text-sm"
          disabled={sending}
        />
        <Button
          size="icon"
          className="shrink-0 cursor-pointer"
          disabled={sending || !draft.trim()}
          onClick={() => void handleSend()}
          title="Send and email"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * First letters of up to two words, for the chat thread's avatar bubble.
 * Senders are often stored as an email (no display name on file), so an
 * "@" cuts off the domain before splitting into words.
 */
function initials(name: string): string {
  const base = name.trim().split("@")[0];
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
