export type StatusVariant = "info" | "success" | "error";

type Props = {
  message: string;
  variant?: StatusVariant;
};

export default function StatusBanner({ message, variant = "info" }: Readonly<Props>) {
  if (!message) return null;

  // Errors interrupt screen readers (role="alert"); other messages wait politely.
  return (
    <div className={`status status-${variant}`} role={variant === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}
