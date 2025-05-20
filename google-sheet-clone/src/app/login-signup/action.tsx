'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/spreadSheet')
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
                full_name: name // Store the name in the user metadata
            }
        }
    })

    if (error) {
        console.error("Signup error:", error);
        redirect('/error')
    }

    // If user is created successfully, update the profiles table
    if (userData?.user) {
        // You might want to create a profile record in a separate table
        const { error: profileError } = await supabase
            .from('profiles') // Assuming you have a profiles table
            .upsert({
                id: userData.user.id,
                full_name: name,
                email: email,
                updated_at: new Date().toISOString()
            })

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // Continue anyway, as the auth account was created
        }
    }

    // After filling the form, the user will be redirected to the verification page
    redirect('/verify')
}


