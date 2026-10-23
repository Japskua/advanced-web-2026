import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  title: string;
  subtitle?: string;
  maxWidth?: "sm" | "md";
  children: ReactNode;
};

// The centred card used by the login, register and onboarding pages.
// `max-w-xl` is at most 36rem (576px) wide, `max-w-3xl` 48rem (768px).
export function AuthPageLayout({ title, subtitle, maxWidth = "sm", children }: Readonly<Props>) {
  return (
    <div className="flex min-h-screen items-center py-8">
      <div className={`mx-auto w-full px-4 ${maxWidth === "md" ? "max-w-3xl" : "max-w-xl"}`}>
        <Card className="shadow-md">
          <CardHeader className="text-center">
            <CardTitle>
              <h1 className="text-2xl">{title}</h1>
            </CardTitle>
            {subtitle && <CardDescription className="text-base">{subtitle}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
