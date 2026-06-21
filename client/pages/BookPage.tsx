import React from 'react';

export default function BookPage({ bookId }: { bookId: string }): React.ReactElement {
  return <div data-testid="book-page">Book {bookId}</div>;
}
