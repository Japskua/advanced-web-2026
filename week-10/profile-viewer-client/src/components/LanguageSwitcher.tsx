import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "../i18n";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <InputLabel id="language-label">{t("language")}</InputLabel>
      <Select
        labelId="language-label"
        label={t("language")}
        value={i18n.resolvedLanguage ?? "en"}
        // changeLanguage re-renders every component that uses useTranslation().
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {(Object.entries(LANGUAGES) as [Language, string][]).map(([code, name]) => (
          // lang={code}: each language name is announced in its own language.
          <MenuItem key={code} value={code} lang={code}>
            {name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
