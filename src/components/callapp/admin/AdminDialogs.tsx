'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

/* =========================================================================
 *  ConfirmDialog
 *  A small wrapper around shadcn <AlertDialog> for yes/no confirmations.
 *  Mirrors the styling used in ChatActions.tsx (max-w-[350px] rounded-2xl).
 * ======================================================================= */

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void | Promise<void>
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const destructive = variant === 'destructive'
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (loading) return; onOpenChange(o) }}>
      <AlertDialogContent className="max-w-[350px] rounded-2xl border-cline bg-white p-5">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-[15.5px] font-extrabold text-cink">
            {destructive && (
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-[#FCE4E1] text-cred">
                <AlertTriangle size={17} />
              </span>
            )}
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-[12.5px] leading-5 text-cmut">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-1 flex-row gap-2">
          <AlertDialogCancel
            disabled={loading}
            className="h-10 rounded-[12px] border-cline bg-white px-4 text-[13px] font-bold text-cink hover:bg-cbg"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`h-10 rounded-[12px] px-4 text-[13px] font-bold text-white disabled:opacity-60 ${
              destructive
                ? 'bg-cred hover:bg-cred/90 focus-visible:ring-cred/40'
                : 'bg-cbrand hover:bg-cbrand/90 focus-visible:ring-cbrand/40'
            }`}
            disabled={loading}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
          >
            {loading && <Loader2 size={14} className="mr-1.5 inline animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* =========================================================================
 *  Bottom-sheet-on-mobile / centered-card-on-desktop shell.
 *  Shared by InputDialog and FormDialog — keeps the styling consistent.
 *  Returns null when closed so the inner form state is reset on next open
 *  through natural mount/unmount, avoiding setState-in-effect anti-patterns.
 * ======================================================================= */

function SheetShell({
  onClose,
  title,
  description,
  children,
  loading,
}: {
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  loading: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, loading])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        className="w-full bg-white shadow-2xl sm:max-w-md sm:rounded-[24px] rounded-t-[28px] p-5 pb-[max(env(safe-area-inset-bottom),20px)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-cline sm:hidden" />
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-extrabold leading-6 text-cink">{title}</h3>
            {description && (
              <p className="mt-1 text-[12.5px] leading-5 text-cmut">{description}</p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

/* =========================================================================
 *  InputDialog
 *  Single text/number input with optional validate(), label, error message.
 *  The body is split out so its useState initialiser re-runs every time the
 *  dialog opens (the outer InputDialog only renders the body when `open`).
 * ======================================================================= */

interface InputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  variant?: 'default' | 'destructive'
  onConfirm: (value: string) => void | Promise<void>
  loading?: boolean
  validate?: (value: string) => string | null
}

export function InputDialog(props: InputDialogProps) {
  if (!props.open) return null
  return <InputDialogBody {...props} />
}

function InputDialogBody({
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = '',
  confirmLabel = 'Save',
  variant = 'default',
  onConfirm,
  loading = false,
  validate,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus the field once the sheet mounts so admins can type immediately.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [])

  const close = () => { if (!loading) onOpenChange(false) }

  const submit = () => {
    const err = validate?.(value) ?? null
    if (err) { setError(err); return }
    void onConfirm(value)
  }

  const destructive = variant === 'destructive'

  return (
    <SheetShell open onClose={close} title={title} description={description} loading={loading}>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">{label}</span>
        <input
          ref={inputRef}
          className={`app-input w-full ${error ? '!border-cred' : ''}`}
          placeholder={placeholder}
          value={value}
          disabled={loading}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
      </label>
      {error && <p className="mt-1.5 text-[12px] font-semibold text-cred">{error}</p>}
      <div className="mt-4 flex flex-row gap-2">
        <button
          type="button"
          className="flex-1 rounded-[14px] border border-cline bg-white px-4 py-3 text-[14px] font-bold text-cink transition hover:bg-cbg disabled:opacity-50"
          onClick={close}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`flex flex-1 items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[14px] font-extrabold text-white transition disabled:opacity-60 ${
            destructive ? 'bg-cred hover:brightness-110' : 'bg-cbrand hover:brightness-110'
          }`}
          onClick={submit}
          disabled={loading}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </SheetShell>
  )
}

/* =========================================================================
 *  FormDialog
 *  Multiple text/number fields for creating gifts, ad packages, users.
 * ======================================================================= */

export interface FormField {
  key: string
  label: string
  placeholder?: string
  defaultValue?: string
  type?: 'text' | 'number'
  required?: boolean
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: FormField[]
  confirmLabel?: string
  onConfirm: (values: Record<string, string>) => void | Promise<void>
  loading?: boolean
}

export function FormDialog(props: FormDialogProps) {
  if (!props.open) return null
  return <FormDialogBody {...props} />
}

function FormDialogBody({
  onOpenChange,
  title,
  description,
  fields,
  confirmLabel = 'Save',
  onConfirm,
  loading = false,
}: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? '']))
  )
  const [error, setError] = useState<string | null>(null)

  const close = () => { if (!loading) onOpenChange(false) }

  const submit = () => {
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`${f.label} is required`)
        return
      }
    }
    void onConfirm(values)
  }

  return (
    <SheetShell open onClose={close} title={title} description={description} loading={loading}>
      <div className="mt-3 space-y-3">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-[#4A5568]">
              {f.label}{f.required && <span className="ml-0.5 text-cred">*</span>}
            </span>
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              className="app-input w-full"
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              disabled={loading}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-[12px] font-semibold text-cred">{error}</p>}
      <div className="mt-4 flex flex-row gap-2">
        <button
          type="button"
          className="flex-1 rounded-[14px] border border-cline bg-white px-4 py-3 text-[14px] font-bold text-cink transition hover:bg-cbg disabled:opacity-50"
          onClick={close}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-cbrand px-4 py-3 text-[14px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
          onClick={submit}
          disabled={loading}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </SheetShell>
  )
}
