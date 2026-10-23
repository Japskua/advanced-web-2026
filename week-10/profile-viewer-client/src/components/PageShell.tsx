import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import LanguageSwitcher from "./LanguageSwitcher";

// The frame shared by both pages: the language switcher and a centred card.
// `max-w-xl` keeps the column at most 36rem wide, `mx-auto` centres it, and
// `gap-6` puts 1.5rem between the switcher and the card.
export default function PageShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-16">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <Card>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
