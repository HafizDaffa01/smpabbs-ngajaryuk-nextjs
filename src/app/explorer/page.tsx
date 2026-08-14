import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'File Explorer - NgajarYuk',
  description: 'Kelola file uploads',
}

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/unauthorized')
  }

  const params = await searchParams
  const currentPath = params.path || ''

  // List files in the current path
  const { data: files } = await supabase.storage.from('uploads').list(currentPath, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-zinc-900">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              File Explorer
            </h1>
            <a
              href="/admin"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← Kembali
            </a>
          </div>

          {/* Breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-sm">
            <a href="/explorer" className="text-blue-600 hover:underline dark:text-blue-400">
              Root
            </a>
            {currentPath && (
              <>
                {currentPath.split('/').map((part, index, array) => (
                  <>
                    <span key={index} className="text-zinc-400">/</span>
                    <a
                      href={`/explorer?path=${array.slice(0, index + 1).join('/')}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {part}
                    </a>
                  </>
                ))}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="mb-6 flex flex-wrap gap-2">
            <form action="/explorer?path={currentPath}" method="GET" className="flex gap-2">
              <input type="hidden" name="path" value={currentPath} />
              <input
                type="text"
                name="newFolder"
                placeholder="Nama folder baru"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                formAction="/explorer/folder"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Buat Folder
              </button>
            </form>

            <form action={`/explorer?path=${currentPath}`} method="GET" encType="multipart/form-data" className="flex gap-2">
              <input type="hidden" name="path" value={currentPath} />
              <input
                type="file"
                name="file"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                type="submit"
                formAction="/explorer/upload"
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Upload
              </button>
            </form>
          </div>

          {/* Files List */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-zinc-300 dark:border-zinc-700">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800">
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Nama
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-left text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Tipe
                  </th>
                  <th className="border border-zinc-300 px-4 py-2 text-right text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {files?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="border border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                      Folder kosong
                    </td>
                  </tr>
                )}
                {files?.map((file) => (
                  <tr key={file.name} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {file.id ? '📁 ' : '📄 '}
                      {file.name}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
                      {file.id ? 'Folder' : 'File'}
                    </td>
                    <td className="border border-zinc-300 px-4 py-2 text-right dark:border-zinc-700">
                      <div className="flex justify-end gap-2">
                        {file.id && (
                          <a
                            href={`/explorer?path=${currentPath ? `${currentPath}/${file.name}` : file.name}`}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                          >
                            Buka
                          </a>
                        )}
                        {!file.id && (
                          <a
                            href={`/explorer/rename?path=${currentPath ? `${currentPath}/${file.name}` : file.name}`}
                            className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-yellow-700"
                          >
                            Rename
                          </a>
                        )}
                        <form
                          action={`/explorer/delete-${file.id ? 'folder' : 'file'}?path=${currentPath ? `${currentPath}/${file.name}` : file.name}`}
                          method="POST"
                          onSubmit={(e) => {
                            if (!confirm('Apakah Anda yakin ingin menghapus ini?')) {
                              e.preventDefault()
                            }
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                          >
                            Hapus
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
