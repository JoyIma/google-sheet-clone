import { Mail } from "lucide-react"

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">Verify Your Account</h1>
        <div className="flex flex-col items-center space-y-4">
          <Mail className="h-16 w-16 text-blue-500" />
          <p className="text-center text-lg text-gray-700">Go check your mail and verify your account.</p>
        </div>
      </div>
    </div>
  )
}

