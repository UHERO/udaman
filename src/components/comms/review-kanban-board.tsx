"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovalJSON } from "@catalog/models/approval";
import type { ApprovalReviewJSON } from "@catalog/models/approval-review";
import {
  REVIEW_BOARD_STATUS_LABELS,
  REVIEW_BOARD_STATUSES,
  type ReviewBoardStatus,
} from "@catalog/models/approval-review";
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
import {
  CheckCircle2,
  GripVertical,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteReview,
  setReviewBoardStatus,
  submitReview,
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
  addReview,
  notStartedExtra,
}: {
  reviews: ApprovalReviewJSON[];
  /** Parent approval per review, keyed by approvalId — only needed when showComm. */
  approvals?: Record<number, ApprovalJSON>;
  canDrag: (review: ApprovalReviewJSON) => boolean;
  currentUserId: number;
  /** Show the parent comm's name/link on each card (cross-comm board). */
  showComm?: boolean;
  /**
   * Enables the "Add review" affordance in "Not Started" for one specific
   * approval. On a cross-comm board (many approvals mixed together), pair
   * this with `notStartedExtra` to let the caller pick which approval first.
   */
  addReview?: {
    approvalId: number;
    currentUserName: string;
  };
  /** Extra content rendered in "Not Started", above the add-review card — e.g. a form picker on a cross-comm board. */
  notStartedExtra?: ReactNode;
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
  const alreadyReviewing = addReview
    ? cards.some(
        (r) =>
          r.approvalId === addReview.approvalId &&
          r.reviewerUserId === currentUserId,
      )
    : true;
  const showAddReview = !!addReview && !alreadyReviewing;

  function handleCardUpdate(updated: ApprovalReviewJSON) {
    setCards((cs) => cs.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleCardDelete(id: number) {
    setCards((cs) => cs.filter((r) => r.id !== id));
  }

  function handleReviewAdded(created: ApprovalReviewJSON) {
    setCards((cs) => [...cs, created]);
  }

  if (!cards.length && !showAddReview && !notStartedExtra) {
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
            onCardUpdate={handleCardUpdate}
            onCardDelete={handleCardDelete}
            addReview={
              showAddReview && status === "not_started" ? addReview : undefined
            }
            onReviewAdded={handleReviewAdded}
            extra={status === "not_started" ? notStartedExtra : undefined}
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
            onUpdate={handleCardUpdate}
            onDelete={handleCardDelete}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Standalone "Add review" affordance for the kanban board — same
 * button-fading-to-form flow as ReviewTable's, but for the reviewer's own
 * new card rather than a table row. Only shown to a viewer who doesn't
 * already have a review on this board (see `alreadyReviewing`).
 */
function AddReviewCard({
  approvalId,
  currentUserName,
  onAdded,
}: {
  approvalId: number;
  currentUserName: string;
  onAdded: (review: ApprovalReviewJSON) => void;
}) {
  const [phase, setPhase] = useState<"button" | "fading" | "form">("button");
  useEffect(() => {
    if (phase !== "fading") return;
    const t = setTimeout(() => setPhase("form"), 150);
    return () => clearTimeout(t);
  }, [phase]);
  const router = useRouter();
  const [attested, setAttested] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await submitReview(approvalId, { attested, notes });
      onAdded(result.data);
      setPhase("button");
      setAttested(false);
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (phase !== "form") {
    return (
      <button
        type="button"
        onClick={() => setPhase("fading")}
        disabled={phase === "fading"}
        className={cn(
          "text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-muted/40 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed p-2 text-sm transition-colors duration-150",
          phase === "fading" && "opacity-0",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Add review
      </button>
    );
  }

  return (
    <div className="animate-in fade-in bg-background space-y-2 rounded-md border p-3 text-sm duration-200">
      <div className="flex items-center justify-between">
        <span className="font-medium">{currentUserName}</span>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={saving}
          />
          Reviewed
        </label>
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        className="min-h-20 text-sm"
        disabled={saving}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={saving}
          onClick={() => setPhase("button")}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          disabled={saving}
          onClick={() => void save()}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}

/**
 * Create a new review for `approval`, in the same dialog layout as an
 * existing card's details — just without a board-status badge, withdraw
 * button, or message thread, since none of those exist until the review is
 * actually saved. Used wherever "Add review" needs to open directly rather
 * than via the inline "Not Started" card (e.g. from a table row's actions
 * menu, or after picking a form on a cross-comm board).
 */
export function NewReviewDialog({
  approval,
  currentUserName,
  onClose,
}: {
  approval: ApprovalJSON;
  currentUserName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [attested, setAttested] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await submitReview(approval.id, { attested, notes });
      toast.success(result.message);
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100%-2rem)] flex-col sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {currentUserName}
            <span className="text-muted-foreground text-xs font-normal">
              {" "}
              (you)
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto text-sm">
          <span className="text-muted-foreground">{approval.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Not Started</Badge>
            {approval.targetReleaseDate && (
              <Badge variant="outline">
                Target {approval.targetReleaseDate}
              </Badge>
            )}
          </div>
          <div>
            <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs font-medium tracking-wide uppercase">
              <span>Notes</span>
              <label className="flex items-center gap-1.5 normal-case">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  disabled={saving}
                />
                Reviewed
              </label>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 text-sm"
              disabled={saving}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer"
              disabled={saving}
              onClick={() => void save()}
            >
              {attested && <CheckCircle2 className="h-3.5 w-3.5" />}
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BoardColumn({
  status,
  cards,
  approvals,
  canDrag,
  currentUserId,
  showComm,
  onCardUpdate,
  onCardDelete,
  addReview,
  onReviewAdded,
  extra,
}: {
  status: ReviewBoardStatus;
  cards: ApprovalReviewJSON[];
  approvals?: Record<number, ApprovalJSON>;
  canDrag: (review: ApprovalReviewJSON) => boolean;
  currentUserId: number;
  showComm: boolean;
  onCardUpdate: (review: ApprovalReviewJSON) => void;
  onCardDelete: (id: number) => void;
  addReview?: { approvalId: number; currentUserName: string };
  onReviewAdded?: (review: ApprovalReviewJSON) => void;
  extra?: ReactNode;
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
          onUpdate={onCardUpdate}
          onDelete={onCardDelete}
        />
      ))}
      {addReview && onReviewAdded && (
        <AddReviewCard
          approvalId={addReview.approvalId}
          currentUserName={addReview.currentUserName}
          onAdded={onReviewAdded}
        />
      )}
      {extra}
    </div>
  );
}

function DraggableCard({
  review,
  approval,
  draggable,
  currentUserId,
  showComm,
  onUpdate,
  onDelete,
}: {
  review: ApprovalReviewJSON;
  approval?: ApprovalJSON;
  draggable: boolean;
  currentUserId: number;
  showComm: boolean;
  onUpdate: (review: ApprovalReviewJSON) => void;
  onDelete: (id: number) => void;
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
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}

function ReviewCard({
  review: initialReview,
  approval,
  draggable,
  currentUserId,
  showComm,
  dragAttributes,
  dragListeners,
  onUpdate,
  onDelete,
}: {
  review: ApprovalReviewJSON;
  approval?: ApprovalJSON;
  draggable: boolean;
  currentUserId: number;
  showComm: boolean;
  dragAttributes?: ReturnType<typeof useDraggable>["attributes"];
  dragListeners?: ReturnType<typeof useDraggable>["listeners"];
  onUpdate?: (review: ApprovalReviewJSON) => void;
  onDelete?: (id: number) => void;
}) {
  const [review, setReview] = useState(initialReview);
  useEffect(() => setReview(initialReview), [initialReview]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(review.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwn = review.reviewerUserId === currentUserId;

  function startEditingNotes() {
    setNotesDraft(review.notes ?? "");
    setEditingNotes(true);
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const result = await submitReview(review.approvalId, {
        attested: review.attested,
        notes: notesDraft,
      });
      setReview(result.data);
      onUpdate?.(result.data);
      setEditingNotes(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const result = await deleteReview(review.id);
      toast.success(result.message);
      setDetailsOpen(false);
      onDelete?.(review.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not withdraw review",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "bg-background hover:bg-muted/40 w-full max-w-full cursor-pointer space-y-1.5 overflow-hidden rounded-md border p-2 text-left text-sm shadow-sm",
          draggable && "touch-none active:cursor-grabbing",
        )}
        onClick={() => setDetailsOpen(true)}
        {...(draggable ? dragAttributes : undefined)}
        {...(draggable ? dragListeners : undefined)}
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
              <GripVertical className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
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
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {REVIEW_BOARD_STATUS_LABELS[review.boardStatus]}
                </Badge>
                {isOwn && !editingNotes && (
                  <Badge variant="outline" asChild>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="text-destructive hover:bg-destructive/10 cursor-pointer hover:border-none disabled:opacity-50"
                    >
                      Withdraw review
                    </button>
                  </Badge>
                )}
              </div>
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
              <div className="mb-1 flex items-center justify-between">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Notes
                </div>
                {isOwn && !editingNotes && (
                  <button
                    type="button"
                    onClick={startEditingNotes}
                    className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    className="min-h-24 text-sm"
                    disabled={savingNotes}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      disabled={savingNotes}
                      onClick={() => setEditingNotes(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer"
                      disabled={savingNotes}
                      onClick={() => void saveNotes()}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : review.notes ? (
                <p className="whitespace-pre-wrap">{review.notes}</p>
              ) : (
                <p className="text-muted-foreground italic">No notes yet.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
