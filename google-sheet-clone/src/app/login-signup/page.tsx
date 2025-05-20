"use client"

import { useState } from "react"
import { login, signup } from "./action"
import { Mail, Lock, LogIn, UserPlus, Loader2, User } from "lucide-react"
import Image from "next/image"

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setError("")
    try {
      if (isLogin) {
        await login(formData)
      } else {
        await signup(formData)
      }
    } catch (error) {
      console.error('Auth error:', error)
      setError(error instanceof Error ? error.message : "Authentication failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden px-2 w-full">
      {/* Logo Space with the specified warm beige color */}
      <div className="bg-[rgb(253,248,246)] p-6 flex justify-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-md">
          <Image 
            src="/permit-logo.png" 
            alt="Company Logo" 
            width={80} 
            height={80}
            priority
          />
        </div>
      </div>
      
      <div className="p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          {isLogin ? "Welcome Back" : "Create An Account"}
        </h2>
        <form className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          {!isLogin && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-700 block">
                Full Name
              </label>
              <div className="relative">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500 pl-10"
                  placeholder="John Doe"
                  disabled={isLoading}
                />
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700 block">
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500 pl-10"
                placeholder="you@example.com"
                disabled={isLoading}
              />
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-gray-700 block">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500 pl-10"
                placeholder="••••••••"
                disabled={isLoading}
              />
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              formAction={handleSubmit}
              disabled={isLoading}
              className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:bg-amber-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  <span>{isLogin ? "Logging in..." : "Signing up..."}</span>
                </>
              ) : (
                <>
                  {isLogin ? (
                    <>
                      <LogIn className="mr-2" size={18} />
                      <span>Log in</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2" size={18} />
                      <span>Sign up</span>
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          disabled={isLoading}
          className="text-sm text-amber-600 hover:text-amber-500 disabled:text-amber-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  )
}