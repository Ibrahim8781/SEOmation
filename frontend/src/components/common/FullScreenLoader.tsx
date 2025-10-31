import './fullScreenLoader.css';

export function FullScreenLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="fullscreen-loader">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}
