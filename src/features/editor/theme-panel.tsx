'use client';

import { RotateCcw } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Label } from '@/components/ui/label';
import { auditThemeContrast } from '@/features/themes/contrast';
import {
  BACKGROUND_STYLES,
  BUTTON_STYLES,
  CARD_STYLES,
  DENSITY_LEVELS,
  DIVIDER_STYLES,
  FONT_PAIRS,
  ICON_STYLES,
  MOTION_LEVELS,
  RADIUS_SCALES,
  SHADOW_SCALES,
  TYPE_SCALES,
  type ThemeTokens,
} from '@/features/themes/tokens';
import { useTranslations } from '@/i18n/client';

import { FieldGroup, SelectField } from './fields/basic';
import { useEditorActions, useEditorDocument } from './store';

/**
 * Uređivanje teme pozivnice (zahtev 3.10 i 3.11).
 *
 * Skup vrednosti je zatvoren - korisnik bira iz ponuđenog, a ne unosi
 * proizvoljan CSS. Boje su jedino slobodno polje, pa uz njih ide provera
 * kontrasta koja se osvežava pri svakoj izmeni: pozivnica sme da bude bilo
 * kakva, ali ne sme da bude nečitljiva.
 */
const PALETTE_KEYS = [
  'background',
  'surface',
  'text',
  'textMuted',
  'accent',
  'accentContrast',
  'border',
] as const;

export function ThemePanel({ templateTheme }: { templateTheme: ThemeTokens | null }) {
  const t = useTranslations();
  const document = useEditorDocument();
  const actions = useEditorActions();
  const theme = document.theme;

  const issues = auditThemeContrast(theme.palette);

  const setToken = <K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) => {
    actions.setTheme({ ...theme, [key]: value });
  };

  const option = (group: string, value: string) => ({
    value,
    label: t.dynamic(`editor.theme.options.${group}.${value}`),
  });

  return (
    <div className="space-y-5">
      <FieldGroup title={t('editor.theme.paletteTitle')}>
        <div className="space-y-2">
          {PALETTE_KEYS.map((key) => (
            <ColorRow
              key={key}
              label={t.dynamic(`editor.theme.${key}`)}
              hexLabel={t('editor.theme.hexLabel', {
                name: t.dynamic(`editor.theme.${key}`),
              })}
              value={theme.palette[key]}
              onChange={(value) =>
                actions.setTheme({
                  ...theme,
                  palette: { ...theme.palette, [key]: value },
                })
              }
            />
          ))}
        </div>

        {/*
          Upozorenje se ne krije iza „naprednih podešavanja": ako je pozivnica
          nečitljiva, to je prvo što korisnik treba da vidi (zahtev 31).
        */}
        {issues.length > 0 ? (
          <Alert tone="warning" title={t('editor.theme.contrastTitle')}>
            <ul className="list-disc space-y-1 pl-4">
              {issues.map((issue) => (
                <li key={issue.pair}>
                  {t('editor.theme.contrastIssue', {
                    pair: t.dynamic(`editor.theme.pairs.${issue.pair}`),
                    ratio: issue.ratio.toFixed(2),
                    required: issue.required,
                  })}
                </li>
              ))}
            </ul>
            <p className="mt-2">{t('editor.theme.contrastHelp')}</p>
          </Alert>
        ) : (
          <p className="text-xs text-success" role="status">
            {t('editor.theme.contrastOk')}
          </p>
        )}
      </FieldGroup>

      <FieldGroup title={t('editor.theme.typographyTitle')}>
        <SelectField
          label={t('editor.theme.fontPair')}
          value={theme.fontPair}
          options={FONT_PAIRS.map((value) => option('fontPair', value))}
          onChange={(value) => setToken('fontPair', value as ThemeTokens['fontPair'])}
        />
        <SelectField
          label={t('editor.theme.typeScale')}
          value={theme.typeScale}
          options={TYPE_SCALES.map((value) => option('typeScale', value))}
          onChange={(value) => setToken('typeScale', value as ThemeTokens['typeScale'])}
        />
      </FieldGroup>

      <FieldGroup title={t('editor.theme.layoutTitle')}>
        <SelectField
          label={t('editor.theme.density')}
          value={theme.density}
          options={DENSITY_LEVELS.map((value) => option('density', value))}
          onChange={(value) => setToken('density', value as ThemeTokens['density'])}
        />
        <SelectField
          label={t('editor.theme.radius')}
          value={theme.radius}
          options={RADIUS_SCALES.map((value) => option('radius', value))}
          onChange={(value) => setToken('radius', value as ThemeTokens['radius'])}
        />
        <SelectField
          label={t('editor.theme.shadow')}
          value={theme.shadow}
          options={SHADOW_SCALES.map((value) => option('shadow', value))}
          onChange={(value) => setToken('shadow', value as ThemeTokens['shadow'])}
        />
        <SelectField
          label={t('editor.theme.buttonStyle')}
          value={theme.buttonStyle}
          options={BUTTON_STYLES.map((value) => option('buttonStyle', value))}
          onChange={(value) =>
            setToken('buttonStyle', value as ThemeTokens['buttonStyle'])
          }
        />
        <SelectField
          label={t('editor.theme.cardStyle')}
          value={theme.cardStyle}
          options={CARD_STYLES.map((value) => option('cardStyle', value))}
          onChange={(value) => setToken('cardStyle', value as ThemeTokens['cardStyle'])}
        />
        <SelectField
          label={t('editor.theme.dividerStyle')}
          value={theme.dividerStyle}
          options={DIVIDER_STYLES.map((value) => option('dividerStyle', value))}
          onChange={(value) =>
            setToken('dividerStyle', value as ThemeTokens['dividerStyle'])
          }
        />
        <SelectField
          label={t('editor.theme.backgroundStyle')}
          value={theme.backgroundStyle}
          options={BACKGROUND_STYLES.map((value) => option('backgroundStyle', value))}
          onChange={(value) =>
            setToken('backgroundStyle', value as ThemeTokens['backgroundStyle'])
          }
        />
      </FieldGroup>

      <FieldGroup title={t('editor.theme.motionTitle')}>
        <SelectField
          label={t('editor.theme.motion')}
          value={theme.motion}
          options={MOTION_LEVELS.map((value) => option('motion', value))}
          onChange={(value) => setToken('motion', value as ThemeTokens['motion'])}
        />
        <SelectField
          label={t('editor.theme.iconStyle')}
          value={theme.iconStyle}
          options={ICON_STYLES.map((value) => option('iconStyle', value))}
          onChange={(value) => setToken('iconStyle', value as ThemeTokens['iconStyle'])}
        />
      </FieldGroup>

      {templateTheme ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => actions.setTheme(templateTheme)}
        >
          <RotateCcw aria-hidden />
          {t('editor.theme.reset')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Jedan par „biralo boje + heks vrednost".
 *
 * Uz biralo stoji i tekstualno polje jer korisnici često imaju tačan heks iz
 * dizajna ili sa poziva; sistemsko biralo bi ih teralo da ga traže mišem.
 *
 * Dve kontrole menjaju istu vrednost, ali **ne smeju** da imaju isti pristupačni
 * naziv - čitač ekrana bi tada čitao „Tekst, Tekst" bez ijedne naznake koja je
 * koja.
 */
function ColorRow({
  label,
  hexLabel,
  value,
  onChange,
}: {
  label: string;
  hexLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';

  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="color"
        value={hex}
        onChange={(event) => onChange(event.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-[var(--radius-xs)] border border-border bg-surface p-0.5"
      />
      <Label htmlFor={id} className="flex-1 text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <input
        type="text"
        value={value}
        aria-label={hexLabel}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value.trim())}
        className="h-9 w-28 rounded-[var(--radius-xs)] border border-input bg-surface px-2 font-mono text-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
      />
    </div>
  );
}
