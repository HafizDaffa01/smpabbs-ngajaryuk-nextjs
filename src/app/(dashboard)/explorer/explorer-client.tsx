'use client'

import { useState } from 'react'
import { FileText, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FeedbackBanner } from '@/components/ui/feedback-banner'

export type ExplorerEntry = {
  name: string
  id: string | null
}

type ExplorerClientProps = {
  files: ExplorerEntry[] | null
  /** Error string from the same `list` query, or `null` on success. */
  error: string | null
  currentPath: string
}

type PendingDelete = {
  name: string
  isFolder: boolean
  action: string
  path: string
}

function entryPath(currentPath: string, name: string) {
  return currentPath ? `${currentPath}/${name}` : name
}

/**
 * The interactive half of `/explorer`. The page (an async Server Component)
 * keeps the auth + storage-query boundary and hands over plain data only.
 *
 * Delete is still a real `<form method="POST">` aimed at
 * `/explorer/delete-file` / `/explorer/delete-folder` with the path in the query
 * string — exactly as the markup it replaced — but the `window.confirm()` gate
 * is now a `Dialog`, so the destructive action is announced, styled and
 * dismissible instead of being a native modal outside the design system.
 */
export default function ExplorerClient({ files, error, currentPath }: ExplorerClientProps) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (error) {
    return (
      <FeedbackBanner tone="error">
        Daftar file tidak dapat dimuat: {error}
      </FeedbackBanner>
    )
  }

  if (!files || files.length === 0) {
    return (
      <EmptyState
        title="Folder kosong"
        description={
          currentPath
            ? `Belum ada file di /${currentPath}.`
            : 'Belum ada file yang diunggah.'
        }
      />
    )
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((file) => {
          const isFolder = Boolean(file.id)
          const path = entryPath(currentPath, file.name)
          const TileIcon = isFolder ? Folder : FileText

          return (
            <li
              key={file.name}
              className="flex min-w-0 flex-col gap-3 rounded-md border border-border-subtle bg-surface-card p-3 shadow-xs transition-[border-color,box-shadow] duration-150 ease-out hover:border-border-strong hover:shadow-sm"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className={
                    isFolder
                      ? 'flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-text'
                      : 'flex size-10 shrink-0 items-center justify-center rounded-md bg-info-bg text-info-text'
                  }
                >
                  <TileIcon className="size-5" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p
                    title={file.name}
                    className="break-all text-sm font-semibold text-text-primary"
                  >
                    {file.name}
                  </p>
                  <Badge variant={isFolder ? 'accent' : 'info'} className="self-start">
                    {isFolder ? 'Folder' : 'File'}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
                {isFolder ? (
                  <ButtonLink
                    href={`/explorer?path=${path}`}
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                  >
                    <FolderOpen aria-hidden className="size-4" />
                    Buka
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    href={`/explorer/rename?path=${path}`}
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                  >
                    <Pencil aria-hidden className="size-4" />
                    Rename
                  </ButtonLink>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  aria-label={`Hapus ${file.name}`}
                  onClick={() =>
                    setPendingDelete({
                      name: file.name,
                      isFolder,
                      action: `/explorer/delete-${isFolder ? 'folder' : 'file'}?path=${path}`,
                      path,
                    })
                  }
                >
                  <Trash2 aria-hidden className="size-4" />
                  Hapus
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setPendingDelete(null)
        }}
        size="sm"
        title={pendingDelete?.isFolder ? 'Hapus folder' : 'Hapus file'}
        description={
          pendingDelete?.isFolder
            ? 'Folder beserta seluruh isinya akan dihapus permanen dari storage.'
            : 'File akan dihapus permanen dari storage.'
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="explorer-delete-form"
              loading={submitting}
              loadingText="Menghapus..."
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Apakah Anda yakin ingin menghapus ini?
        </p>

        {pendingDelete ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold break-all text-text-primary">
            {pendingDelete.isFolder ? (
              <Folder aria-hidden className="size-4 shrink-0 text-accent-text" />
            ) : (
              <FileText aria-hidden className="size-4 shrink-0 text-info-text" />
            )}
            {pendingDelete.name}
          </p>
        ) : null}

        {pendingDelete ? (
          <form
            id="explorer-delete-form"
            method="POST"
            action={pendingDelete.action}
            onSubmit={() => setSubmitting(true)}
            className="mt-3"
          >
            <input type="hidden" name="path" value={pendingDelete.path} />
          </form>
        ) : null}
      </Dialog>
    </>
  )
}