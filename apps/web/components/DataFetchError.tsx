export function DataFetchError({ message }: { message: string }) {
  return (
    <div className="error-state">
      Unable to load data from the database: {message}
      <br />
      Check DATABASE_URL and that Postgres is reachable (see README &quot;Desenvolvimento local&quot;).
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}
