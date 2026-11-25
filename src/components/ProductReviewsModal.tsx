import { FormEvent, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { CheckCircle2, Pencil, Star, Trash2, X } from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
} from '../firebase';
import { DropProduct, OrderRecord, ProductReview, UserRole } from '../types';

interface ProductReviewsModalProps {
  drop: DropProduct | null;
  reviews: ProductReview[];
  orders: OrderRecord[];
  user: User | null;
  userRole: UserRole;
  onClose: () => void;
}

function formatReviewDate(ts: unknown): string {
  if (!ts) return 'Just now';
  let dateObj: Date | null = null;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    dateObj = (ts as { toDate: () => Date }).toDate();
  } else if (ts instanceof Date) {
    dateObj = ts;
  } else if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
  }
  if (!dateObj) return 'Recently';
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ProductReviewsModal({
  drop,
  reviews,
  orders,
  user,
  userRole,
  onClose,
}: ProductReviewsModalProps) {
  const [rating, setRating] = useState(5);
  const [djHandle, setDjHandle] = useState(user?.displayName || '');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setEditingReviewId(null);
    setConfirmDeleteId(null);
    setNotice('');
    setErrorMsg('');
    setTitle('');
    setComment('');
    setRating(5);
    setDjHandle(user?.displayName || '');
  }, [drop?.id, user?.uid, user?.displayName]);

  const dropReviews = useMemo(() => {
    if (!drop) return [];
    return reviews.filter((r) => r.dropId === drop.id);
  }, [drop, reviews]);

  const stats = useMemo(() => {
    if (dropReviews.length === 0) {
      return { avg: 0, count: 0 };
    }
    const total = dropReviews.reduce((s, r) => s + r.rating, 0);
    return {
      avg: Number((total / dropReviews.length).toFixed(1)),
      count: dropReviews.length,
    };
  }, [dropReviews]);

  const matchingPurchaseOrder = useMemo(() => {
    if (!drop || !user) return null;
    return (
      orders.find(
        (o) =>
          o.buyerUid === user.uid &&
          o.items.some((item) => item.dropId === drop.id)
      ) || null
    );
  }, [drop, orders, user]);

  if (!drop) return null;

  const isAdmin = userRole === 'admin';

  const resetForm = () => {
    setRating(5);
    setTitle('');
    setComment('');
    setEditingReviewId(null);
    setDjHandle(user?.displayName || '');
  };

  const handleStartEdit = (rev: ProductReview) => {
    setErrorMsg('');
    setNotice('');
    setEditingReviewId(rev.id);
    setRating(rev.rating);
    setDjHandle(rev.djHandle);
    setTitle(rev.title);
    setComment(rev.comment);
  };

  const handleSubmitReview = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');

    let activeUser = user;
    if (!activeUser) {
      try {
        const cred = await signInWithGoogle();
        activeUser = cred.user;
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Sign-in cancelled.');
        return;
      }
    }
    if (!activeUser) return;

    const cleanTitle = title.trim().slice(0, 120);
    const cleanComment = comment.trim().slice(0, 1000);
    const cleanHandle = (djHandle.trim() || activeUser.displayName || 'DJ Listener').slice(0, 80);
    const cleanAuthorName = (activeUser.displayName || cleanHandle).slice(0, 80);

    if (cleanTitle.length < 2) {
      setErrorMsg('Please enter a review headline (at least 2 characters).');
      return;
    }
    if (cleanComment.length < 5) {
      setErrorMsg('Please write at least 5 characters in your review.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingReviewId) {
        await updateDoc(doc(db, 'reviews', editingReviewId), {
          authorName: cleanAuthorName,
          djHandle: cleanHandle,
          rating: Math.max(1, Math.min(5, Math.round(rating))),
          title: cleanTitle,
          comment: cleanComment,
          updatedAt: serverTimestamp(),
        });
        setNotice('Your review has been updated.');
      } else {
        const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const hasVerifiedOrder = Boolean(matchingPurchaseOrder);
        await setDoc(doc(db, 'reviews', reviewId), {
          id: reviewId,
          dropId: drop.id,
          dropTitle: drop.title.slice(0, 120),
          authorUid: activeUser.uid,
          authorName: cleanAuthorName,
          djHandle: cleanHandle,
          rating: Math.max(1, Math.min(5, Math.round(rating))),
          title: cleanTitle,
          comment: cleanComment,
          verifiedBuyer: hasVerifiedOrder,
          orderId: hasVerifiedOrder && matchingPurchaseOrder ? matchingPurchaseOrder.id : '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setNotice('Thank you! Your review is now live on the catalog.');
      }
      resetForm();
    } catch (err) {
      handleFirestoreError(
        err,
        editingReviewId ? OperationType.UPDATE : OperationType.CREATE,
        editingReviewId ? `reviews/${editingReviewId}` : 'reviews'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    setErrorMsg('');
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      setConfirmDeleteId(null);
      if (editingReviewId === reviewId) resetForm();
      setNotice('Review removed.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${reviewId}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#12151C] border border-zinc-800 rounded-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono text-amber-400">
              {drop.genre} · {drop.bpm} BPM · Voice: {drop.voiceTalent}
            </div>
            <h2 className="text-lg font-bold text-zinc-100 truncate mt-0.5">
              Customer Reviews — {drop.title}
            </h2>
            <div className="flex items-center gap-2.5 mt-1 text-xs text-zinc-400">
              <div className="flex items-center gap-1 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= Math.round(stats.avg)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-zinc-600'
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono tabular-nums text-zinc-200">
                {stats.count > 0 ? `${stats.avg.toFixed(1)} / 5.0` : 'No ratings yet'}
              </span>
              <span className="text-zinc-500">
                ({stats.count} review{stats.count === 1 ? '' : 's'})
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close product reviews"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {notice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Write / Edit Review Form */}
          <form
            onSubmit={handleSubmitReview}
            className="bg-[#0B0D11] border border-zinc-800 rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">
                {editingReviewId ? 'Edit Your Review' : 'Leave a Customer Review'}
              </h3>
              {matchingPurchaseOrder && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Buyer
                </span>
              )}
            </div>

            {!user ? (
              <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                <p className="text-xs text-zinc-400">
                  Sign in with Google to rate this DJ drop and share feedback with other DJs.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In to Review
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="block text-xs text-zinc-400 mb-1.5">Your Rating</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          aria-label={`Rate ${star} out of 5 stars`}
                          className="p-1 rounded hover:bg-zinc-800 transition-colors"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-zinc-600'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-xs font-mono text-zinc-300 tabular-nums">
                        {rating}/5
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-zinc-400 mb-1">
                      DJ / Station Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={djHandle}
                      onChange={(e) => setDjHandle(e.target.value)}
                      placeholder="e.g. DJ Kairo Live"
                      className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Review Headline
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Punchy club opener with clean 24-bit headroom"
                    className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Your Experience
                  </label>
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share how this drop sounds on club/radio systems and how smooth the licensing & download process was..."
                    className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {editingReviewId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-md transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                  >
                    {submitting
                      ? 'Publishing...'
                      : editingReviewId
                      ? 'Save Updated Review'
                      : 'Submit Review'}
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Existing Reviews List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-100">
              Verified &amp; Community Feedback ({dropReviews.length})
            </h3>
            {dropReviews.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 bg-[#0B0D11] border border-zinc-800 rounded-lg">
                No reviews yet for this drop. Be the first DJ to rate it!
              </div>
            ) : (
              <div className="space-y-3">
                {dropReviews.map((rev) => {
                  const canEdit = Boolean(user && rev.authorUid === user.uid);
                  const canDelete = Boolean(user && (rev.authorUid === user.uid || isAdmin));
                  return (
                    <div
                      key={rev.id}
                      className="p-4 bg-[#0B0D11] border border-zinc-800 rounded-lg space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    s <= rev.rating
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-zinc-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-semibold text-zinc-100">
                              {rev.title}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            <span className="font-medium text-zinc-300">
                              {rev.djHandle}
                            </span>
                            {rev.verifiedBuyer && (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Verified Buyer
                              </span>
                            )}
                            <span className="text-zinc-600">·</span>
                            <span className="font-mono text-zinc-500">
                              {formatReviewDate(rev.updatedAt || rev.createdAt)}
                            </span>
                          </div>
                        </div>

                        {(canEdit || canDelete) && (
                          <div className="flex items-center gap-1.5">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(rev)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                            )}
                            {canDelete &&
                              (confirmDeleteId === rev.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReview(rev.id)}
                                    className="px-2.5 py-1 bg-red-500 hover:bg-red-400 text-zinc-950 font-semibold text-xs rounded"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(rev.id)}
                                  aria-label="Delete review"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-300 text-xs rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                        {rev.comment}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
