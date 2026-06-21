import type { Book } from './collections';

// Who is allowed to READ a book.
//   - the owner can always read their own book
//   - a public book is readable by anyone (even logged-out visitors)
//   - a "specific" book is readable only by the users listed in sharedWith
export function canReadBook(
  book: Pick<Book, 'ownerId' | 'sharing'>,
  userId: string | null,
): boolean {
  if (userId && book.ownerId === userId) return true;
  if (book.sharing.visibility === 'public') return true;
  if (book.sharing.visibility === 'specific' && userId) {
    return book.sharing.sharedWith.includes(userId);
  }
  return false;
}

// Throws unless the given user owns the book. Used to guard writes/deletes.
export function assertOwner(book: Pick<Book, 'ownerId'>, userId: string): void {
  if (book.ownerId !== userId) throw new Error('Forbidden');
}
