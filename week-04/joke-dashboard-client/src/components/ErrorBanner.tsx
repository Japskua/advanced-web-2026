type Props = {
  message: string;
};

export default function ErrorBanner({ message }: Readonly<Props>) {
  // role="alert" makes screen readers announce the message when it appears.
  return (
    <div className="card error" role="alert">
      <strong>Error:</strong> {message}
    </div>
  );
}
