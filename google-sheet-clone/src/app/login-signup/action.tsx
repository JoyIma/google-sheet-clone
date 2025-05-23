'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error('Login error:', error)
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/Dashboard')
}





export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  // First sign up the user
  const { error, data: userData } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  })

  if (error) {
    console.error("Signup error:", error);
    redirect('/error')
  }

  // If user is created successfully, update the profiles table
  if (userData?.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userData.user.id,
        full_name: name,
        email: email,
        updated_at: new Date().toISOString()
      })

    if (profileError) {
      console.error("Profile creation error:", profileError);
    }

    // Sync user to Permit.io after successful signup
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/permit/sync-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            id: userData.user.id,
            email: userData.user.email,
            name: name
          }
          // Note: No role parameter - just syncing the user
        }),
      })
    } catch (syncError) {
      console.warn('Failed to sync user to Permit.io on signup:', syncError)
      // Continue with signup flow even if sync fails
    }
  }

  redirect('/verify')
}