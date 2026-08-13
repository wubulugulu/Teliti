'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, FileText, ScanLine, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const errParam = searchParams.get('error')
    if (errParam) setError(errParam)
  }, [searchParams])

  const resetFeedback = () => {
    setError(null)
    setMessage(null)
  }

  const validateSignUp = (): string | null => {
    if (fullName.trim().length < 2) return 'Nama lengkap wajib diisi.'
    if (!email.includes('@')) return 'Email tidak valid.'
    if (password.length < 8) return 'Password minimal 8 karakter.'
    if (password !== confirmPassword) return 'Konfirmasi password tidak cocok.'
    if (!agreedToTerms) return 'Kamu harus menyetujui Syarat Ketentuan dan Kebijakan Privasi.'
    return null
  }

  const handleEmailSubmit = async () => {
    resetFeedback()

    if (isSignUp) {
      const validationError = validateSignUp()
      if (validationError) {
        setError(validationError)
        return
      }

      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
          data: { full_name: fullName.trim() },
        },
      })

      if (error) {
        setError(error.message)
      } else {
        setMessage('Cek email kamu untuk konfirmasi akun!')
        setFullName('')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setAgreedToTerms(false)
      }
      setLoading(false)
      return
    }

    if (!email.includes('@')) {
      setError('Email tidak valid.')
      return
    }
    if (password.length === 0) {
      setError('Password wajib diisi.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      location.href = '/analyze'
    }
  }

  const handleGoogle = async () => {
    resetFeedback()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) setError(error.message)
  }

  const toggleMode = () => {
    resetFeedback()
    setIsSignUp(prev => !prev)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen bg-[#f0fdfa] flex flex-col">
      <nav className="w-full px-6 py-5 md:px-12">
        <Link href="/" className="inline-flex items-center gap-2 text-[#0b1c30]">
          <ScanLine className="text-teal-600" strokeWidth={1.75} size={26} />
          <span className="text-xl font-bold">Teliti</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 pb-12 md:px-12">
        <div className="w-full max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="hidden md:flex flex-col gap-6">
            <h1 className="text-5xl font-bold text-[#0b1c30] leading-tight">
              Klaritas Melalui
              <br />
              Kecerdasan
            </h1>
            <p className="text-[#6d7a77] text-base leading-relaxed max-w-md">
              Setiap dokumen akademik dan profesional berhak ditulis dengan integritas. Teliti
              membantu kamu menemukan bias dan inkonsistensi sebelum orang lain yang
              menemukannya.
            </p>

            <div className="mt-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 p-10 aspect-square max-w-md flex items-center justify-center">
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="w-40 h-52 bg-white rounded-xl shadow-xl border border-[#e5eeff] rotate-[-8deg] flex flex-col gap-2 p-4">
                  <FileText className="text-teal-600 mb-2" strokeWidth={1.75} size={24} />
                  <div className="h-2 w-full bg-[#e5eeff] rounded-full" />
                  <div className="h-2 w-4/5 bg-teal-100 rounded-full" />
                  <div className="h-2 w-full bg-teal-200 rounded-full" />
                  <div className="h-2 w-3/5 bg-teal-100 rounded-full" />
                  <div className="h-2 w-full bg-[#e5eeff] rounded-full" />
                  <div className="h-2 w-4/5 bg-[#e5eeff] rounded-full" />
                </div>
                <Sparkles
                  className="absolute top-2 right-8 text-teal-400"
                  strokeWidth={1.75}
                  size={28}
                />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-sm border border-white/60 rounded-2xl p-8 md:p-10 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-[#0b1c30] mb-2">
              {isSignUp ? 'Buat Akun' : 'Masuk ke Teliti'}
            </h2>
            <p className="text-[#6d7a77] text-sm mb-6">
              {isSignUp ? 'Mulai gunakan analisis dokumen AI hari ini.' : 'Lanjutkan analisis dokumenmu.'}
            </p>

            {error && (
              <p className="text-red-500 text-sm mb-4 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-teal-700 text-sm mb-4 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
                {message}
              </p>
            )}

            <div className="flex flex-col gap-4 mb-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-[#0b1c30] mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full bg-[#f4f7fc] border border-[#e5eeff] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#0b1c30] mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="nama@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#f4f7fc] border border-[#e5eeff] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0b1c30] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignUp ? 'Minimal 8 karakter' : 'Masukkan password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[#f4f7fc] border border-[#e5eeff] rounded-xl px-4 py-2.5 pr-11 text-sm outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d7a77]"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} strokeWidth={1.75} />
                    ) : (
                      <Eye size={18} strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-[#0b1c30] mb-1.5">
                    Konfirmasi Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ulangi password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#f4f7fc] border border-[#e5eeff] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-teal-400"
                  />
                </div>
              )}

              {isSignUp && (
                <label className="flex items-start gap-2 text-xs text-[#6d7a77] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 accent-teal-600"
                  />
                  <span>
                    Saya setuju dengan{' '}
                    <span className="text-teal-600 font-medium">Syarat Ketentuan</span> dan{' '}
                    <span className="text-teal-600 font-medium">Kebijakan Privasi</span> Teliti.
                  </span>
                </label>
              )}

              <button
                onClick={handleEmailSubmit}
                disabled={loading}
                className="bg-teal-600 text-white rounded-full py-2.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : isSignUp ? 'Daftar Sekarang' : 'Masuk'}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-[#e5eeff]" />
              <span className="text-xs text-[#6d7a77]">atau</span>
              <div className="flex-1 h-px bg-[#e5eeff]" />
            </div>

            <button
              onClick={handleGoogle}
              className="w-full border border-[#e5eeff] rounded-full py-2.5 text-sm font-medium text-[#0b1c30] hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Lanjutkan dengan Google
            </button>

            <p className="text-center text-xs text-[#6d7a77] mt-6">
              {isSignUp ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
              <button onClick={toggleMode} className="text-teal-600 font-medium">
                {isSignUp ? 'Masuk' : 'Daftar'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}