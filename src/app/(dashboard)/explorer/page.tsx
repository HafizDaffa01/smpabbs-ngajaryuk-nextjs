import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft, FolderPlus, UploadCloud } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { Button, ButtonLink } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import ExplorerClient, { type ExplorerEntry } from './explorer-client'

export const metadata = {
  title: 'File Explorer',
  description: 'Kelola file uploads',
}

export const dynamic = 'force-dynamic'

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/unauthorized')
  }

  const params = await searchParams
  const currentPath = params.path || ''

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="File Explorer"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'File Explorer' }]}
        description="Jelajahi, unggah, dan hapus berkas pada bucket storage uploads."
        actions={
          <ButtonLink href="/admin" variant="secondary">
            <ArrowLeft aria-hidden className="size-4" />
            Kembali
          </ButtonLink>
        }
      />

      <StorageActions currentPath={currentPath} />

      <Suspense fallback={<ExplorerSkeleton />}>
        <FileBrowser currentPath={currentPath} />
      </Suspense>
    </div>
  )
}

/**
 * Streamed separately from the page body so the storage round-trip renders a
 * skeleton instead of blocking the header and the upload forms. Auth still
 * happens first, in the page, so the boundary is unchanged.
 */
async function FileBrowser({ currentPath }: { currentPath: string }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: files, error } = await supabase.storage.from('uploads').list(currentPath, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Isi folder</CardTitle>
          <CardDescription>
            Maksimal 100 entri per folder, diurutkan berdasarkan nama.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <PathBreadcrumb currentPath={currentPath} />
        <ExplorerClient
          files={files as ExplorerEntry[] | null}
          error={error ? error.message : null}
          currentPath={currentPath}
        />
      </CardContent>
    </Card>
  )
}

function PathBreadcrumb({ currentPath }: { currentPath: string }) {
  const segments = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <nav aria-label="Lokasi folder">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-text-tertiary">
        <li>
          <Link
            href="/explorer"
            aria-current={segments.length === 0 ? 'page' : undefined}
            className="rounded-sm font-medium text-accent-text transition-colors duration-150 ease-out hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Root
          </Link>
        </li>

        {segments.map((segment, index) => (
          <li key={`${segment}-${index}`} className="flex items-center gap-1">
            <span aria-hidden className="text-text-disabled">
              /
            </span>
            <Link
              href={`/explorer?path=${segments.slice(0, index + 1).join('/')}`}
              aria-current={index === segments.length - 1 ? 'page' : undefined}
              className="rounded-sm font-medium text-accent-text transition-colors duration-150 ease-out hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {segment}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Folder creation and file upload. Both forms keep their original destinations
 * and field names exactly: a `GET` form whose submit button overrides the
 * action to `/explorer/folder`, and a `GET` + `multipart/form-data` form whose
 * button overrides to `/explorer/upload`. Only the markup is tokenised.
 */
function StorageActions({ currentPath }: { currentPath: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Unggah &amp; folder</CardTitle>
          <CardDescription>
            Buat folder baru di <code className="text-text-primary">/{currentPath}</code> atau
            unggah berkas ke lokasi ini.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <form action={`/explorer?path=${currentPath}`} method="GET" className="flex flex-col gap-3">
          <input type="hidden" name="path" value={currentPath} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newFolder">
              Nama folder baru
              <span aria-hidden className="text-danger-text">
                *
              </span>
            </Label>
            <Input
              id="newFolder"
              name="newFolder"
              type="text"
              required
              placeholder="contoh: foto-guru"
            />
          </div>

          <Button type="submit" formAction="/explorer/folder" className="self-start">
            <FolderPlus aria-hidden className="size-4" />
            Buat Folder
          </Button>
        </form>

        <form
          action={`/explorer?path=${currentPath}`}
          method="GET"
          encType="multipart/form-data"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="path" value={currentPath} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="file">
              Pilih berkas
              <span aria-hidden className="text-danger-text">
                *
              </span>
            </Label>
            <input
              id="file"
              name="file"
              type="file"
              required
              className="focus-ring block w-full cursor-pointer rounded-sm border border-border-default bg-surface-card text-sm text-text-secondary file:mr-3 file:cursor-pointer file:border-0 file:bg-surface-sunken file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-text-primary hover:border-border-strong"
            />
          </div>

          <Button type="submit" formAction="/explorer/upload" className="self-start">
            <UploadCloud aria-hidden className="size-4" />
            Upload
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function ExplorerSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Isi folder</CardTitle>
          <CardDescription>
            <Skeleton className="mt-1 h-3 w-64" />
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <p role="status" className="sr-only">
          Memuat daftar file…
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-card p-3"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-md" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-16" />
                </div>
              </div>
              <div className="flex gap-2 border-t border-border-subtle pt-3">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
