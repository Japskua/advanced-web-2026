import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, type Language } from "../i18n";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      {/* htmlFor/id ties the Label to the select's trigger button, so screen
          readers announce the select as "Language". */}
      <Label htmlFor="language">{t("language")}</Label>
      <Select
        value={i18n.resolvedLanguage ?? "en"}
        // changeLanguage re-renders every component that uses useTranslation().
        onValueChange={(language) => void i18n.changeLanguage(language)}
      >
        <SelectTrigger id="language" className="w-36">
          {/* Shows the text of the selected item. */}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(LANGUAGES) as [Language, string][]).map(([code, name]) => (
            // lang={code}: each language name is announced in its own language.
            <SelectItem key={code} value={code} lang={code}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
